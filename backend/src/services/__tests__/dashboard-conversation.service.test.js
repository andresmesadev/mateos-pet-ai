jest.mock("../../lib/prisma", () => ({ conversation: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() }, message: { findMany: jest.fn() } }));
const prisma = require("../../lib/prisma");
const { listConversations, getConversationMessages } = require("../dashboard-conversation.service");
const row = (id, status, extra = {}) => ({ id, userId: `owner-${id}`, tenantId: "tenant-a", status, updatedAt: new Date("2026-09-30T15:00:00Z"), user: { name: "Ana", phone: "123" }, messages: [], sessionData: {}, ...extra });
beforeEach(() => jest.resetAllMocks());

test("la atención humana usa el estado vigente y se pagina después del filtro", async () => {
  prisma.conversation.findMany.mockResolvedValue([
    row("resolved", "activa", { sessionData: { requires_human_attention: true } }),
    row("one", "esperando_humano"), row("two", "esperando_humano"),
  ]);
  const result = await listConversations({ tenantId: "tenant-a", attention: "human", limit: 1, page: 2 });
  expect(result.data.map((item) => item.id)).toEqual(["two"]);
  expect(result.data[0]).toMatchObject({ userId: "owner-two", name: "Ana", requires_human_attention: true });
  expect(result.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
  expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a" }, distinct: ["userId"] }));
});

test("la búsqueda de teléfono formateado conserva el aislamiento y alcanza filas fuera de la primera página", async () => {
  prisma.conversation.findMany.mockResolvedValue([row("one", "activa")]);
  await listConversations({ tenantId: "tenant-a", search: "+57 300 123", page: 3 });
  expect(prisma.conversation.findMany.mock.calls[0][0].where).toEqual({ tenantId: "tenant-a", user: { OR: [{ name: { contains: "+57 300 123", mode: "insensitive" } }, { phone: { contains: "57300123" } }] } });
});

test("un enlace anterior abre la sesión vigente y agrega historial del mismo propietario y establecimiento", async () => {
  prisma.conversation.findUnique.mockResolvedValue({ id: "old", userId: "owner-a", tenantId: "tenant-a" });
  prisma.conversation.findFirst.mockResolvedValue(row("new", "activa", { userId: "owner-a", sessionData: { requires_human_attention: true } }));
  prisma.conversation.findMany.mockResolvedValue([{ id: "new" }, { id: "old" }]);
  prisma.message.findMany.mockResolvedValue([{ id: "m", role: "assistant", origin: "agente", content: "Mensaje", createdAt: new Date() }]);
  const result = await getConversationMessages("old");
  expect(result.conversation).toMatchObject({ id: "new", userId: "owner-a", tenantId: "tenant-a", status: "activa", requires_human_attention: false });
  expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ userId: "owner-a", tenantId: "tenant-a" });
  expect(prisma.conversation.findMany.mock.calls[0][0].where).toEqual({ userId: "owner-a", tenantId: "tenant-a" });
  expect(result.messages[0].origin).toBe("agente");
});

test("un identificador inexistente no selecciona otro chat", async () => {
  prisma.conversation.findUnique.mockResolvedValue(null);
  expect(await getConversationMessages("missing")).toBeNull();
  expect(prisma.message.findMany).not.toHaveBeenCalled();
  expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
});

test("los números dentro de un nombre no se convierten en otra búsqueda de teléfono", async () => {
  prisma.conversation.findMany.mockResolvedValue([]);
  await listConversations({ tenantId: "tenant-a", search: "Cliente 01" });
  expect(prisma.conversation.findMany.mock.calls[0][0].where.user.OR[1]).toEqual({ phone: { contains: "Cliente 01" } });
});
