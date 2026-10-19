// Only the legacy import wrapper is eligible. Default is read-only.
const fs = require('node:fs');
const path = require('node:path');
const { cleanupImportedContact, phoneList, mergePhones } = require('../backend/src/services/contact-import-cleanup.service');

async function planRepair(db, tenantId, sourceContacts = []) {
  if (!tenantId) throw new Error('Explicit tenant required');
  const sourceByPhone = new Map();
  for (const contact of sourceContacts) {
    const key = phoneList(contact.phone)[0];
    if (key) sourceByPhone.set(key, [...(sourceByPhone.get(key) ?? []), cleanupImportedContact(contact)]);
  }
  const legacy = { notes: { startsWith: 'Registro original:' } };
  const rows = await db.user.findMany({ where: { tenantId, ...(sourceByPhone.size ? { OR: [legacy, { phone: { in: [...sourceByPhone.keys()] } }] } : legacy) }, select: { id: true, tenantId: true, phone: true, phoneAlt: true, notes: true } });
  return rows.flatMap(before => {
    const clean = cleanupImportedContact(before);
    const source = sourceByPhone.get(phoneList(before.phone)[0]) ?? [];
    const notes = clean.recognized ? [...new Set([clean.notes, ...source.map(c => c.notes)].filter(Boolean))].join('\n') || null : before.notes;
    const after = { phoneAlt: mergePhones(before.phone, clean.phoneAlt, ...source.map(c => c.phoneAlt)), notes };
    return (clean.recognized || source.length) && (after.phoneAlt !== before.phoneAlt || after.notes !== before.notes) ? [{ before, after }] : [];
  });
}

async function applyRepair(db, tenantId, plan) {
  return db.$transaction(async tx => {
    for (const { before, after } of plan) {
      if (before.tenantId !== tenantId) throw new Error('Foreign tenant in repair');
      const changed = await tx.user.updateMany({ where: { id: before.id, tenantId, phone: before.phone, phoneAlt: before.phoneAlt, notes: before.notes }, data: after });
      if (changed.count !== 1) throw new Error('A contact changed during repair; rolled back');
    }
    return plan.length;
  }, { timeout: 30000 });
}

async function main() {
  const tenantId = process.argv[process.argv.indexOf('--tenant') + 1];
  if (!process.argv.includes('--tenant') || !tenantId || tenantId.startsWith('--')) throw new Error('Use --tenant <id> [--apply]');
  const dbUrl = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname)) throw new Error('This repair only runs against local PostgreSQL');
  const db = require('../backend/src/lib/prisma');
  try {
    const sourceIndex = process.argv.indexOf('--source');
    const source = sourceIndex < 0 ? [] : require('../frontend/lib/contact-import.ts').parseContactsCSV(fs.readFileSync(path.resolve(process.argv[sourceIndex + 1]), 'utf8'));
    const plan = await planRepair(db, tenantId, source);
    const summary = { owners: plan.length, phonesRecovered: plan.filter(p => p.before.phoneAlt !== p.after.phoneAlt).length, notesCleaned: plan.filter(p => p.before.notes !== p.after.notes).length };
    if (!process.argv.includes('--apply') || !plan.length) { console.log(JSON.stringify({ mode: 'dry-run', ...summary })); return; }
    const dir = path.resolve(__dirname, '../.cache/private-contact-backups');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, 'owner-contact-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(backup, JSON.stringify({ tenantId, savedAt: new Date().toISOString(), plan }, null, 2), { flag: 'wx', mode: 0o600 });
    const repaired = await applyRepair(db, tenantId, plan);
    console.log(JSON.stringify({ mode: 'applied', ...summary, repaired, backup: path.relative(path.resolve(__dirname, '..'), backup) }));
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { planRepair, applyRepair };
