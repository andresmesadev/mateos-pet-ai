/**
 * API pública, Fase 1 (Ecosistema) — middleware de autenticación por API
 * key. Verifica: resolución de tenantId exclusivamente desde la key
 * validada (nunca desde body/params), rechazo de keys inválidas/revocadas,
 * y que el hash nunca expone la key en texto plano.
 */
jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const { hashApiKey } = require("../../lib/apiKeyHash");

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

describe("apiKeyAuth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rechaza con 401 sin ninguna key (ni Authorization ni X-Api-Key)", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    await apiKeyAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si la key no existe", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    const req = makeReq({ authorization: "Bearer no-existe" });
    const res = makeRes();
    const next = jest.fn();
    await apiKeyAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rechaza con 401 si la key está revocada", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: "k1",
      tenantId: "tenant-a",
      scopes: [],
      revokedAt: new Date(),
    });
    const req = makeReq({ authorization: "Bearer revocada" });
    const res = makeRes();
    const next = jest.fn();
    await apiKeyAuth(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  test("con una key válida, resuelve tenantId exclusivamente desde la key y continúa", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: "k1",
      tenantId: "tenant-b",
      scopes: ["read:appointments"],
      revokedAt: null,
    });
    const req = makeReq({ authorization: "Bearer valida" });
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.apiKey).toEqual({ tenantId: "tenant-b", scopes: ["read:appointments"] });
  });

  test("el tenantId nunca proviene del body/params, solo de la key resuelta", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: "k1",
      tenantId: "tenant-real",
      scopes: [],
      revokedAt: null,
    });
    const req = makeReq({ authorization: "Bearer valida" });
    req.body = { tenantId: "tenant-falsificado" };
    req.params = { tenantId: "tenant-falsificado-2" };
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(req, res, next);

    expect(req.apiKey.tenantId).toBe("tenant-real");
    expect(req.apiKey.tenantId).not.toBe(req.body.tenantId);
    expect(req.apiKey.tenantId).not.toBe(req.params.tenantId);
  });

  test("actualiza lastUsedAt en cada autenticación exitosa", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: "k1",
      tenantId: "tenant-a",
      scopes: [],
      revokedAt: null,
    });
    const req = makeReq({ authorization: "Bearer valida" });
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(req, res, next);

    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "k1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  test("acepta la key vía X-Api-Key si no hay header Authorization", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: "k1",
      tenantId: "tenant-c",
      scopes: [],
      revokedAt: null,
    });
    const req = makeReq({ "x-api-key": "valida" });
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.apiKey.tenantId).toBe("tenant-c");
  });

  test("busca la key por su hash, nunca por el valor en texto plano", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    const rawKey = "clave-secreta-de-prueba";
    const req = makeReq({ authorization: `Bearer ${rawKey}` });
    const res = makeRes();
    const next = jest.fn();

    await apiKeyAuth(req, res, next);

    const calledWith = prisma.apiKey.findUnique.mock.calls[0][0];
    expect(calledWith.where.keyHash).toBe(hashApiKey(rawKey));
    expect(calledWith.where.keyHash).not.toBe(rawKey);
  });
});

describe("hashApiKey", () => {
  test("es determinístico y nunca devuelve la key original", () => {
    const raw = "mi-api-key-de-prueba";
    const hash1 = hashApiKey(raw);
    const hash2 = hashApiKey(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(raw);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  test("keys distintas producen hashes distintos", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});
