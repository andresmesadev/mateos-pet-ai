const { randomUUID } = require('node:crypto');
const { buildInventoryCommands } = require('../application/use-cases/inventory.commands');

function setup() {
  const order = [];
  const repository = {
    findOperation: jest.fn().mockResolvedValue(null),
    lockProducts: jest.fn(async () => { order.push('lock'); }),
    findProduct: jest.fn().mockResolvedValue({ id: 'p', active: true, lotPolicy: 'untracked', metadataVersion: 1, name: 'Producto', presentation: 'Unidad' }),
    createOperation: jest.fn(), lots: jest.fn().mockResolvedValue([]),
    createLot: jest.fn().mockResolvedValue({ id: 'lot', balancePhysical: 0 }),
    changeBalance: jest.fn(), recordMovement: jest.fn(), bumpStock: jest.fn(), movements: jest.fn().mockResolvedValue([]),
  };
  const accessReader = { readAccess: jest.fn().mockResolvedValue({ capabilities: { inventory_manage: true }, principalKey: 'admin:a', snapshot: {} }) };
  const unitOfWork = { run: jest.fn(fn => fn({ tx: {} })) };
  const eventPublisher = { publish: jest.fn() };
  const commands = buildInventoryCommands({ repository, accessReader, unitOfWork, eventPublisher, clock: () => new Date('2026-10-14T17:00:00Z') });
  const input = { tenantId: 't', actor: {}, kind: 'register_entry', operationKey: randomUUID(), command: { productId: 'p', quantity: 2, unitCost: '10' } };
  return { commands, repository, accessReader, unitOfWork, eventPublisher, input, order };
}
test('valida el producto bajo lock y guarda auditoría antes del commit, sin publicar legacy', async () => {
  const s = setup(); const contexts = [];
  const result = await s.commands.entry(s.input, {
    before: async ctx => { contexts.push(ctx); s.order.push('before'); },
    validateProduct: async (product, ctx) => { expect(product.metadataVersion).toBe(1); expect(ctx).toBe(contexts[0]); s.order.push('validate'); },
    after: async (response, event, ctx) => { expect(ctx).toBe(contexts[0]); expect(response.operationId).toBeTruthy(); expect(event.name).toBe('EntradaDeInventarioRegistrada'); s.order.push('after'); },
  });
  expect(result.replayed).toBe(false);
  expect(s.order).toEqual(['before', 'lock', 'validate', 'after']);
  expect(s.eventPublisher.publish).not.toHaveBeenCalled();
});
test('recuperar recibo corta antes de empleado/producto y no crea efectos', async () => {
  const s = setup(); const after = jest.fn();
  await expect(s.commands.entry(s.input, { before: async () => ({ recovered: { receiptId: 'r' } }), validateProduct: jest.fn(), after })).resolves.toEqual({ receiptId: 'r', replayed: true });
  expect(s.accessReader.readAccess).not.toHaveBeenCalled();
  expect(s.repository.lockProducts).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
});
test('conflicto Serializable repite hooks en un contexto nuevo y no publica intento fallido', async () => {
  const s = setup(); let attempt = 0;
  s.unitOfWork.run.mockImplementation(async fn => { const response = await fn({ tx: { attempt: ++attempt } }); if (attempt === 1) throw Object.assign(new Error('retry'), { code: 'P2034' }); return response; });
  const before = jest.fn(); const after = jest.fn();
  await s.commands.entry(s.input, { before, after, validateProduct: jest.fn() });
  expect(before).toHaveBeenCalledTimes(2);
  expect(before.mock.calls[0][0]).not.toBe(before.mock.calls[1][0]);
  expect(after).toHaveBeenCalledTimes(2);
  expect(s.eventPublisher.publish).not.toHaveBeenCalled();
});
test('metadatos modificados abortan antes de registrar la entrada', async () => {
  const s = setup(); const after = jest.fn();
  await expect(s.commands.entry(s.input, { before: jest.fn(), after, validateProduct: async () => { throw new Error('PRODUCT_CHANGED'); } })).rejects.toThrow('PRODUCT_CHANGED');
  expect(s.repository.createOperation).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
});
