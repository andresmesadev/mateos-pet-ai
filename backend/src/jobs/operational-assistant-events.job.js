const cron = require('node-cron');
const logger = require('../lib/logger');
const { operationalAssistants, events } = require('../contexts');
const { buildOperationalWorker } = require('../contexts/agents/infrastructure/operational/worker');
const worker = buildOperationalWorker({ prisma: require('../lib/prisma'), store: operationalAssistants.store, events });
function startOperationalAssistantEventsJob() {
  let running = false;
  return cron.schedule('* * * * *', async () => {
    if (running) return; running = true;
    try { const summary = await worker.tick(); if (Object.values(summary).some(Boolean)) logger.info('[OperationalAssistantWorker] Sweep', summary); }
    catch (e) { logger.error('[OperationalAssistantWorker] Sweep failed', { code: e.code || e.name }); }
    finally { running = false; }
  });
}
module.exports = { startOperationalAssistantEventsJob };
