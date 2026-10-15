const { buildOperationalStore } = require('./infrastructure/operational/store');
const { buildOperationalInterpreter } = require('./infrastructure/operational/interpreter');
const { buildOperationalQueries } = require('./application/operational/queries');
const { buildOperationalAttention } = require('./application/operational/attention');
function buildOperationalContext({ prisma, unitOfWork, finance, inventory, events, interpret, clock, operatorAccess }) {
  const audit = require('./index').buildAgentAudit();
  const store = buildOperationalStore({ prisma, accessReader: inventory.accessReader, audit, operatorAccess, ...(clock ? { clock } : {}) });
  const commands = finance.buildTransactionalFinance({ unitOfWork });
  const attention = buildOperationalAttention({ store, finance: { ...finance, ...commands }, inventory,
    interpret: interpret || buildOperationalInterpreter(), read: buildOperationalQueries({ finance, inventory }) });
  return { ...attention, store, events };
}
module.exports = { buildOperationalContext };
