const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { validSlug, registerTenantAdministrator } = require("../services/onboarding-registration.service");
const { provisionDefaultDigitalEmployees } = require("../services/tenant-provisioning.service");

const router = express.Router();
const registrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: "Se alcanzó el límite de registros. Espera unos minutos antes de volver a intentarlo." }),
});

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/verify/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!validSlug(slug)) return res.status(400).json({ error: "El identificador no es válido." });
  try {
    const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    return res.json({ available: !existing });
  } catch {
    return res.status(503).json({ error: "No pudimos comprobar el identificador. Vuelve a intentarlo." });
  }
});

router.post("/register", registrationLimit, async (req, res) => {
  try {
    const tenant = await registerTenantAdministrator(req.body);
    let provisioning = "ready";
    try {
      const result = await provisionDefaultDigitalEmployees(tenant.id);
      if (result.results.some(item => item.error)) provisioning = "pending";
    } catch {
      provisioning = "pending";
    }
    return res.status(201).json({ tenant: { name: tenant.name, slug: tenant.slug, plan: tenant.plan }, provisioning });
  } catch (error) {
    if (error.code === "P2002" || error.status === 409) {
      return res.status(409).json({ error: "No se pudo crear la cuenta con ese correo o identificador. Si ya tienes una cuenta, inicia sesión." });
    }
    if (error.status === 400) return res.status(400).json({ error: error.message, field: error.field });
    return res.status(503).json({ error: "No pudimos confirmar el registro. Intenta iniciar sesión con tu correo antes de volver a registrarte." });
  }
});

module.exports = router;
