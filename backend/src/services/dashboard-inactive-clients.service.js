const prisma = require('../lib/prisma');
const { Prisma } = require('@prisma/client');
const { parseContactDay } = require('./dashboard-followup-dates');

// Read projection only: the last grooming record still defines inactivity.
async function listInactiveClientsPage(tenantId, query = {}) {
  const take = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 20));
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';
  const from = parseContactDay(query.contactFrom), to = parseContactDay(query.contactTo);
  if (from && to && from > to) throw Object.assign(new Error('La fecha inicial no puede ser posterior a la final.'), { status: 400 });
  const contact = query.contact === 'never' ? Prisma.sql`AND u."lastReminderSentAt" IS NULL`
    : query.contact === 'recorded' ? Prisma.sql`AND u."lastReminderSentAt" IS NOT NULL
      ${from ? Prisma.sql`AND u."lastReminderSentAt" >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND u."lastReminderSentAt" < ${new Date(to.getTime() + 86400000)}` : Prisma.empty}` : Prisma.empty;
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const eligible = Prisma.sql`
    SELECT u.id, MAX(r.date) AS "lastVisitDate"
    FROM "User" u JOIN "Pet" p ON p."ownerId" = u.id AND p."tenantId" IS NOT DISTINCT FROM u."tenantId"
    JOIN "MedicalRecord" r ON r."petId" = p.id AND r.type = 'grooming'
    WHERE TRUE ${tenantId ? Prisma.sql`AND u."tenantId" = ${tenantId}` : Prisma.empty} ${contact}
      ${search ? Prisma.sql`AND (u.name ILIKE ${pattern} OR u.phone ILIKE ${pattern} OR EXISTS (
        SELECT 1 FROM "Pet" sp WHERE sp."ownerId" = u.id AND sp."tenantId" IS NOT DISTINCT FROM u."tenantId" AND sp.name ILIKE ${pattern}))` : Prisma.empty}
    GROUP BY u.id HAVING MAX(r.date) < ${new Date(Date.now() - 60 * 86400000)} OR MAX(r.date) IS NULL`;
  const [count] = await prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total FROM (${eligible}) eligible`);
  const total = count.total;
  const totalPages = Math.max(1, Math.ceil(total / take));
  const page = Math.min(totalPages, Math.max(1, parseInt(query.page, 10) || 1));
  const rows = await prisma.$queryRaw(Prisma.sql`${eligible} ORDER BY "lastVisitDate" ASC NULLS LAST, u.id ASC LIMIT ${take} OFFSET ${(page - 1) * take}`);
  const users = rows.length ? await prisma.user.findMany({
    where: { id: { in: rows.map(row => row.id) }, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, name: true, phone: true, lastReminderSentAt: true,
      pets: { where: tenantId ? { tenantId } : {}, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 3, select: { id: true, name: true, type: true } } },
  }) : [];
  const byId = new Map(users.map(user => [user.id, user]));
  const data = rows.flatMap(row => { const user = byId.get(row.id); return user ? [{ ...user, lastVisitDate: row.lastVisitDate ? new Date(row.lastVisitDate).toISOString() : null }] : []; });
  return { data, total, page, totalPages, pageSize: take };
}
module.exports = { listInactiveClientsPage };
