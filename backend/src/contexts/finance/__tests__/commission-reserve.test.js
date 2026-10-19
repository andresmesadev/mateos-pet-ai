const { commissionReserve } = require('../domain/rules/financial-summary.rules');

test('reserves the frozen staff share once without changing cash or commissions', () => {
  const snapshot = Object.freeze({ netAmount: 484000, staffBreakdown: Object.freeze([Object.freeze({ staffShare: 144000 })]) });
  expect(commissionReserve(snapshot)).toEqual({ staffCommissionTotal: 144000, netAfterCommissions: 340000 });
  expect(commissionReserve({ ...snapshot, ...commissionReserve(snapshot) })).toEqual(commissionReserve(snapshot));
  expect(snapshot.netAmount).toBe(484000);
});
test('preserves cents and negative reserve balance when collection is delayed', () => {
  expect(commissionReserve({ netAmount: 0, staffBreakdown: [{ staffShare: '500.15' }, { staffShare: '20.10' }] })).toEqual({ staffCommissionTotal: 520.25, netAfterCommissions: -520.25 });
  expect(commissionReserve({ netAmount: '20.10', staffBreakdown: [] })).toEqual({ staffCommissionTotal: 0, netAfterCommissions: 20.1 });
});
