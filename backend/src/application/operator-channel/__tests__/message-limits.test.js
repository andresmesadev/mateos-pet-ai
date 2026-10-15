const { buildOperatorWhatsappProvider } = require('../../../contexts/communication/infrastructure/providers/operator-whatsapp-provider');
const { fits } = require('../message-limits');
const { queryText } = require('../coordinator');

test.each(['x', '🐾'])('interactive and simple text limits count complete Unicode characters (%s)', async character => {
  const post = jest.fn(async () => ({ data: { messages: [{ id: 'wamid.test' }] } }));
  const provider = buildOperatorWhatsappProvider({ env: { WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'fake-only' }, http: { post } });
  const send = (text, buttons) => provider({ receiver: '123', phone: '573000000001', text, buttons });
  const buttons = [{ token: 'test-only', title: 'Confirmar operación' }];
  expect((await send(character.repeat(1024), buttons)).state).toBe('accepted');
  expect((await send(character.repeat(1025), buttons)).code).toBe('INVALID_MESSAGE_FORMAT');
  expect((await send(character.repeat(4000), [])).state).toBe('accepted');
  expect((await send(character.repeat(4001), [])).code).toBe('INVALID_MESSAGE_FORMAT');
  expect(post).toHaveBeenCalledTimes(2);
  expect(fits(character.repeat(1024), true)).toBe(true);
  expect(fits(character.repeat(1025), true)).toBe(false);
});

test('malformed or excessive buttons never reach HTTP', async () => {
  const post = jest.fn();
  const provider = buildOperatorWhatsappProvider({ env: { WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'fake-only' }, http: { post } });
  for (const buttons of [[{ token: 'x', title: 'x'.repeat(21) }], Array(4).fill({ token: 'x', title: 'x' }), [{ token: '', title: 'x' }]]) {
    expect((await provider({ receiver: '123', phone: '573000000001', text: 'Completo', buttons })).code).toBe('INVALID_MESSAGE_FORMAT');
  }
  expect(post).not.toHaveBeenCalled();
});

test('search summaries preserve full names/references and do not display opaque pagination state', () => {
  const name = 'Alimento completo 🐾';
  const text = queryText({ intent: 'inventory_search', observedAt: '2026-10-15', data: { data: [
    { id: 'product-a', name, presentation: 'Bolsa de 5 kg', internalCode: 'REF-A', available: '5' },
    { id: 'product-b', name, presentation: 'Bolsa de 10 kg', available: '8' }
  ], nextCursor: 'opaque-state-not-for-display' } });
  expect(text).toContain(name); expect(text).toContain('REF-A'); expect(text).toContain('product-b');
  expect(text).toContain('resultados resumidos'); expect(text).not.toContain('opaque-state'); expect(fits(text, true)).toBe(true);
});
