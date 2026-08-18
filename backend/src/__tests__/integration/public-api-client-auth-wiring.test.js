/**
 * Identidad de Cliente (Ecosistema, Portal del Cliente): verifica
 * POST /api/public/auth/request-code, /verify-code y /logout montados
 * exactamente como en app.js (apiKeyAuth protegiendo todo el router),
 * incluyendo el gate de ApiKey y el aislamiento por tenant end-to-end.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
  clientVerificationCode: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  clientSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));

jest.mock("../../contexts/services", () => ({ listAvailableServices: jest.fn() }));
jest.mock("../../contexts/staff", () => ({ resolveStaffAvailability: jest.fn() }));
jest.mock("../../contexts/communication", () => ({ sendMessage: jest.fn() }));

const prisma = require("../../lib/prisma");
const { sendMessage } = require("../../contexts/communication");
const { hashSecret } = require("../../lib/clientAuthCrypto");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const publicApiRoutes = require("../../routes/public-api.routes");
const logger = require("../../lib/logger");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public", apiKeyAuth, publicApiRoutes);
  return app;
}

const KEY_TENANT_A = { id: "key-1", tenantId: "tenant-a", scopes: [], revokedAt: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/public/auth/request-code", () => {
  test("rechaza sin API key con 401, sin buscar usuario", async () => {
    const res = await request(buildApp()).post("/api/public/auth/request-code").send({ phone: "3000000000" });
    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("con API key válida, responde genérico exista o no el usuario", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/public/auth/request-code")
      .set("Authorization", "Bearer valida")
      .send({ phone: "3000000000" });

    expect(res.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("resuelve el tenantId exclusivamente desde la ApiKey, nunca desde el body", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: "3000000000", tenantId: "tenant-a" });
    sendMessage.mockResolvedValue({});

    await request(buildApp())
      .post("/api/public/auth/request-code")
      .set("Authorization", "Bearer valida")
      .send({ phone: "3000000000", tenantId: "tenant-falsificado" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_phone: { tenantId: "tenant-a", phone: "3000000000" } },
    });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a" }));
  });

  test("400 sin phone", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/auth/request-code")
      .set("Authorization", "Bearer valida")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/public/auth/verify-code", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp())
      .post("/api/public/auth/verify-code")
      .send({ phone: "3000000000", code: "123456" });
    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("401 con código inválido", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/public/auth/verify-code")
      .set("Authorization", "Bearer valida")
      .send({ phone: "3000000000", code: "000000" });

    expect(res.status).toBe(401);
  });

  test("con código correcto, responde 200 con un token y crea la sesión con el tenantId de la ApiKey", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      codeHash: hashSecret("123456"),
      attempts: 0,
    });

    const res = await request(buildApp())
      .post("/api/public/auth/verify-code")
      .set("Authorization", "Bearer valida")
      .send({ phone: "3000000000", code: "123456", tenantId: "tenant-falsificado" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    const sessionArgs = prisma.clientSession.create.mock.calls[0][0].data;
    expect(sessionArgs.tenantId).toBe("tenant-a");
  });

  test("400 sin phone/code", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/auth/verify-code")
      .set("Authorization", "Bearer valida")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/public/auth/logout", () => {
  const SESSION = {
    id: "session-1",
    tenantId: "tenant-a",
    userId: "user-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 10000),
  };

  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).post("/api/public/auth/logout");
    expect(res.status).toBe(401);
    expect(prisma.clientSession.update).not.toHaveBeenCalled();
  });

  test("rechaza sin X-Client-Token con 401", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp()).post("/api/public/auth/logout").set("Authorization", "Bearer valida");
    expect(res.status).toBe(401);
    expect(prisma.clientSession.update).not.toHaveBeenCalled();
  });

  test("con sesión válida, revoca exclusivamente esa sesión (por su id)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION);
    prisma.clientSession.update.mockResolvedValue({ ...SESSION, revokedAt: new Date() });
    const loggerInfoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});

    const res = await request(buildApp())
      .post("/api/public/auth/logout")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(200);
    const calls = prisma.clientSession.update.mock.calls;
    const revokeCall = calls.find((call) => call[0].data?.revokedAt);
    expect(revokeCall[0]).toEqual({ where: { id: "session-1" }, data: { revokedAt: expect.any(Date) } });
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "[PublicApi] Sesión de cliente cerrada",
      { tenantId: "tenant-a", userId: "user-1", sessionId: "session-1" }
    );

    loggerInfoSpy.mockRestore();
  });

  test("una sesión ya revocada no puede volver a autenticar (logout no reutilizable)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue({ ...SESSION, revokedAt: new Date() });

    const res = await request(buildApp())
      .post("/api/public/auth/logout")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(401);
    expect(prisma.clientSession.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: expect.any(Date) } })
    );
  });
});
