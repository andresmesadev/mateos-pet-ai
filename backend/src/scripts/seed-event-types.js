require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

// Precondición operativa del Entregable 3.0: "CitaCompletada" debe existir y
// estar activo en el Catálogo (Invariante 2) antes de que el comando
// Completar Cita del contexto Agenda pueda certificarlo como Evento de
// Dominio. Idempotente: no falla si el tipo ya existe.
const DEFAULT_EVENT_TYPES = [
  {
    name: "CitaCompletada",
    originContext: "Agenda",
    payloadContractDescription:
      "tenantId, appointmentId, staffId?, serviceId?, serviceType?, resolvedPrice, priceSource, completedAt",
  },
];

async function main() {
  for (const eventType of DEFAULT_EVENT_TYPES) {
    const existing = await prisma.eventType.findUnique({ where: { name: eventType.name } });
    if (existing) {
      console.log(`  → "${eventType.name}" ya existe en el Catálogo (activo=${existing.active}).`);
      continue;
    }
    await prisma.eventType.create({ data: eventType });
    console.log(`  → "${eventType.name}" registrado en el Catálogo.`);
  }
  console.log("Seed de Tipos de Evento completado.");
}

main()
  .catch((error) => {
    console.error("Seed de Tipos de Evento falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
