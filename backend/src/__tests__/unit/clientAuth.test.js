jest.mock("../../lib/prisma", () => ({
  clientSession: { findUnique: jest.fn(), update: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const { clientAuth } = require("../../middleware/clientAuth");
const { hashSecret } = require("../../lib/clientAuthCrypto");

function makeReq(headers = {}) {
  return { headers, originalUrl: "/api/public/test" };
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("clientAuth middleware", () => {
  test("rechaza con 401 sin X-Client-Token", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    await clientAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si el token no existe", async () => {
    prisma.clientSession.findUnique.mockResolvedValue(null);
    const req = makeReq({ "x-client-token": "no-existe" });
    const res = makeRes();
    const next = jest.fn();
    await clientAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si la sesión está revocada", async () => {
    prisma.clientSession.findUnique.mockResolvedValue({
      id: "s1",
      tenantId: "t1",
      userId: "u1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    const req = makeReq({ "x-client-token": "revocado" });
    const res = makeRes();
    const next = jest.fn();
    await clientAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(prisma.clientSession.update).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si la sesión está expirada", async () => {
    prisma.clientSession.findUnique.mockResolvedValue({
      id: "s1",
      tenantId: "t1",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const req = makeReq({ "x-client-token": "expirado" });
    const res = makeRes();
    const next = jest.fn();
    await clientAuth(req, res, next);
    expect(res._status).toBe(401);
  });

  test("con una sesión válida, resuelve { tenantId, userId } exclusivamente desde la sesión y continúa", async () => {
    prisma.clientSession.findUnique.mockResolvedValue({
      id: "s1",
      tenantId: "tenant-a",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });
    const req = makeReq({ "x-client-token": "valido" });
    req.body = { tenantId: "tenant-falsificado", userId: "user-falsificado" };
    const res = makeRes();
    const next = jest.fn();

    await clientAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.clientAuth).toEqual({ tenantId: "tenant-a", userId: "user-1" });
  });

  test("busca la sesión por el hash del token, nunca por el valor en texto plano", async () => {
    prisma.clientSession.findUnique.mockResolvedValue(null);
    const req = makeReq({ "x-client-token": "mi-token-secreto" });
    const res = makeRes();
    const next = jest.fn();

    await clientAuth(req, res, next);

    const calledWith = prisma.clientSession.findUnique.mock.calls[0][0];
    expect(calledWith.where.tokenHash).toBe(hashSecret("mi-token-secreto"));
  });
});
