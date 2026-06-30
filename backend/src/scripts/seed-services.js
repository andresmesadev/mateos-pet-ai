require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

const DEFAULT_SERVICES = [
  // Veterinaria
  { name: "Consulta general",        category: "veterinary", duration: 45, requiresAppointment: true },
  { name: "Exámenes laboratorio",    category: "veterinary", duration: 45, requiresAppointment: true },
  { name: "Rayos X",                 category: "veterinary", duration: 45, requiresAppointment: true },
  { name: "Ecografía",               category: "veterinary", duration: 45, requiresAppointment: true },
  { name: "Cirugía básica",          category: "veterinary", duration: 120, requiresAppointment: true },
  { name: "Urgencias",               category: "veterinary", duration: 45, requiresAppointment: true },
  // Grooming
  { name: "Baño básico",             category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Baño + corte",            category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Baño medicado",           category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Baño antipulgas",         category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Spa canino/felino",       category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Deslanado",               category: "grooming", duration: 60, requiresAppointment: true },
  { name: "Colorimetría",            category: "grooming", duration: 60, requiresAppointment: true },
  // Sin cita
  { name: "Vacunación",              category: "other", duration: 15, requiresAppointment: false },
  { name: "Desparasitación",         category: "other", duration: 15, requiresAppointment: false },
];

const SPLIT_BY_DEFAULT = { grooming: true, veterinary: false, other: false };

async function resolveCategoryId(tenantId, categoryName) {
  const existing = await prisma.serviceCategory.findFirst({
    where: { tenantId: tenantId ?? null, name: categoryName },
  });
  if (existing) return existing.id;
  const created = await prisma.serviceCategory.create({
    data: {
      tenantId: tenantId ?? null,
      name: categoryName,
      appliesCommissionSplit: SPLIT_BY_DEFAULT[categoryName] ?? false,
      active: true,
    },
  });
  return created.id;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });

  if (tenants.length === 0) {
    console.log("No hay tenants. Creando servicios globales (tenantId: null)...");
    for (const svc of DEFAULT_SERVICES) {
      const { category, ...rest } = svc;
      const categoryId = await resolveCategoryId(null, category);
      await prisma.service.upsert({
        where: { id: `global-${svc.name.toLowerCase().replace(/\s+/g, "-")}` },
        update: {},
        create: { id: `global-${svc.name.toLowerCase().replace(/\s+/g, "-")}`, ...rest, categoryId, tenantId: null },
      });
    }
  } else {
    for (const tenant of tenants) {
      console.log(`Seeding servicios para tenant: ${tenant.slug} (${tenant.id})`);
      const existing = await prisma.service.count({ where: { tenantId: tenant.id } });
      if (existing > 0) {
        console.log(`  → Ya tiene ${existing} servicios, saltando.`);
        continue;
      }
      for (const svc of DEFAULT_SERVICES) {
        const { category, ...rest } = svc;
        const categoryId = await resolveCategoryId(tenant.id, category);
        await prisma.service.create({ data: { ...rest, categoryId, tenantId: tenant.id } });
      }
      console.log(`  → ${DEFAULT_SERVICES.length} servicios creados.`);
    }
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
