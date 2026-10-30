const axios = require('axios');
const { fits, validButtons } = require('../../../../application/operator-channel/message-limits');
function buildOperatorWhatsappProvider({ env = process.env, http = axios } = {}) {
  return async ({ receiver, phone, text, buttons = [] }) => {
    const scope = require('../../../../lib/provider-execution').providerScope();
    const route = scope ? await require('../../../../services/whatsapp-route.service').currentWhatsAppRoute() : null;
    const configuredReceiver = scope ? route?.receiver : env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = scope ? route?.accessToken : env.WHATSAPP_ACCESS_TOKEN;
    if (!receiver || receiver !== configuredReceiver || !accessToken) return { state: 'rejected', code: 'ROUTE_NOT_CONFIGURED' };
    if (!validButtons(buttons) || !fits(text, buttons.length > 0)) return { state: 'rejected', code: 'INVALID_MESSAGE_FORMAT' };
    const content = buttons.length ? { type: 'interactive', interactive: { type: 'button', body: { text }, action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.token, title: b.title } })) } } } : { type: 'text', text: { body: text } };
    try {
      const result = await http.post(`https://graph.facebook.com/v25.0/${receiver}/messages`, { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, ...content },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 5000, maxRedirects: 0 });
      const id = result.data?.messages?.[0]?.id;
      return typeof id === 'string' ? { state: 'accepted', messageId: id } : { state: 'uncertain', code: 'PROVIDER_ACCEPTANCE_UNKNOWN' };
    } catch (e) {
      // A received HTTP rejection proves that this attempt was not accepted.
      // Network errors and timeouts cannot prove that; never replay them.
      const status = e.response?.status;
      return status >= 400 && status < 500 && status !== 408 ? { state: 'rejected', code: 'PROVIDER_REJECTED' } : { state: 'uncertain', code: 'PROVIDER_ACCEPTANCE_UNKNOWN' };
    }
  };
}
module.exports = { buildOperatorWhatsappProvider };
