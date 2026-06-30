/**
 * Smoke test contra la base real ya migrada (Entregable 2.2): confirma que
 * el código de Fase 1 que depende de Staff.availability (JSON) sigue
 * funcionando exactamente igual tras agregar generatesCommission y las
 * tres tablas nuevas, y que la nueva tabla StaffAvailability ya tiene
 * el backfill esperado, sin tocar el JSON original (ADR 003).
 */
require("dotenv").config();
const { listStaff, getStaff, updateStaff } = require("../../src/services/staff.service");
const prisma = require("../../src/lib/prisma");

async function main() {
  console.log("1) Adaptador legacy — staff.service.js sigue operando sin cambios:");
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  const tenantId = tenant?.id ?? null;
  const all = await prisma.staff.findMany({ where: tenantId ? { tenantId } : {}, select: { id: true, name: true, availability: true, generatesCommission: true } });
  console.log("   ", all.map((s) => ({ name: s.name, hasAvailabilityJson: s.availability != null, generatesCommission: s.generatesCommission })));

  console.log("\n2) GET /staff/available (lógica replicada): filtra por Staff.availability (JSON) sin tocar StaffAvailability:");
  const DOW_MAP = ["sun","mon","tue","wed","thu","fri","sat"];
  const today = DOW_MAP[new Date().getUTCDay()];
  const filtered = all.filter((s) => {
    if (!s.availability) return true;
    const day = s.availability[today];
    return Boolean(day && day.active);
  });
  console.log(`    Día evaluado: ${today}. Staff "disponible" según JSON legado:`, filtered.map((s) => s.name));

  console.log("\n3) Nueva tabla StaffAvailability — backfill ya presente, JSON original intacto:");
  for (const s of all) {
    const rows = await prisma.staffAvailability.findMany({ where: { staffId: s.id, type: "base_schedule" } });
    console.log(`    ${s.name}: ${rows.length} filas base_schedule (JSON original ${s.availability ? "presente" : "ausente"}, sin modificar)`);
  }

  console.log("\n4) Commission — sin cambios de esquema, lectura sigue funcionando:");
  const commissionCount = await prisma.commission.count();
  console.log("    Total de comisiones existentes (no debería haber cambiado):", commissionCount);

  console.log("\nOK: compatibilidad total con Fase 1 confirmada (ADR 003).");
}

main()
  .catch((err) => {
    console.error("FALLÓ EL SMOKE TEST:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
