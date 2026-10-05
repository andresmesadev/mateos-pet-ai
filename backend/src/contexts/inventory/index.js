const { PrismaInventoryRepository } = require('./infrastructure/prisma-inventory.repository');
const { PrismaInventoryAccessReader } = require('./infrastructure/prisma-access.reader');
const { buildInventoryCommands } = require('./application/use-cases/inventory.commands');
const { buildInventoryReads } = require('./application/use-cases/inventory.reads');
const { assertPorts } = require('./application/ports/contracts');
function buildInventoryContext({ unitOfWork, eventPublisher, clock }) {
  const repository = new PrismaInventoryRepository(), accessReader = new PrismaInventoryAccessReader();
  assertPorts(Object.fromEntries(['ProductRepository','StockRepository','MovementRepository','OperationRepository','AttentionAccessReader','SaleReader'].map(k => [k, repository]).concat([['AccessReader', accessReader]])));
  const deps = { repository, accessReader, unitOfWork, eventPublisher, ...(clock ? { clock } : {}) };
  return { repository, accessReader, commands: buildInventoryCommands(deps), reads: buildInventoryReads(deps) };
}
module.exports = { buildInventoryContext };
