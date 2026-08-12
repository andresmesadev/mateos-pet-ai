/**
 * Identidad de Cliente (Ecosistema, Portal del Cliente): verifica
 * request-code (respuesta genérica, envío exclusivo por WhatsApp vía
 * sendMessage, aislamiento por tenant) y verify-code (consumo único,
 * límite de intentos, expiración, emisión de sesión hasheada).
 */
jest.mock("../../lib/prisma", () => ({
  user: { findUnique: jest.fn() },
  clientVerificationCode: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  clientSession: { create: jest.fn() },
}));

jest.mock("../../contexts/communication", () => ({
  sendMessage: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { sendMessage } = require("../../contexts/communication");
const { hashSecret } = require("../../lib/clientAuthCrypto");
const { requestVerificationCode, verifyCodeAndCreateSession } = require("../../services/client-auth.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requestVerificationCode", () => {
  test("400 si no se envía phone", async () => {
    const result = await requestVerificationCode({ tenantId: "t1", phone: "" });
    expect(result.badRequest).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("respuesta genérica ok:true aunque el usuario no exista, sin enviar mensaje", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await requestVerificationCode({ tenantId: "t1", phone: "3000000000" });
    expect(result.ok).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(prisma.clientVerificationCode.create).not.toHaveBeenCalled();
  });

  test("busca el usuario exclusivamente dentro del tenantId provisto (nunca cross-tenant)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await requestVerificationCode({ tenantId: "tenant-a", phone: "3000000000" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_phone: { tenantId: "tenant-a", phone: "3000000000" } },
    });
  });

  test("con usuario existente, crea el código hasheado y lo envía por WhatsApp vía sendMessage", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: "3000000000", tenantId: "tenant-a" });
    sendMessage.mockResolvedValue({ message: {} });

    const result = await requestVerificationCode({ tenantId: "tenant-a", phone: "3000000000" });

    expect(result.ok).toBe(true);
    expect(prisma.clientVerificationCode.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.clientVerificationCode.create.mock.calls[0][0].data;
    expect(createArgs.tenantId).toBe("tenant-a");
    expect(createArgs.userId).toBe("user-1");
    expect(createArgs.codeHash).toMatch(/^[a-f0-9]{64}$/);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a", userId: "user-1", phone: "3000000000", origin: "sistema" })
    );
  });

  test("si sendMessage falla, la respuesta sigue siendo genérica (no revela el fallo al llamador)", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: "3000000000", tenantId: "tenant-a" });
    sendMessage.mockRejectedValue(new Error("canal inactivo"));

    const result = await requestVerificationCode({ tenantId: "tenant-a", phone: "3000000000" });
    expect(result.ok).toBe(true);
  });
});

describe("verifyCodeAndCreateSession", () => {
  test("400 si falta phone o code", async () => {
    const result = await verifyCodeAndCreateSession({ tenantId: "t1", phone: "", code: "" });
    expect(result.badRequest).toBe(true);
  });

  test("inválido si el usuario no existe en ese tenant", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await verifyCodeAndCreateSession({ tenantId: "t1", phone: "3000000000", code: "123456" });
    expect(result.ok).toBe(false);
    expect(result.invalid).toBe(true);
  });

  test("inválido si no hay ningún código pendiente sin consumir y sin expirar", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue(null);
    const result = await verifyCodeAndCreateSession({ tenantId: "t1", phone: "3000000000", code: "123456" });
    expect(result.ok).toBe(false);
    expect(result.invalid).toBe(true);
  });

  test("inválido si ya se alcanzó el máximo de intentos", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      codeHash: hashSecret("123456"),
      attempts: 5,
    });
    const result = await verifyCodeAndCreateSession({ tenantId: "t1", phone: "3000000000", code: "123456" });
    expect(result.ok).toBe(false);
    expect(prisma.clientSession.create).not.toHaveBeenCalled();
  });

  test("código incorrecto incrementa attempts y responde inválido, sin crear sesión", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      codeHash: hashSecret("123456"),
      attempts: 0,
    });
    const result = await verifyCodeAndCreateSession({ tenantId: "t1", phone: "3000000000", code: "000000" });
    expect(result.ok).toBe(false);
    expect(prisma.clientVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.clientSession.create).not.toHaveBeenCalled();
  });

  test("código correcto marca el código consumido y emite una sesión con token hasheado", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.clientVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      codeHash: hashSecret("123456"),
      attempts: 0,
    });

    const result = await verifyCodeAndCreateSession({ tenantId: "tenant-a", phone: "3000000000", code: "123456" });

    expect(result.ok).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(prisma.clientVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: { consumedAt: expect.any(Date) },
    });

    const sessionArgs = prisma.clientSession.create.mock.calls[0][0].data;
    expect(sessionArgs.tenantId).toBe("tenant-a");
    expect(sessionArgs.userId).toBe("user-1");
    expect(sessionArgs.tokenHash).toBe(hashSecret(result.token));
    expect(sessionArgs.tokenHash).not.toBe(result.token);
  });
});
