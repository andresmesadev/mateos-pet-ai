require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");
const { provisionDefaultDigitalEmployees, DEFAULT_SPECIALIZATIONS } = require("../services/tenant-provisioning.service");

// Precondición operativa de 3.4/3.5: debe existir un DigitalEmployee por
// especialización antes de que su respectivo caso de uso pueda procesar
// (ReceptionistNotConfiguredError / ScheduleCoordinatorNotConfiguredError si
// no existe). Idempotente.
//
// Entregable 4.2 — Onboarding Autónomo: la lógica de aprovisionamiento
// (lista de especializaciones + ensure-o-crea) se extrajo a
// tenant-provisioning.service.js para que este script manual y el flujo
// automático de registro (onboarding.routes.js) reutilicen la misma
// implementación, sin duplicarla. Este script queda como herramienta de
// backfill para tenants que no pasaron por el registro autónomo (o para
// re-sembrar tras extender DEFAULT_SPECIALIZATIONS a futuro).

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { active: true } });

  const tenantIds = tenants.length === 0 ? [null] : tenants.map((t) => t.id);
  if (tenants.length === 0) {
    console.log("Sin tenants activos — registrando Empleados Digitales globales (tenantId=null).");
  }

  console.log(`Especializaciones a sembrar: ${DEFAULT_SPECIALIZATIONS.join(", ")}`);

  for (const tenantId of tenantIds) {
    const { results } = await provisionDefaultDigitalEmployees(tenantId);
    for (const result of results) {
      if (result.error) {
        console.error(`  → "${result.specialization}" falló para tenant "${tenantId ?? "(global)"}": ${result.error}`);
      } else if (result.created) {
        console.log(`  → "${result.specialization}" registrado para tenant "${tenantId ?? "(global)"}" (id=${result.digitalEmployeeId}).`);
      } else {
        console.log(`  → "${result.specialization}" ya existe para tenant "${tenantId ?? "(global)"}" (id=${result.digitalEmployeeId}).`);
      }
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
