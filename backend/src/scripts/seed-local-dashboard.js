// Sample records for an isolated local development database only.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

function assertLocalDatabase() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.MATEOS_LOCAL_DEV_SEED !== "1" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/mateos_dev"
  ) {
    throw new Error("Seed permitido solo en PostgreSQL local mateos_dev:5433");
  }
}

async function main() {
  assertLocalDatabase();
  const tenantId = process.env.SINGLE_TENANT_ID;
  if (!tenantId || !(await prisma.tenant.findUnique({ where: { id: tenantId } }))) {
    throw new Error("SINGLE_TENANT_ID local no está configurado");
  }

  const vet = await prisma.staff.findFirst({ where: { tenantId, role: "vet" } });
  const service = await prisma.service.findFirst({
    where: { tenantId, name: "Consulta general" },
  });
  if (!vet || !service) throw new Error("Primero ejecuta seed-staff y seed-services");

  const today = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const examples = [
    { id: "local-consulta-luna", name: "Luna", owner: "Camila Ruiz", phone: "000000000001", time: "09:00", status: "confirmed" },
    { id: "local-consulta-milo", name: "Milo", owner: "Andrés Pérez", phone: "000000000002", time: "10:30", status: "arrived" },
    { id: "local-consulta-nala", name: "Nala", owner: "Santiago Ríos", phone: "000000000003", time: "11:30", status: "in_progress" },
    { id: "local-consulta-bruno", name: "Bruno", owner: "Mariana Torres", phone: "000000000004", time: "15:00", status: "completed" },
  ];

  for (const item of examples) {
    const user = await prisma.user.upsert({
      where: { tenantId_phone: { tenantId, phone: item.phone } },
      update: { name: item.owner },
      create: { tenantId, phone: item.phone, name: item.owner },
    });
    const petId = `${item.id}-pet`;
    await prisma.pet.upsert({
      where: { id: petId },
      update: { name: item.name, ownerId: user.id },
      create: { id: petId, tenantId, ownerId: user.id, name: item.name, type: "cat" },
    });
    await prisma.appointment.upsert({
      where: { id: item.id },
      update: { date: new Date(`${today}T${item.time}:00-05:00`) },
      create: {
        id: item.id, tenantId, userId: user.id, petId,
        petName: item.name, petType: "cat", serviceType: "vet",
        serviceId: service.id, staffId: vet.id,
        date: new Date(`${today}T${item.time}:00-05:00`), status: item.status,
      },
    });
  }
  console.log(JSON.stringify({ tenantId, sampleAppointments: examples.length }));
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
