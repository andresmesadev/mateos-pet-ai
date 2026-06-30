/**
 * Smoke test contra la base real ya migrada: confirma que el adaptador
 * legacy (service.service.js) y el nuevo contexto contexts/services
 * funcionan sobre el esquema físico aplicado. No crea datos persistentes
 * relevantes (limpia lo que crea).
 */
require("dotenv").config();
const { listServices, getService } = require("../../src/services/service.service");
const ctxServices = require("../../src/contexts/services");
const prisma = require("../../src/lib/prisma");

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  const tenantId = tenant?.id ?? null;

  console.log("1) Adaptador legacy — listServices() devuelve category como string:");
  const legacyList = await listServices(tenantId);
  console.log("   ", legacyList.slice(0, 2).map((s) => ({ name: s.name, category: s.category })));
  if (legacyList.some((s) => typeof s.category !== "string")) {
    throw new Error("FALLO: category no es string en el adaptador legacy");
  }

  console.log("2) Nuevo contexto — listAvailableServices use case:");
  const { services } = await ctxServices.listAvailableServices({ tenantId });
  console.log("   total:", services.length, "ejemplo:", services[0] && { name: services[0].name, categoryId: services[0].categoryId });

  console.log("3) Nuevo contexto — resolveServicePrice sobre el primer servicio:");
  if (services[0]) {
    const resolution = await ctxServices.resolveServicePrice({ serviceId: services[0].id });
    console.log("   ", resolution);
  }

  console.log("\nOK: ambos caminos (legacy y nuevo contexto) operan sobre el esquema migrado.");
}

main()
  .catch((err) => {
    console.error("FALLÓ EL SMOKE TEST:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
