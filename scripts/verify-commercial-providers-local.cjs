// Explicitly disposable PostgreSQL verifier; never accepts a database URL.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('../backend/node_modules/pg');
const root = path.resolve(__dirname, '..');
const marker = 'huella-final-provider-check-' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
let container;
function docker(args, env) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000, env: env || process.env });
  if (result.status !== 0) throw new Error('Disposable Docker operation failed: ' + args[0]);
  return result.stdout.trim();
}
async function main() {
  try {
    container = docker(['run', '--pull', 'never', '--rm', '-d', '--name', marker,
      '--label', 'huella.purpose=' + marker, '-e', 'POSTGRES_USER=provider_test', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=huella_provider_check',
      '-p', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql', 'pgvector/pgvector:0.8.6-pg18-bookworm'], { ...process.env, POSTGRES_PASSWORD: password });
    assert(/^[a-f0-9]{64}$/.test(container));
    const binding = JSON.parse(docker(['inspect', container]))[0].NetworkSettings.Ports['5432/tcp'][0];
    assert.equal(binding.HostIp, '127.0.0.1');
    assert(/^\d+$/.test(binding.HostPort) && Number(binding.HostPort) > 0);
    const target = new URL(`postgresql://provider_test@127.0.0.1:${binding.HostPort}/huella_provider_check`); target.password = password;
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      const db = new Client({ connectionString: target.href, connectionTimeoutMillis: 500 });
      try { await db.connect(); await db.query('CREATE EXTENSION IF NOT EXISTS vector'); ready = true; }
      catch { await delay(500); } finally { await db.end().catch(() => {}); }
    }
    assert(ready, 'Disposable database did not start');
    const env = { ...process.env, DATABASE_URL: target.href, COMMERCIAL_PROVIDER_TEST_PORT: binding.HostPort, COMMERCIAL_PROVIDER_TEST_RUN_ID: marker,
      NODE_ENV: 'test', LOG_LEVEL: 'error', OPENAI_API_KEY: 'synthetic-no-provider' };
    const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
    assert.equal(migrate.status, 0, 'Fresh temporary migrations failed');
    const result = spawnSync(process.execPath, ['--test', 'backend/tests/postgres/commercial-providers.test.cjs'], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 5e6 });
    const output = result.stdout + '\n' + result.stderr;
    console.log(JSON.stringify({ exit: result.status, summary: output.split(/\r?\n/).filter(line => /^ℹ |^# (tests|pass|fail|duration)|^✖ |^not ok/.test(line)), failures: result.status ? output.slice(-5000).replaceAll(password, '[synthetic password]') : [] }, null, 2));
    assert.equal(result.status, 0, 'Commercial provider regression failed');
  } finally {
    if (container) {
      const data = JSON.parse(docker(['inspect', container]))[0];
      assert.equal(data.Name, '/' + marker);
      assert.equal(data.Config.Labels['huella.purpose'], marker);
      assert.equal(data.HostConfig.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1');
      assert(/^\d+$/.test(data.NetworkSettings.Ports['5432/tcp'][0].HostPort));
      assert(Object.hasOwn(data.HostConfig.Tmpfs, '/var/lib/postgresql'));
      docker(['stop', '--time', '1', container]);
      assert.equal(docker(['ps', '-a', '--filter', 'name=^/' + marker + '$', '--format', '{{.ID}}']), '');
      console.log('PASS verified own disposable PostgreSQL container removed');
    }
  }
}
main().catch(error => { console.error(error.message.replaceAll(password, '[synthetic password]')); process.exitCode = 1; });
