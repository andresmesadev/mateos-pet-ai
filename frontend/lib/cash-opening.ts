export type CashOpeningState = { date: string; closed: boolean; opening: { amount: number; sourceDailyCloseId: string | null; updatedAt: string } | null; suggestion: { id: string; date: string; amount: number } | null; openingCashAmount: number | null; retainedCashAmount: number | null };
export const cashAmountValid = (value: number) => Number.isFinite(value) && value >= 0 && value <= 99999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
export function readCashOpening(value: unknown, date: string): CashOpeningState {
  if (!value || typeof value !== 'object' || !('date' in value) || value.date !== date || !('closed' in value) || typeof value.closed !== 'boolean' || !('opening' in value)) throw new Error('No se pudo comprobar la base de caja.');
  const row = value as CashOpeningState;
  if (row.opening !== null && (!row.opening || typeof row.opening.amount !== 'number' || !cashAmountValid(row.opening.amount))) throw new Error('La base recibida no es válida.');
  return row;
}
