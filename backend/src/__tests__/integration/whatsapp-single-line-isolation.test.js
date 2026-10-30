const axios = require('axios');
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../lib/prisma', () => ({ whatsAppConnection: { findUnique: jest.fn().mockResolvedValue(null) }, tenant: { findUnique: jest.fn() }, channel: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() } }));
const prisma = require('../../lib/prisma');
const { PrismaChannelRepository } = require('../../contexts/communication/infrastructure/persistence/prisma-channel.repository');
const { buildChannelProviderRegistry } = require('../../contexts/communication/infrastructure/providers/channel-provider-registry');
const { WhatsAppChannelProvider } = require('../../contexts/communication/infrastructure/providers/whatsapp-channel-provider');
const { createSendMessageUseCase } = require('../../contexts/communication/application/use-cases/send-message.usecase');
const { createSendTemplateMessageUseCase } = require('../../contexts/communication/application/use-cases/send-template-message.usecase');
const originalEnv = process.env;
let tenants, channels;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, WHATSAPP_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '100001', WHATSAPP_ACCESS_TOKEN: 'synthetic-token-only' };
  tenants = { 'tenant-a': { id: 'tenant-a', phone: '100001', active: true }, 'tenant-b': { id: 'tenant-b', phone: '100002', active: true } };
  channels = [{ id: 'global', type: 'whatsapp', active: true, tenantId: null }];
  prisma.tenant.findUnique.mockImplementation(async ({ where }) => tenants[where.id] ?? null);
  prisma.channel.findFirst.mockImplementation(async ({ where }) => channels.find(c => c.tenantId === where.tenantId && c.active === where.active) ?? null);
  prisma.channel.findUnique.mockImplementation(async ({ where }) => channels.find(c => c.id === where.id) ?? null);
  axios.post.mockResolvedValue({ data: { messages: [{ id: 'wamid-synthetic' }] } });
});
afterEach(() => { process.env = originalEnv; });
function useCase(kind, beforeDelivery = () => {}) {
  const messageRepository = { create: jest.fn(async data => ({ id: 'message-demo', ...data })) };
  const eventPublisher = { publish: jest.fn() };
  const conversationRepository = { findOrCreateActiveForUser: jest.fn(async () => { beforeDelivery(); return { id: 'conversation-demo' }; }) };
  const deps = { channelRepository: new PrismaChannelRepository(), channelProvider: buildChannelProviderRegistry(), messageRepository, eventPublisher, conversationRepository };
  const execute = kind === 'text' ? createSendMessageUseCase(deps) : createSendTemplateMessageUseCase(deps);
  return { ...deps, execute: (tenantId = 'tenant-a') => execute({ tenantId, userId: 'user-demo', phone: '573000000001', content: 'Synthetic message', origin: 'sistema', templateName: 'synthetic_template', languageCode: 'es', components: [] }) };
}
for (const kind of ['text', 'template']) describe(kind + ' delivery through actual case/repository/registry/provider/transport', () => {
  test('the bound active tenant can use its inherited global channel', async () => {
    const f = useCase(kind); const result = await f.execute();
    expect(result.message.id).toBe('message-demo');
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v25.0/100001/messages');
    expect(body.to).toBe('573000000001');
    expect(options.headers.Authorization).toBe('Bearer synthetic-token-only');
    expect(f.eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(prisma.channel.create).not.toHaveBeenCalled();
  });
  test('an active second business does not inherit the global line', async () => {
    const f = useCase(kind); await expect(f.execute('tenant-b')).rejects.toMatchObject({ name: 'NoActiveChannelError' });
    expect(axios.post).not.toHaveBeenCalled(); expect(f.messageRepository.create).not.toHaveBeenCalled();
    expect(f.eventPublisher.publish).not.toHaveBeenCalled(); expect(f.conversationRepository.findOrCreateActiveForUser).not.toHaveBeenCalled();
  });
  test('a second business own Channel is not a configured provider connection', async () => {
    channels.push({ id: 'own-b', tenantId: 'tenant-b', type: 'whatsapp', active: true });
    const f = useCase(kind); await expect(f.execute('tenant-b')).rejects.toMatchObject({ name: 'NoActiveChannelError' });
    expect(axios.post).not.toHaveBeenCalled(); expect(f.messageRepository.create).not.toHaveBeenCalled();
  });
  test.each([null, undefined, 'unknown'])('an unidentified business %s cannot use the global channel', async tenantId => {
    const f = useCase(kind);
    // Avoid the convenience fixture default for undefined.
    await expect((kind === 'text' ? createSendMessageUseCase(f) : createSendTemplateMessageUseCase(f))({ tenantId, userId: 'u', phone: '573000000001', content: 'Synthetic', origin: 'sistema', templateName: 'demo', languageCode: 'es' })).rejects.toMatchObject({ name: 'NoActiveChannelError' });
    expect(axios.post).not.toHaveBeenCalled(); expect(f.messageRepository.create).not.toHaveBeenCalled();
  });
  test('the correctly bound own channel remains usable', async () => {
    channels.push({ id: 'own-a', tenantId: 'tenant-a', type: 'whatsapp', active: true });
    await useCase(kind).execute();
    expect(prisma.channel.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'own-a' } }));
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  test.each(['inactive', 'no-line', 'contact-only', 'paused', 'missing-token', 'missing-line'])('configuration %s blocks sends before HTTP', async state => {
    if (state === 'inactive') tenants['tenant-a'].active = false;
    if (state === 'no-line') tenants['tenant-a'].phone = null;
    if (state === 'contact-only') { tenants['tenant-a'].phone = '100002'; tenants['tenant-a'].contactPhone = '100001'; }
    if (state === 'paused') process.env.WHATSAPP_ENABLED = 'false';
    if (state === 'missing-token') process.env.WHATSAPP_ACCESS_TOKEN = '';
    if (state === 'missing-line') process.env.WHATSAPP_PHONE_NUMBER_ID = '';
    const f = useCase(kind); await expect(f.execute()).rejects.toMatchObject({ name: 'NoActiveChannelError' });
    expect(axios.post).not.toHaveBeenCalled(); expect(f.messageRepository.create).not.toHaveBeenCalled();
  });
  test.each(['channel-revoked', 'tenant-suspended', 'line-reassigned'])('rechecks %s between selection and provider handoff', async change => {
    const f = useCase(kind, () => {
      if (change === 'channel-revoked') channels[0].active = false;
      if (change === 'tenant-suspended') tenants['tenant-a'].active = false;
      if (change === 'line-reassigned') tenants['tenant-a'].phone = '100002';
    });
    await expect(f.execute()).rejects.toMatchObject({ code: 'WHATSAPP_ROUTE_NOT_CONFIGURED' });
    expect(axios.post).not.toHaveBeenCalled(); expect(f.messageRepository.create).not.toHaveBeenCalled(); expect(f.eventPublisher.publish).not.toHaveBeenCalled();
  });
});
test('provider denies missing identity, foreign or disabled channels even if invoked without repository selection', async () => {
  const provider = new WhatsAppChannelProvider();
  channels.push({ id: 'foreign', tenantId: 'tenant-b', type: 'whatsapp', active: true });
  for (const route of [undefined, {}, { tenantId: 'tenant-a' }, { tenantId: 'tenant-b', channelId: 'global' }, { tenantId: 'tenant-a', channelId: 'foreign' }, { tenantId: 'tenant-a', channelId: 'missing' }]) {
    await expect(provider.send('whatsapp', '573000000001', 'Synthetic', route)).rejects.toMatchObject({ code: 'WHATSAPP_ROUTE_NOT_CONFIGURED' });
  }
  expect(axios.post).not.toHaveBeenCalled();
});
test('database verification failure never falls back to the configured global identity', async () => {
  prisma.tenant.findUnique.mockRejectedValue(Error('database unavailable'));
  await expect(new WhatsAppChannelProvider().send('whatsapp', '573000000001', 'Synthetic', { tenantId: 'tenant-a', channelId: 'global' })).rejects.toThrow('database unavailable');
  expect(axios.post).not.toHaveBeenCalled();
});
