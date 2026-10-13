const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

test('HTTPS capacity tool really starts through stdin and fails closed without credentials', () => {
  const source=readFileSync(resolve(__dirname,'verify-capacity-https.cjs'),'utf8');
  const result=spawnSync(process.execPath,['-'],{ input:source,encoding:'utf8',timeout:10000,
    env:{ ...process.env,ADMIN_EMAIL:'',ADMIN_PASSWORD:'' } });
  assert.equal(result.status,1);
  assert.match(result.stderr,/Existing admin credentials required/);
  assert.equal(result.stdout,'');
});

test('queue capacity tool cannot select production or reuse DATABASE_URL', () => {
  const source=readFileSync(resolve(__dirname,'benchmark-inbound-capacity.cjs'),'utf8');
  for(const destination of ['', 'postgresql://fixture:fixture@db:5432/mateos',
    'postgresql://fixture:fixture@capacity-db:5432/mateos']){
    const result=spawnSync(process.execPath,['-'],{ input:source,encoding:'utf8',timeout:15000,
      cwd:resolve(__dirname,'../backend'),
      env:{ ...process.env,DATABASE_URL:'postgresql://fixture:fixture@db:5432/mateos',CAPACITY_TEST_DATABASE_URL:destination } });
    assert.equal(result.status,1);
    assert.match(result.stderr,/Set CAPACITY_TEST_DATABASE_URL|Requires the internal capacity-db/);
    assert.equal(result.stdout,'');
  }
});
