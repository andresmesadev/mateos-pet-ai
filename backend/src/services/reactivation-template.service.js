const { sendTemplateMessage } = require('../contexts/communication');
const { getBusinessName } = require('./business-identity.service');
const { outbound } = require('./whatsapp-route.service');
const logger = require('../lib/logger');

// Copiar el cuerpo EXACTO aprobado en la WABA de cada Tenant. Nunca
// reconstruir un supuesto cuerpo a partir del nombre de la plantilla.
function getReactivationTemplate(tenantId, env = process.env) {
  if (typeof tenantId !== 'string' || !tenantId) return null;
  try {
    const templates = JSON.parse(env.WHATSAPP_REACTIVATION_TEMPLATES_JSON || '{}');
    if (!templates || Array.isArray(templates) || !Object.hasOwn(templates, tenantId)) return null;
    const entry = templates[tenantId];
    if (!entry || typeof entry.name !== 'string' || !/^[a-z0-9_]{1,512}$/.test(entry.name) ||
      typeof entry.languageCode !== 'string' || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(entry.languageCode) ||
      typeof entry.body !== 'string' || !entry.body.trim() || entry.body.length > 1024) return null;
    const variables = entry.body.match(/\{\{[\s\S]*?\}\}/g) || [];
    if (variables.length !== 2 || !variables.includes('{{1}}') || !variables.includes('{{2}}') ||
      /[{}]/.test(entry.body.replace(/\{\{[12]\}\}/g, ''))) return null;
    return { templateName: entry.name, languageCode: entry.languageCode, body: entry.body };
  } catch { return null; }
}

function renderReactivationTemplate(clientName, businessName, template) {
  if (!template || !businessName) return null;
  const name = String(clientName || '').trim() || 'cliente';
  // Callback: nombres con $& o secuencias de plantilla se insertan literalmente.
  return template.body.replace(/\{\{([12])\}\}/g, (_, key) => key === '1' ? name : businessName);
}

const isReactivationTemplateConfigured = (tenantId) => Boolean(getReactivationTemplate(tenantId));

async function reactivationContext(tenantId) {
  const template = getReactivationTemplate(tenantId);
  const businessName = await getBusinessName(tenantId);
  let channelConfigured = false;
  try { channelConfigured = Boolean(await outbound(tenantId)); } catch { /* fail closed */ }
  const templateConfigured = Boolean(template);
  const identityConfigured = Boolean(businessName);
  return {
    ready: channelConfigured && templateConfigured && identityConfigured,
    templateConfigured, channelConfigured, identityConfigured,
    preview: renderReactivationTemplate('{nombre}', businessName, template),
    previewTemplate: template && businessName ? { body: template.body, businessName } : null,
    reason: !identityConfigured ? 'Completa el nombre del establecimiento en Administración antes de enviar.'
      : !channelConfigured ? 'Configura y habilita el canal de WhatsApp de este establecimiento antes de enviar.'
        : !templateConfigured ? 'Falta configurar el cuerpo exacto y las variables de la plantilla aprobada para este establecimiento.' : null,
  };
}

async function sendReactivationTemplate({ tenantId, userId, phone, clientName, conversationId } = {}) {
  try {
    const template = getReactivationTemplate(tenantId);
    const businessName = await getBusinessName(tenantId);
    if (!template || !businessName || !(await outbound(tenantId))) return false;
    const name = String(clientName || '').trim() || 'cliente';
    const result = await sendTemplateMessage({
      tenantId, userId, phone,
      conversationId: conversationId ?? null,
      origin: 'sistema',
      content: renderReactivationTemplate(name, businessName, template),
      templateName: template.templateName,
      languageCode: template.languageCode,
      components: [{ type: 'body', parameters: [
        { type: 'text', text: name }, { type: 'text', text: businessName },
      ] }],
    });
    return Boolean(result?.message && !result?.skipped);
  } catch (error) {
    logger.error('[ReactivationTemplate] No se confirmó el envío de la plantilla:', error.message);
    return false;
  }
}

module.exports = {
  getReactivationTemplate, renderReactivationTemplate, isReactivationTemplateConfigured,
  reactivationContext, sendReactivationTemplate,
};
