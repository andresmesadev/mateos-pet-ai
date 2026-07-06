/**
 * Entregable 3.4 — Recepcionista IA: verifica que webhook.controller.js
 * delega el procesamiento del mensaje entrante en el caso de uso Procesar
 * Mensaje Entrante (contexts/receptionist) en lugar de invocar directamente
 * whatsapp.service.processIncomingMessage, preservando el contrato de envío
 * hacia Comunicación (3.1) sin cambios.
 */
jest.mock("../../services/whatsapp.service", () => ({
  verifyWebhookSignature: jest.fn(() => "challenge-ok"),
}));

jest.mock("../../contexts/receptionist", () => ({
  processIncomingMessage: jest.fn(),
}));

jest.mock("../../contexts/communication", () => ({
  sendMessage: jest.fn(),
}));

const { receiveWebhook } = require("../../controllers/webhook.controller");
const { processIncomingMessage } = require("../../contexts/receptionist");
const { sendMessage } = require("../../contexts/communication");

function buildRes() {
  return { sendStatus: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe("receiveWebhook (wiring Recepcionista IA → Comunicación)", () => {
  test("mensaje procesado con reply: invoca communication.sendMessage con conversationId explícito", async () => {
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1", tenantId: "tenant-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage.mockResolvedValue({ message: {} });

    const req = { body: {} };
    const res = buildRes();
    await receiveWebhook(req, res, jest.fn());

    expect(processIncomingMessage).toHaveBeenCalledWith(req.body);
    expect(sendMessage).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      conversationId: "conv-1",
      phone: "573000000000",
      content: "hola",
      origin: "agente",
    });
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("mensaje no procesado (processed:false): no invoca sendMessage", async () => {
    processIncomingMessage.mockResolvedValue({ received: true, processed: false });

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test("fallo de sendMessage no rompe la respuesta 200 al webhook", async () => {
    processIncomingMessage.mockResolvedValue({
      processed: true,
      from: "573000000000",
      reply: "hola",
      user: { id: "user-1" },
      conversation: { id: "conv-1" },
    });
    sendMessage.mockRejectedValue(new Error("proveedor caído"));

    const res = buildRes();
    await receiveWebhook({ body: {} }, res, jest.fn());

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
