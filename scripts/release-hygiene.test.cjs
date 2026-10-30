const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectFile } = require('./check-release-hygiene.cjs');
test('publication rejects forced private/generated files even if Git ignore is bypassed', () => {
  for (const name of ['.env', 'backend/.env.production', '.codex-remote-attachments/customer.png', '.cache/private/legal.md', 'secrets/key', 'scripts/__pycache__/test.pyc', 'backups/offsite/database.dump.age']) {
    assert.equal(inspectFile(name, null)[0].kind, 'private-or-generated-file');
  }
  assert.deepEqual(inspectFile('backend/.env.example', 'KEY=replace_me'), []);
});
test('secret scanning reports only the location and kind, never the credential', () => {
  const synthetic = 'sk-proj-' + 'x'.repeat(45);
  const result = inspectFile('example.js', 'const key = "' + synthetic + '";');
  assert.deepEqual(result, [{ file: 'example.js', line: 1, kind: 'openai-token' }]);
  assert(!JSON.stringify(result).includes(synthetic));
  for (const type of ['', 'RSA ', 'EC ', 'DSA ', 'OPENSSH ', 'ENCRYPTED ']) {
    const keyHeader = '-----BEGIN ' + type + 'PRIVATE KEY-----';
    assert.equal(inspectFile('accidental.txt', keyHeader)[0].kind, 'private-key');
  }
});
test('unresolved conflicts are rejected without mistaking documentation separators for conflicts', () => {
  assert.equal(inspectFile('file.ts', '<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>> branch').length, 2);
  assert.deepEqual(inspectFile('README.md', '# Header\n=======\ntext'), []);
});
