const express = require("express");
const prisma = require("../lib/prisma");
const { createTenant } = require("../services/tenant.service");
const { createCheckoutSession } = require("../services/stripe.service");

const router = express.Router();

const PRICE_IDS = {
  basic: () => process.env.STRIPE_PRICE_ID_BASIC,
  pro: () => process.env.STRIPE_PRICE_ID_PRO,
};

const frontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");

/**
 * GET /api/onboarding/verify/:slug
 * Verifica si el slug está disponible.
 */
router.get("/verify/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();

  if (!slug) {
    return res.status(400).json({ error: "slug requerido" });
  }

  try {
    const existing = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    res.json({ available: !existing });
  } catch (error) {
    console.error("[Onboarding] verify error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/onboarding/register
 * Registra una veterinaria nueva.
 * Body: { name, slug, phone, email?, ownerName?, plan? }
 * Responde: { tenant, checkoutUrl? }
 */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      slug,
      phone,
      email,
      ownerName,
      plan = "free",
    } = req.body ?? {};

    if (!name || !slug || !phone) {
      return res
        .status(400)
        .json({ error: "name, slug y phone son requeridos" });
    }

    const tenant = await createTenant(name, slug, phone);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        email: email || null,
        plan,
        // ownerName no es un campo del schema; se puede extender en el futuro
      },
    });

    let checkoutUrl = null;

    if (plan !== "free") {
      const priceId = PRICE_IDS[plan]?.();

      if (priceId) {
        const base = frontendUrl();
        const session = await createCheckoutSession(
          tenant.id,
          priceId,
          `${base}/onboarding/success?tenant=${slug}`,
          `${base}/onboarding?step=3&slug=${slug}`
        ).catch((err) => {
          console.error("[Onboarding] Stripe checkout error:", err.message);
          return null;
        });

        if (session) checkoutUrl = session.url;
      }
    }

    const result = await prisma.tenant.findUnique({ where: { id: tenant.id } });

    res.status(201).json({ tenant: result, checkoutUrl });
  } catch (error) {
    console.error("[Onboarding] register error:", error.message);

    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "El slug o teléfono ya está registrado" });
    }

    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
