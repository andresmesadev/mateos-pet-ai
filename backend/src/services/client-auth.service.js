/**
 * Identidad de Cliente (Ecosistema, Portal del Cliente). Segunda capa de
 * identidad, separada de ApiKey (nivel tenant/app) y de la sesión de staff
 * (NextAuth). El tenantId de toda esta capa proviene exclusivamente del
 * ApiKey ya resuelto por apiKeyAuth — nunca de body/params/query.
 *
 * Entrega del código exclusivamente vía WhatsApp, reutilizando
 * send-message.usecase.js (Comunicación, 3.1) sin ningún cambio — mismo
 * mecanismo ya usado por recordatorios para enviar fuera de una
 * conversación activa.
 */
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const { hashSecret, generateVerificationCode, generateSessionToken } = require("../lib/clientAuthCrypto");
const { sendMessage } = require("../contexts/communication");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/**
 * Siempre responde con éxito genérico, exista o no el usuario — evita que
 * el endpoint sirva para enumerar teléfonos registrados en un tenant.
 */
async function requestVerificationCode({ tenantId, phone }) {
  const trimmedPhone = String(phone || "").trim();
  if (!trimmedPhone) {
    return { ok: false, badRequest: true };
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_phone: { tenantId, phone: trimmedPhone } },
  });

  if (!user) {
    logger.info("[ClientAuth] request-code: teléfono sin usuario registrado, respuesta genérica emitida", { tenantId });
    return { ok: true };
  }

  const code = generateVerificationCode();
  await prisma.clientVerificationCode.create({
    data: {
      tenantId,
      userId: user.id,
      codeHash: hashSecret(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  try {
    await sendMessage({
      tenantId,
      userId: user.id,
      phone: user.phone,
      content: `Tu código de verificación es ${code}. Vence en 10 minutos.`,
      origin: "sistema",
    });
  } catch (error) {
    logger.error("[ClientAuth] request-code: fallo al enviar el código por WhatsApp", { tenantId, error: error.message });
    // No se revela al llamador si el envío falló — mismo criterio anti-enumeración.
  }

  return { ok: true };
}

async function verifyCodeAndCreateSession({ tenantId, phone, code }) {
  const trimmedPhone = String(phone || "").trim();
  const trimmedCode = String(code || "").trim();
  if (!trimmedPhone || !trimmedCode) {
    return { ok: false, badRequest: true };
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_phone: { tenantId, phone: trimmedPhone } },
  });
  if (!user) {
    return { ok: false, invalid: true };
  }

  const pending = await prisma.clientVerificationCode.findFirst({
    where: { tenantId, userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) {
    return { ok: false, invalid: true };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, invalid: true };
  }

  if (pending.codeHash !== hashSecret(trimmedCode)) {
    await prisma.clientVerificationCode.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, invalid: true };
  }

  await prisma.clientVerificationCode.update({
    where: { id: pending.id },
    data: { consumedAt: new Date() },
  });

  const token = generateSessionToken();
  await prisma.clientSession.create({
    data: {
      tenantId,
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return { ok: true, token };
}

module.exports = { requestVerificationCode, verifyCodeAndCreateSession };
