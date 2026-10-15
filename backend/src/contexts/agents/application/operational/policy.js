const { createHash } = require('node:crypto');
const { civilDayBounds } = require('../../../shared/business-day');

class OperationalError extends Error {
  constructor(code, message, status = 422) { super(message); this.name = 'OperationalError'; this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new OperationalError(code, message, status); };
const INTENTS = ['financial_history', 'daily_close', 'financial_period', 'prepare_expense', 'inventory_search', 'inventory_detail', 'inventory_movements', 'prepare_entry'];
const SPECIALIZATIONS = { asistente_financiero: INTENTS.slice(0, 4), asistente_administrativo: INTENTS.slice(4) };
const COMMANDS = { prepare_expense: 'registrar_gasto', prepare_entry: 'entrada_inventario' };
const EXPENSE_CATEGORIES = ['supplies','utilities','rent','salary','equipment','marketing','other'];
const PAYMENT_METHODS = ['cash','transfer','card','other'];
const FIELDS = {
  financial_history: ['rangeStart', 'rangeEnd'], daily_close: ['date'], financial_period: ['periodStart', 'periodEnd'],
  prepare_expense: ['amount', 'category', 'responsible', 'date', 'description', 'paymentMethod', 'notes'],
  inventory_search: ['search', 'limit', 'cursor', 'status', 'use', 'category', 'includeInactive'],
  inventory_detail: ['productId'], inventory_movements: ['productId', 'cursor'],
  prepare_entry: ['productId', 'quantity', 'unitCost', 'lotCode', 'expiresOn', 'reason'],
};
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', 'Los campos deben ser un objeto.', 400); return value; }
function keys(value, allowed) { object(value); if (Object.keys(value).some(k => !allowed.includes(k))) fail('INVALID_INPUT', 'La solicitud contiene campos no admitidos.', 400); }
function canonical(value) {
  if (value === null || typeof value !== 'object') { if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID_INPUT', 'Número no válido.', 400); return value; }
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toJSON === 'function') return canonical(value.toJSON());
  return Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
}
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
const json = value => JSON.parse(JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v));
function limitedResult(value) { const clean = json(value); if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > 65536) fail('RESULT_TOO_LARGE', 'Acota la consulta para obtener un resultado completo.', 422); return clean; }
function text(value, field, max = 4000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || [...value].length > max) fail('INVALID_INPUT', `${field}: texto no válido.`, 400);
  return value.trim() || null;
}
function money(value, field, positive = false) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value);
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw)) fail('INVALID_INPUT', `${field}: usa hasta dos decimales, sin separadores de miles.`, 400);
  const [whole, decimal = ''] = raw.split('.'); const cents = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (cents > 9999999999n || (positive && cents < 1n)) fail('INVALID_INPUT', `${field}: importe fuera de rango.`, 400);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
function dateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('INVALID_INPUT', `${field}: fecha no válida.`, 400);
  return value;
}
function intentInput(intent, fields = {}) { if (!INTENTS.includes(intent)) fail('INVALID_INTENT', 'Selecciona una tarea disponible.', 400); keys(fields, FIELDS[intent]); return fields; }
function authorize(access, specialization, intent) {
  if (!SPECIALIZATIONS[specialization]?.includes(intent)) fail('INVALID_INTENT', 'Ese empleado no atiende esta tarea.', 422);
  if (intent.startsWith('financial') || intent === 'daily_close' || intent === 'prepare_expense') { if (!access.capabilities.finance) fail('ACCESS_DENIED', 'Finanzas requiere administración.', 403); }
  else if (['prepare_entry', 'inventory_movements'].includes(intent)) { if (!access.capabilities.inventory_manage) fail('ACCESS_DENIED', 'Esta tarea requiere administración.', 403); }
  else if (!access.capabilities.inventory_read) fail('ACCESS_DENIED', 'No tienes acceso al inventario.', 403);
}
function normalizeCommand(intent, fields, now = new Date()) {
  intentInput(intent, fields);
  const payload = {}; const missing = [];
  if (intent === 'prepare_expense') {
    payload.amount = money(fields.amount, 'Importe', true);
    payload.responsible = text(fields.responsible, 'Responsable', 160);
    payload.description = text(fields.description, 'Descripción');
    payload.category = fields.category ?? 'other'; payload.paymentMethod = fields.paymentMethod ?? 'cash';
    if (!EXPENSE_CATEGORIES.includes(payload.category) || !PAYMENT_METHODS.includes(payload.paymentMethod)) fail('INVALID_INPUT', 'Categoría o forma de pago no válida.', 400);
    payload.notes = text(fields.notes, 'Notas');
    if (fields.date && !Number.isFinite(Date.parse(fields.date))) fail('INVALID_INPUT', 'Fecha no válida.', 400);
    payload.date = !fields.date ? now.toISOString() : /^\d{4}-\d{2}-\d{2}$/.test(fields.date) ? civilDayBounds(dateOnly(fields.date, 'Fecha')).start.toISOString() : new Date(fields.date).toISOString();
    for (const field of ['amount','responsible','description']) if (!payload[field]) missing.push(field);
  } else if (intent === 'prepare_entry') {
    payload.productId = text(fields.productId, 'Producto', 100);
    payload.quantity = fields.quantity === '' || fields.quantity === undefined || fields.quantity === null ? null : Number(fields.quantity);
    if (payload.quantity !== null && (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 2147483647)) fail('INVALID_INPUT', 'Cantidad: usa unidades enteras positivas.', 400);
    payload.unitCost = money(fields.unitCost, 'Costo unitario'); payload.lotCode = text(fields.lotCode, 'Lote', 160);
    payload.expiresOn = fields.expiresOn ? dateOnly(fields.expiresOn, 'Vencimiento') : null;
    payload.reason = text(fields.reason, 'Motivo');
    for (const field of ['productId','quantity','unitCost']) if (payload[field] === null) missing.push(field);
  } else fail('INVALID_INTENT', 'Esta tarea no prepara una operación.', 400);
  return { kind: COMMANDS[intent], payload, missing };
}
const productContext = p => ({ id: p.id, active: p.active, presentation: p.presentation, uses: [...p.uses].sort(), lotPolicy: p.lotPolicy });
module.exports = { OperationalError, fail, uuid, keys, hash, json, limitedResult, text, dateOnly, intentInput, authorize, normalizeCommand, productContext, INTENTS, SPECIALIZATIONS, COMMANDS, FIELDS, EXPENSE_CATEGORIES, PAYMENT_METHODS };
