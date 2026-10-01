// Disposable local-only conversations; the main recipient has NO phone,
// so testing Send is rejected before a provider or channel can be invoked.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
const assert = require("node:assert/strict");
const prisma = require("../backend/src/lib/prisma");
const prefix = "local-wa-workspace-check-";
const ownerIds = Array.from({ length: 28 }, (_, index) => `${prefix}owner-${index}`);
const chatId = `${prefix}chat-0`, oldId = `${prefix}old-0`;

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/mateos_dev");
  const tenantId = process.env.SINGLE_TENANT_ID;
  assert(tenantId);
  const mode = process.argv[2];
  if (mode === "prepare") {
    assert.equal(await prisma.user.count({ where: { id: { startsWith: prefix } } }), 0);
    const now = Date.now();
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < 28; index++) {
        const ownerId = ownerIds[index];
        const name = index === 0 ? "Prueba WhatsApp Ana" : index === 27 ? "Prueba WhatsApp Zorro" : `Prueba WhatsApp cliente ${String(index).padStart(2, "0")}`;
        await tx.user.create({ data: { id: ownerId, tenantId, name, phone: index === 0 ? "" : `0000000099${String(index).padStart(2, "0")}` } });
        await tx.conversation.create({ data: { id: `${prefix}chat-${index}`, tenantId, userId: ownerId, step: "idle", status: index === 0 ? "esperando_humano" : "activa", sessionData: { requires_human_attention: index === 0 }, updatedAt: new Date(now - index * 1000) } });
      }
      await tx.pet.create({ data: { id: `${prefix}pet-0`, tenantId, ownerId: ownerIds[0], name: "Luna de prueba", type: "dog" } });
      await tx.conversation.create({ data: { id: oldId, tenantId, userId: ownerIds[0], step: "completed", status: "cerrada", updatedAt: new Date(now - 3 * 86400000) } });
      await tx.message.createMany({ data: [
        { id: `${prefix}message-0`, conversationId: oldId, role: "user", origin: "cliente", content: "Hola, quisiera consultar los horarios.", createdAt: new Date("2026-09-29T15:00:00Z") },
        { id: `${prefix}message-1`, conversationId: oldId, role: "assistant", origin: "agente", content: "Hola. Podemos ayudarte con la agenda de Luna.", createdAt: new Date("2026-09-29T15:01:00Z") },
        { id: `${prefix}message-2`, conversationId: chatId, role: "user", origin: "cliente", content: "Quisiera hablar con el equipo para reservar una cita.\nGracias.", createdAt: new Date("2026-09-30T15:00:00Z") },
      ] });
    }, { timeout: 20000 });
    console.log("PASS: 28 hilos temporales y 2 sesiones del mismo propietario; destinatario principal sin teléfono. Ningún envío externo posible en esa prueba.");
  } else if (mode === "history" || mode === "incoming") {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerIds[0] } });
    assert.equal(owner.tenantId, tenantId); assert.equal(owner.phone, "");
    assert.equal(owner.name, "Prueba WhatsApp Ana");
    const chat = await prisma.conversation.findUniqueOrThrow({ where: { id: chatId } });
    assert.equal(chat.userId, owner.id); assert.equal(chat.tenantId, tenantId);
    if (mode === "history") {
      assert.equal(await prisma.message.count({ where: { id: { startsWith: `${prefix}history-` } } }), 0);
      await prisma.message.createMany({ data: Array.from({length:40}, (_, index)=>({ id:`${prefix}history-${index}`, conversationId:chatId, role:index%2 ? "assistant" : "user", origin:index%2 ? "agente" : "cliente", content:`Mensaje temporal ${index+1}: información sobre horarios y preparación de Luna para su visita. Este texto permite comprobar la lectura de un historial largo.`, createdAt:new Date(Date.parse("2026-09-29T16:00:00Z")+index*60000) })) });
    } else {
      assert.equal(await prisma.message.count({ where: { id: `${prefix}incoming` } }), 0);
      await prisma.message.create({ data: { id:`${prefix}incoming`, conversationId:chatId, role:"user", origin:"cliente", content:"Mensaje nuevo de prueba recibido mientras se lee el historial.", createdAt:new Date() } });
    }
    console.log(`PASS: ${mode} local agregado sin proveedor externo.`);
  } else if (mode === "verify") {
    const { listConversations, getConversationMessages } = require("../backend/src/services/dashboard-conversation.service");
    const page = await listConversations({ tenantId, search: "Prueba WhatsApp", limit: 25 });
    assert.equal(page.pagination.total, 28); assert.equal(page.data.length, 25);
    const other = await listConversations({ tenantId, search: "Prueba WhatsApp", limit: 25, page: 2 });
    assert.equal(other.data.length, 3);
    const zorro = await listConversations({ tenantId, search: "Zorro" });
    assert.equal(zorro.data.length, 1); assert.equal(zorro.data[0].userId, ownerIds[27]);
    const detail = await getConversationMessages(oldId);
    assert.equal(detail.conversation.id, chatId);
    const historyCount = await prisma.message.count({where:{id:{startsWith:`${prefix}history-`}}});
    const incomingCount = await prisma.message.count({where:{id:`${prefix}incoming`}});
    assert([0,40].includes(historyCount)); assert([0,1].includes(incomingCount));
    const expectedMessages = 3 + historyCount + incomingCount;
    assert.equal(detail.messages.length, expectedMessages);
    assert(detail.messages.every(message=>message.id.startsWith(prefix)));
    const row = await prisma.conversation.findUniqueOrThrow({ where: { id: chatId } });
    assert.equal(row.status, "activa"); assert.equal(row.sessionData.requires_human_attention, true);
    const human = await listConversations({ tenantId, search: "Prueba WhatsApp", attention: "human" });
    assert.equal(human.data.length, 0);
    assert.equal(await prisma.message.count({ where: { conversation: { userId: { in: ownerIds } } } }), expectedMessages);
    console.log("PASS: paginación real, búsqueda global, historial agregado, resolución vigente y cero mensajes enviados.");
  } else if (mode === "cleanup") {
    await prisma.$transaction(async (tx) => {
      const owners = await tx.user.findMany({ where: { id: { in: ownerIds } } });
      assert.equal(owners.length, 28); assert(owners.every((owner) => owner.tenantId === tenantId && owner.name.startsWith("Prueba WhatsApp")));
      assert.equal(owners.find((owner) => owner.id === ownerIds[0]).phone, "");
      assert.equal(await tx.appointment.count({ where: { userId: { in: ownerIds } } }), 0);
      const chats = await tx.conversation.findMany({ where: { userId: { in: ownerIds } } });
      assert.equal(chats.length, 29); assert(chats.every((chat) => chat.id.startsWith(prefix) && chat.tenantId === tenantId));
      const events = await tx.domainEvent.findMany({ where: { tenantId, payload: { path: ["conversation", "id"], equals: chatId } }, select: { id: true } });
      const eventIds = events.map((event) => event.id);
      assert.equal(await tx.automationExecution.count({ where: { domainEventId: { in: eventIds } } }), 0);
      await tx.eventDelivery.deleteMany({ where: { domainEventId: { in: eventIds } } });
      await tx.domainEvent.deleteMany({ where: { id: { in: eventIds } } });
      await tx.message.deleteMany({ where: { conversationId: { in: chats.map((chat) => chat.id) } } });
      await tx.conversation.deleteMany({ where: { id: { in: chats.map((chat) => chat.id) } } });
      await tx.pet.deleteMany({ where: { id: `${prefix}pet-0`, tenantId, ownerId: ownerIds[0] } });
      await tx.user.deleteMany({ where: { id: { in: ownerIds }, tenantId } });
    }, { timeout: 20000 });
    console.log("PASS: únicamente datos temporales retirados; datos anteriores conservados.");
  } else throw new Error("Usa prepare, verify o cleanup.");
}
main().catch((cause) => { console.error(cause.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
