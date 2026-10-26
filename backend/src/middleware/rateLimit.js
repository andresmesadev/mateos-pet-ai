const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const { createHash } = require("node:crypto");

const rateLimitMessage = "Demasiadas solicitudes, intenta más tarde";

const createLimiter = (max) =>
  rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).send(rateLimitMessage);
    },
  });

const testRateLimit = createLimiter(20);
const dashboardKey = (req) => {
  const actor = req.actor;
  const principal = typeof actor?.staffId === "string" && actor.staffId
    ? ["staff", actor.staffId] : typeof actor?.email === "string" && actor.email
      ? ["admin", actor.email.trim().toLowerCase()] : null;
  if (!req.tenant || !principal) return "ip:" + ipKeyGenerator(req.ip);
  const identity = "actor:" + createHash("sha256").update(JSON.stringify([
    req.tenant.tenantId ?? "central", ...principal,
  ])).digest("hex");
  // Permission probes run during navigation, prefetch and workspace refresh.
  // A busy cash/clinical screen must not consume their budget and resemble a
  // revoked session. Authentication precedes BOTH bounded actor buckets.
  const accessProbe = ["GET", "HEAD"].includes(req.method) && ["/access", "/access/"].includes(req.path);
  return identity + (accessProbe ? ":access" : ":operations");
};
const createDashboardRateLimits = () => ({
  // Choosing the ingress ceiling never grants access; resolveTenant still
  // authenticates token, establishment and staff session before the actor cap.
  dashboardProxyRateLimit: rateLimit({
    windowMs: 60 * 1000,
    limit: req => typeof process.env.INTERNAL_API_SECRET === "string" && process.env.INTERNAL_API_SECRET &&
      req.headers["x-internal-token"] === process.env.INTERNAL_API_SECRET ? 300 : 60,
    standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => res.status(429).send(rateLimitMessage),
  }),
  dashboardRateLimit: rateLimit({
    windowMs: 60 * 1000, limit: 60, keyGenerator: dashboardKey,
    standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => res.status(429).send(rateLimitMessage),
  }),
});
const { dashboardProxyRateLimit, dashboardRateLimit } = createDashboardRateLimits();
const webhookRateLimit = createLimiter(100);
// Superficies públicas sin autenticación (onboarding, billing) — hallazgo A5,
// auditoría v2.1.0: eran los únicos mounts sin ninguna protección.
const publicRateLimit = createLimiter(10);
// Catálogo de Recursos de la API pública v1 — consumidores autenticados por
// API key, ventana más amplia que publicRateLimit (que protege superficies
// sin identidad, como onboarding). No es todavía por key individual — límite
// global por IP, misma granularidad que el resto de limitadores del proyecto.
const publicApiRateLimit = createLimiter(30);

// Identidad de Cliente — request-code envía un mensaje real de WhatsApp por
// cada solicitud exitosa; límite deliberadamente más estricto (ventana de
// 15 min, no la ventana de 1 min del resto) para evitar floodear el
// WhatsApp de un número real o agotar el canal del tenant.
const clientAuthRequestCodeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).send(rateLimitMessage);
  },
});

// Revocación de Sesión y Gestión Mínima de ApiKey — verify-code solo tenía el
// límite global del router (30/min/IP). Segunda capa dedicada, misma ventana
// de 15 min que request-code pero más laxa (10 en vez de 5): la defensa
// principal contra fuerza bruta sigue siendo MAX_ATTEMPTS=5 por código en
// client-auth.service.js, no este límite.
const clientAuthVerifyCodeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).send(rateLimitMessage);
  },
});

module.exports = {
  testRateLimit,
  dashboardRateLimit,
  dashboardProxyRateLimit,
  createDashboardRateLimits,
  webhookRateLimit,
  publicRateLimit,
  publicApiRateLimit,
  clientAuthRequestCodeRateLimit,
  clientAuthVerifyCodeRateLimit,
};
