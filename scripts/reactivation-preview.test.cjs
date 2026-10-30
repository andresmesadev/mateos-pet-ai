const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/lib/customer-followup.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { reactivationPreview } = exportsObject;

test('two business previews match the positional parameters without leaking the other identity', () => {
  for (const businessName of ['Centro A', 'Pet shop B']) {
    assert.equal(reactivationPreview({ body: 'Hola {{1}}. Somos {{2}}.', businessName }, ' Ana '), `Hola Ana. Somos ${businessName}.`);
  }
});
test('replacement-like names remain literal even when the business variable comes first', () => {
  assert.equal(reactivationPreview({ body: '{{2}} saluda a {{1}}.', businessName: 'Centro {nombre} $& {{1}}' }, '$& {{2}}'), 'Centro {nombre} $& {{1}} saluda a $& {{2}}.');
});
test('missing configuration renders nothing and missing client uses the same fallback as delivery', () => {
  assert.equal(reactivationPreview(null, 'Ana'), null);
  assert.equal(reactivationPreview(undefined, 'Ana'), null);
  assert.equal(reactivationPreview({ body: '{{1}} - {{2}}', businessName: 'Centro A' }, '  '), 'cliente - Centro A');
});
