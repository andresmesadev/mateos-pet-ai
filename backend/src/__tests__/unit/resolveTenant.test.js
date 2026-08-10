jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn() },
}));

const prisma = require("../../lib/prisma");
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
    jest.clearAllMocks();
    // Entregable 4.4 — por defecto el tenant está activo, salvo que el test lo diga.
    prisma.tenant.findUnique.mockResolvedValue({ active: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("1. NODE_ENV=test, no secret, super admin sin tenantId ni X-View-All-Tenants → 403 (Entregable 6.6)", async () => {
    const req = makeReq({ "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  test("1b. NODE_ENV=test, super admin sin tenantId con X-View-All-Tenants=true → allow, viewAllTenants: true", async () => {
    const req = makeReq({ "x-super-admin": "true", "x-view-all-tenants": "true" });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: null, viewAllTenants: true });
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  test("2. Secret set, wrong token → 401", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "correct-secret";
    const req = makeReq({ "x-internal-token": "wrong-token", "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  test("3. Correct token, X-Super-Admin=true, no X-Tenant-Id, no X-View-All-Tenants → 403 (Entregable 6.6)", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({ "x-internal-token": "mysecret", "x-super-admin": "true" });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  test("3b. Correct token, X-Super-Admin=true, no X-Tenant-Id, X-View-All-Tenants=true → allow, viewAllTenants: true", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "true",
      "x-view-all-tenants": "true",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: null, viewAllTenants: true });
  });

  test("4. Correct token, X-Super-Admin=true, X-Tenant-Id=xxx → { isSuperAdmin: true, tenantId: 'xxx' }", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "true",
      "x-tenant-id": "xxx",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: true, tenantId: "xxx", viewAllTenants: false });
  });

  test("5. Correct token, X-Super-Admin=false, X-Tenant-Id=xxx → { isSuperAdmin: false, tenantId: 'xxx' }", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
      "x-tenant-id": "xxx",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: false, tenantId: "xxx", viewAllTenants: false });
  });

  test("6. Correct token, X-Super-Admin=false, no X-Tenant-Id → 403", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  test("7. SINGLE_TENANT_ID set → always { isSuperAdmin: false, tenantId: SINGLE_TENANT_ID }, no token needed", async () => {
    process.env.SINGLE_TENANT_ID = "tenant-abc";
    const req = makeReq({}); // no token, no headers
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual({ isSuperAdmin: false, tenantId: "tenant-abc", viewAllTenants: false });
  });

  // Entregable 4.4 — Facturación / Habilitación Comercial: Tenant.active como
  // única fuente de verdad de suspensión comercial, sin excepciones.

  test("8. Tenant.active === false → 402, no continúa", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    prisma.tenant.findUnique.mockResolvedValue({ active: false });
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
      "x-tenant-id": "suspended-tenant",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(402);
  });

  test("9. SuperAdmin impersonando un tenant suspendido también queda bloqueado (sin excepción)", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    prisma.tenant.findUnique.mockResolvedValue({ active: false });
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "true",
      "x-tenant-id": "suspended-tenant",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(402);
  });

  test("10. SINGLE_TENANT_ID con tenant suspendido → 402", async () => {
    process.env.SINGLE_TENANT_ID = "tenant-abc";
    prisma.tenant.findUnique.mockResolvedValue({ active: false });
    const req = makeReq({});
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(402);
  });

  test("11. Tenant.active === true → continúa normalmente", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_SECRET = "mysecret";
    prisma.tenant.findUnique.mockResolvedValue({ active: true });
    const req = makeReq({
      "x-internal-token": "mysecret",
      "x-super-admin": "false",
      "x-tenant-id": "active-tenant",
    });
    const res = makeRes();
    const next = jest.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
