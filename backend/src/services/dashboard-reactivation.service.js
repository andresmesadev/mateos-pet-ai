const prisma = require('../lib/prisma');
const { reactivationContext, sendReactivationTemplate } = require('./reactivation-template.service');

function validContactPhone(phone) {
  return typeof phone === 'string' && /^\+?\d{8,15}$/.test(phone.replace(/\s/g, ''));
}

async function sendReactivationCampaign(tenantId, clientIds) {
  if (!tenantId) throw Object.assign(new Error('Selecciona un establecimiento antes de enviar.'), { status: 400 });
  const context = await reactivationContext(tenantId);
  if (!context.ready) throw Object.assign(new Error(context.reason), { status: 422 });
  if (!Array.isArray(clientIds) || !clientIds.length || clientIds.length > 500 || clientIds.some(id => typeof id !== 'string' || !id)) {
    throw Object.assign(new Error('Selecciona entre 1 y 500 clientes válidos.'), { status: 400 });
  }
  const ids = [...new Set(clientIds)];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, ...(tenantId ? { tenantId } : {}) }, select: { id: true, phone: true, name: true } });
  // Reject stale/cross-tenant selections before sending any message.
  if (users.length !== ids.length) throw Object.assign(new Error('La selección cambió o contiene clientes de otro establecimiento. Actualiza la lista.'), { status: 409 });
  const recipients = [];
  for (const user of users) {
    if (!validContactPhone(user.phone)) { recipients.push({ id: user.id, status: 'omitted', reason: 'Sin teléfono válido' }); continue; }
    try {
      const delivered = await sendReactivationTemplate({ tenantId, userId: user.id, phone: user.phone.replace(/\s/g, ''), clientName: user.name });
      if (!delivered) { recipients.push({ id: user.id, status: 'failed', reason: 'WhatsApp no confirmó el envío. Revisa el canal o la plantilla antes de reintentar.' }); continue; }
      let recorded = true;
      try { await prisma.user.update({ where: { id: user.id }, data: { lastReminderSentAt: new Date() } }); }
      catch { recorded = false; }
      // Never offer a retry for an already delivered message if recording its metric failed.
      recipients.push({ id: user.id, status: 'sent', ...(recorded ? {} : { reason: 'Enviado; no se pudo actualizar la métrica de contacto.' }) });
    } catch { recipients.push({ id: user.id, status: 'failed', reason: 'No se confirmó el envío.' }); }
  }
  return { sent: recipients.filter(r => r.status === 'sent').length, failed: recipients.filter(r => r.status === 'failed').length,
    noPhone: recipients.filter(r => r.status === 'omitted').length, total: ids.length, recipients };
}

module.exports = { reactivationContext, sendReactivationCampaign, validContactPhone };
