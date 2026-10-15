const { transactionalCommand } = require('../transactional-events');
const { PrismaBusinessDayGate } = require('../prisma-business-day-gate');

test('un retry descarta eventos del intento revertido y solo publica tras commit', async () => {
  const calls = [];
  let attempt = 0;
  const unitOfWork = { run: async fn => {
    attempt++;
    const result = await fn({ tx: { attempt } });
    if (attempt === 1) throw Object.assign(new Error('serialization'), { code: 'P2034' });
    calls.push('commit');
    return result;
  } };
  const command = transactionalCommand(async (_input, ctx) => {
    await ctx.eventPublisher.publish('saved', { attempt: ctx.tx.attempt });
    return ctx.tx.attempt;
  }, { unitOfWork, eventPublisher: { publish: async (_name, payload) => calls.push(payload) } });
  await expect(command({})).resolves.toBe(2);
  expect(calls).toEqual(['commit', { attempt: 2 }]);
});

test('rollback de validación no publica ni reintenta', async () => {
  const publish = jest.fn();
  const run = jest.fn(fn => fn({ tx: {} }));
  const command = transactionalCommand(async (_input, ctx) => {
    await ctx.eventPublisher.publish('saved', {});
    throw new Error('validation');
  }, { unitOfWork: { run }, eventPublisher: { publish } });
  await expect(command({})).rejects.toThrow('validation');
  expect(run).toHaveBeenCalledTimes(1);
  expect(publish).not.toHaveBeenCalled();
});

test('un fallo posterior al commit nunca reejecuta la escritura', async () => {
  const write = jest.fn(async (_input, ctx) => { await ctx.eventPublisher.publish('saved', {}); });
  const command = transactionalCommand(write, {
    unitOfWork: { run: async fn => fn({ tx: {} }) },
    eventPublisher: { publish: async () => { throw Object.assign(new Error('publisher'), { code: 'P2034' }); } },
  });
  await expect(command({})).rejects.toThrow('publisher');
  expect(write).toHaveBeenCalledTimes(1);
});

test('ctx existente comparte la misma transacción y colector sin iniciar otro UOW', async () => {
  const run = jest.fn();
  const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  const command = transactionalCommand(async (_input, inner) => inner, { unitOfWork: { run } });
  await expect(command({}, ctx)).resolves.toBe(ctx);
  expect(run).not.toHaveBeenCalled();
  await expect(command({}, { tx: {} })).rejects.toThrow('transaction-local');
});

test('la barrera usa tenant y fecha como parámetros y requiere transacción', async () => {
  const query = jest.fn().mockResolvedValue([{ locked: 1 }]);
  const gate = new PrismaBusinessDayGate();
  await gate.acquire('tenant-other', '2026-10-14', { tx: { $queryRaw: query } });
  expect(query.mock.calls[0][1]).toBe(JSON.stringify(['expense-close-v1', 'tenant-other', '2026-10-14']));
  await expect(gate.acquire('tenant', '2026-10-14')).rejects.toThrow('transaction');
});
