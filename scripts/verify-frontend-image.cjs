// Run inside the built frontend image with a read-only mount of this file.
// Uses only an internal loopback port and fake authentication values.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

assert.equal(process.platform, 'linux', 'Use the frontend Docker image');
assert(!fs.existsSync('/app/node_modules/typescript'), 'Development tools must be removed');
assert(!fs.existsSync('/app/node_modules/shadcn'), 'The component CLI is not a runtime dependency');
const server = spawn(process.execPath, ['/app/node_modules/next/dist/bin/next', 'start', '-p', '3001'], {
  cwd: '/app', env: { ...process.env, NEXTAUTH_SECRET: 'local-image-check-only', AUTH_SECRET: 'local-image-check-only',
    INTERNAL_API_SECRET: 'local-image-check-only', NEXTAUTH_URL: 'http://localhost:3001', AUTH_TRUST_HOST: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostics = '';
server.stdout.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-2000); });
server.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-2000); });
async function main() {
  try {
    let login;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { login = await fetch('http://127.0.0.1:3001/login', { signal: AbortSignal.timeout(2000) }); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 200)); }
    }
    assert(login, 'Next.js did not start: ' + diagnostics);
    assert.equal(login.status, 200);
    const html = await login.text();
    const styles = [...html.matchAll(/href="([^\"]+\.css(?:\?[^\"]*)?)"/g)].map(match => match[1]);
    assert(styles.length > 0, 'Login must include the built styles');
    for (const style of new Set(styles)) {
      const response = await fetch(new URL(style, 'http://127.0.0.1:3001'), { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200, style);
      assert((await response.text()).length > 1000, 'Empty stylesheet');
    }
    const protectedPage = await fetch('http://127.0.0.1:3001/dashboard/pos', { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    assert([302, 303, 307, 308].includes(protectedPage.status), 'Anonymous access must redirect');
    assert.equal(new URL(protectedPage.headers.get('location'), 'http://127.0.0.1:3001').pathname, '/login');
    console.log('PASS Linux production image: Next.js starts, login and CSS return 200, anonymous POS redirects to login, development tools absent');
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
