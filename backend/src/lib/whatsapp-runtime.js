// Reversible environment-wide pause. Absent flag preserves deployed behavior.
const isWhatsAppEnabled = (env = process.env) => !['false', '0', 'off'].includes(String(env.WHATSAPP_ENABLED ?? '').trim().toLowerCase());
const isConfiguredWhatsAppReceiver = (receiver, env = process.env) => {
  const configured = String(env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
  return typeof receiver === 'string' && Boolean(configured) && receiver === configured;
};
module.exports = { isWhatsAppEnabled, isConfiguredWhatsAppReceiver };
