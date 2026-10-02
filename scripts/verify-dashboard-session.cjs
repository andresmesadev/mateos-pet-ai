// Public, read-only session gate check. No cookies or credentials are sent.
const assert = require("node:assert/strict");
const origin = process.argv[2] ?? "http://localhost:3001";
const url = new URL(origin);
assert(["localhost", "127.0.0.1", "app.nexoweb.co"].includes(url.hostname), "Unexpected target");
(async () => {
  for (const path of ["/dashboard", "/dashboard/settings", "/dashboard/pos", "/print/pets/session-guard-probe"]) {
    const target = new URL(path, origin);
    const response = await fetch(target, { redirect: "manual" });
    assert([302, 303, 307, 308].includes(response.status), `${path}: protected page must redirect, received ${response.status}`);
    const login = new URL(response.headers.get("location"), origin);
    assert.equal(login.pathname, "/login", `${path}: redirect must require sign-in`);
    assert.equal(new URL(login.searchParams.get("callbackUrl")).pathname, path);
    console.log(`PASS: ${path} without a session redirects to login (${response.status})`);
  }
  const login = await fetch(new URL("/login", origin), { redirect: "manual" });
  assert.equal(login.status, 200);
  console.log("PASS: public login remains available (200)");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
