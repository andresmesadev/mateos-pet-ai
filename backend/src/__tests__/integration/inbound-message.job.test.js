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

jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

jest.mock("../../services/inbound-job.service", () => ({
  claimNextInboundJob: jest.fn(),
  markInboundJobDone: jest.fn(),
  markInboundJobFailed: jest.fn(),
  checkpointInboundJob: jest.fn(),
  renewInboundJobLease: jest.fn(),
  recoverExpiredInboundJobs: jest.fn(),
  getNextInboundAttemptAt: jest.fn(),
  InboundLeaseLostError: class InboundLeaseLostError extends Error {},
  HEARTBEAT_MS: 20_000,
}));

const { processIncomingMessage } = require("../../contexts/receptionist");
const { sendMessage } = require("../../contexts/communication");
const cron = require("node-cron");
const {
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
  checkpointInboundJob,
  renewInboundJobLease,
  recoverExpiredInboundJobs,
  getNextInboundAttemptAt,
  InboundLeaseLostError,
} = require("../../services/inbound-job.service");
const { startInboundMessageJob, processOneJob, drainInboundJobs } = require("../../jobs/inbound-message.job");

beforeEach(() => {
  jest.resetAllMocks();
  checkpointInboundJob.mockImplementation(async (job, phase, data) => ({ ...job, phase, ...data }));
  renewInboundJobLease.mockResolvedValue({});
  recoverExpiredInboundJobs.mockResolvedValue(0);
  getNextInboundAttemptAt.mockResolvedValue(null);
  markInboundJobFailed.mockResolvedValue({ status: "needs_review" });
});
afterEach(() => jest.useRealTimers());

describe("startInboundMessageJob", () => {
  test("drena al iniciar y agrupa el barrido en la ventana activa de cada cuarto de hora", async () => {
    claimNextInboundJob.mockResolvedValue(null);

    startInboundMessageJob();
    await new Promise(setImmediate);

    expect(cron.schedule).toHaveBeenCalledWith("30 */15 * * * *", expect.any(Function));
    expect(recoverExpiredInboundJobs).toHaveBeenCalledTimes(1);
    expect(claimNextInboundJob).toHaveBeenCalledTimes(1);
  });
});

describe("processOneJob", () => {
  test("recuperar respuestas preparadas no vuelve a ejecutar el motor", async () => {
    claimNextInboundJob.mockResolvedValue({
      id: "job-resume", payload: {}, phase: "ready", attempts: 2,
      replies: [{ tenantId: "tenant-1", userId: "user-1", conversationId: "conv-1", phone: "573000000000", content: "respuesta guardada", origin: "agente" }],
      replyCursor: 0,
    });
    processIncomingMessage.mockResolvedValue({ processed: false });
    sendMessage.mockResolvedValue({ message: {} });
    await processOneJob();
    expect(processIncomingMessage).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: "respuesta guardada" }));
  });
  test("cola vacía: no procesa nada, retorna false", async () => {
    claimNextInboundJob.mockResolvedValue(null);

    const didWork = await processOneJob();

    expect(didWork).toBe(false);
    expect(processIncomingMessage).not.toHaveBeenCalled();
  });

  test("mensaje procesado con reply: invoca sendMessage con conversationId explícito y marca done", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-1", phase: "pending", attempts: 1, payload: { entry: [] } });
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
    expect(markInboundJobDone).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1", phase: "complete", replyCursor: 1 }));
  });

  test("mensaje no procesado (processed:false): no invoca sendMessage, igual marca done", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-2", phase: "pending", payload: {} });
    processIncomingMessage.mockResolvedValue({ received: true, processed: false });

    await processOneJob();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(markInboundJobDone).toHaveBeenCalledWith(expect.objectContaining({ id: "job-2", phase: "complete" }));
  });

  test("fallo persistente de envío conserva 3 intentos pero no certifica done", async () => {
    jest.useFakeTimers();
    claimNextInboundJob.mockResolvedValue({ id: "job-3", phase: "pending", payload: {} });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage.mockRejectedValue(new Error("proveedor caído"));

    const promise = processOneJob();
    await jest.advanceTimersByTimeAsync(3500);
    await promise;

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(markInboundJobDone).not.toHaveBeenCalled();
    expect(markInboundJobFailed).toHaveBeenCalledWith(expect.objectContaining({ id: "job-3", phase: "sending" }), expect.any(Error));
    jest.useRealTimers();
  });

  test("Entregable 8.4 (D-F6): falla transitoria (2 intentos) y el 3ro entrega la respuesta", async () => {
    jest.useFakeTimers();
    claimNextInboundJob.mockResolvedValue({ id: "job-3b", phase: "pending", payload: {} });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1", tenantId: "tenant-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ message: {} });

    const promise = processOneJob();
    await jest.advanceTimersByTimeAsync(3500);
    await promise;

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(markInboundJobDone).toHaveBeenCalledWith(expect.objectContaining({ id: "job-3b", phase: "complete" }));
    jest.useRealTimers();
  });

  test("mejora post-Fase 8 (2026-09-08): additionalReplies (batch de Meta) se envían antes que la respuesta principal, en orden", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-batch", phase: "pending", payload: {} });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "segunda respuesta",
      user: { id: "user-2", tenantId: "tenant-1" },
      conversation: { id: "conv-2" },
      additionalReplies: [
        {
          from: "573000000000",
          reply: "primera respuesta",
          user: { id: "user-1", tenantId: "tenant-1" },
          conversation: { id: "conv-1" },
        },
      ],
    });
    sendMessage.mockResolvedValue({ message: {} });

    await processOneJob();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      conversationId: "conv-1",
      content: "primera respuesta",
    });
    expect(sendMessage.mock.calls[1][0]).toMatchObject({
      conversationId: "conv-2",
      content: "segunda respuesta",
    });
  });

  test("additionalReplies sin usuario resuelto se omite sin bloquear el resto", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-batch-2", phase: "pending", payload: {} });
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "respuesta principal",
      user: { id: "user-1", tenantId: "tenant-1" },
      conversation: { id: "conv-1" },
      additionalReplies: [
        { from: "573000000000", reply: "sin usuario", user: null, conversation: null },
      ],
    });
    sendMessage.mockResolvedValue({ message: {} });

    await processOneJob();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toMatchObject({ content: "respuesta principal" });
  });

  test("excepción del motor conserva la fase incierta para revisión, sin reenviar", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "job-4", phase: "pending", payload: {} });
    processIncomingMessage.mockRejectedValue(new Error("OpenAI caído"));
    markInboundJobFailed.mockResolvedValue({ id: "job-4", status: "received" });

    await processOneJob();

    expect(markInboundJobDone).not.toHaveBeenCalled();
    expect(markInboundJobFailed).toHaveBeenCalledWith(expect.objectContaining({ id: "job-4", phase: "processing" }), expect.any(Error));
  });
});

