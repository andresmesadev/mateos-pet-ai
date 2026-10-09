const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { links, localTarget } = require('./check-docs.cjs');

test('reads portable links, images and reference definitions with their line', () => {
  assert.deepEqual(links('# Guide\n[Page](./page.md#section)\n![Capture](<shots/example image.png>)\n[ref]: ../README.md'), [
    { target: './page.md#section', line: 2 },
    { target: 'shots/example image.png', line: 3 },
    { target: '../README.md', line: 4 },
  ]);
});
test('ignores examples inside fenced and inline code without changing line numbers', () => {
  const sample = '```md\n[Example](missing.md)\n```\n`[example](entity)`\n[Actual](real.md)';
  assert.deepEqual(links(sample), [{ target: 'real.md', line: 5 }]);
});
test('does not treat an external URL or a local anchor as a file', () => {
  for (const value of ['https://example.com', 'mailto:person@example.com', '#heading', '//example.com']) assert.equal(localTarget(value, 'README.md'), null);
});
test('resolves a moved document relative to its new directory', () => {
  const target = localTarget('../README.md', ['docs', 'history', 'designs', 'proposal.md'].join('/'));
  assert.equal(target, path.resolve(__dirname, '../docs/history/README.md'));
});
test('decodes file names and removes query and fragment before checking existence', () => {
  assert.equal(localTarget('example%20image.png?view=1#figure', ['docs', 'history', 'report.md'].join('/')), path.resolve(__dirname, '../docs/history/example image.png'));
});
test('root-relative links resolve inside the repository', () => {
  assert.equal(localTarget('/README.md', ['docs', 'history', 'report.md'].join('/')), path.resolve(__dirname, '../README.md'));
});
