const { requireScope } = require("../../middleware/requireScope");

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

describe("requireScope middleware", () => {
  test("rechaza con 403 si req.apiKey no tiene el scope requerido", () => {
    const req = { apiKey: { tenantId: "t1", scopes: ["read:services"] } };
    const res = makeRes();
    const next = jest.fn();
    requireScope("read:availability")(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("rechaza con 403 si req.apiKey no existe", () => {
    const req = {};
    const res = makeRes();
    const next = jest.fn();
    requireScope("read:services")(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("permite continuar si el scope está presente", () => {
    const req = { apiKey: { tenantId: "t1", scopes: ["read:services", "read:availability"] } };
    const res = makeRes();
    const next = jest.fn();
    requireScope("read:availability")(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
