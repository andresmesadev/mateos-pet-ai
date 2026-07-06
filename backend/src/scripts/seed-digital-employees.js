require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");
const agents = require("../contexts/agents");

// Precondición operativa de 3.4/3.5: debe existir un DigitalEmployee por
// especialización antes de que su respectivo caso de uso pueda procesar
// (ReceptionistNotConfiguredError / ScheduleCoordinatorNotConfiguredError si
// no existe). Idempotente: no crea uno nuevo si el tenant ya tiene uno de esa
// especialización. Usa el caso de uso ya expuesto por Empleados Digitales
// (agents.registerDigitalEmployee), no inserción directa por Prisma — a
// diferencia de seed-event-types.js, aquí sí existe un caso de uso de
// Administración que cumple la misma función y aplica sus propias
// validaciones (Etapa 4, sección "Seed operativo").
//
// Lista extensible entregable a entregable — mismo criterio que
// DEFAULT_EVENT_TYPES en seed-event-types.js (3.0). Añadir una especialización
// aquí es una extensión aditiva, no una reapertura del entregable que la
// introdujo.
const SPECIALIZATIONS_TO_SEED = ["recepcionista", "coordinador_agenda"];

async function ensureDigitalEmployeeForTenant(tenantId, specialization) {
  const { digitalEmployees } = await agents.getDigitalEmployees({ tenantId });
  const existing = digitalEmployees.find((e) => e.specialization === specialization);
  if (existing) {
    console.log(`  → "${specialization}" ya existe para tenant "${tenantId ?? "(global)"}" (id=${existing.id}, status=${existing.status}).`);
    return;
  }
  const { digitalEmployee } = await agents.registerDigitalEmployee({ tenantId, specialization });
  console.log(`  → "${specialization}" registrado para tenant "${tenantId ?? "(global)"}" (id=${digitalEmployee.id}).`);
}

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { active: true } });

  const tenantIds = tenants.length === 0 ? [null] : tenants.map((t) => t.id);
  if (tenants.length === 0) {
    console.log("Sin tenants activos — registrando Empleados Digitales globales (tenantId=null).");
  }

  for (const tenantId of tenantIds) {
    for (const specialization of SPECIALIZATIONS_TO_SEED) {
      await ensureDigitalEmployeeForTenant(tenantId, specialization);
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
