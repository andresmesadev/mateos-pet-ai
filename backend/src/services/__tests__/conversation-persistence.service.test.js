jest.mock("../../lib/prisma", () => ({
  conversation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
  message: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
}));

jest.mock("../embedding.service", () => ({
  saveMessageEmbedding: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../memory.service", () => ({
  hydrateSessionFromConversation: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { saveMessageEmbedding } = require("../embedding.service");
const { hydrateSessionFromConversation } = require("../memory.service");
const {
  findOrCreateConversation,
  saveMessage,
  findMessageByExternalId,
  getConversationMessages,
  syncConversationState,
} = require("../conversation-persistence.service");

beforeEach(() => jest.clearAllMocks());

describe("findOrCreateConversation", () => {
  test("rechaza sin userId", async () => {
    await expect(findOrCreateConversation("")).rejects.toThrow("userId is required");
  });

  test("retorna la conversación activa existente e hidrata la sesión", async () => {
    const existing = {
      id: "conv-1",
      tenantId: "tenant-1",
      user: { phone: "+573000000000", tenantId: "tenant-1" },
    };
    prisma.conversation.findFirst.mockResolvedValue(existing);
    await expect(findOrCreateConversation("user-1")).resolves.toBe(existing);
    expect(hydrateSessionFromConversation).toHaveBeenCalledWith("+573000000000", existing);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  test("no hidrata si el usuario de la conversación existente no tiene phone", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: "conv-1", tenantId: "t1", user: {} });
    await findOrCreateConversation("user-1");
    expect(hydrateSessionFromConversation).not.toHaveBeenCalled();
  });

  test("repara tenantId null en la conversación existente si el usuario sí lo tiene", async () => {
    const existing = { id: "conv-1", tenantId: null, user: { tenantId: "tenant-1" } };
    prisma.conversation.findFirst.mockResolvedValue(existing);
    prisma.conversation.update.mockResolvedValue({});
    const result = await findOrCreateConversation("user-1");
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { tenantId: "tenant-1" },
    });
    expect(result.tenantId).toBe("tenant-1");
  });

  test("no lanza si el backfill de tenantId falla en segundo plano", async () => {
    const existing = { id: "conv-1", tenantId: null, user: { tenantId: "tenant-1" } };
    prisma.conversation.findFirst.mockResolvedValue(existing);
    prisma.conversation.update.mockRejectedValue(new Error("backfill failed"));
    await expect(findOrCreateConversation("user-1")).resolves.toBe(existing);
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("no repara tenantId si el usuario tampoco lo tiene", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: "conv-1", tenantId: null, user: {} });
    await findOrCreateConversation("user-1");
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  test("crea una conversación nueva con el tenantId del usuario si no hay una activa", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ tenantId: "tenant-1", phone: "+573000000000" });
    prisma.conversation.create.mockResolvedValue({ id: "conv-new" });
    await findOrCreateConversation("user-1");
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { userId: "user-1", tenantId: "tenant-1" },
    });
    expect(hydrateSessionFromConversation).toHaveBeenCalledWith(
      "+573000000000",
      { id: "conv-new" }
    );
  });

  test("crea una conversación con tenantId null si el usuario no existe", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: "conv-new" });
    await findOrCreateConversation("user-1");
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { userId: "user-1", tenantId: null },
    });
    expect(hydrateSessionFromConversation).not.toHaveBeenCalled();
  });

  test("propaga el error de prisma", async () => {
    prisma.conversation.findFirst.mockRejectedValue(new Error("db down"));
    await expect(findOrCreateConversation("user-1")).rejects.toThrow("db down");
  });
});

describe("findMessageByExternalId", () => {
  test("retorna null sin consultar prisma si externalId está vacío", async () => {
    await expect(findMessageByExternalId("")).resolves.toBeNull();
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
  });

  test("retorna el mensaje encontrado", async () => {
    prisma.message.findUnique.mockResolvedValue({ id: "msg-1" });
    await expect(findMessageByExternalId("wamid.1")).resolves.toEqual({ id: "msg-1" });
    expect(prisma.message.findUnique).toHaveBeenCalledWith({ where: { externalId: "wamid.1" } });
  });

  test("retorna null (sin lanzar) si prisma falla", async () => {
    prisma.message.findUnique.mockRejectedValue(new Error("db down"));
    await expect(findMessageByExternalId("wamid.1")).resolves.toBeNull();
  });
});

