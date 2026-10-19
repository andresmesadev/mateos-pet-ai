const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commissionPeriod, aggregateCommissions } = require('../frontend/lib/daily-close.ts');
test('civil day presets handle Mondays, Sundays, month/year and half-month boundaries', () => {
  assert.deepEqual(commissionPeriod('2026-10-19', 'day'), { from: '2026-10-19', to: '2026-10-19' });
  assert.equal(commissionPeriod('2026-11-01', 'week').from, '2026-10-26');
  assert.equal(commissionPeriod('2026-01-01', 'week').from, '2025-12-29');
  assert.equal(commissionPeriod('2026-10-15', 'fortnight').from, '2026-10-01');
  assert.equal(commissionPeriod('2026-10-16', 'fortnight').from, '2026-10-16');
  assert.equal(commissionPeriod('2026-10-19', 'month').from, '2026-10-01');
});
test('period sums snapshots and previews with cents, preserving individual records', () => {
  const days = [{ staffBreakdown: [{ staffId: 'a', count: 1, staffShare: 10.1, businessShare: 20 }] }, { staffBreakdown: [{ staffId: 'a', count: 2, staffShare: 0.2, businessShare: 1 }, { staffId: null, count: 1, staffShare: 3, businessShare: 2 }] }];
  assert.deepEqual(aggregateCommissions(days), [{ staffId: 'a', count: 3, staffShare: 10.3, businessShare: 21 }, { staffId: null, count: 1, staffShare: 3, businessShare: 2 }]);
  assert.equal(days[0].staffBreakdown[0].staffShare, 10.1);
});
