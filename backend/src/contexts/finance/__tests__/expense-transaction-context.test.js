const { createRegisterExpenseUseCase } = require('../application/use-cases/register-expense.usecase');
const { createVoidExpenseUseCase } = require('../application/use-cases/void-expense.usecase');
const { createGenerateDailyCloseUseCase } = require('../application/use-cases/generate-daily-close.usecase');

function deps() {
  return {
    expenseRepository: { findById: jest.fn().mockResolvedValue({ id: 'e', tenantId: 't', date: '2026-10-14T17:00:00Z', status: 'active' }), create: jest.fn().mockResolvedValue({ id: 'e', tenantId: 't' }), void: jest.fn().mockResolvedValue({ id: 'e' }), listByDateRange: jest.fn().mockResolvedValue([]) },
    dailyCloseRepository: { findByDate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'close' }) },
    transactionRepository: { listByDateRange: jest.fn().mockResolvedValue([]) },
    commissionReader: { listByDateRange: jest.fn().mockResolvedValue([]) },
    completedAppointmentsReader: { listCompletedInRange: jest.fn().mockResolvedValue([]) },
    businessDayGate: { acquire: jest.fn() }, eventPublisher: { publish: jest.fn() },
  };
}
test('registrar toma barrera antes de consultar y escribe/publica en el contexto del intento', async () => {
  const d = deps(); const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  await createRegisterExpenseUseCase(d)({ tenantId: 't', amount: 100, responsible: 'Ana', date: '2026-10-14T17:00:00Z' }, ctx);
  expect(d.businessDayGate.acquire).toHaveBeenCalledWith('t', '2026-10-14', ctx);
  expect(d.businessDayGate.acquire.mock.invocationCallOrder[0]).toBeLessThan(d.dailyCloseRepository.findByDate.mock.invocationCallOrder[0]);
  expect(d.expenseRepository.create).toHaveBeenCalledWith(expect.any(Object), ctx);
  expect(ctx.eventPublisher.publish).toHaveBeenCalledWith('GastoRegistrado', expect.any(Object));
  expect(d.eventPublisher.publish).not.toHaveBeenCalled();
});
test('anular relee el gasto después de la barrera y preserva el rechazo de cierre', async () => {
  const d = deps(); const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  d.dailyCloseRepository.findByDate.mockResolvedValue({ id: 'close' });
  await expect(createVoidExpenseUseCase(d)({ tenantId: 't', expenseId: 'e', reason: 'Duplicado' }, ctx)).rejects.toThrow();
  expect(d.expenseRepository.findById).toHaveBeenCalledTimes(2);
  expect(d.expenseRepository.findById.mock.invocationCallOrder[1]).toBeGreaterThan(d.businessDayGate.acquire.mock.invocationCallOrder[0]);
  expect(d.expenseRepository.void).not.toHaveBeenCalled();
  expect(ctx.eventPublisher.publish).not.toHaveBeenCalled();
});
test('cierre lee todas las fuentes y crea el corte en una misma transacción', async () => {
  const d = deps(); const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  await createGenerateDailyCloseUseCase(d)({ tenantId: 't', date: '2026-10-14' }, ctx);
  for (const r of [d.expenseRepository, d.transactionRepository, d.commissionReader]) expect(r.listByDateRange.mock.calls[0][3]).toBe(ctx);
  expect(d.completedAppointmentsReader.listCompletedInRange.mock.calls[0][3]).toBe(ctx);
  expect(d.dailyCloseRepository.create).toHaveBeenCalledWith(expect.any(Object), ctx);
  expect(d.eventPublisher.publish).not.toHaveBeenCalled();
});
