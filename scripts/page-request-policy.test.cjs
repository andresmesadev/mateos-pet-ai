const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const policyPath = path.join(__dirname, "../frontend/lib/page-request-policy.ts");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(policyPath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { rejectsPageAction } = context.exports;
for (const route of ["/", "/login", "/dashboard/conversations", "/print/receipt", "/unknown"]) {
  test(`POST page ${route} rejects malformed action in any body before parsing`, () => {
    assert(rejectsPageAction("POST", route, new Headers({ "content-type": "multipart/form-data; boundary=test" })));
    assert(rejectsPageAction("POST", route, new Headers({ "content-type": "application/x-www-form-urlencoded" })));
  });
}
test("action header on API cannot bypass the policy", () => {
  assert(rejectsPageAction("POST", "/api/auth/callback/credentials", new Headers({ "next-action": "x" })));
});
test("auth, business mutations, onboarding, assets and page navigation retain their normal routes", () => {
  for (const route of ["/api/auth/callback/credentials", "/api/auth/signout", "/api/proxy/dashboard/conversations/any/send", "/api/onboarding", "/_next/internal"]) {
    assert.equal(rejectsPageAction("POST", route, new Headers()), false);
  }
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(rejectsPageAction(method, "/dashboard", new Headers()), false);
});

test("actual proxy rejects before invoking authentication and covers page requests plus action headers", async () => {
  const calls = [];
  class ResponseStub { constructor(body, options) { this.body = body; Object.assign(this, options); } static next() { return { next: true }; } }
  const proxyContext = { exports: {}, require(id) {
    if (id === "./auth") return { auth: () => async () => { calls.push("auth"); return { auth: true }; } };
    if (id === "next/server") return { NextResponse: ResponseStub };
    if (id === "./lib/page-request-policy") return { rejectsPageAction };
    if (id === "./lib/billing-access") return require('./helpers/billing-access.cjs').loadBillingAccess(async () => { throw Error('Unexpected access validation'); });
    return {};
  } };
  const source = fs.readFileSync(path.join(__dirname, "../frontend/proxy.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, proxyContext);
  const proxy = proxyContext.exports.proxy;
  const request = (method, pathname, headers = new Headers()) => ({ method, headers, nextUrl: { pathname } });
  assert.equal((await proxy(request("POST", "/"), {})).status, 405);
  assert.equal((await proxy(request("POST", "/dashboard"), {})).status, 405);
  assert.equal(calls.length, 0);
  assert.equal((await proxy(request("GET", "/dashboard"), {})).auth, true);
  assert.equal(calls.length, 1);
  const { unstable_doesMiddlewareMatch } = require("../frontend/node_modules/next/experimental/testing/server");
  for (const url of ["/", "/login", "/dashboard", "/print/receipt", "/unknown"]) assert(unstable_doesMiddlewareMatch({ config: proxyContext.exports.config, nextConfig: {}, url }));
  assert.equal(unstable_doesMiddlewareMatch({ config: proxyContext.exports.config, nextConfig: {}, url: "/api/auth/signin" }), false);
  assert(unstable_doesMiddlewareMatch({ config: proxyContext.exports.config, nextConfig: {}, url: "/api/auth/signin", headers: { "next-action": "x" } }));
});
