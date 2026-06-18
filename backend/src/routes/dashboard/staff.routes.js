const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  createStaff,
  updateStaff,
  deleteStaff,
} = require("../../services/staff.service");

const VALID_ROLES = ["vet", "groomer", "admin"];

router.get("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const rows = await prisma.staff.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (error) {
    console.error("[Dashboard] Staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, role, phone, email } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name es requerido" });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    }

    const member = await createStaff(tenantId ?? null, {
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    });
    res.status(201).json(member);
  } catch (error) {
    console.error("[Dashboard] Create staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// IMPORTANT: GET /staff/available must be registered BEFORE PATCH /staff/:id and DELETE /staff/:id
router.get("/staff/available", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { date, time } = req.query;

    if (!date || !time) return res.status(400).json({ error: "date y time son requeridos" });

    const DOW_MAP = ["sun","mon","tue","wed","thu","fri","sat"];
    const dayKey = DOW_MAP[new Date(`${date}T12:00:00Z`).getUTCDay()];

    const allStaff = await prisma.staff.findMany({
      where: { ...(tenantId ? { tenantId } : {}), active: true },
      select: { id: true, name: true, role: true, availability: true },
    });

    const available = allStaff.filter((s) => {
      if (!s.availability) return true; // no restrictions = always available
      const day = s.availability[dayKey];
      if (!day || !day.active) return false;
      return time >= day.open && time < day.close;
    });

    res.json(available.map((s) => ({ id: s.id, name: s.name, role: s.role })));
  } catch (error) {
    console.error("[Dashboard] Staff available error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { name, role, phone, email, active, availability } = req.body ?? {};

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
      }
      data.role = role;
    }
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (active !== undefined) data.active = Boolean(active);
    if (availability !== undefined) data.availability = availability;

    const updated = await updateStaff(id, data);
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    await deleteStaff(id);
    res.status(204).end();
  } catch (error) {
    console.error("[Dashboard] Delete staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
