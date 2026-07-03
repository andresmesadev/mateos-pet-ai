const prisma = require("../../../lib/prisma");

/**
 * Unidad de Trabajo (Etapa 3 del Entregable Puente): ejecuta un comando y sus
 * reactivos dentro de una única transacción de base de datos. El contexto `ctx`
 * es opaco para los casos de uso — solo lo propagan; los adaptadores Prisma
 * usan `ctx.tx ?? prisma`.
 */
class PrismaUnitOfWork {
  async run(fn) {
    return prisma.$transaction((tx) => fn({ tx }));
  }
}

module.exports = { PrismaUnitOfWork };
