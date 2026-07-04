const { createSendMessageUseCase } = require("../application/use-cases/send-message.usecase");
const {
  InvalidMessageAttributesError,
  NoActiveChannelError,
  MessageDeliveryFailedError,
  ConversationNotFoundError,
} = require("../domain/errors");

function buildUseCase({ channelActive = true, deliverySucceeds = true } = {}) {
  const messages = [];
  const conversations = [{ id: "conv-1", userId: "user-1", channelId: null }];

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
  const channelProvider = { send: async () => deliverySucceeds };
  const eventPublisher = { publish: async () => {} };

  const execute = createSendMessageUseCase({
    channelRepository,
    conversationRepository,
    messageRepository,
    channelProvider,
    eventPublisher,
  });

  return { execute, messages };
}

describe("SendMessageUseCase (Enviar Mensaje)", () => {
  test("rechaza sin canal activo (NoActiveChannelError)", async () => {
    const { execute } = buildUseCase({ channelActive: false });
    await expect(
      execute({ tenantId: null, userId: "user-1", phone: "573000000000", content: "hola", origin: "sistema" })
    ).rejects.toBeInstanceOf(NoActiveChannelError);
  });

  test("todo-o-nada: si el proveedor falla, no persiste ningún Message", async () => {
    const { execute, messages } = buildUseCase({ deliverySucceeds: false });
    await expect(
      execute({ tenantId: null, userId: "user-1", phone: "573000000000", content: "hola", origin: "sistema" })
    ).rejects.toBeInstanceOf(MessageDeliveryFailedError);
    expect(messages.length).toBe(0);
  });

  test("sin conversationId: resuelve la conversación activa por userId (notificaciones)", async () => {
    const { execute, messages } = buildUseCase();
    const { message } = await execute({
      tenantId: null,
      userId: "user-1",
      phone: "573000000000",
      content: "recordatorio",
      origin: "sistema",
    });
    expect(message.conversationId).toBe("conv-1");
    expect(message.origin).toBe("sistema");
    expect(message.role).toBe("assistant");
    expect(messages.length).toBe(1);
  });

  test("con conversationId explícito: usa exactamente esa conversación (precisión del contrato)", async () => {
    const { execute } = buildUseCase();
    const { message } = await execute({
      tenantId: null,
      userId: "user-1",
      conversationId: "conv-1",
      phone: "573000000000",
      content: "respuesta manual",
      origin: "agente",
    });
    expect(message.conversationId).toBe("conv-1");
    expect(message.origin).toBe("agente");
  });

  test("conversationId explícito inexistente rechaza con ConversationNotFoundError", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({
        tenantId: null,
        userId: "user-1",
        conversationId: "no-existe",
        phone: "573000000000",
        content: "x",
        origin: "agente",
      })
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  test("rechaza content vacío y origin inválido", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ tenantId: null, userId: "user-1", phone: "573000000000", content: "", origin: "sistema" })
    ).rejects.toBeInstanceOf(InvalidMessageAttributesError);
    await expect(
      execute({ tenantId: null, userId: "user-1", phone: "573000000000", content: "x", origin: "cliente" })
    ).rejects.toBeInstanceOf(InvalidMessageAttributesError);
  });
});