describe("drainInboundJobs", () => {
  test("ticks solapados comparten el drenado sin reclamar dos veces", async () => {
    let finishRecovery;
    recoverExpiredInboundJobs.mockImplementation(() => new Promise(resolve => { finishRecovery = resolve; }));
    claimNextInboundJob.mockResolvedValue(null);
    const first = drainInboundJobs();
    const second = drainInboundJobs();
    expect(first).toBe(second);
    expect(recoverExpiredInboundJobs).toHaveBeenCalledTimes(1);
    finishRecovery(0);
    await first;
    expect(claimNextInboundJob).toHaveBeenCalledTimes(1);
  });
  test("procesa jobs hasta que la cola queda vacía", async () => {
    claimNextInboundJob
      .mockResolvedValueOnce({ id: "job-a", phase: "pending", payload: {} })
      .mockResolvedValueOnce({ id: "job-b", phase: "pending", payload: {} })
      .mockResolvedValueOnce(null);
    processIncomingMessage.mockResolvedValue({ received: true, processed: false });

    const processed = await drainInboundJobs();

    expect(processed).toBe(2);
    expect(markInboundJobDone).toHaveBeenCalledTimes(2);
  });
});

describe("checkpoint interruption boundaries", () => {
  const reply = { phone: "573000000000", userId: "user-1", content: "saved", origin: "agente" };
  test("cursor recuperado omite respuestas ya confirmadas", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "cursor", phase: "ready", replies: [{ ...reply, content: "already sent" }, reply], replyCursor: 1 });
    await processOneJob();
    expect(processIncomingMessage).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(reply);
  });
  test("complete se finaliza sin volver a enviar ni procesar", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "complete", phase: "complete" });
    await processOneJob();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(processIncomingMessage).not.toHaveBeenCalled();
    expect(markInboundJobDone).toHaveBeenCalledTimes(1);
  });
  test("fallo al guardar processing impide ejecutar el motor", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "before-engine", phase: "pending", payload: {} });
    checkpointInboundJob.mockRejectedValue(new Error("DB unavailable"));
    await processOneJob();
    expect(processIncomingMessage).not.toHaveBeenCalled();
    expect(markInboundJobFailed).toHaveBeenCalledWith(expect.objectContaining({ phase: "pending" }), expect.any(Error));
  });
  test("fallo al guardar cursor después del envío conserva sending incierto", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "after-send", phase: "ready", replies: [reply], replyCursor: 0 });
    checkpointInboundJob.mockImplementation(async (job, phase) => {
      if (phase === "complete") throw new Error("DB unavailable after delivery");
      return { ...job, phase };
    });
    await processOneJob();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(markInboundJobFailed).toHaveBeenCalledWith(expect.objectContaining({ phase: "sending", replyCursor: 0 }), expect.any(Error));
    expect(markInboundJobDone).not.toHaveBeenCalled();
  });
  test("propietario vencido no inicia envío ni altera el nuevo estado", async () => {
    claimNextInboundJob.mockResolvedValue({ id: "lost", phase: "ready", replies: [reply], replyCursor: 0 });
    renewInboundJobLease.mockRejectedValue(new InboundLeaseLostError("lost"));
    await processOneJob();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(markInboundJobFailed).not.toHaveBeenCalled();
  });
  test("heartbeat fallido durante motor lento impide iniciar la entrega", async () => {
    jest.useFakeTimers();
    let finishEngine;
    claimNextInboundJob.mockResolvedValue({ id: "slow", phase: "pending", payload: {} });
    processIncomingMessage.mockImplementation(() => new Promise(resolve => { finishEngine = resolve; }));
    renewInboundJobLease.mockResolvedValueOnce({}).mockRejectedValue(new Error("lost DB connection"));
    const promise = processOneJob();
    await jest.advanceTimersByTimeAsync(20001);
    finishEngine({ processed: true, from: reply.phone, reply: reply.content, user: { id: reply.userId } });
    await promise;
    expect(sendMessage).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
