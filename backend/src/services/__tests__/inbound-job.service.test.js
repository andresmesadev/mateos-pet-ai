jest.mock("../../lib/prisma", () => ({
  inboundJob: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const {
  enqueueInboundJob,
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
  checkpointInboundJob,
  renewInboundJobLease,
  recoverExpiredInboundJobs,
  InboundLeaseLostError,
  LEASE_MS,
  MAX_ATTEMPTS,
} = require("../inbound-job.service");

const mockTx = {
  $queryRaw: jest.fn(),
  inboundJob: { update: jest.fn() },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((cb) => cb(mockTx));
  prisma.inboundJob.updateMany.mockResolvedValue({ count: 1 });
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
        leaseExpiresAt: expect.any(Date),
        attempts: { increment: 1 },
      },
    });
  });
});

describe("markInboundJobDone", () => {
  test("marca el job como done y limpia lastError", async () => {
    await expect(markInboundJobDone({ id: "job-1", attempts: 1, phase: "complete" })).resolves.toMatchObject({ id: "job-1", status: "done" });
    expect(prisma.inboundJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", attempts: 1, status: "claimed", leaseExpiresAt: { gt: expect.any(Date) } },
      data: { status: "done", finishedAt: expect.any(Date), lastError: null, leaseExpiresAt: null },
    });
  });
});

describe("markInboundJobFailed", () => {
  test("un fallo antes de efectos programa el próximo intento en el futuro", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-delay", status: "claimed", attempts: 1, phase: "pending" });
    const before = Date.now();
    await markInboundJobFailed({ id: "job-delay", attempts: 1 }, new Error("db temporarily unavailable"));
    expect(prisma.inboundJob.updateMany.mock.calls[0][0].data.nextAttemptAt?.getTime()).toBeGreaterThanOrEqual(before + 5000);
  });
  test("retorna null si el job no existe", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue(null);
    await expect(markInboundJobFailed({ id: "job-1", attempts: 1 }, new Error("boom"))).resolves.toBeNull();
    expect(prisma.inboundJob.updateMany).not.toHaveBeenCalled();
  });

  test("marca 'failed' (terminal) al alcanzar MAX_ATTEMPTS", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", status: "claimed", phase: "pending", attempts: MAX_ATTEMPTS });

    await markInboundJobFailed({ id: "job-1", attempts: MAX_ATTEMPTS }, new Error("boom"));
    expect(prisma.inboundJob.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "job-1", attempts: MAX_ATTEMPTS }),
      data: { status: "failed", finishedAt: expect.any(Date), lastError: "boom", leaseExpiresAt: null },
    });
  });

  test("vuelve a 'received' (retry) si no alcanzó MAX_ATTEMPTS", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", status: "claimed", phase: "pending", attempts: MAX_ATTEMPTS - 1 });

    await markInboundJobFailed({ id: "job-1", attempts: MAX_ATTEMPTS - 1 }, new Error("boom"));
    expect(prisma.inboundJob.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "job-1", attempts: MAX_ATTEMPTS - 1 }),
      data: { status: "received", claimedAt: null, lastError: "boom", leaseExpiresAt: null, finishedAt: null, nextAttemptAt: expect.any(Date) },
    });
  });

  test("acepta un error como string plano (sin .message)", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", status: "claimed", phase: "pending", attempts: 1 });
    await markInboundJobFailed({ id: "job-1", attempts: 1 }, "fallo plano");
    expect(prisma.inboundJob.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "job-1" }),
      data: expect.objectContaining({ status: "received", claimedAt: null, lastError: "fallo plano" }),
    });
  });

  test("usa '' como lastError si error es undefined", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", status: "claimed", phase: "pending", attempts: 1 });
    await markInboundJobFailed({ id: "job-1", attempts: 1 }, undefined);
    expect(prisma.inboundJob.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "job-1" }),
      data: expect.objectContaining({ status: "received", claimedAt: null, lastError: "" }),
    });
  });

  test("trunca lastError a 2000 caracteres", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "job-1", status: "claimed", phase: "pending", attempts: 1 });
    const longMessage = "x".repeat(3000);
    await markInboundJobFailed({ id: "job-1", attempts: 1 }, new Error(longMessage));
    const call = prisma.inboundJob.updateMany.mock.calls[0][0];
    expect(call.data.lastError).toHaveLength(2000);
  });
});

describe("lease and safe recovery", () => {
  test.each(["processing", "sending"])("%s incierto nunca se reencola", async (phase) => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "uncertain", status: "claimed", phase, attempts: 1 });
    const result = await markInboundJobFailed({ id: "uncertain", attempts: 1 }, new Error("interrupted"));
    expect(result.status).toBe("needs_review");
    expect(result.lastError).toContain(`UNCERTAIN_${phase}`);
  });
  test("un propietario obsoleto no modifica una reclamación posterior", async () => {
    prisma.inboundJob.findUnique.mockResolvedValue({ id: "new", status: "claimed", phase: "pending", attempts: 2 });
    expect(await markInboundJobFailed({ id: "new", attempts: 1 }, "late")).toBeNull();
    expect(prisma.inboundJob.updateMany).not.toHaveBeenCalled();
  });
  test("checkpoint y heartbeat rechazan concesiones perdidas", async () => {
    prisma.inboundJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(checkpointInboundJob({ id: "lost", attempts: 1 }, "ready")).rejects.toBeInstanceOf(InboundLeaseLostError);
    await expect(renewInboundJobLease({ id: "lost", attempts: 1 })).rejects.toBeInstanceOf(InboundLeaseLostError);
  });
  test("recuperación usa checkpoints y respeta tope de intentos", async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: "safe", phase: "ready", attempts: 1 },
      { id: "uncertain", phase: "sending", attempts: 1 },
      { id: "sent", phase: "complete", attempts: MAX_ATTEMPTS },
      { id: "exhausted", phase: "pending", attempts: MAX_ATTEMPTS },
    ]);
    const now = new Date();
    expect(await recoverExpiredInboundJobs(now)).toBe(4);
    expect(mockTx.inboundJob.update.mock.calls.map(([arg]) => arg.data.status)).toEqual(["received", "needs_review", "done", "failed"]);
    expect(mockTx.inboundJob.update.mock.calls[0][0].data.nextAttemptAt.getTime()).toBe(now.getTime() + 5000);
  });
  test("heartbeat renueva por una concesión completa", async () => {
    const before = Date.now();
    const result = await renewInboundJobLease({ id: "active", attempts: 1 });
    expect(result.leaseExpiresAt.getTime()).toBeGreaterThanOrEqual(before + LEASE_MS);
  });
});
