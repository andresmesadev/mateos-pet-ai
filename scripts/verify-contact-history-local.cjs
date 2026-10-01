// Disposable local-only fixture for history, allergy summaries and quick record forms.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
const assert = require("node:assert/strict");
const prisma = require("../backend/src/lib/prisma");
const ownerId = "local-contact-history-check-owner", petId = "local-contact-history-check-pet";
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.equal(url.pathname, "/mateos_dev");
  const tenantId = process.env.SINGLE_TENANT_ID; assert(tenantId);
  const mode = process.argv[2];
  if (mode === "prepare") {
    assert.equal(await prisma.user.count({ where: { id: ownerId } }), 0);
    await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { id: ownerId, tenantId, name: "Prueba historial propietario", phone: "000000009931" } });
      await tx.pet.create({ data: { id: petId, tenantId, ownerId, name: "Prueba historial temporal", type: "dog", breed: "Mestizo", birthDate: new Date("2024-09-29T12:00:00Z"), weight: 8.5 } });
      await tx.medicalRecord.create({ data: { petId, type: "allergy", title: "Alergia de prueba", detail: "Observación temporal para comprobar la ficha.", date: new Date("2025-09-01T12:00:00Z") } });
      await tx.medicalRecord.create({ data: { petId, type: "note", title: "Observación de prueba 2025", detail: "Reacción cutánea de prueba.\nSegunda línea del antecedente.", date: new Date("2025-09-01T12:00:00Z") } });
    });
    console.log("PASS: fixture preparada sin citas ni mensajes.");
  } else if (mode === "verify") {
    const row = await prisma.medicalRecord.findFirstOrThrow({ where: { petId, title: "Comprobación de vacuna temporal", type: "vaccine" } });
    assert.equal(row.detail, "Observación de prueba.\nSegunda línea conservada.");
    assert.equal(row.date?.toISOString().slice(0, 10), "2026-09-30");
    assert.equal(row.nextControlAt?.toISOString().slice(0, 10), "2026-10-30");
    console.log("PASS: registro, fechas y saltos de línea guardados en PostgreSQL.");
  } else if (mode === "cleanup") {
    await prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findUniqueOrThrow({ where: { id: petId } });
      const owner = await tx.user.findUniqueOrThrow({ where: { id: ownerId } });
      assert.equal(pet.ownerId, ownerId); assert.equal(pet.tenantId, tenantId); assert.equal(pet.name, "Prueba historial temporal");
      assert.equal(owner.phone, "000000009931"); assert.equal(owner.name, "Prueba historial propietario");
      assert.equal(await tx.appointment.count({ where: { OR: [{ petId }, { userId: ownerId }] } }), 0);
      assert.equal(await tx.pet.count({ where: { ownerId } }), 1);
      const recordIds = (await tx.medicalRecord.findMany({ where: { petId }, select: { id: true } })).map((row) => row.id);
      assert.equal(await tx.medicalRecordRevision.count({ where: { recordId: { in: recordIds } } }), 0);
      await tx.petNextAction.deleteMany({ where: { petId } });
      await tx.medicalRecord.deleteMany({ where: { petId } });
      await tx.pet.delete({ where: { id: petId } }); await tx.user.delete({ where: { id: ownerId } });
    });
    console.log("PASS: fixture retirada; registros anteriores conservados.");
  } else throw new Error("Usa prepare, verify o cleanup.");
}
main().catch((cause) => { console.error(cause.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
