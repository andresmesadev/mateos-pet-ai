const axios = require('axios');
function providerError(code, status = 502) {
  const error = new Error(code); error.code = code; error.status = status; return error;
}
function buildMetaWhatsAppConnection({ http = axios, env = process.env, clock = () => new Date() } = {}) {
  const id = value => typeof value === 'string' && /^\d{1,64}$/.test(value);
  function configuration() {
    if (env.WHATSAPP_MULTITENANT_ENABLED !== 'true' || env.AI_QUOTA_ENABLED !== 'true') throw providerError('COMMERCIAL_PROVIDERS_NOT_ENABLED', 503);
    require('./ai-quota.service').aiQuotaPolicy(env);
    if (!id(env.WHATSAPP_APP_ID) || !id(env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID) || !env.WHATSAPP_APP_SECRET) throw providerError('META_SIGNUP_NOT_CONFIGURED', 503);
    return { appId: env.WHATSAPP_APP_ID, configId: env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID, version: 'v25.0' };
  }
  async function verify({ code, wabaId, phoneNumberId }) {
    const config = configuration();
    if (typeof code !== 'string' || !code || code.length > 10000 || !id(wabaId) || !id(phoneNumberId)) throw providerError('INVALID_META_AUTHORIZATION', 400);
    const base = `https://graph.facebook.com/${config.version}`;
    const options = token => ({ headers: { Authorization: `Bearer ${token}` }, timeout: 10000, maxRedirects: 0 });
    try {
      const exchange = await http.get(`${base}/oauth/access_token`, { params: { client_id: config.appId, client_secret: env.WHATSAPP_APP_SECRET, code }, timeout: 10000, maxRedirects: 0 });
      const token = exchange.data?.access_token;
      if (typeof token !== 'string' || !token) throw providerError('META_TOKEN_NOT_CONFIRMED');
      const debug = await http.get(`${base}/debug_token`, { ...options(`${config.appId}|${env.WHATSAPP_APP_SECRET}`), params: { input_token: token } });
      const grant = debug.data?.data;
      const now = Math.floor(+clock() / 1000);
      if (grant?.is_valid !== true || String(grant.app_id) !== config.appId ||
        !['whatsapp_business_management', 'whatsapp_business_messaging'].every(scope => grant.scopes?.includes(scope)) ||
        [grant.expires_at, grant.data_access_expires_at].some(value => value !== undefined && (!Number.isSafeInteger(value) || (value !== 0 && value <= now)))) throw providerError('META_PERMISSION_NOT_CONFIRMED', 403);
      // A scope name alone is insufficient: verify effective WABA membership.
      let phone = null, after;
      for (let page = 0; page < 10 && !phone; page++) {
        const response = await http.get(`${base}/${wabaId}/phone_numbers`, { ...options(token), params: { fields: 'id,display_phone_number,code_verification_status,platform_type', limit: 100, ...(after ? { after } : {}) } });
        if (!Array.isArray(response.data?.data)) throw providerError('META_ASSETS_NOT_CONFIRMED');
        phone = response.data.data.find(item => item.id === phoneNumberId);
        const cursor = response.data.paging?.cursors?.after;
        if (!response.data.paging?.next || typeof cursor !== 'string' || cursor === after) break;
        after = cursor;
      }
      if (!phone || phone.code_verification_status !== 'VERIFIED' || phone.platform_type !== 'CLOUD_API') throw providerError('META_NUMBER_NOT_READY', 409);
      const subscription = await http.post(`${base}/${wabaId}/subscribed_apps`, {}, options(token));
      if (subscription.data?.success !== true) throw providerError('META_WEBHOOK_NOT_CONFIRMED');
      const expires = [grant.expires_at, grant.data_access_expires_at].filter(value => Number.isSafeInteger(value) && value > 0);
      return { token, wabaId, phoneNumberId, displayPhone: typeof phone.display_phone_number === 'string' ? phone.display_phone_number.slice(0,64) : null,
        tokenExpiresAt: expires.length ? new Date(Math.min(...expires) * 1000) : null };
    } catch (error) {
      // Axios errors can contain tokens, app secrets and authorization codes.
      if (typeof error.code === 'string' && error.code.startsWith('META_')) throw error;
      throw providerError('META_AUTHORIZATION_UNAVAILABLE');
    }
  }
  return { configuration, verify };
}
module.exports = { buildMetaWhatsAppConnection, providerError };
