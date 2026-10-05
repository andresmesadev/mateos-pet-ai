const { fingerprint } = require('../../contexts/inventory/domain/policy');
describe('Inventory command fingerprint contract v1', () => {
  test('amounts and trimmed Unicode text have one canonical representation', () => {
    expect(fingerprint('register_entry', { productId: 'sku', quantity: 2, unitCost: 12, reason: '  Ban\u0303o  ' }))
      .toBe(fingerprint('register_entry', { reason: 'Baño', unitCost: '12.00', quantity: 2, productId: 'sku' }));
  });
  test('quantities, ordered sale lines and operation type remain significant', () => {
    const command = { items: [{ productId: 'a', quantity: 1, unitPrice: 2 }, { productId: 'b', quantity: 2, unitPrice: 3 }] };
    const hash = fingerprint('confirm_pos_sale', command);
    expect(hash).not.toBe(fingerprint('confirm_pos_sale', { items: [...command.items].reverse() }));
    expect(hash).not.toBe(fingerprint('confirm_pos_sale', { items: [{ ...command.items[0], quantity: 2 }, command.items[1]] }));
    expect(hash).not.toBe(fingerprint('register_consumption', command));
  });
  test('uses are a set and malformed amounts cannot be normalized into valid commands', () => {
    expect(fingerprint('create_product', { uses: ['grooming', 'veterinary', 'grooming'], salePrice: '' }))
      .toBe(fingerprint('create_product', { salePrice: null, uses: ['veterinary', 'grooming'] }));
    expect(() => fingerprint('register_entry', { unitCost: '1,000' })).toThrow();
  });
});
