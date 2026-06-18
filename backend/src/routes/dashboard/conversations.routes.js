const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  getPendingEscalations,
  resolveEscalation,
} = require("../../services/escalation.service");
const {
  listConversations,
  getConversationMessages,
} = require("../../services/dashboard-conversation.service");

router.get("/escalations", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const escalations = await getPendingEscalations(tenantId);
    res.json(escalations);
  } catch (error) {
    console.error("[Dashboard] Escalations error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/escalations/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await resolveEscalation(id);

    if (!resolved) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    res.json(resolved);
  } catch (error) {
    console.error("[Dashboard] Resolve escalation error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const result = await listConversations({ ...req.query, tenantId: tenantId ?? undefined });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Conversations error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getConversationMessages(id);

    if (!result) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Conversation messages error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// ── Bandeja de oportunidades (TAREA 13) ──────────────────────────────────────
router.get("/opportunities", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const now = new Date();

    // 1. Pending next-actions with pet + owner
    // Cota de seguridad: ordenadas por vencimiento, las más urgentes primero.
    const actions = await prisma.petNextAction.findMany({
      where: { ...tenantFilter, status: "pending" },
      orderBy: { dueAt: "asc" },
      take: 500,
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            type: true,
            owner: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    // Group by type
    const byType = {};
    for (const a of actions) {
      const entry = {
        actionId: a.id,
        petId: a.pet.id,
        petName: a.pet.name,
        petType: a.pet.type,
        ownerId: a.pet.owner?.id ?? null,
        ownerName: a.pet.owner?.name ?? null,
        ownerPhone: a.pet.owner?.phone ?? null,
        dueAt: a.dueAt,
        notes: a.notes,
        isOverdue: a.dueAt < now,
      };
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(entry);
    }

    // 2. Inactive clients (no appointment ≥ 60 days)
    const cutoff = new Date(Date.now() - 60 * 86_400_000);
    const inactiveUsers = await prisma.user.findMany({
      where: {
        ...tenantFilter,
        AND: [
          { appointments: { some: {} } },
          { appointments: { none: { date: { gte: cutoff } } } },
        ],
      },
      include: {
        pets: {
          select: { id: true, name: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        appointments: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const inactive = inactiveUsers.map((u) => {
      const lastDate = u.appointments[0]?.date ?? null;
      const daysSince = lastDate
        ? Math.floor((now - new Date(lastDate)) / 86_400_000)
        : null;
      return {
        ownerId: u.id,
        ownerName: u.name ?? null,
        ownerPhone: u.phone,
        pets: u.pets,
        lastAppointmentDate: lastDate,
        daysSince,
      };
    });

    res.json({ byType, inactive });
  } catch (error) {
    console.error("[Dashboard] Opportunities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
