const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  listTenants,
  getTenantById,
  createTenant,
} = require("../../services/tenant.service");

// ── Tenant profile (self) — TAREA 18 ─────────────────────────────────────────
router.get("/tenant/profile", async (req, res) => {
  try {
    const { tenantId, isSuperAdmin } = req.tenant;
    if (!tenantId && !isSuperAdmin) return res.status(403).json({ error: "Forbidden" });
    if (!tenantId) return res.status(400).json({ error: "No tenant context" });

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
    const { tenantId } = req.tenant;
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const { name, email, description, address, logoUrl, businessHours } = req.body ?? {};

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (email !== undefined) data.email = email?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl?.trim() || null;
    if (businessHours !== undefined) data.businessHours = businessHours;

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

router.get("/tenants", async (req, res) => {
  try {
    const tenants = await listTenants();
    res.json(tenants);
  } catch (error) {
    console.error("[Dashboard] Tenants error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tenants", async (req, res) => {
  try {
    const { name, slug, phone, email, plan } = req.body ?? {};

    if (!name || !slug || !phone) {
      return res.status(400).json({ error: "name, slug y phone son requeridos" });
    }

    const tenant = await createTenant(name, slug, phone);

    if (email !== undefined) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { email: email || null, plan: plan || "free" },
      });
    }

    const created = await getTenantById(tenant.id);
    res.status(201).json(created);
  } catch (error) {
    console.error("[Dashboard] Create tenant error:", error.message);

    if (error.message.includes("Unique constraint") || error.code === "P2002") {
      return res.status(409).json({ error: "El slug o teléfono ya existe" });
    }

    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            pets: true,
            appointments: true,
            conversations: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("[Dashboard] Tenant detail error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, plan, active } = req.body ?? {};

    const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (plan !== undefined) data.plan = String(plan).trim();
    if (active !== undefined) data.active = Boolean(active);

    const updated = await prisma.tenant.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update tenant error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const where = tenantId ? { tenantId } : {};

    const [
      users,
      pets,
      appointments,
      conversations,
    ] = await Promise.all([
      prisma.user.count({ where }),
      prisma.pet.count({ where }),
      prisma.appointment.count({ where }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      users,
      pets,
      appointments,
      conversations,
      ...(tenantId ? { tenantId } : {}),
    });
  } catch (error) {
    console.error("[Dashboard] Stats error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
