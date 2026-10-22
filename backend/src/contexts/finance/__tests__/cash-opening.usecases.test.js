const { createCashOpeningUseCases } = require('../application/use-cases/cash-opening.usecases');
let repository, closes, gate, commands, opening;
const day = '2026-07-01', ctx = { tx: {} };
beforeEach(() => {
  opening = null;
  repository = { findByDate: jest.fn(async () => opening), previousSuggestion: jest.fn().mockResolvedValue({ id: 'previous-close', date: '2026-06-30', amount: 50000 }), save: jest.fn(async data => { opening = { ...data, updatedAt: new Date() }; }) };
  closes = { findByDate: jest.fn().mockResolvedValue(null) }; gate = { acquire: jest.fn() };
  commands = createCashOpeningUseCases({ openingRepository: repository, dailyCloseRepository: closes, businessDayGate: gate });
});
test.each([0, 50000, 123.45])('base %p is stored separately, with authenticated provenance only when it matches the suggestion', async amount => {
  const result = await commands.save({ tenantId: 't1', date: day, amount, actor: { id: 'staff:owner', name: 'Responsable' } }, ctx);
  expect(result.opening.amount).toBe(amount); expect(result.suggestion).toBeNull();
  expect(repository.save.mock.calls[0][0]).toMatchObject({ tenantId: 't1', amount, actorId: 'staff:owner', sourceDailyCloseId: amount === 50000 ? 'previous-close' : null });
  expect(gate.acquire).toHaveBeenCalledWith('t1', day, ctx);
});
test.each([-1, 1.001, 100000000, '50000', null, NaN])('invalid money %p does not write', async amount => {
  await expect(commands.save({ tenantId: 't1', date: day, amount }, ctx)).rejects.toMatchObject({ code: 'CASH_OPENING', status: 400 }); expect(repository.save).not.toHaveBeenCalled();
});
test.each(['2026-02-30', '2099-01-01', 'bad', null])('invalid or future date %p does not write', async date => {
  await expect(commands.save({ tenantId: 't1', date, amount: 0 }, ctx)).rejects.toMatchObject({ code: 'CASH_OPENING' }); expect(repository.save).not.toHaveBeenCalled();
});
test('a closed day blocks editing and exposes its original unknown values without inventing zero', async () => {
  closes.findByDate.mockResolvedValue({ openingCashAmount: null, retainedCashAmount: null });
  await expect(commands.save({ tenantId: 't1', date: day, amount: 0 }, ctx)).rejects.toMatchObject({ status: 409 });
  const result = await commands.get({ tenantId: 't1', date: day }); expect(result).toMatchObject({ closed: true, opening: null, suggestion: null, openingCashAmount: null, retainedCashAmount: null });
});
test('missing tenant cannot query or mutate another establishment', async () => {
  await expect(commands.get({ date: day })).rejects.toMatchObject({ status: 400 }); expect(repository.findByDate).not.toHaveBeenCalled();
});
