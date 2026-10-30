jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn() }, whatsAppConnection: { findUnique: jest.fn() }, channel: { findUnique: jest.fn() } }));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(() => true), promises: { writeFile: jest.fn(), unlink: jest.fn() } }));
const db = require('../../lib/prisma'), axios = require('axios');
const { encryptProviderToken } = require('../../services/provider-credential.service');
const { runProviderScope, routeSnapshot } = require('../../lib/provider-execution');
const { outbound } = require('../../services/whatsapp-route.service');
const { WhatsAppChannelProvider } = require('../../contexts/communication/infrastructure/providers/whatsapp-channel-provider');
const { buildOperatorWhatsappProvider } = require('../../contexts/communication/infrastructure/providers/operator-whatsapp-provider');
const { downloadWhatsAppAudio } = require('../../services/audio.service');
const original = process.env; let tenants, connections;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...original, WHATSAPP_ENABLED: 'true', WHATSAPP_MULTITENANT_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '100001', WHATSAPP_ACCESS_TOKEN: 'synthetic-global', PROVIDER_CREDENTIAL_KEY: Buffer.alloc(32,7).toString('base64') };
  tenants = Object.fromEntries(['a','b'].map((key,i) => [key,{ id: key, active: true, phone: String(100001+i) }]));
  connections = Object.fromEntries(['a','b'].map(key => [key,{ id: key+'-connection', tenantId: key, channelId: key+'-channel', phoneNumberId: tenants[key].phone, wabaId: key+'-account', status: 'enabled', routeVersion: 1,
    encryptedToken: encryptProviderToken('synthetic-token-'+key,key,key+'-connection'), tokenExpiresAt: null }]));
  db.tenant.findUnique.mockImplementation(async ({ where }) => tenants[where.id] || null);
  db.whatsAppConnection.findUnique.mockImplementation(async ({ where }) => connections[where.tenantId] || null);
  db.channel.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, tenantId: where.id[0], type: 'whatsapp', active: true }));
  axios.post.mockResolvedValue({ data: { messages: [{ id: 'wamid.synthetic' }] } });
  axios.get.mockImplementation(async url => url.includes('graph.facebook.com') ? { data: { url: 'https://lookaside.fbsbx.com/audio', mime_type: 'audio/ogg' } } : { data: Buffer.from('synthetic') });
});
afterEach(() => { process.env = original; });
test('text, templates and private messages use each tenant credentials under concurrent scopes', async () => {
  const provider = new WhatsAppChannelProvider();
  await Promise.all(['a','b'].map(async tenantId => {
    const route = await outbound(tenantId);
    await runProviderScope({ tenantId, whatsapp: route },async () => {
      await provider.send('whatsapp','573000000001','synthetic',{ tenantId, channelId: tenantId+'-channel' });
      await provider.sendTemplate('whatsapp','573000000001','synthetic','es',[],{ tenantId, channelId: tenantId+'-channel' });
      await buildOperatorWhatsappProvider()({ receiver: route.receiver, phone: '573000000001', text: 'private synthetic' });
    });
  }));
  expect(axios.post).toHaveBeenCalledTimes(6);
  for (const [url,,options] of axios.post.mock.calls) expect(options.headers.Authorization).toBe(url.includes('/100001/') ? 'Bearer synthetic-token-a' : 'Bearer synthetic-token-b');
});
test('audio metadata and download both use the selected tenant token', async () => {
  const route = await outbound('b');
  const file = await runProviderScope({ tenantId: 'b', whatsapp: route },() => downloadWhatsAppAudio('12345'));
  expect(file).toContain('wa-audio-12345-'); expect(axios.get).toHaveBeenCalledTimes(2);
  expect(axios.get.mock.calls.every(([,options]) => options.headers.Authorization === 'Bearer synthetic-token-b')).toBe(true);
});
test('expired/revoked grants and disabled commercial mode never use the legacy token', async () => {
  connections.a.tokenExpiresAt = new Date(0); expect(await outbound('a')).toBeNull();
  connections.a.tokenExpiresAt = null; connections.a.status = 'revoked'; expect(await outbound('a')).toBeNull();
  connections.a.status = 'enabled'; process.env.WHATSAPP_MULTITENANT_ENABLED = 'false'; expect(await outbound('a')).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});
test('stale or foreign scopes cannot switch credential versions at the delivery boundary', async () => {
  const route = await outbound('a'); connections.a.routeVersion++;
  await expect(runProviderScope({ tenantId: 'a', whatsapp: route },() => new WhatsAppChannelProvider().send('whatsapp','573000000001','synthetic',{ tenantId: 'a', channelId: 'a-channel' }))).rejects.toMatchObject({ code: 'WHATSAPP_ROUTE_NOT_CONFIGURED' });
  await expect(runProviderScope({ tenantId: 'a', whatsapp: route },() => new WhatsAppChannelProvider().send('whatsapp','573000000001','synthetic',{ tenantId: 'b', channelId: 'b-channel' }))).rejects.toMatchObject({ code: 'WHATSAPP_ROUTE_NOT_CONFIGURED' });
  expect(axios.post).not.toHaveBeenCalled(); expect(await outbound('b',routeSnapshot(route))).toBeNull();
});
test.each(['http://127.0.0.1/','https://attacker.invalid/audio','https://lookaside.fbsbx.com.attacker.invalid/audio','https://lookaside.fbsbx.com:8443/audio'])('does not send media credentials to %s', async url => {
  axios.get.mockResolvedValue({ data: { url } }); const route = await outbound('b');
  await expect(runProviderScope({ tenantId: 'b', whatsapp: route },() => downloadWhatsAppAudio('12345'))).resolves.toBeNull(); expect(axios.get).toHaveBeenCalledTimes(1);
});
