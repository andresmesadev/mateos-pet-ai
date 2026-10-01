// Disposable UI fixture for checking profile persistence on the local dashboard.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
const assert = require("node:assert/strict");
const prisma = require("../backend/src/lib/prisma");
const ownerId = "local-contact-ficha-check-owner";
const petId = "local-contact-ficha-check-pet";
const fixtureName = "Prueba ficha (temporal)";
const savedNotes = "Observaciones de prueba guardadas.\nSegunda línea de cuidados.";

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Solo se permite una base local");
  assert.equal(url.pathname, "/mateos_dev", "Solo se permite la base de desarrollo");
  const tenantId = process.env.SINGLE_TENANT_ID;
  assert(tenantId, "Falta SINGLE_TENANT_ID para verificar el mismo establecimiento del dashboard");
  const mode = process.argv[2];
  if (mode === "prepare") {
    assert.equal(await prisma.user.count({ where: { id: ownerId } }), 0, "La fixture ya existe; revísala antes de reutilizarla");
    await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { id: ownerId, tenantId, name: "Propietario de prueba de ficha", phone: "000000009930" } });
      await tx.pet.create({ data: { id: petId, tenantId, ownerId, name: fixtureName, type: "dog", breed: "Mestizo", notes: "Observaciones originales de prueba." } });
    });
    console.log("Fixture local preparada: Prueba ficha (temporal). No se crearon citas ni mensajes.");
  } else if (mode === "verify") {
    const pet = await prisma.pet.findUniqueOrThrow({ where: { id: petId } });
    assert.equal(pet.tenantId, tenantId);
    assert.equal(pet.notes, savedNotes);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    assert.equal(owner.notes, "Nota de propietario guardada en la comprobación local.");
    console.log("PASS: las notas de mascota y propietario se guardaron realmente en PostgreSQL.");
  } else if (mode === "cleanup") {
    await prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findUniqueOrThrow({ where: { id: petId } });
      const owner = await tx.user.findUniqueOrThrow({ where: { id: ownerId } });
      assert.equal(pet.ownerId, ownerId); assert.equal(pet.name, fixtureName); assert.equal(pet.tenantId, tenantId);
      assert.equal(owner.name, "Propietario de prueba de ficha"); assert.equal(owner.phone, "000000009930");
      assert.equal(await tx.appointment.count({ where: { OR: [{ petId }, { userId: ownerId }] } }), 0);
      assert.equal(await tx.medicalRecord.count({ where: { petId } }), 0);
      assert.equal(await tx.pet.count({ where: { ownerId } }), 1);
      await tx.pet.delete({ where: { id: petId } });
      await tx.user.delete({ where: { id: ownerId } });
    });
    assert.equal(await prisma.pet.count({ where: { id: petId } }), 0);
    console.log("PASS: fixture eliminada; se conservaron los registros existentes.");
  } else throw new Error("Usa prepare, verify o cleanup.");
}
main().catch((cause) => { console.error(cause.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
