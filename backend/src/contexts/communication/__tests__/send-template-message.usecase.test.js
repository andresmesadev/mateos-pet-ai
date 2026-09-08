/**
 * Mejora post-Fase 8 (2026-09-08). Calcado de send-message.usecase.test.js
 * — mismo contrato, solo cambia que invoca channelProvider.sendTemplate en
 * vez de channelProvider.send.
 */
const { createSendTemplateMessageUseCase } = require("../application/use-cases/send-template-message.usecase");
const {
  InvalidMessageAttributesError,
  NoActiveChannelError,
  MessageDeliveryFailedError,
  ConversationNotFoundError,
} = require("../domain/errors");

function buildUseCase({ channelActive = true, deliverySucceeds = true } = {}) {
  const messages = [];
  const conversations = [{ id: "conv-1", userId: "user-1", channelId: null }];
  const sendTemplateCalls = [];

  const channelRepository = {
    findActiveDefault: async () => (channelActive ? { id: "ch-1", type: "whatsapp" } : null),
  };
  const conversationRepository = {
    findOrCreateActiveForUser: async (userId) => conversations.find((c) => c.userId === userId) ?? conversations[0],
    findById: async (id) => conversations.find((c) => c.id === id) ?? null,
  };
  const messageRepository = {
    create: async (data) => {
      const row = { id: `msg-${messages.length + 1}`, ...data };
      messages.push(row);
      return row;
    },
  };
  const channelProvider = {
    sendTemplate: async (channelType, to, templateName, languageCode, components) => {
      sendTemplateCalls.push({ channelType, to, templateName, languageCode, components });
      return deliverySucceeds;
    },
  };
  const eventPublisher = { publish: async () => {} };

  const execute = createSendTemplateMessageUseCase({
    channelRepository,
    conversationRepository,
    messageRepository,
    channelProvider,
    eventPublisher,
  });

  return { execute, messages, sendTemplateCalls };
}

const BASE_INPUT = {
  tenantId: null,
  userId: "user-1",
  phone: "573000000000",
  content: "Hola María 👋 texto renderizado",
  origin: "sistema",
  templateName: "reactivacion_cliente",
  languageCode: "es",
  components: [{ type: "body", parameters: [{ type: "text", text: "María" }] }],
};

describe("SendTemplateMessageUseCase (Enviar Mensaje de Plantilla)", () => {
  test("rechaza sin canal activo (NoActiveChannelError)", async () => {
    const { execute } = buildUseCase({ channelActive: false });
    await expect(execute(BASE_INPUT)).rejects.toBeInstanceOf(NoActiveChannelError);
  });

  test("todo-o-nada: si el proveedor falla, no persiste ningún Message", async () => {
    const { execute, messages } = buildUseCase({ deliverySucceeds: false });
    await expect(execute(BASE_INPUT)).rejects.toBeInstanceOf(MessageDeliveryFailedError);
    expect(messages.length).toBe(0);
  });

  test("invoca channelProvider.sendTemplate con templateName/languageCode/components — no .send", async () => {
    const { execute, sendTemplateCalls } = buildUseCase();
    await execute(BASE_INPUT);
    expect(sendTemplateCalls).toHaveLength(1);
    expect(sendTemplateCalls[0]).toMatchObject({
      channelType: "whatsapp",
      to: "573000000000",
      templateName: "reactivacion_cliente",
      languageCode: "es",
    });
  });

  test("persiste el `content` renderizado (no la plantilla cruda) en Message", async () => {
    const { execute, messages } = buildUseCase();
    const { message } = await execute(BASE_INPUT);
    expect(message.content).toBe("Hola María 👋 texto renderizado");
    expect(message.origin).toBe("sistema");
    expect(message.role).toBe("assistant");
    expect(messages.length).toBe(1);
  });

  test("conversationId explícito inexistente rechaza con ConversationNotFoundError", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ ...BASE_INPUT, conversationId: "no-existe" })).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  test("rechaza sin templateName ni languageCode", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ ...BASE_INPUT, templateName: "" })).rejects.toBeInstanceOf(InvalidMessageAttributesError);
    await expect(execute({ ...BASE_INPUT, languageCode: "" })).rejects.toBeInstanceOf(InvalidMessageAttributesError);
  });

  test("rechaza content vacío y origin inválido", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ ...BASE_INPUT, content: "" })).rejects.toBeInstanceOf(InvalidMessageAttributesError);
    await expect(execute({ ...BASE_INPUT, origin: "cliente" })).rejects.toBeInstanceOf(InvalidMessageAttributesError);
  });
});
