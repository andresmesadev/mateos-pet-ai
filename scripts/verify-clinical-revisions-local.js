// Verificación de persistencia real que revierte todos sus cambios.
require("dotenv").config();
const assert = require("node:assert/strict");
const { saveConsultationRecord, snapshot } = require("../backend/src/services/clinical-record-revision.service");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost", "::1"].includes(url.hostname), "Solo se permite una base local");
  const prisma = require("../backend/src/lib/prisma");
  try {
    const original = await prisma.medicalRecord.findFirst({ where: { appointmentId: { not: null } }, include: { appointment: true } });
    assert(original, "Se necesita al menos un registro de consulta local para verificar");
    const count = await prisma.medicalRecordRevision.count({ where: { recordId: original.id } });
    const rollback = new Error("ROLLBACK_VERIFICATION");
    try {
      await prisma.$transaction(async (tx) => {
        const result = await saveConsultationRecord(tx, {
          appointment: original.appointment, createData: {}, updateData: { findings: "Prueba local de revisión; se revierte" }, include: {}, expectedVersion: original.version,
          correctionReason: "Verificación técnica local con rollback", actor: { type: "admin", name: "Verificación local" },
        });
        assert.equal(result.version, original.version + 1);
        const revision = await tx.medicalRecordRevision.findUnique({ where: { recordId_version: { recordId: original.id, version: original.version } } });
        assert.deepEqual(revision.before, snapshot(original));
        assert.equal(revision.after.findings, "Prueba local de revisión; se revierte");
        assert.equal(await tx.medicalRecordRevision.count({ where: { recordId: original.id } }), count + 1);
        throw rollback;
      }, { isolationLevel: "Serializable" });
    } catch (error) { if (error !== rollback && error.message !== rollback.message) throw error; }
    const after = await prisma.medicalRecord.findUnique({ where: { id: original.id } });
    assert.equal(after.version, original.version);
    assert.deepEqual(snapshot(after), snapshot(original));
    assert.equal(await prisma.medicalRecordRevision.count({ where: { recordId: original.id } }), count);
    console.log("Clinical revisions: real persistence verified; transaction rolled back; original data unchanged.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
