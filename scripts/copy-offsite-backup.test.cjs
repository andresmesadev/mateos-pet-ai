const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { backupTime, latestBackup, metadata, options, copyBackup, DEFAULT_DESTINATION } = require('./copy-offsite-backup.cjs');

const name = 'mateos-pet-ai-20261009T081741Z';
const now = Date.parse('2026-10-09T12:00:00Z');
const data = Buffer.from('age-encryption.org/v1\n-> ssh-rsa test\n--- test\nencrypted-test-fixture');
const sha256 = createHash('sha256').update(data).digest('hex');
const manifest = `created_at_utc=20261009T081741Z\nformat=postgresql-custom-dump\nencryption=age\nencrypted_file=database.dump.age\nencrypted_sha256=${sha256}\nencrypted_size_bytes=${data.length}\npostgres_image=postgres:18-alpine\nretention_days=14\n`;
const sums = `${sha256}  database.dump.age\n`;

function fakeTransport({ downloadData = data, fail = false } = {}) {
  let downloads = 0;
  return {
    get downloads() { return downloads; },
    async text(command) {
      assert(command.startsWith('sudo -n '));
      if (command.includes(' find ')) return name + '\n';
      if (command.endsWith('/manifest.txt')) return manifest;
      if (command.endsWith('/SHA256SUMS')) return sums;
      throw new Error('Unexpected remote command');
    },
    async download(command, file, expectedSize) {
      assert(command.endsWith('/database.dump.age')); assert.equal(expectedSize, data.length);
      downloads++; await fs.writeFile(file, downloadData, { flag: 'wx' });
      if (fail) throw new Error('Connection interrupted');
    },
  };
}

async function temporary(t) {
  await fs.mkdir(DEFAULT_DESTINATION, { recursive: true });
  const destination = await fs.mkdtemp(path.join(DEFAULT_DESTINATION, 'test-'));
  t.after(async () => {
    const relative = path.relative(DEFAULT_DESTINATION, destination);
    assert(/^test-[a-z0-9]+$/i.test(relative));
    await fs.rm(destination, { recursive: true, force: true });
  });
  return { host: 'ubuntu@149.130.191.53', identity: path.join(__dirname, 'not-read.key'), destination, maxAgeHours: 36, plan: false };
}

test('Selects the newest atomic backup and rejects stale, future and invalid names', () => {
  assert.equal(latestBackup(`mateos-pet-ai-20261008T081533Z\n${name}\n`, now), name);
  for (const list of ['', '../secrets', 'mateos-pet-ai-20260230T081741Z', 'mateos-pet-ai-20261001T081741Z', 'mateos-pet-ai-20261010T081741Z']) assert.throws(() => latestBackup(list, now));
  assert.equal(backupTime(name), Date.parse('2026-10-09T08:17:41Z'));
});

test('Manifest must identify the exact encrypted file, date, size and checksum', () => {
  assert.deepEqual(metadata(manifest, sums, name), { sha256, size: data.length });
  for (const changed of [manifest.replace('encryption=age', 'encryption=none'), manifest.replace(sha256, '0'.repeat(64)), manifest.replace('database.dump.age', '../database.dump'), manifest.replace('081741Z', '081740Z'), manifest + 'encryption=age\n', manifest.replace(`encrypted_size_bytes=${data.length}`, 'encrypted_size_bytes=0')]) assert.throws(() => metadata(changed, sums, name));
  assert.throws(() => metadata(manifest, sums.replace('database.dump.age', '../database.dump.age'), name));
});

test('CLI rejects SSH argument injection and destinations outside the ignored directory', () => {
  const identity = path.join(__dirname, 'fixture.key');
  assert.equal(options(['--identity', identity, '--plan']).plan, true);
  for (const extra of [['--host', '-oProxyCommand=bad'], ['--host', 'ubuntu@host;command'], ['--destination', path.join(DEFAULT_DESTINATION, '..')], ['--max-age-hours', '0'], ['--unknown', 'value']]) assert.throws(() => options(['--identity', identity, ...extra]));
});

test('Plan reads metadata without creating local directories or downloading a dump', async () => {
  const transport = fakeTransport();
  const destination = path.join(DEFAULT_DESTINATION, 'plan-not-created');
  const result = await copyBackup({ destination, maxAgeHours: 36, plan: true }, transport, now);
  assert.equal(result.status, 'ready_to_copy'); assert.equal(transport.downloads, 0);
  await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
  await assert.rejects(copyBackup({ destination, maxAgeHours: 36, plan: true, backup: 'mateos-pet-ai-20261008T081533Z' }, transport, now), /not published/);
});

test('Publishes verified ciphertext and receipt; repeat validates without downloading again', async t => {
  const config = await temporary(t), transport = fakeTransport();
  const result = await copyBackup(config, transport, now);
  assert.equal(result.status, 'copied_and_verified');
  assert.deepEqual(await fs.readFile(path.join(result.destination, 'database.dump.age')), data);
  const receipt = JSON.parse(await fs.readFile(path.join(result.destination, 'copy-receipt.json'), 'utf8'));
  assert.equal(receipt.encrypted, true); assert.equal(receipt.sha256, sha256);
  assert.equal((await copyBackup(config, transport, now)).status, 'already_verified');
  assert.equal(transport.downloads, 1);
  assert.deepEqual((await fs.readdir(result.destination)).sort(), ['SHA256SUMS', 'copy-receipt.json', 'database.dump.age', 'manifest.txt'].sort());
});

test('Corruption and interrupted transfers never publish a backup and clean only staging', async t => {
  const config = await temporary(t);
  for (const transport of [fakeTransport({ downloadData: Buffer.from('corrupted') }), fakeTransport({ fail: true })]) {
    await assert.rejects(copyBackup(config, transport, now));
    assert.deepEqual(await fs.readdir(config.destination), []);
  }
});

test('A corrupted existing backup is preserved and reported, never replaced', async t => {
  const config = await temporary(t), transport = fakeTransport();
  const result = await copyBackup(config, transport, now);
  const file = path.join(result.destination, 'database.dump.age');
  await fs.writeFile(file, 'corrupted');
  await assert.rejects(copyBackup(config, transport, now), /integrity/);
  assert.equal(await fs.readFile(file, 'utf8'), 'corrupted'); assert.equal(transport.downloads, 1);
});