describe("saveMessage", () => {
  test("rechaza sin conversationId, role o content", async () => {
    await expect(
      saveMessage({ conversationId: "", role: "user", content: "hola", userId: "u1" })
    ).rejects.toThrow("conversationId, role and content are required");
    await expect(
      saveMessage({ conversationId: "c1", role: "", content: "hola", userId: "u1" })
    ).rejects.toThrow();
    await expect(
      saveMessage({ conversationId: "c1", role: "user", content: "", userId: "u1" })
    ).rejects.toThrow();
    await expect(
      saveMessage({ conversationId: "c1", role: "user", content: undefined, userId: "u1" })
    ).rejects.toThrow();
  });

  test("rechaza un role distinto de user/assistant", async () => {
    await expect(
      saveMessage({ conversationId: "c1", role: "system", content: "hola", userId: "u1" })
    ).rejects.toThrow('role must be "user" or "assistant"');
  });

  test("rechaza mensajes de user sin userId", async () => {
    await expect(
      saveMessage({ conversationId: "c1", role: "user", content: "hola" })
    ).rejects.toThrow("userId is required for user messages");
  });

  test("guarda un mensaje assistant sin userId y sin disparar embedding", async () => {
    prisma.message.create.mockResolvedValue({ id: "msg-1" });
    await saveMessage({ conversationId: "c1", role: "assistant", content: "respuesta" });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: "c1", role: "assistant", content: "respuesta" },
    });
    expect(saveMessageEmbedding).not.toHaveBeenCalled();
  });

  test("guarda un mensaje user, incluye externalId y dispara embedding", async () => {
    prisma.message.create.mockResolvedValue({ id: "msg-1" });
    await saveMessage({
      conversationId: "c1",
      role: "user",
      content: "hola",
      userId: "u1",
      externalId: "wamid.1",
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: "c1", role: "user", content: "hola", externalId: "wamid.1" },
    });
    expect(saveMessageEmbedding).toHaveBeenCalledWith({
      userId: "u1",
      conversationId: "c1",
      messageId: "msg-1",
      content: "hola",
      metadata: { role: "user" },
    });
  });

  test("no rechaza si falla la generación de embedding", async () => {
    prisma.message.create.mockResolvedValue({ id: "msg-1" });
    saveMessageEmbedding.mockRejectedValue(new Error("embedding down"));
    await expect(
      saveMessage({ conversationId: "c1", role: "user", content: "hola", userId: "u1" })
    ).resolves.toEqual({ id: "msg-1" });
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("no rechaza si el fallo de embedding no trae un .message", async () => {
    prisma.message.create.mockResolvedValue({ id: "msg-1" });
    saveMessageEmbedding.mockRejectedValue("string-sin-message");
    await expect(
      saveMessage({ conversationId: "c1", role: "user", content: "hola", userId: "u1" })
    ).resolves.toEqual({ id: "msg-1" });
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("propaga el error de prisma", async () => {
    prisma.message.create.mockRejectedValue(new Error("db down"));
    await expect(
      saveMessage({ conversationId: "c1", role: "assistant", content: "hola" })
    ).rejects.toThrow("db down");
  });
});

describe("getConversationMessages", () => {
  test("rechaza sin conversationId", async () => {
    await expect(getConversationMessages("")).rejects.toThrow("conversationId is required");
  });

  test("retorna los mensajes ordenados por creación ascendente", async () => {
    prisma.message.findMany.mockResolvedValue([{ id: "msg-1" }]);
    await expect(getConversationMessages("c1")).resolves.toEqual([{ id: "msg-1" }]);
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: "c1" },
      orderBy: { createdAt: "asc" },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.message.findMany.mockRejectedValue(new Error("db down"));
    await expect(getConversationMessages("c1")).rejects.toThrow("db down");
  });
});

describe("syncConversationState", () => {
  test("retorna null sin tocar prisma si conversationId está vacío", async () => {
    await expect(syncConversationState("", { intent: "booking" })).resolves.toBeNull();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  test("retorna null sin tocar prisma si no hay intent ni step", async () => {
    await expect(syncConversationState("c1", {})).resolves.toBeNull();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  test("actualiza solo intent cuando step no se provee", async () => {
    prisma.conversation.update.mockResolvedValue({ id: "c1" });
    await syncConversationState("c1", { intent: "booking" });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { intent: "booking" },
    });
  });

  test("al actualizar step, también resetea abandonReminderSent", async () => {
    prisma.conversation.update.mockResolvedValue({ id: "c1" });
    await syncConversationState("c1", { step: "waiting_date" });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { step: "waiting_date", abandonReminderSent: false },
    });
  });

  test("combina intent y step en la misma actualización", async () => {
    prisma.conversation.update.mockResolvedValue({ id: "c1" });
    await syncConversationState("c1", { intent: "booking", step: "waiting_date" });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { intent: "booking", step: "waiting_date", abandonReminderSent: false },
    });
  });

  test("retorna null (sin lanzar) si prisma falla", async () => {
    prisma.conversation.update.mockRejectedValue(new Error("db down"));
    await expect(syncConversationState("c1", { intent: "booking" })).resolves.toBeNull();
  });
});
