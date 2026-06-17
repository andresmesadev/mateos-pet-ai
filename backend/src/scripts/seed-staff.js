require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

const DEFAULT_STAFF = [
  { name: "Lina María", role: "vet" },
  { name: "Andrés",     role: "admin" },
  { name: "Empleada grooming", role: "groomer" },
];

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });

  if (tenants.length === 0) {
    console.log("No hay tenants. Creando staff global (tenantId: null)...");
    for (const member of DEFAULT_STAFF) {
      await prisma.staff.create({ data: { ...member, tenantId: null } });
    }
  } else {
    for (const tenant of tenants) {
      console.log(`Seeding staff para tenant: ${tenant.slug} (${tenant.id})`);
      const existing = await prisma.staff.count({ where: { tenantId: tenant.id } });
      if (existing > 0) {
        console.log(`  → Ya tiene ${existing} miembros, saltando.`);
        continue;
      }
      for (const member of DEFAULT_STAFF) {
        await prisma.staff.create({ data: { ...member, tenantId: tenant.id } });
      }
      console.log(`  → ${DEFAULT_STAFF.length} miembros creados.`);
    }
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
