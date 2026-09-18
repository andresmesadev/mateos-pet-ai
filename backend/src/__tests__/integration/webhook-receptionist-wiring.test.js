/**
 * Entregable 3.4 — Recepcionista IA: verifica que webhook.controller.js
 * delega el procesamiento del mensaje entrante en el caso de uso Procesar
 * Mensaje Entrante (contexts/receptionist) en lugar de invocar directamente
 * whatsapp.service.processIncomingMessage, preservando el contrato de envío
 * hacia Comunicación (3.1) sin cambios.
 */
jest.mock("../../services/whatsapp.service", () => ({
  verifyWebhookSignature: jest.fn(() => "challenge-ok"),
  parseIncomingMessage: jest.fn(),
}));

jest.mock("../../services/inbound-job.service", () => ({
  enqueueInboundJob: jest.fn(),
}));

jest.mock("../../jobs/inbound-message.job", () => ({
  requestInboundDrain: jest.fn(),
}));

const { receiveWebhook } = require("../../controllers/webhook.controller");
const { parseIncomingMessage } = require("../../services/whatsapp.service");
const { enqueueInboundJob } = require("../../services/inbound-job.service");
const { requestInboundDrain } = require("../../jobs/inbound-message.job");

function buildRes() {
  return { sendStatus: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe("receiveWebhook (cola durable)", () => {
  test("mensaje soportado: encola el payload por wamid y responde 200", async () => {
    parseIncomingMessage.mockReturnValue({ wamid: "wamid-1", from: "573000000000" });
    enqueueInboundJob.mockResolvedValue({ created: true });

    const req = { body: {} };
    const res = buildRes();
    await receiveWebhook(req, res, jest.fn());

    expect(enqueueInboundJob).toHaveBeenCalledWith({
      provider: "whatsapp", providerEventId: "wamid-1", payload: req.body,
    });
    expect(requestInboundDrain).toHaveBeenCalledTimes(1);
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("reintento duplicado responde 200 sin despertar otro drenado", async () => {
    parseIncomingMessage.mockReturnValue({ wamid: "wamid-1", from: "573000000000" });
    enqueueInboundJob.mockResolvedValue({ created: false });

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(requestInboundDrain).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("payload sin mensaje soportado: no encola y responde 200", async () => {
    parseIncomingMessage.mockReturnValue(null);

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(enqueueInboundJob).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("fallo al encolar delega el error al middleware", async () => {
    parseIncomingMessage.mockReturnValue({ wamid: "wamid-2", from: "573000000000" });
    const error = new Error("base de datos caída");
    enqueueInboundJob.mockRejectedValue(error);

    const res = buildRes();
    const next = jest.fn();
    await receiveWebhook({ body: {} }, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
