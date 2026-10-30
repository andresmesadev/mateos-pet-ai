jest.mock('../../contexts/communication', () => ({ sendTemplateMessage: jest.fn() }));
jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn() } }));
jest.mock('../../services/whatsapp-route.service', () => ({ outbound: jest.fn() }));
const prisma = require('../../lib/prisma');
const { outbound } = require('../../services/whatsapp-route.service');
const { sendTemplateMessage } = require('../../contexts/communication');
const { getReactivationTemplate, renderReactivationTemplate, isReactivationTemplateConfigured,
  reactivationContext, sendReactivationTemplate } = require('../../services/reactivation-template.service');
const original = process.env;
const templates = {
  'tenant-a': { name: 'retorno_a', languageCode: 'es', body: 'Hola {{1}} 👋 Somos {{2}}. ¿Agendamos una visita?' },
  'tenant-b': { name: 'retorno_b', languageCode: 'es_CO', body: '{{2}} te saluda, {{1}}. Puedes escribirnos aquí.' },
};
beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...original, WHATSAPP_REACTIVATION_TEMPLATES_JSON: JSON.stringify(templates) };
  prisma.tenant.findUnique.mockImplementation(async ({ where }) => ({ name: { 'tenant-a': 'Centro A', 'tenant-b': 'Pet shop B' }[where.id] }));
  outbound.mockImplementation(async tenantId => tenantId ? { tenantId } : null);
  sendTemplateMessage.mockResolvedValue({ message: { id: 'synthetic' } });
});
afterEach(() => { process.env = original; });

test.each(['tenant-a', 'tenant-b'])('preview, persisted content and provider parameters agree for %s', async tenantId => {
  const context = await reactivationContext(tenantId);
  expect(context).toMatchObject({ ready: true, channelConfigured: true, templateConfigured: true, identityConfigured: true });
  const businessName = tenantId === 'tenant-a' ? 'Centro A' : 'Pet shop B';
  expect(context.preview).toContain(businessName);
  expect(context.preview).not.toContain(tenantId === 'tenant-a' ? 'Pet shop B' : 'Centro A');
  expect(await sendReactivationTemplate({ tenantId, userId: 'user', phone: '0000000000', clientName: 'Ana', conversationId: 'conversation' })).toBe(true);
  const sent = sendTemplateMessage.mock.calls[0][0];
  expect(sent).toMatchObject({ tenantId, templateName: templates[tenantId].name, languageCode: templates[tenantId].languageCode, conversationId: 'conversation' });
  const parameters = sent.components[0].parameters;
  expect(parameters).toEqual([{ type: 'text', text: 'Ana' }, { type: 'text', text: businessName }]);
  expect(sent.content).toBe(templates[tenantId].body.replace(/\{\{([12])\}\}/g, (_, key) => parameters[Number(key) - 1].text));
  expect(context.preview.replace('{nombre}', 'Ana')).toBe(sent.content);
  expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId }, select: { name: true } });
  expect(outbound).toHaveBeenCalledWith(tenantId);
});

test('missing, blank or unknown business name blocks without inventing a sender', async () => {
  for (const tenant of [null, { name: '  ' }, { name: null }]) {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    expect(await reactivationContext('tenant-a')).toMatchObject({ ready: false, identityConfigured: false, preview: null });
    expect(await sendReactivationTemplate({ tenantId: 'tenant-a' })).toBe(false);
  }
  expect(sendTemplateMessage).not.toHaveBeenCalled();
});

test('no tenant never queries a different business or sends', async () => {
  expect(await reactivationContext(null)).toMatchObject({ ready: false, preview: null });
  expect(await sendReactivationTemplate({})).toBe(false);
  expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  expect(sendTemplateMessage).not.toHaveBeenCalled();
});

test.each([null, new Error('credential unavailable')])('disabled or unavailable route blocks even with template and name', async route => {
  if (route instanceof Error) outbound.mockRejectedValue(route); else outbound.mockResolvedValue(route);
  expect(await reactivationContext('tenant-a')).toMatchObject({ ready: false, channelConfigured: false });
  expect(await sendReactivationTemplate({ tenantId: 'tenant-a' })).toBe(false);
  expect(sendTemplateMessage).not.toHaveBeenCalled();
});

test('a global or another tenant template never enables an unconfigured business', async () => {
  process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = 'legacy';
  process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = 'es';
  expect(isReactivationTemplateConfigured('tenant-c')).toBe(false);
  expect(await reactivationContext('tenant-c')).toMatchObject({ ready: false, templateConfigured: false, preview: null });
  expect(await sendReactivationTemplate({ tenantId: 'tenant-c' })).toBe(false);
  expect(sendTemplateMessage).not.toHaveBeenCalled();
});

test.each(['', '{bad json', 'null', '[]', '42'])('invalid configuration %p stays disabled', value => {
  process.env.WHATSAPP_REACTIVATION_TEMPLATES_JSON = value;
  expect(isReactivationTemplateConfigured('tenant-a')).toBe(false);
});

test.each([
  { body: 'Hola {{1}}. Somos un negocio fijo.' },
  { body: '{{1}} {{2}} {{3}}' }, { body: '{{1}} {{1}} {{2}}' },
  { body: '{{1}} {{ 2 }}' }, { body: '{{1}} {{2}} {' },
  { body: 'x'.repeat(1025) + '{{1}} {{2}}' },
  { name: 'invalid-name' }, { languageCode: 'not a language' },
])('rejects unsupported template descriptor %p', patch => {
  process.env.WHATSAPP_REACTIVATION_TEMPLATES_JSON = JSON.stringify({ 'tenant-a': { ...templates['tenant-a'], ...patch } });
  expect(getReactivationTemplate('tenant-a')).toBeNull();
});

test('customer fallback and replacement metacharacters stay literal in both representations', async () => {
  prisma.tenant.findUnique.mockResolvedValue({ name: 'Centro $& {{1}}' });
  await sendReactivationTemplate({ tenantId: 'tenant-a' });
  const sent = sendTemplateMessage.mock.calls[0][0];
  expect(sent.content).toBe('Hola cliente 👋 Somos Centro $& {{1}}. ¿Agendamos una visita?');
  expect(sent.components[0].parameters.map(p => p.text)).toEqual(['cliente', 'Centro $& {{1}}']);
  expect(renderReactivationTemplate('$& {{2}}', 'Centro', getReactivationTemplate('tenant-a'))).toContain('Hola $& {{2}}');
});

test.each([null, { skipped: true }, { message: {}, skipped: true }])('unconfirmed communication result %p is not reported as delivered', async result => {
  sendTemplateMessage.mockResolvedValue(result);
  expect(await sendReactivationTemplate({ tenantId: 'tenant-a' })).toBe(false);
});

test('provider rejection never records a successful delivery', async () => {
  sendTemplateMessage.mockRejectedValue(new Error('template rejected'));
  expect(await sendReactivationTemplate({ tenantId: 'tenant-a' })).toBe(false);
});
