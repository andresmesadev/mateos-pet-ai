const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

function resolveTenantId(req) {
  const { tenantId, isSuperAdmin } = req.tenant;
  return tenantId || (isSuperAdmin ? process.env.SINGLE_TENANT_ID : null) || null;
}

router.get("/tenant/profile", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, phone: true, email: true,
        description: true, address: true, logoUrl: true, businessHours: true,
        plan: true, active: true, createdAt: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (error) {
    console.error("[Dashboard] Tenant profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tenant/profile", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const { name, email, description, address, logoUrl, businessHours } = req.body ?? {};

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (email !== undefined) data.email = email?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl?.trim() || null;
    if (businessHours !== undefined) {
      if (typeof businessHours === "object" && businessHours !== null) {
        for (const [, val] of Object.entries(businessHours)) {
          if (val?.active && typeof val.open === "string" && typeof val.close === "string") {
            if (val.open >= val.close) {
              return res.status(400).json({ error: "La hora de apertura debe ser anterior a la hora de cierre" });
            }
          }
        }
      }
      data.businessHours = businessHours;
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true, name: true, slug: true, phone: true, email: true,
        description: true, address: true, logoUrl: true, businessHours: true,
        plan: true, active: true,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update tenant profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const where = tenantId ? { tenantId } : {};

    const [users, pets, appointments, conversations] = await Promise.all([
      prisma.user.count({ where }),
      prisma.pet.count({ where }),
      prisma.appointment.count({ where }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ users, pets, appointments, conversations });
  } catch (error) {
    console.error("[Dashboard] Stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
