require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");
const agents = require("../contexts/agents");

// Precondición operativa del Entregable 3.4: debe existir un DigitalEmployee
// con specialization "recepcionista" antes de que un mensaje entrante pueda
// procesarse (ProcessIncomingMessageUseCase lo exige — ReceptionistNotConfiguredError
// si no existe). Idempotente: no crea uno nuevo si el tenant ya tiene uno.
// Usa el caso de uso ya expuesto por Empleados Digitales (agents.registerDigitalEmployee),
// no inserción directa por Prisma — a diferencia de seed-event-types.js, aquí
// sí existe un caso de uso de Administración que cumple la misma función y
// aplica sus propias validaciones (Etapa 4, sección "Seed operativo").
const SPECIALIZATION = "recepcionista";

async function ensureReceptionistForTenant(tenantId) {
  const { digitalEmployees } = await agents.getDigitalEmployees({ tenantId });
  const existing = digitalEmployees.find((e) => e.specialization === SPECIALIZATION);
  if (existing) {
    console.log(`  → Recepcionista ya existe para tenant "${tenantId ?? "(global)"}" (id=${existing.id}, status=${existing.status}).`);
    return;
  }
  const { digitalEmployee } = await agents.registerDigitalEmployee({ tenantId, specialization: SPECIALIZATION });
  console.log(`  → Recepcionista registrada para tenant "${tenantId ?? "(global)"}" (id=${digitalEmployee.id}).`);
}

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { active: true } });

  if (tenants.length === 0) {
    console.log("Sin tenants activos — registrando Recepcionista global (tenantId=null).");
    await ensureReceptionistForTenant(null);
  } else {
    for (const tenant of tenants) {
      await ensureReceptionistForTenant(tenant.id);
    }
  }

  console.log("Seed de Empleados Digitales completado.");
}

main()
  .catch((error) => {
    console.error("Seed de Empleados Digitales falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
