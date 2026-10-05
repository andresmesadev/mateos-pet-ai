const prisma = require('../lib/prisma');
const { CANONICAL_ORDER } = require('../contexts/communication/infrastructure/persistence/prisma-conversation-control.repository');
const { bogotaDayStart, followupDates } = require('./dashboard-followup-dates');

// Read adapter: the expediente owns states; old records remain a read-only fallback.
async function readFollowups(tenantId, modules, query = {}) {
  const types = ['other', ...(modules.includes('veterinary') ? ['control', 'vaccine', 'exam', 'treatment'] : []), ...(modules.includes('grooming') ? ['grooming'] : [])];
  if (!modules.some(m => ['veterinary', 'grooming'].includes(m))) return { byType: {}, total: 0, page: 1, totalPages: 1, pageSize: 20, periodCounts: { all: 0, past: 0, today: 0, next7: 0 } };
  const selectedTypes = types.includes(query.type) ? [query.type] : types;
  // MedicalRecord uses a different existing vocabulary than PetNextAction.
  const legacyAliases = { control: ['control', 'consultation'], vaccine: ['vaccine'], exam: ['exam'], treatment: ['treatment', 'deworming'], grooming: ['grooming'], other: ['other', 'note', ...(modules.includes('veterinary') ? ['allergy'] : [])] };
  const legacyTypes = selectedTypes.flatMap(type => legacyAliases[type]);
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';
  const petFilter = { ...(tenantId ? { tenantId } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { owner: { name: { contains: search, mode: 'insensitive' } } }] } : {}) };
  const now = new Date();
  const period = ['past', 'today', 'next7'].includes(query.period) ? query.period : 'all';
  const dates = followupDates(period, now) ?? (query.overdue === 'true' ? { lt: now } : undefined);
  // Include associations in every state: a closed action must suppress its old record too.
  const linked = await prisma.petNextAction.findMany({ where: { ...(tenantId ? { tenantId } : {}), sourceRecordId: { not: null } }, select: { sourceRecordId: true } });
  const canonicalBase = { ...(tenantId ? { tenantId } : {}), pet: petFilter, status: 'pending', type: { in: selectedTypes } };
  const canonicalWhere = { ...canonicalBase, ...(dates ? { dueAt: dates } : {}) };
  const legacyWhere = { pet: petFilter, type: { in: legacyTypes }, reminderSent: false,
    nextControlAt: { gte: new Date(now.getTime() - 180 * 86400000), lte: new Date(now.getTime() + 60 * 86400000) },
    ...(linked.length ? { id: { notIn: linked.map(a => a.sourceRecordId) } } : {}) };
  const legacyWithDates = bounds => ({ ...legacyWhere, nextControlAt: { ...legacyWhere.nextControlAt, ...bounds, gte: new Date(Math.max(legacyWhere.nextControlAt.gte.getTime(), bounds?.gte?.getTime() ?? 0)) } });
  const selectedLegacyWhere = legacyWithDates(dates);
  const [canonicalTotal, legacyTotal] = await Promise.all([prisma.petNextAction.count({ where: canonicalWhere }), prisma.medicalRecord.count({ where: selectedLegacyWhere })]);
  const total = canonicalTotal + legacyTotal;
  const periodCounts = Object.fromEntries(await Promise.all(['all', 'past', 'today', 'next7'].map(async name => {
    if (name === period && query.overdue !== 'true') return [name, total];
    const bounds = followupDates(name, now);
    const counts = await Promise.all([prisma.petNextAction.count({ where: { ...canonicalBase, ...(bounds ? { dueAt: bounds } : {}) } }), prisma.medicalRecord.count({ where: legacyWithDates(bounds) })]);
    return [name, counts[0] + counts[1]];
  })));
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, parseInt(query.page, 10) || 1));
  // Merge the prefix of both sorted streams before taking the requested page.
  const pet = { select: { id: true, name: true, type: true, owner: { select: { id: true, name: true, phone: true, conversations: { orderBy: CANONICAL_ORDER, take: 1, select: { id: true } } } } } };
  const [actions, records] = await Promise.all([
    prisma.petNextAction.findMany({ where: canonicalWhere, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: page * pageSize, include: { pet } }),
    prisma.medicalRecord.findMany({ where: selectedLegacyWhere, orderBy: [{ nextControlAt: 'asc' }, { id: 'asc' }], take: page * pageSize, include: { pet } }),
  ]);
  const map = (row, source) => ({ actionId: row.id, source, type: source === 'action' ? row.type : Object.keys(legacyAliases).find(type => legacyAliases[type].includes(row.type)) ?? 'other', petId: row.pet.id, petName: row.pet.name, petType: row.pet.type,
    ownerId: row.pet.owner?.id ?? null, ownerName: row.pet.owner?.name ?? null, ownerPhone: row.pet.owner?.phone ?? null,
    conversationId: row.pet.owner?.conversations?.[0]?.id ?? null, dueAt: source === 'action' ? row.dueAt : row.nextControlAt,
    notes: source === 'action' ? row.notes : row.title, reminderSentAt: row.reminderSentAt ?? null,
    isOverdue: new Date(source === 'action' ? row.dueAt : row.nextControlAt) < now,
    dayOffset: Math.round((bogotaDayStart(new Date(source === 'action' ? row.dueAt : row.nextControlAt)) - bogotaDayStart(now)) / 86400000) });
  const rows = [...actions.map(a => map(a, 'action')), ...records.map(a => map(a, 'record'))]
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt) || a.source.localeCompare(b.source) || a.actionId.localeCompare(b.actionId))
    .slice((page - 1) * pageSize, page * pageSize);
  const byType = {};
  for (const row of rows) (byType[row.type] ??= []).push(row);
  return { byType, total, page, totalPages, pageSize, periodCounts };
}

module.exports = { readFollowups };
