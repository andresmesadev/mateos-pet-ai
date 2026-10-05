const crypto = require('node:crypto');
class InventoryError extends Error {
  constructor(code, message, status = 422) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new InventoryError(code, message, status); };
const MAX = 2147483647;
function integer(value, label, allowZero = false) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > MAX) fail('INVALID_QUANTITY', `${label}: ingresa unidades enteras ${allowZero ? 'desde cero' : 'mayores que cero'}.`, 400);
  return value;
}
function cents(value, label = 'Precio', allowZero = false) {
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  if (typeof text !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(text)) fail('INVALID_AMOUNT', `${label}: usa máximo dos decimales y ningún separador de miles.`, 400);
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (result > 9999999999 || (!allowZero && result === 0)) fail('INVALID_AMOUNT', `${label} fuera del rango permitido.`, 400);
  return result;
}
const amount = value => (value / 100).toFixed(2);
function text(value, label, limit, optional = false) {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) fail('INVALID_TEXT', `${label} es requerido (máximo ${limit} caracteres).`, 400);
  return value.trim().normalize('NFC');
}
const key = value => value.normalize('NFC').trim().toLowerCase();
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) fail('INVALID_DATE', 'La fecha de vencimiento no es válida.', 400);
  return value;
}
const expiryKey = lot => lot.expiresOn ? new Date(lot.expiresOn).toISOString().slice(0, 10) : null;
const availableLot = (lot, today) => !expiryKey(lot) || expiryKey(lot) > today;
function allocate(lots, quantity, today) {
  integer(quantity, 'Cantidad');
  const ordered = lots.filter(l => l.balancePhysical > 0 && availableLot(l, today)).sort((a, b) =>
    (expiryKey(a) ?? '9999-12-31').localeCompare(expiryKey(b) ?? '9999-12-31') ||
    new Date(a.firstReceivedAt) - new Date(b.firstReceivedAt) || a.id.localeCompare(b.id));
  let remaining = quantity;
  const result = [];
  for (const lot of ordered) { const taken = Math.min(lot.balancePhysical, remaining); if (taken) result.push({ lot, quantity: taken }); remaining -= taken; if (!remaining) break; }
  if (remaining) fail('INSUFFICIENT_STOCK', 'No hay existencias disponibles suficientes. Revisa las cantidades o registra una entrada.', 409);
  return result;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function normalizedIntent(value, field) {
  if (Array.isArray(value)) {
    if (field === 'uses' && value.every(v => typeof v === 'string')) return [...new Set(value)].sort();
    return value.map(v => normalizedIntent(v));
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizedIntent(v, k)]));
  if (['referenceCost', 'salePrice', 'unitCost', 'unitPrice'].includes(field) && value != null) {
    if (field === 'salePrice' && value === '') return null;
    return amount(cents(value, 'Importe', true));
  }
  if (['name', 'category', 'internalCode', 'barcode', 'presentation', 'lotCode', 'description', 'reason', 'notes'].includes(field)) {
    return typeof value === 'string' ? value.trim().normalize('NFC') || null : value;
  }
  return value;
}
function fingerprint(kind, command) { return crypto.createHash('sha256').update(JSON.stringify(canonical({ version: 1, kind, command: normalizedIntent(command) }))).digest('hex'); }
function requestKey(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail('OPERATION_KEY_REQUIRED', 'La operación necesita una clave válida para evitar duplicados.', 400);
  return value.toLowerCase();
}
function productValues(command) {
  if (!Array.isArray(command.uses)) fail('INVALID_USE', 'Selecciona al menos un uso válido.', 400);
  const uses = [...new Set(command.uses)];
  if (!uses.length || uses.some(u => !['retail', 'veterinary', 'grooming'].includes(u))) fail('INVALID_USE', 'Selecciona al menos un uso válido.', 400);
  if (!['untracked', 'lot', 'lot_expiry'].includes(command.lotPolicy)) fail('INVALID_LOT_POLICY', 'Selecciona cómo se controlan los lotes.', 400);
  const internalCode = text(command.internalCode, 'Código interno', 64);
  const price = command.salePrice == null || command.salePrice === '' ? null : amount(cents(command.salePrice));
  if (uses.includes('retail') && price === null) fail('PRICE_REQUIRED', 'Un producto para venta necesita precio.', 400);
  return { name: text(command.name, 'Nombre', 160), category: text(command.category, 'Categoría', 80), internalCode,
    internalCodeKey: key(internalCode), barcode: text(command.barcode, 'Código de barras', 80, true),
    presentation: text(command.presentation, 'Presentación', 80), uses, lotPolicy: command.lotPolicy,
    referenceCost: amount(cents(command.referenceCost, 'Costo de referencia', true)), salePrice: price,
    stockMinimum: integer(command.stockMinimum ?? 0, 'Existencia mínima', true) };
}
module.exports = { InventoryError, fail, integer, cents, amount, text, key, dateOnly, expiryKey, availableLot, allocate, fingerprint, requestKey, productValues, MAX };
