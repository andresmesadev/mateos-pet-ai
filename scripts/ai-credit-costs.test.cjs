const { test } = require('node:test');
const assert = require('node:assert/strict');
const { costUsd,report } = require('./helpers/ai-credit-costs.cjs');

test('provider cost scenarios remain within the conservative weighted-credit envelope', () => {
  const result=report();
  assert.ok(Math.abs(result.maxUsdPerCredit-.0032384)<1e-12);
  for(const c of result.cases) assert.ok(c.providerUsd/c.credits <= result.maxUsdPerCredit+1e-12,c.name);
  assert.equal(result.cases.find(c=>c.name==='Audio 60 segundos').credits,5);
  assert.equal(result.cases.find(c=>c.name==='Audio 61 segundos').credits,10);
  assert.equal(result.cases.find(c=>c.name==='Contexto largo supuesto').credits,25);
});
test('the same worst-case cost per credit is applied to whole trial, Basic and Pro allowances', () => {
  const result=report();
  for(const p of result.plans) {
    assert.ok(Math.abs(p.providerCopAt4500-p.credits*14.5728)<1e-8);
    assert.ok(Math.abs(p.providerCopAt6000-p.credits*19.4304)<1e-8);
  }
  assert.equal(result.plans[2].credits,3000);
  assert.deepEqual(result.excludes,['taxes','infrastructure','support','paymentFees']);
});
test('the calculator never treats negative or non-finite quantities as provider savings', () => {
  for(const n of [-1,Infinity,NaN]) assert.throws(()=>costUsd({ operation: 'reply',inputTokens: n }),/INVALID_COST_SCENARIO/);
});
