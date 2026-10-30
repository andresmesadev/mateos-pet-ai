const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Prisma } = require('../node_modules/@prisma/client');
const { buildTenantHandover, validateSchema, validateReferences, writeHandover, verifyHandover } = require('./tenant-handover.cjs');

test('schema review covers the generated client and rejects new models/fields before exporting', () => {
  validateSchema();
  const models = structuredClone(Prisma.dmmf.datamodel.models);
  assert.throws(() => validateSchema([...models, { name: 'UnreviewedSecret' }]), /SCHEMA_REVIEW/);
  models.find(m => m.name === 'Staff').fields.push({ name: 'newSecret', kind: 'scalar' });
  assert.throws(() => validateSchema(models), /FIELD_REVIEW/);
});
test('exported relations cannot refer to another tenant or an omitted parent', () => {
  const records = { Tenant: [{ id: 'a' }], Staff: [{ id: 'own', tenantId: 'a' }], User: [{ id: 'owner', tenantId: 'a' }], Appointment: [{ id: 'visit', tenantId: 'a', staffId: 'own', userId: 'owner' }] };
  validateReferences(records);
  records.Appointment[0].staffId = 'foreign';
  assert.throws(() => validateReferences(records), /FOREIGN_OR_MISSING_REFERENCE/);
});
test('verified case is mandatory and export snapshot is repeatable-read and read-only', async () => {
  await assert.rejects(buildTenantHandover({}, { tenantId: 't', caseId: 'invalid', operator: 'QA', verifiedChannel: 'new-email' }), /VERIFIED_CASE/);
  const queries = [], tx = { $executeRawUnsafe: async sql => queries.push(sql) };
  for (const model of Prisma.dmmf.datamodel.models) tx[model.name[0].toLowerCase() + model.name.slice(1)] = { findMany: async options => {
    queries.push(options); return model.name === 'Tenant' ? [{ id: 't' }] : [];
  } };
  tx.tenant.findUnique = async () => ({ id: 't' });
  const packet = await buildTenantHandover({ $transaction: async (read, options) => {
    assert.equal(options.isolationLevel, 'RepeatableRead'); return read(tx);
  } }, { tenantId: 't', caseId: 'HN-TEST-READONLY', operator: 'QA', verifiedChannel: 'registered-email' });
  assert.equal(queries[0], 'SET TRANSACTION READ ONLY');
  assert.equal(packet.counts.Tenant, 1); assert.equal(packet.records.StaffCredential, undefined);
  assert.equal(packet.records.ApiKey, undefined); assert.equal(packet.records.WhatsAppConnection, undefined);
});
test('package refuses public destinations, preserves an existing delivery and detects tampering', () => {
  const root = path.resolve(__dirname, '../.cache/tenant-handovers');
  const directory = path.join(root, 'unit-' + randomUUID());
  const packet = { format: 'test', counts: { User: 1 }, records: { User: [{ id: 'synthetic' }] } };
  assert.throws(() => writeHandover(packet, path.resolve(__dirname, '../frontend/public/export')), /PRIVATE_DESTINATION/);
  try {
    const result = writeHandover(packet, directory); assert.equal(result.files, 3);
    assert.equal(verifyHandover(directory).dataSha256, result.dataSha256);
    assert.throws(() => writeHandover(packet, directory), /DESTINATION_EXISTS/);
    fs.appendFileSync(path.join(directory, 'data.json'), 'tamper');
    assert.throws(() => verifyHandover(directory), /INTEGRITY_FAILED/);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), root);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('CLI refuses ambiguous input without a database connection or secret diagnostics', () => {
  const env = { ...process.env }; delete env.HUELLA_SUPPORT_EXPORT_DATABASE_URL;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'export-tenant-handover.cjs'), '--tenant=not-authorized'], { env, encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'HANDOVER_ARGUMENTS_REQUIRED');
});
