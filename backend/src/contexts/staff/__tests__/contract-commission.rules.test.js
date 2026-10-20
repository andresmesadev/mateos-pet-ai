const { validateContract, resolveContractRate } = require('../domain/rules/contract-commission.rules');
const { InvalidStaffAttributesError } = require('../domain/errors');

test.each([0, 0.3, 0.3333, 0.4, 0.5, 0.7, 1])('accepts fractional professional rate %p with complementary business share', async commissionRate => {
  expect(validateContract('service', commissionRate)).toEqual({ contractType: 'service', commissionRate });
  const legacy = jest.fn(() => 0.5);
  expect(await resolveContractRate({ contractType: 'service', commissionRate }, { appliesCommissionSplit: true }, legacy)).toBe(commissionRate);
  expect(legacy).not.toHaveBeenCalled();
});
test.each([undefined, null, -0.01, 1.01, NaN, Infinity, '0.3', 0.33333])('rejects invalid service rate %p', commissionRate => {
  expect(() => validateContract('service', commissionRate)).toThrow(InvalidStaffAttributesError);
});
test('fixed and direct service reserve no percentage; legacy preserves the prior establishment rate', async () => {
  const legacy = jest.fn(() => 0.5);
  expect(validateContract('fixed', null)).toEqual({ contractType: 'fixed', commissionRate: null });
  expect(await resolveContractRate({ contractType: 'fixed' }, { appliesCommissionSplit: true }, legacy)).toBe(0);
  expect(await resolveContractRate({ contractType: 'service', commissionRate: 0.3 }, { appliesCommissionSplit: false }, legacy)).toBe(0);
  expect(legacy).not.toHaveBeenCalled();
  expect(await resolveContractRate({ contractType: null }, { appliesCommissionSplit: true }, legacy)).toBe(0.5);
  expect(legacy).toHaveBeenCalledTimes(1);
  await expect(resolveContractRate({ contractType: 'service', commissionRate: null }, { appliesCommissionSplit: true }, legacy)).rejects.toThrow(InvalidStaffAttributesError);
  for (const [type, rate] of [['fixed', 0.5], [null, null], ['unknown', null]]) expect(() => validateContract(type, rate)).toThrow(InvalidStaffAttributesError);
});
