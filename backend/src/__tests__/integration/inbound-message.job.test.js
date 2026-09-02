/**
 * Entregable 8.2 (Fase 8) — D-F1: verifica que el worker reclama un job,
 * ejecuta el mismo pipeline que corría antes inline en webhook.controller.js
 * (contexts/receptionist → whatsapp.service.js, sin cambios), entrega la
 * respuesta vía Comunicación (mismo contrato que 3.1) y marca el job
 * done/failed según corresponda — heredero directo de las verificaciones
 * de webhook-receptionist-wiring.test.js antes de 8.2.
 */
jest.mock("../../contexts/receptionist", () => ({
  processIncomingMessage: jest.fn(),
}));

jest.mock("../../contexts/communication", () => ({
  sendMessage: jest.fn(),
}));

jest.mock("../../services/inbound-job.service", () => ({
  claimNextInboundJob: jest.fn(),
  markInboundJobDone: jest.fn(),
  markInboundJobFailed: jest.fn(),
}));

const { processIncomingMessage } = require("../../contexts/receptionist");
const { sendMessage } = require("../../contexts/communication");
const {
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
} = require("../../services/inbound-job.service");
const { processOneJob, drainInboundJobs } = require("../../jobs/inbound-message.job");

beforeEach(() => jest.clearAllMocks());

describe("processOneJob", () => {
  test("cola vacía: no procesa nada, retorna false", async () => {
    claimNextInboundJob.mockResolvedValue(null);

    const didWork = await processOneJob();

    expect(didWork).toBe(false);
    expect(processIncomingMessage).not.toHaveBeenCalled();
  });

  test("mensaje procesado con reply: invoca sendMessage con conversationId explícito y marca done", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-1", payload: { entry: [] } });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1", tenantId: "tenant-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage.mockResolvedValue({ message: {} });

    const didWork = await processOneJob();

    expect(didWork).toBe(true);
    expect(processIncomingMessage).toHaveBeenCalledWith({ entry: [] });
    expect(sendMessage).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      conversationId: "conv-1",
      phone: "573000000000",
      content: "hola",
      origin: "agente",
    });
    expect(markInboundJobDone).toHaveBeenCalledWith("job-1");
  });

  test("mensaje no procesado (processed:false): no invoca sendMessage, igual marca done", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-2", payload: {} });
    processIncomingMessage.mockResolvedValue({ received: true, processed: false });

    await processOneJob();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(markInboundJobDone).toHaveBeenCalledWith("job-2");
  });

  test("fallo de sendMessage no rompe el job (se marca done igual — el mensaje sí se analizó)", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-3", payload: {} });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage.mockRejectedValue(new Error("proveedor caído"));

    await processOneJob();

    expect(markInboundJobDone).toHaveBeenCalledWith("job-3");
    expect(markInboundJobFailed).not.toHaveBeenCalled();
  });

  test("fallo de processIncomingMessage marca el job como failed (para reintento)", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-4", payload: {} });
    processIncomingMessage.mockRejectedValue(new Error("OpenAI caído"));
    markInboundJobFailed.mockResolvedValue({ id: "job-4", status: "received" });

    await processOneJob();

    expect(markInboundJobDone).not.toHaveBeenCalled();
    expect(markInboundJobFailed).toHaveBeenCalledWith("job-4", expect.any(Error));
  });
});

describe("drainInboundJobs", () => {
  test("procesa jobs hasta que la cola queda vacía", async () => {
    claimNextInboundJob
      .mockResolvedValueOnce({ id: "job-a", payload: {} })
      .mockResolvedValueOnce({ id: "job-b", payload: {} })
      .mockResolvedValueOnce(null);
    processIncomingMessage.mockResolvedValue({ received: true, processed: false });

    const processed = await drainInboundJobs();

    expect(processed).toBe(2);
    expect(markInboundJobDone).toHaveBeenCalledTimes(2);
  });
});
