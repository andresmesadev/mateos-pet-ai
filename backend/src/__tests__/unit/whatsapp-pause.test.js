jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../services/inbound-job.service', () => ({ enqueueInboundJob: jest.fn(), claimNextInboundJob: jest.fn() }));
const axios = require('axios');
const jobs = require('../../services/inbound-job.service');
const { isWhatsAppEnabled } = require('../../lib/whatsapp-runtime');
const { sendWhatsAppMessage, sendWhatsAppTemplateMessage } = require('../../services/whatsapp-api.service');
const { verifyWebhook, receiveWebhook } = require('../../controllers/webhook.controller');
const { processOneJob } = require('../../jobs/inbound-message.job');
const previous = process.env.WHATSAPP_ENABLED;
beforeEach(() => { jest.clearAllMocks(); process.env.WHATSAPP_ENABLED = 'false'; });
afterEach(() => { if (previous === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous; });
test('pause blocks text and templates before provider HTTP even when credentials exist', async () => {
  expect(await sendWhatsAppMessage('fixture', 'texto')).toBeNull();
  expect(await sendWhatsAppTemplateMessage('fixture', 'template', 'es')).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});
test('paused webhook rejects both verification and incoming batches without enqueueing', async () => {
  const res = { sendStatus: jest.fn() };
  verifyWebhook({}, res, jest.fn()); await receiveWebhook({}, res, jest.fn());
  expect(res.sendStatus.mock.calls).toEqual([[503], [503]]);
  expect(jobs.enqueueInboundJob).not.toHaveBeenCalled();
});
test('paused worker leaves durable jobs unclaimed and absence of flag preserves compatibility', async () => {
  expect(await processOneJob()).toBe(false); expect(jobs.claimNextInboundJob).not.toHaveBeenCalled();
  delete process.env.WHATSAPP_ENABLED; expect(isWhatsAppEnabled()).toBe(true);
  process.env.WHATSAPP_ENABLED = 'true'; expect(isWhatsAppEnabled()).toBe(true);
});
test('an intentional pause is reported as paused and healthy, without claiming worker success', () => {
  const { getInboundWorkerHealth, resetOperationalHealthForTests } = require('../../services/operational-health.service');
  resetOperationalHealthForTests();
  expect(getInboundWorkerHealth()).toMatchObject({ status: 'paused', healthy: true, lastSuccessAt: null });
});
