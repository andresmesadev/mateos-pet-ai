const { normalizeCommand, intentInput, authorize, hash, limitedResult } = require('../application/operational/policy');

test.each(['1,000.00', '-1', '0', '0.001', '100000000.00', 'NaN', 'Infinity', {}, []])('gasto rechaza importe no representable sin redondear: %p', amount => {
  expect(() => normalizeCommand('prepare_expense', { amount, responsible: 'Owner', description: 'Supply' })).toThrow();
});

test.each(['0.29', '12500.50', '99999999.99'])('gasto conserva exactamente el decimal autorizado %s', amount => {
  const result = normalizeCommand('prepare_expense', { amount, responsible: 'Owner', description: 'Supply' });
  expect(result.payload.amount).toBe(amount);
  expect(result.missing).toEqual([]);
});

test('faltantes mantienen borrador sin inventar importe ni responsable', () => {
  const result = normalizeCommand('prepare_expense', {});
  expect(result.payload.amount).toBeNull();
  expect(result.payload.responsible).toBeNull();
  expect(result.missing).toEqual(['amount', 'responsible', 'description']);
});

test.each(['tenantId', 'actor', 'principalKey', 'expenseId', 'operationKey'])('el formulario rechaza identidad o referencias de ejecución inyectadas: %s', key => {
  expect(() => intentInput('prepare_expense', { [key]: 'attacker-controlled' })).toThrow();
  expect(() => intentInput('prepare_entry', { [key]: 'attacker-controlled' })).toThrow();
});

test('permisos actuales y especialización son precondiciones independientes', () => {
  const finance = { capabilities: { finance: true, inventory_read: false, inventory_manage: false } };
  const reader = { capabilities: { finance: false, inventory_read: true, inventory_manage: false } };
  expect(() => authorize(finance, 'asistente_financiero', 'prepare_expense')).not.toThrow();
  expect(() => authorize(finance, 'asistente_financiero', 'prepare_entry')).toThrow();
  expect(() => authorize(reader, 'asistente_administrativo', 'inventory_detail')).not.toThrow();
  expect(() => authorize(reader, 'asistente_administrativo', 'prepare_entry')).toThrow();
  expect(() => authorize(reader, 'asistente_financiero', 'financial_history')).toThrow();
});

test('la huella es estable ante orden de claves y representación ISO de fechas', () => {
  const date = '2026-10-14T17:00:00.000Z';
  expect(hash({ date: new Date(date), nested: { a: 1, b: 2 } })).toBe(hash({ nested: { b: 2, a: 1 }, date }));
  expect(() => hash({ invalid: NaN })).toThrow();
});

test('resultado excesivo se rechaza explícitamente, sin guardar una vista parcial como completa', () => {
  expect(() => limitedResult({ value: 'x'.repeat(65536) })).toThrow();
  expect(limitedResult({ count: 2n })).toEqual({ count: '2' });
});

test.each(['2026-02-30', '2026-13-01'])('la fecha civil imposible no se corrige silenciosamente: %s', date => {
  expect(() => normalizeCommand('prepare_expense', { date })).toThrow();
});
