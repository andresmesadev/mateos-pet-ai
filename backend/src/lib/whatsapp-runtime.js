// Reversible environment-wide pause. Absent flag preserves deployed behavior.
const isWhatsAppEnabled = () => !['false', '0', 'off'].includes(String(process.env.WHATSAPP_ENABLED ?? '').trim().toLowerCase());
module.exports = { isWhatsAppEnabled };
