const { resolveTenant } = require("../../middleware/resolveTenant");

function makeReq(headers = {}) {
  return { headers };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

describe("resolveTenant middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.SINGLE_TENANT_ID;
    delete process.env.INTERNAL_API_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("1. NODE_ENV=test, no secret → allow, read headers directly (super admin)", () => {
    const req = makeReq({ "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: null });
  });

  test("2. Secret set, wrong token → 401", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "correct-secret";
    const req = makeReq({ "x-internal-token": "wrong-token", "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  test("3. Correct token, X-Super-Admin=true, no X-Tenant-Id → { isSuperAdmin: true, tenantId: null }", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({ "x-internal-token": "mysecret", "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: null });
  });

  test("4. Correct token, X-Super-Admin=true, X-Tenant-Id=xxx → { isSuperAdmin: true, tenantId: 'xxx' }", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "true",
      "x-tenant-id": "xxx",
    });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: "xxx" });
  });

  test("5. Correct token, X-Super-Admin=false, X-Tenant-Id=xxx → { isSuperAdmin: false, tenantId: 'xxx' }", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
      "x-tenant-id": "xxx",
    });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: false, tenantId: "xxx" });
  });

  test("6. Correct token, X-Super-Admin=false, no X-Tenant-Id → 403", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
    });
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  test("7. SINGLE_TENANT_ID set → always { isSuperAdmin: false, tenantId: SINGLE_TENANT_ID }, no token needed", () => {
    process.env.SINGLE_TENANT_ID = "tenant-abc";
    const req = makeReq({}); // no token, no headers
    const res = makeRes();
    const next = jest.fn();

    resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: false, tenantId: "tenant-abc" });
  });
});
