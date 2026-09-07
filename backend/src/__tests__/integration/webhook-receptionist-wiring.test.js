/**
 * Entregable 8.2 (Fase 8) — D-F1: webhook.controller.js dejó de procesar el
 * mensaje entrante inline (delegado hasta 8.2 en contexts/receptionist,
 * Entregable 3.4) y pasó a encolarlo en InboundJob, respondiendo 200 de
 * inmediato. jobs/inbound-message.job.js hereda ese wiring — ver
 * inbound-message.job.test.js para la verificación de que
 * processIncomingMessage → communication.sendMessage sigue intacto, ahora
 * desde el worker.
 */
jest.mock("../../services/whatsapp.service", () => ({
  verifyWebhookSignature: jest.fn(() => "challenge-ok"),
  parseIncomingMessage: jest.fn(),
}));

jest.mock("../../services/inbound-job.service", () => ({
  enqueueInboundJob: jest.fn(),
}));

const { receiveWebhook } = require("../../controllers/webhook.controller");
const { parseIncomingMessage } = require("../../services/whatsapp.service");
const { enqueueInboundJob } = require("../../services/inbound-job.service");

function buildRes() {
  return { sendStatus: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe("receiveWebhook (wiring hacia la cola de InboundJob — Entregable 8.2)", () => {
  test("payload con mensaje soportado: encola por wamid y responde 200", async () => {
    parseIncomingMessage.mockReturnValue({ from: "573000000000", wamid: "wamid-1" });
    enqueueInboundJob.mockResolvedValue({ created: true });

    const req = { body: { entry: [] } };
    const res = buildRes();
    await receiveWebhook(req, res, jest.fn());

    expect(enqueueInboundJob).toHaveBeenCalledWith({
      provider: "whatsapp",
      providerEventId: "wamid-1",
      payload: req.body,
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("payload sin mensaje soportado (parseIncomingMessage → null): no encola, responde 200", async () => {
    parseIncomingMessage.mockReturnValue(null);

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(enqueueInboundJob).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("wamid ausente: sintetiza providerEventId con remitente para no perder el mensaje", async () => {
    parseIncomingMessage.mockReturnValue({ from: "573000000000", wamid: null });
    enqueueInboundJob.mockResolvedValue({ created: true });

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(enqueueInboundJob).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "whatsapp",
        providerEventId: expect.stringContaining("573000000000:"),
      })
    );
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("fallo de enqueueInboundJob se propaga al errorHandler (next), sin responder 200", async () => {
    parseIncomingMessage.mockReturnValue({ from: "573000000000", wamid: "wamid-1" });
    enqueueInboundJob.mockRejectedValue(new Error("BD caída"));

    const res = buildRes();
    const next = jest.fn();
    await receiveWebhook({ body: {} }, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.sendStatus).not.toHaveBeenCalled();
  });
});
