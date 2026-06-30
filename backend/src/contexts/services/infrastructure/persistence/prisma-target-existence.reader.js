const prisma = require("../../../../lib/prisma");
const { TargetExistenceReaderPort } = require("../../application/ports/target-existence-reader.port");

/**
 * Implementa la verificación mínima de existencia sobre los contextos
 * Clientes (modelo físico: User) y Mascotas (modelo físico: Pet), sin
 * incorporar su estructura completa a Servicios — solo lee lo necesario.
 */
class PrismaTargetExistenceReader extends TargetExistenceReaderPort {
  async clientExists(clientId) {
    const client = await prisma.user.findUnique({ where: { id: clientId }, select: { id: true } });
    return Boolean(client);
  }

  async petExists(petId) {
    const pet = await prisma.pet.findUnique({ where: { id: petId }, select: { id: true } });
    return Boolean(pet);
  }

  async getPetAttributes(petId) {
    const pet = await prisma.pet.findUnique({ where: { id: petId }, select: { breed: true } });
    if (!pet) return null;
    // El modelo físico Pet no persiste "tamaño" hoy; queda como atributo
    // ausente hasta que el contexto Mascotas lo incorpore (fuera de alcance
    // del Entregable 2.1). breed se mapea como breedId conceptual: el
    // esquema actual lo guarda como texto libre, no como referencia a un
    // catálogo de razas.
    return { breedId: pet.breed || null, size: null };
  }
}

module.exports = { PrismaTargetExistenceReader };
