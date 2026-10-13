const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env'), quiet: true });
const db = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) && db.pathname === '/mateos_dev');
const prisma = require('../backend/src/lib/prisma');
const { PrismaMessageRepository } = require('../backend/src/contexts/communication/infrastructure/persistence/prisma-message.repository');
const { createWhatsAppWindowGuard } = require('../backend/src/contexts/communication/infrastructure/providers/whatsapp-window-guard');

test('WhatsApp window uses owner history across threads and isolates tenants with real PostgreSQL', async () => {
  const ids = [randomUUID(), randomUUID()];
  const marker = 'message-window-' + ids[0];
  const now = new Date('2026-10-13T16:00:00Z');
  const repository = new PrismaMessageRepository();
  let delivered = 0;
  try {
    const tenants = await Promise.all(ids.map((id,i) => prisma.tenant.create({ data: { id, slug: marker+'-'+i, name: marker, phone: marker+'-'+i } })));
    const owners = await Promise.all(tenants.map(t => prisma.user.create({ data: { tenantId: t.id, name: marker, phone: marker } })));
    const emptyOwner = await prisma.user.create({ data: { tenantId: ids[0], name: marker, phone: marker+'-empty' } });
    const thread = owner => prisma.conversation.create({ data: { tenantId: owner.tenantId, userId: owner.id } });
    const old = await thread(owners[0]), newest = await thread(owners[0]), foreign = await thread(owners[1]);
    const create = (conversationId, role, age) => prisma.message.create({ data: { conversationId, role, content: marker, createdAt: new Date(now - age * 3600000) } });
    await create(old.id,'user',40);
    await create(newest.id,'assistant',0.1);
    await create(foreign.id,'user',0.1);
    const guard = createWhatsAppWindowGuard({ messageRepository: repository, now: () => now });
    const input = { channelType: 'whatsapp', origin: 'sistema', purpose: 'reminder', tenantId: ids[0], userId: owners[0].id };
    const deliver = async () => { delivered++; return { message: { id: 'accepted' } }; };
    assert.equal((await guard(input,deliver)).skipped,true,'assistant/another tenant cannot open this window');
    assert.equal((await guard({ ...input, userId: emptyOwner.id },deliver)).skipped,true,'another owner cannot open this window');
    assert.equal(await repository.findLatestIncomingAt(owners[0].id,ids[1]),null,'mismatched tenant cannot read owner history');
    assert.equal(delivered,0);
    await create(old.id,'user',1);
    assert.equal((await guard(input,deliver)).message.id,'accepted','interaction in an older thread still opens the owner window');
    assert.equal(delivered,1);
  } finally {
    for (const id of ids) {
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (tenant) {
        assert.equal(tenant.name,marker); assert(tenant.slug.startsWith(marker));
        await prisma.$transaction(async tx => {
          await tx.message.deleteMany({ where: { conversation: { tenantId: id } } });
          await tx.conversation.deleteMany({ where: { tenantId: id } });
          await tx.user.deleteMany({ where: { tenantId: id } });
          await tx.tenant.delete({ where: { id } });
        });
      }
    }
    await prisma.$disconnect();
  }
});
