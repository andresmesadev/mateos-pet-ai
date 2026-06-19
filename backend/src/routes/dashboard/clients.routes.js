const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const ERRORS = require("../../constants/errors");
const {
  listClients,
  getClientById,
  updateClient,
  listInactiveClients,
} = require("../../services/dashboard-client.service");
const { sendWhatsAppMessage } = require("../../services/whatsapp-api.service");
const { sendNextActionReminders } = require("../../services/next-action.service");

router.get("/clients", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { search, limit } = req.query;

    // Quick search mode for POS autocomplete
    if (search && typeof search === "string" && search.trim().length >= 2) {
      const tenantFilter = tenantId ? { tenantId } : {};
      const term = search.trim();
      const take = Math.min(parseInt(limit) || 8, 20);
      const users = await prisma.user.findMany({
        where: {
          ...tenantFilter,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: term } },
          ],
        },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          pets: { select: { id: true, name: true, type: true }, orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      return res.json(users.map((u) => ({
        id: u.id, name: u.name, phone: u.phone, pets: u.pets,
      })));
    }

    const clients = await listClients(tenantId);
    res.json({ data: clients, total: clients.length });
  } catch (error) {
    console.error("[Dashboard] Clients error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// Crear cliente manualmente desde el dashboard.
router.post("/clients", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, phone, email, address, notes } = req.body ?? {};

    const cleanPhone = typeof phone === "string" ? phone.replace(/\s+/g, "").trim() : "";
    if (!cleanPhone) {
      return res.status(400).json({ error: "El teléfono es requerido" });
    }

    const created = await prisma.user.create({
      data: {
        phone: cleanPhone,
        tenantId: tenantId ?? null,
        name: name?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
      select: { id: true, name: true, phone: true },
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un cliente con ese teléfono" });
    }
    console.error("[Dashboard] Create client error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// Crear propietario + mascotas en una transacción atómica.
// Debe estar antes de /:id para que Express no lo capture como parámetro.
router.post("/clients/with-pets", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, phone, address, notes, pets } = req.body ?? {};

    const cleanPhone = typeof phone === "string" ? phone.replace(/\s+/g, "").trim() : "";
    const cleanName = typeof name === "string" ? name.trim() : "";

    if (!cleanName) return res.status(400).json({ error: ERRORS.REQUIRED("El nombre del propietario") });
    if (!cleanPhone) return res.status(400).json({ error: ERRORS.REQUIRED("El teléfono") });

    const VALID_PET_TYPES = ["dog", "cat", "other"];
    const petsArr = Array.isArray(pets) ? pets : [];

    for (let i = 0; i < petsArr.length; i++) {
      const p = petsArr[i];
      if (!p.name?.trim()) {
        return res.status(400).json({ error: `Mascota ${i + 1}: el nombre es requerido` });
      }
      if (!VALID_PET_TYPES.includes(p.type?.toLowerCase())) {
        return res.status(400).json({ error: `Mascota ${i + 1}: tipo inválido` });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          phone: cleanPhone,
          tenantId: tenantId ?? null,
          name: cleanName || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
        },
        select: { id: true, name: true, phone: true },
      });

      const createdPets = await Promise.all(
        petsArr.map((p) =>
          tx.pet.create({
            data: {
              name: p.name.trim(),
              type: p.type.toLowerCase(),
              breed: p.breed?.trim() || null,
              gender: p.gender?.trim() || null,
              weight: p.weight != null ? Number(p.weight) : null,
              notes: p.notes?.trim() || null,
              tenantId: tenantId ?? null,
              ownerId: owner.id,
            },
            select: { id: true, name: true, type: true },
          })
        )
      );

      return { owner, pets: createdPets };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un cliente con ese teléfono" });
    }
    console.error("[Dashboard] Create client+pets error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.get("/clients/inactive", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listInactiveClients(tenantId);
    res.json(clients);
  } catch (error) {
    console.error("[Dashboard] Inactive clients error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const client = await getClientById(id, tenantId);

    if (!client) {
      return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });
    }

    res.json(client);
  } catch (error) {
    console.error("[Dashboard] Client detail error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const existing = await prisma.user.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });

    const { name, email, address, notes } = req.body ?? {};
    const updated = await updateClient(id, { name, email, address, notes });
    res.json({ id: updated.id, name: updated.name, email: updated.email, address: updated.address, notes: updated.notes });
  } catch (error) {
    console.error("[Dashboard] Update client error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });
    }
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.post("/campaigns/reactivation", async (req, res) => {
  try {
    const { clientIds, message } = req.body ?? {};

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: "clientIds es requerido" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message es requerido" });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, phone: true, name: true },
    });

    let sent = 0;
    let failed = 0;

    const now = new Date();
    for (const user of users) {
      const text = message.replace(/\{nombre\}/g, user.name ?? "cliente");
      const result = await sendWhatsAppMessage(user.phone, text);
      if (result) {
        sent++;
        await prisma.user.update({ where: { id: user.id }, data: { lastReminderSentAt: now } });
      } else {
        failed++;
      }
    }

    res.json({ sent, failed, total: users.length });
  } catch (error) {
    console.error("[Dashboard] Reactivation campaign error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// ── Automatizaciones — envío masivo por tipo de acción (TAREA 14) ────────────
router.post("/campaigns/next-actions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { type } = req.body ?? {};
    if (!type) return res.status(400).json({ error: "type es requerido" });
    const result = await sendNextActionReminders({ tenantId, type });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Next-action campaign error:", error.message);
    if (error.message.includes("inválido")) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

module.exports = router;
