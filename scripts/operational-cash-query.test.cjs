const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cashQuery } = require('../backend/src/routes/dashboard/operational-cash-page');
const { getBogotaYmd } = require('../backend/src/routes/dashboard/shared');
const admin = { capabilities: { administration: true } }, reception = { capabilities: { administration: false } };
const today = getBogotaYmd(), yesterday = new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);

test('Reception can query all pending dates; historical ordinary cash remains administrative', () => {
  const pending=cashQuery({scope:'pending',date:yesterday},reception);
  assert.equal(pending.query.method,'review'); assert.equal(pending.scope,'pending');
  assert.throws(()=>cashQuery({date:yesterday},reception),{status:403});
  assert.equal(cashQuery({date:yesterday},admin).date,yesterday);
});
test('Paging, invalid days and duplicated query parameters are rejected', () => {
  for(const input of [{page:'0'},{pageSize:'51'},{pageSize:'1.5'},{date:'2026-02-30'},{scope:['pending','day']},{scope:'other'},{filter:'other'},{search:'a'.repeat(201)},{scope:'pending',method:'cash'}]) {
    assert.throws(()=>cashQuery(input,admin));
  }
});
test('Cash keeps active-only records and fixed source even with conflicting client parameters', () => {
  const {query}=cashQuery({status:'voided',origin:'manual_pos_sale',filter:'registered',page:'2',pageSize:'25'},admin);
  assert.equal(query.status,'active');assert.equal(query.origin,'all');assert.equal(query.confirmedOnly,true);assert.equal(query.page,2);
});
