const { buildConfirmPosSale } = require('../../application/workflows/pos/confirm-pos-sale');
const { createRegisterAppointmentSaleUseCase } = require('../../contexts/finance/application/use-cases/pos/register-appointment-sale.usecase');
const { PrismaTransactionRepository } = require('../../contexts/finance/infrastructure/persistence/prisma-transaction.repository');
const staff = require('../../contexts/staff');

// Exercise the real checkout and Staff commands against a transactional in-memory
// adapter. PostgreSQL locking/concurrency is not claimed by these tests.
function setup({ split = false, closed = false, settled = false, failStock = false } = {}) {
  let state = { visit: { id: 'visit', tenantId: 'clinic', userId: 'owner', petId: 'pet', serviceId: 'vaccination', staffId: 'vet',
    status: 'completed', serviceType: 'vet', finalPrice: null, endedAt: new Date('2026-10-23T16:00:00Z'), service: { category: { name: 'other' } } },
    charge: null, commissions: [], stock: 11 };
  const sent = [], locks = [], successes = new Map();
  const ctx = () => ({ tx: {
    $queryRaw: async (sql, ...values) => { locks.push({ sql: sql.join('?'), values }); return []; },
    appointment: { findFirst: async ({ where }) => where.tenantId === 'clinic' && where.id === 'visit' ? state.visit : null,
      update: async ({ where, data }) => { if (where.tenantId !== state.visit.tenantId || where.finalPrice !== state.visit.finalPrice) throw new Error('snapshot changed'); Object.assign(state.visit, data); return state.visit; } },
    transaction: { findFirst: async () => state.charge,
      create: async ({ data }) => { if (state.charge) throw new Error('unique charge'); state.charge = { id: 'charge', ...data }; return state.charge; },
      update: async ({ data: { items, ...data } }) => Object.assign(state.charge, data, { items: items.create.map((i, index) => ({ id: 'line-' + index, ...i })) }) },
    staff: { findUnique: async () => ({ id: 'vet', tenantId: 'clinic', contractType: 'service', commissionRate: 0.5 }) },
    service: { findFirst: async () => ({ appliesCommissionSplit: split, category: { id: 'other', name: 'other', appliesCommissionSplit: false } }) },
    commission: { create: async ({ data }) => { const row = { id: 'commission', ...data }; state.commissions.push(row); return row; } },
    dailyClose: { findFirst: async () => closed ? { id: 'close' } : null },
    settlement: { findFirst: async () => settled ? { id: 'settlement' } : null },
  } });
  const access = { snapshot: { actorId: 'admin:cashier' }, capabilities: { cash: true, services: true, retail: true } };
  const finance = { registerAppointmentSale: createRegisterAppointmentSaleUseCase({ transactionRepository: new PrismaTransactionRepository(),
    referencesReader: { validate: async () => {} }, dailyCloseRepository: { findByDate: async () => null }, businessDayGate: { acquire: async () => {} } }),
    publishCheckoutPayment: jest.fn(async row => sent.push(['payment', row.id])) };
  const recordCommission = jest.fn(staff.recordDeferredCheckoutCommission);
  const integrationStaff = { recordDeferredCheckoutCommission: recordCommission, correctCheckoutCommission: jest.fn(),
    publishCheckoutCorrection: jest.fn(async event => sent.push([event.name, event.payload.commission.id])) };
  const inventory = { prepareSale: async (_state, lines) => lines,
    run: async ({ operationKey }, execute) => {
      if (successes.has(operationKey)) return { ...successes.get(operationKey), replayed: true };
      const before = structuredClone(state);
      try {
        const result = await execute({ ctx: ctx(), access, now: new Date('2026-10-24T17:00:00Z') });
        successes.set(operationKey, result); return result;
      } catch (error) { state = before; throw error; }
    }, start: async () => ({ transaction: state.charge }), sellLines: async () => { if (failStock) throw new Error('stock changed'); state.stock--; } };
  const execute = buildConfirmPosSale({ inventory, finance, staff: integrationStaff });
  const input = { tenantId: 'clinic', actor: {}, operationKey: 'operation-1', command: { appointmentCheckout: true, appointmentId: 'visit', userId: 'owner', petId: 'pet', paymentMethod: 'cash',
    items: [{ description: 'Vacunación', itemKind: 'service', quantity: 1, unitPrice: 60000, appointmentComponent: 'service' }] } };
  return { execute, input, state: () => state, sent, recordCommission, locks };
}

test.each([false, true])('deferred checkout respects per-service split=%s and pays once', async split => {
  const s = setup({ split }); await s.execute(s.input);
  expect(s.state().charge).toMatchObject({ origin: 'system_appointment_completed', total: '60000.00', paidAt: new Date('2026-10-24T17:00:00Z') });
  expect(s.state().visit.finalPrice).toBe(60000);
  expect(s.state().commissions).toEqual([expect.objectContaining({ staffShare: split ? 30000 : 0, completedAt: new Date('2026-10-24T17:00:00Z') })]);
  expect(s.locks.some(lock => lock.sql.includes('"Appointment"') && lock.sql.includes('FOR UPDATE') && lock.values.includes('clinic'))).toBe(true);
  const result = await s.execute(s.input); expect(result.replayed).toBe(true);
  expect(s.recordCommission).toHaveBeenCalledTimes(1); expect(s.state().stock).toBe(10); expect(s.sent).toHaveLength(2);
  await expect(s.execute({ ...s.input, operationKey: 'second-key' })).rejects.toThrow(/pago confirmado/);
});

test.each(['closed', 'settled', 'failStock'])('%s rolls back value, obligation, commission and stock; emits no events', async kind => {
  const s = setup({ [kind]: true, split: true });
  await expect(s.execute(s.input)).rejects.toThrow();
  expect(s.state()).toMatchObject({ visit: { finalPrice: null }, charge: null, commissions: [], stock: 11 });
  expect(s.sent).toHaveLength(0);
});
