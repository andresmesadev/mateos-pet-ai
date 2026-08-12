const rateLimit = require("express-rate-limit");

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
const dashboardRateLimit = createLimiter(60);
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
  webhookRateLimit,
  publicRateLimit,
  publicApiRateLimit,
  clientAuthRequestCodeRateLimit,
  clientAuthVerifyCodeRateLimit,
};
