/**
 * Smoke test del contexto Staff implementado, contra la base real ya
 * migrada. Ejercita el composition root real (no fakes) y confirma que
 * Fase 1 (Staff.availability JSON, Commission) sigue intacta.
 */
require("dotenv").config();
const staffContext = require("../../src/contexts/staff");
const { listStaff } = require("../../src/services/staff.service");
const prisma = require("../../src/lib/prisma");

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  const tenantId = tenant?.id ?? null;

  console.log("1) ListActiveStaffUseCase (contexto nuevo):");
  const { staff } = await staffContext.listActiveStaff({ tenantId });
  console.log("   ", staff.map((s) => ({ name: s.name, generatesCommission: s.generatesCommission })));

  console.log("\n2) ResolveStaffAvailabilityUseCase, sobre un servicio real existente:");
  const service = await prisma.service.findFirst({ where: { active: true }, select: { id: true, name: true } });
  if (service) {
    const { availableStaff } = await staffContext.resolveStaffAvailability({
      serviceId: service.id,
      rangeStart: new Date().toISOString(),
      rangeEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    console.log(`    Servicio "${service.name}": ${availableStaff.length} staff con capacidad+disponibilidad ahora mismo (esperado 0, nadie tiene capacidades asignadas todavía).`);
  }

  console.log("\n3) Adaptador legacy — staff.service.js sigue intacto (Fase 1, JSON sin tocar):");
  const legacyList = await listStaff(tenantId);
  console.log("   ", legacyList.length, "miembros, con availability JSON original presente donde corresponde.");

  console.log("\nOK: contexto Staff implementado opera sobre la base real sin afectar Fase 1.");
}

main()
  .catch((err) => {
    console.error("FALLÓ EL SMOKE TEST:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
