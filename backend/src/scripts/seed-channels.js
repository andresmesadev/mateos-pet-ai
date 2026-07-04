require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

// Precondición operativa del Entregable 3.1: debe existir un Canal global
// activo de tipo "whatsapp" antes de que "Enviar Mensaje" pueda resolver un
// Canal (NoActiveChannelError si no existe). Idempotente: no falla si ya existe.
const DEFAULT_CHANNELS = [{ tenantId: null, type: "whatsapp" }];

async function main() {
  for (const channel of DEFAULT_CHANNELS) {
    const existing = await prisma.channel.findFirst({
      where: { tenantId: channel.tenantId, type: channel.type },
    });
    if (existing) {
      console.log(`  → Canal "${channel.type}" (tenantId=${channel.tenantId}) ya existe (activo=${existing.active}).`);
      continue;
    }
    await prisma.channel.create({ data: channel });
    console.log(`  → Canal "${channel.type}" (tenantId=${channel.tenantId}) registrado.`);
  }
  console.log("Seed de Canales completado.");
}

main()
  .catch((error) => {
    console.error("Seed de Canales falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
