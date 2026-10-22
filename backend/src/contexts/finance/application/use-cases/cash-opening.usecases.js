const { civilDateKey, civilDateLabel } = require('../../../shared/business-day');
const { CashOpeningError, validCashAmount } = require('../../domain/rules/cash-opening.rules');
function identity(tenantId, date) {
  if (!tenantId) throw new CashOpeningError('Selecciona un establecimiento.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new CashOpeningError('Selecciona una fecha válida.');
  let key;
  try { key = civilDateKey(date); } catch { throw new CashOpeningError('Selecciona una fecha válida.'); }
  if (typeof date !== 'string' || date !== key) throw new CashOpeningError('Selecciona una fecha válida.');
  const today = civilDateKey(new Date());
  if (key > today) throw new CashOpeningError('La base se confirma al iniciar la jornada, no para fechas futuras.');
  return { key, label: civilDateLabel(key) };
}
function createCashOpeningUseCases({ openingRepository, dailyCloseRepository, businessDayGate }) {
  async function get({ tenantId, date }, ctx) {
    const { label } = identity(tenantId, date);
    const [opening, closed, suggestion] = await Promise.all([
      openingRepository.findByDate(tenantId, label, ctx), dailyCloseRepository.findByDate(tenantId, label, ctx), openingRepository.previousSuggestion(tenantId, label, ctx),
    ]);
    return { date, closed: !!closed,
      opening: opening ? { amount: Number(closed ? closed.openingCashAmount ?? opening.amount : opening.amount), sourceDailyCloseId: opening.sourceDailyCloseId, updatedAt: opening.updatedAt } : null,
      suggestion: closed || opening ? null : suggestion,
      openingCashAmount: closed?.openingCashAmount == null ? null : Number(closed.openingCashAmount),
      retainedCashAmount: closed?.retainedCashAmount == null ? null : Number(closed.retainedCashAmount) };
  }
  async function save({ tenantId, date, amount, actor }, ctx) {
    const { label, key } = identity(tenantId, date);
    if (!validCashAmount(amount)) throw new CashOpeningError('Indica una base válida; 0 significa iniciar sin efectivo.');
    await businessDayGate.acquire(tenantId, key, ctx);
    if (await dailyCloseRepository.findByDate(tenantId, label, ctx)) throw new CashOpeningError('La jornada ya está cerrada. Su base no puede cambiar.', 409);
    const suggestion = await openingRepository.previousSuggestion(tenantId, label, ctx);
    await openingRepository.save({ tenantId, date: label, amount, sourceDailyCloseId: suggestion && Math.round(suggestion.amount * 100) === Math.round(amount * 100) ? suggestion.id : null,
      actorId: actor?.id ?? null, actorName: actor?.name ?? null }, ctx);
    return get({ tenantId, date }, ctx);
  }
  return { get, save };
}
module.exports = { createCashOpeningUseCases };
