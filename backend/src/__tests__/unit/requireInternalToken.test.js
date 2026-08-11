/**
 * API pública, Fase 1 (Ecosistema) — cierre de la deuda A5 en
 * /api/billing/*: el proxy Next.js ya enviaba X-Internal-Token, pero el
 * backend nunca lo validaba. Este middleware replica exactamente el mismo
 * criterio ya usado por resolveTenant.js.
 */
const { requireInternalToken } = require("../../middleware/requireInternalToken");

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

describe("requireInternalToken middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "production", INTERNAL_API_SECRET: "s3cr3t" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("rechaza con 401 sin X-Internal-Token", () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    requireInternalToken(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si el token no coincide", () => {
    const req = makeReq({ "x-internal-token": "incorrecto" });
    const res = makeRes();
    const next = jest.fn();
    requireInternalToken(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("permite continuar con el token correcto", () => {
    const req = makeReq({ "x-internal-token": "s3cr3t" });
    const res = makeRes();
    const next = jest.fn();
    requireInternalToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._status).toBeNull();
  });

  test("en NODE_ENV=test no bloquea, incluso sin token", () => {
    process.env.NODE_ENV = "test";
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    requireInternalToken(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("sin INTERNAL_API_SECRET configurado, no bloquea (paridad con resolveTenant.js)", () => {
    delete process.env.INTERNAL_API_SECRET;
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    requireInternalToken(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
