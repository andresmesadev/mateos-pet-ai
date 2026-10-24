const { InvalidTransactionOperationError } = require('./errors');
const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'other', 'mixed'];
function paymentCents(value) {
  const text = String(value ?? '');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text)) throw new InvalidTransactionOperationError('Importe de pago inválido: usa máximo dos decimales.');
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
function resolvePayment({ paymentMethod, cashAmount, transferAmount }, total) {
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new InvalidTransactionOperationError('Método de pago inválido.');
  if (paymentMethod !== 'mixed') {
    if (cashAmount != null || transferAmount != null) throw new InvalidTransactionOperationError('El reparto corresponde solo al pago en efectivo y transferencia.');
    return { paymentMethod };
  }
  const cash = paymentCents(cashAmount), transfer = paymentCents(transferAmount);
  if (cash <= 0 || transfer <= 0 || cash + transfer !== paymentCents(total)) throw new InvalidTransactionOperationError('Efectivo y transferencia deben ser mayores que cero y sumar el total del cobro.');
  return { paymentMethod, cashAmount: (cash / 100).toFixed(2), transferAmount: (transfer / 100).toFixed(2) };
}
function paymentShares(transaction) {
  if (transaction.paymentMethod !== 'mixed') return [{ method: transaction.paymentMethod, amount: Number(transaction.total) }];
  // Aggregated reporting groups may exceed the limit of one individual sale.
  const cash = Number(transaction.cashAmount), transfer = Number(transaction.transferAmount), total = Number(transaction.total);
  if (![cash, transfer, total].every(Number.isFinite) || cash <= 0 || transfer <= 0 || Math.round(cash * 100) + Math.round(transfer * 100) !== Math.round(total * 100)) throw new InvalidTransactionOperationError('El reparto guardado no coincide con el total.');
  return [{ method: 'cash', amount: cash }, { method: 'transfer', amount: transfer }];
}
function paymentTotals(transactions) {
  const totals = new Map();
  for (const transaction of transactions) for (const part of paymentShares(transaction)) {
    const group = totals.get(part.method) ?? { method: part.method, count: 0, cents: 0 };
    group.count++; group.cents += Math.round(part.amount * 100); totals.set(part.method, group);
  }
  return [...totals.values()].map(({ cents, ...group }) => ({ ...group, total: cents / 100 }));
}
module.exports = { PAYMENT_METHODS, paymentCents, resolvePayment, paymentShares, paymentTotals };
