jest.mock("../../lib/prisma", () => ({
  inboundJob: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const {
  enqueueInboundJob,
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
  MAX_ATTEMPTS,
} = require("../inbound-job.service");

const mockTx = {
  $queryRaw: jest.fn(),
  inboundJob: { update: jest.fn() },
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((cb) => cb(mockTx));
});

describe("enqueueInboundJob", () => {
  test("rechaza sin provider o providerEventId", async () => {
    await expect(
      enqueueInboundJob({ provider: "", providerEventId: "wamid.1" })
    ).rejects.toThrow("provider and providerEventId are required");
    await expect(
      enqueueInboundJob({ provider: "whatsapp", providerEventId: "" })
    ).rejects.toThrow();
  });

  test("retorna created:false si ya existe un job para ese evento", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1" });
    await expect(
      enqueueInboundJob({ provider: "whatsapp", providerEventId: "wamid.1", payload: {} })
    ).resolves.toEqual({ job: { id: "job-1" }, created: false });
    expect(prisma.inboundJob.create).not.toHaveBeenCalled();
  });

  test("crea el job si no existe uno previo", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue(null);
    prisma.inboundJob.create.mockResolvedValue({ id: "job-2" });
    await expect(
      enqueueInboundJob({ provider: "whatsapp", providerEventId: "wamid.2", payload: { a: 1 } })
    ).resolves.toEqual({ job: { id: "job-2" }, created: true });
    expect(prisma.inboundJob.create).toHaveBeenCalledWith({
      data: { provider: "whatsapp", providerEventId: "wamid.2", payload: { a: 1 } },
    });
  });

  test("en carrera (P2002) trata el job como ya existente", async () => {
    prisma.inboundJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "job-3" });
    const raceError = new Error("unique constraint");
    raceError.code = "P2002";
    prisma.inboundJob.create.mockRejectedValue(raceError);

    await expect(
      enqueueInboundJob({ provider: "whatsapp", providerEventId: "wamid.3" })
    ).resolves.toEqual({ job: { id: "job-3" }, created: false });
    expect(prisma.inboundJob.findUnique).toHaveBeenCalledTimes(2);
  });

  test("propaga cualquier otro error de prisma", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue(null);
    prisma.inboundJob.create.mockRejectedValue(new Error("db down"));
    await expect(
      enqueueInboundJob({ provider: "whatsapp", providerEventId: "wamid.4" })
    ).rejects.toThrow("db down");
  });
});

describe("claimNextInboundJob", () => {
  test("retorna null si no hay filas disponibles", async () => {
    mockTx.$queryRaw.mockResolvedValue([]);
    await expect(claimNextInboundJob()).resolves.toBeNull();
    expect(mockTx.inboundJob.update).not.toHaveBeenCalled();
  });

  test("retorna null si rows no es un array", async () => {
    mockTx.$queryRaw.mockResolvedValue(null);
    await expect(claimNextInboundJob()).resolves.toBeNull();
  });

  test("reclama la fila encontrada y la marca 'claimed'", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: "job-1" }]);
    mockTx.inboundJob.update.mockResolvedValue({ id: "job-1", status: "claimed" });

    await expect(claimNextInboundJob()).resolves.toEqual({ id: "job-1", status: "claimed" });
    expect(mockTx.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "claimed",
        claimedAt: expect.any(Date),
        attempts: { increment: 1 },
      },
    });
  });
});

describe("markInboundJobDone", () => {
  test("marca el job como done y limpia lastError", async () => {
    prisma.inboundJob.update.mockResolvedValue({ id: "job-1", status: "done" });
    await expect(markInboundJobDone("job-1")).resolves.toEqual({ id: "job-1", status: "done" });
    expect(prisma.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "done", finishedAt: expect.any(Date), lastError: null },
    });
  });
});

describe("markInboundJobFailed", () => {
  test("retorna null si el job no existe", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue(null);
    await expect(markInboundJobFailed("job-1", new Error("boom"))).resolves.toBeNull();
    expect(prisma.inboundJob.update).not.toHaveBeenCalled();
  });

  test("marca 'failed' (terminal) al alcanzar MAX_ATTEMPTS", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", attempts: MAX_ATTEMPTS });
    prisma.inboundJob.update.mockResolvedValue({ id: "job-1", status: "failed" });

    await markInboundJobFailed("job-1", new Error("boom"));
    expect(prisma.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "failed", finishedAt: expect.any(Date), lastError: "boom" },
    });
  });

  test("vuelve a 'received' (retry) si no alcanzó MAX_ATTEMPTS", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", attempts: MAX_ATTEMPTS - 1 });
    prisma.inboundJob.update.mockResolvedValue({ id: "job-1", status: "received" });

    await markInboundJobFailed("job-1", new Error("boom"));
    expect(prisma.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "received", claimedAt: null, lastError: "boom" },
    });
  });

  test("acepta un error como string plano (sin .message)", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", attempts: 0 });
    prisma.inboundJob.update.mockResolvedValue({});
    await markInboundJobFailed("job-1", "fallo plano");
    expect(prisma.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "received", claimedAt: null, lastError: "fallo plano" },
    });
  });

  test("usa '' como lastError si error es undefined", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", attempts: 0 });
    prisma.inboundJob.update.mockResolvedValue({});
    await markInboundJobFailed("job-1", undefined);
    expect(prisma.inboundJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "received", claimedAt: null, lastError: "" },
    });
  });

  test("trunca lastError a 2000 caracteres", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", attempts: 0 });
    prisma.inboundJob.update.mockResolvedValue({});
    const longMessage = "x".repeat(3000);
    await markInboundJobFailed("job-1", new Error(longMessage));
    const call = prisma.inboundJob.update.mock.calls[0][0];
    expect(call.data.lastError).toHaveLength(2000);
  });
});
