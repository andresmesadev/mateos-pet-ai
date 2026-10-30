jest.mock('../../services/whatsapp.service', () => ({
  verifyWebhookSignature: jest.fn(),
  parseIncomingMessages: body => body.entry.flatMap(e => e.changes.flatMap(c => (c.value.messages || []).map(m => ({ wamid: m.id, from: m.from })))),
  parseIncomingMessage: jest.fn(),
}));
jest.mock('../../services/whatsapp-route.service', () => ({ receiver: jest.fn() }));
jest.mock('../../services/whatsapp-delivery-receipt.service', () => ({ recordDeliveryReceipts: jest.fn() }));
jest.mock('../../services/inbound-job.service', () => ({ enqueueInboundJob: jest.fn(), enqueueOperatorJob: jest.fn() }));
jest.mock('../../jobs/inbound-message.job', () => ({ requestInboundDrain: jest.fn() }));
jest.mock('../../contexts', () => ({ operatorChannel: { ingress: jest.fn(async () => ({ handled: new Set(), created: false })) } }));
const { receiver } = require('../../services/whatsapp-route.service');
const { enqueueInboundJob } = require('../../services/inbound-job.service');
const { providerScope } = require('../../lib/provider-execution');
const { receiveWebhook } = require('../../controllers/webhook.controller');
const original = process.env;
beforeEach(() => { jest.clearAllMocks(); process.env = { ...original, WHATSAPP_ENABLED: 'true', WHATSAPP_MULTITENANT_ENABLED: 'true' }; });
afterEach(() => { process.env = original; });
const entry = (tenantId,field = 'messages',waba = tenantId+'-account') => ({ id: waba, changes: [{ field,value: { metadata: { phone_number_id: tenantId+'-phone' }, messages: [{ id: 'wamid-'+tenantId, from: '573000000001',type: 'text',text: { body: 'synthetic' } }] } }] });
test('a signed multi-account envelope is split into isolated tenant turns; unknown accounts and history are ignored', async () => {
  receiver.mockImplementation(async (phone,waba) => ['a','b'].some(t => phone === t+'-phone' && waba === t+'-account') ? { tenantId: phone[0], receiver: phone, wabaId: waba, connectionId: phone[0]+'-connection', routeVersion: 4, accessToken: 'synthetic' } : null);
  const scopes = [];
  enqueueInboundJob.mockImplementation(async () => { scopes.push(providerScope()); return { created: true }; });
  const res = { sendStatus: jest.fn() }, next = jest.fn();
  await receiveWebhook({ body: { object: 'whatsapp_business_account',entry: [entry('a'),entry('b'),entry('c'),entry('b','messages','a-account'),entry('a','history')] } },res,next);
  expect(next).not.toHaveBeenCalled(); expect(res.sendStatus).toHaveBeenCalledWith(200);
  expect(enqueueInboundJob).toHaveBeenCalledTimes(2); expect(scopes.map(s => s.tenantId)).toEqual(['a','b']);
  expect(enqueueInboundJob.mock.calls.map(([data]) => data.payload.entry[0].id)).toEqual(['a-account','b-account']);
});
