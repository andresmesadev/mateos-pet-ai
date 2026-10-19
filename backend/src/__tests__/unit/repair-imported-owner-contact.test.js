const { planRepair, applyRepair } = require('../../../../scripts/repair-imported-owner-contact.cjs');
const before = { id: 'owner', tenantId: 'clinic', phone: '573001234567', phoneAlt: null, notes: 'Registro original: R1 | Teléfonos móviles originales: 3111234567 | Notas originales: 01/01/26 | Fechas de peluquería del contacto: 2026-01-01' };
test('plan requires an explicit tenant and only selects legacy imported notes', async () => {
  const db = { user: { findMany: jest.fn(async () => [before]) } };
  await expect(planRepair(db)).rejects.toThrow('Explicit tenant');
  const plan = await planRepair(db, 'clinic');
  expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'clinic', notes: { startsWith: 'Registro original:' } } }));
  expect(plan).toEqual([{ before, after: { phoneAlt: '573111234567', notes: null } }]);
});
test('repair compares exact originals and refuses concurrent changes or foreign tenants', async () => {
  const tx = { user: { updateMany: jest.fn(async () => ({ count: 1 })) } };
  const db = { $transaction: fn => fn(tx) };
  const plan = [{ before, after: { phoneAlt: '573111234567', notes: null } }];
  expect(await applyRepair(db, 'clinic', plan)).toBe(1);
  expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: 'owner', tenantId: 'clinic', phone: before.phone, phoneAlt: null, notes: before.notes }, data: plan[0].after });
  tx.user.updateMany.mockResolvedValue({ count: 0 });
  await expect(applyRepair(db, 'clinic', plan)).rejects.toThrow('rolled back');
  await expect(applyRepair(db, 'other', plan)).rejects.toThrow('Foreign tenant');
});

test('source recovery includes phones from repeated contacts but preserves ordinary notes and primary identity', async () => {
  const row = { ...before, notes: 'Observación escrita por el equipo' };
  const db = { user: { findMany: jest.fn(async () => [row]) } };
  const plan = await planRepair(db, 'clinic', [{ phone: '3001234567', phones_alt: '3111234567', notes: '' }, { phone: '573001234567', phones_alt: '3121234567', notes: 'Otra nota' }]);
  expect(plan).toEqual([{ before: row, after: { phoneAlt: '573111234567 / 573121234567', notes: row.notes } }]);
});
