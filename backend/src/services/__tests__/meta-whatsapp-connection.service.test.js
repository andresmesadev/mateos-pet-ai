jest.mock('../../lib/prisma', () => ({}));
const { buildMetaWhatsAppConnection } = require('../meta-whatsapp-connection.service');
const env = { WHATSAPP_MULTITENANT_ENABLED: 'true', AI_QUOTA_ENABLED: 'true', WHATSAPP_APP_ID: '100', WHATSAPP_APP_SECRET: 'synthetic-app-secret', WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: '101',
  AI_QUOTA_POLICY_VERSION: 'test', AI_OPERATION_UNITS_JSON: '{"analyze":1,"reply":1,"embedding":1,"transcription":1,"interpret":1}' };
const input = { code: 'synthetic-code', wabaId: '1001', phoneNumberId: '2001' };
function fixture({ grant = {}, phone = {}, response, failure } = {}) {
  const http = { get: jest.fn(async url => {
    if (failure) throw failure;
    if (url.endsWith('/oauth/access_token')) return { data: { access_token: 'synthetic-token' } };
    if (url.endsWith('/debug_token')) return { data: { data: { is_valid: true, app_id: '100', scopes: ['whatsapp_business_management','whatsapp_business_messaging'], expires_at: 2000000000, ...grant } } };
    return { data: response || { data: [{ id: '2001', display_phone_number: 'synthetic', platform_type: 'CLOUD_API', code_verification_status: 'VERIFIED', ...phone }] } };
  }), post: jest.fn(async () => ({ data: { success: true } })) };
  const service = buildMetaWhatsAppConnection({ http, env, clock: () => new Date('2026-10-28T12:00:00Z') }); return { service, http };
}
test('exchanges a one-time code and verifies effective number membership before subscription', async () => {
  const { service,http } = fixture(); const value = await service.verify(input);
  expect(value).toMatchObject({ token: 'synthetic-token', wabaId: '1001', phoneNumberId: '2001' });
  expect(http.get.mock.calls.map(c => c[0])).toEqual(['https://graph.facebook.com/v25.0/oauth/access_token','https://graph.facebook.com/v25.0/debug_token','https://graph.facebook.com/v25.0/1001/phone_numbers']);
  expect(http.post).toHaveBeenCalledWith('https://graph.facebook.com/v25.0/1001/subscribed_apps',{},expect.objectContaining({ maxRedirects: 0, headers: { Authorization: 'Bearer synthetic-token' } }));
});
test.each([{ is_valid: false },{ app_id: 'other' },{ scopes: ['whatsapp_business_messaging'] },{ expires_at: 1 },{ data_access_expires_at: 1 }])('rejects an invalid or insufficient grant %j', async grant => {
  const { service,http } = fixture({ grant }); await expect(service.verify(input)).rejects.toMatchObject({ code: 'META_PERMISSION_NOT_CONFIRMED' }); expect(http.post).not.toHaveBeenCalled();
});
test.each([{ id: 'other' },{ platform_type: 'ON_PREMISE' },{ code_verification_status: 'NOT_VERIFIED' }])('does not connect a wrong or unready phone %j', async phone => {
  const { service,http } = fixture({ phone }); await expect(service.verify(input)).rejects.toMatchObject({ code: 'META_NUMBER_NOT_READY' }); expect(http.post).not.toHaveBeenCalled();
});
test('does not follow arbitrary pagination URLs with provider credentials', async () => {
  const { service,http } = fixture({ response: { data: [], paging: { next: 'https://attacker.invalid/steal', cursors: { after: 'cursor' } } } });
  await expect(service.verify(input)).rejects.toMatchObject({ code: 'META_NUMBER_NOT_READY' });
  expect(http.get.mock.calls.every(c => c[0].startsWith('https://graph.facebook.com/v25.0/'))).toBe(true);
  expect(http.get.mock.calls.length).toBeLessThanOrEqual(12);
});
test('provider errors never expose request secrets, code, or tokens', async () => {
  const { service } = fixture({ failure: Object.assign(Error('synthetic-token synthetic-app-secret synthetic-code'),{ response: { data: 'synthetic-token' } }) });
  try { await service.verify(input); throw Error('expected rejection'); } catch (error) { expect(error.message).toBe('META_AUTHORIZATION_UNAVAILABLE'); expect(JSON.stringify(error)).not.toMatch(/synthetic/); }
});
test('a subscription without confirmed success cannot enable the route', async () => {
  const { service,http } = fixture(); http.post.mockResolvedValue({ data: {} }); await expect(service.verify(input)).rejects.toMatchObject({ code: 'META_WEBHOOK_NOT_CONFIRMED' });
});
test.each([{ AI_QUOTA_ENABLED: 'false' },{ WHATSAPP_MULTITENANT_ENABLED: 'false' },{ WHATSAPP_APP_ID: '' },{ AI_OPERATION_UNITS_JSON: '{}' }])('setup is unavailable without the commercial prerequisites %j', changed => {
  expect(() => buildMetaWhatsAppConnection({ env: { ...env,...changed } }).configuration()).toThrow();
});
