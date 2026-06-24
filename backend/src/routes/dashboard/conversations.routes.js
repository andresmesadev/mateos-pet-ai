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
const { sendWhatsAppMessage } = require("../../services/whatsapp-api.service");

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

router.post("/conversations/:id/send", async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body ?? {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "El mensaje no puede estar vacío" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { user: { select: { phone: true } } },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }

    const phone = conversation.user?.phone;
    if (!phone) {
      return res.status(400).json({ error: "El cliente no tiene teléfono registrado" });
    }

    const sent = await sendWhatsAppMessage(phone, String(message).trim());
    if (!sent) {
      return res.status(502).json({ error: "No se pudo enviar el mensaje por WhatsApp. Verifica las credenciales." });
    }

    const saved = await prisma.message.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: String(message).trim(),
      },
    });

    res.json({ ok: true, message: saved });
  } catch (error) {
    console.error("[Dashboard] Send message error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bandeja de oportunidades ──────────────────────────────────────────────────
// Usa MedicalRecord.nextControlAt como fuente de recordatorios pendientes.
router.get("/opportunities", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const now = new Date();
    // Ventana: vencidos en los últimos 180 días + próximos 60 días
    const windowStart = new Date(now.getTime() - 180 * 86_400_000);
    const windowEnd = new Date(now.getTime() + 60 * 86_400_000);

    const tenantWhere = tenantId
      ? { pet: { owner: { tenantId } } }
      : {};

    const recordWhere = {
      ...tenantWhere,
      nextControlAt: { gte: windowStart, lte: windowEnd },
    };

    const [total, records] = await Promise.all([
      prisma.medicalRecord.count({ where: recordWhere }),
      prisma.medicalRecord.findMany({
        where: recordWhere,
        orderBy: { nextControlAt: "asc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          nextControlAt: true,
          reminderSent: true,
          pet: {
            select: {
              id: true,
              name: true,
              type: true,
              owner: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
    ]);

    const byType = {};
    for (const r of records) {
      const entry = {
        actionId: r.id,
        petId: r.pet.id,
        petName: r.pet.name,
        petType: r.pet.type,
        ownerId: r.pet.owner?.id ?? null,
        ownerName: r.pet.owner?.name ?? null,
        ownerPhone: r.pet.owner?.phone ?? null,
        dueAt: r.nextControlAt,
        notes: r.title,
        isOverdue: r.nextControlAt < now,
      };
      const key = r.type || "other";
      if (!byType[key]) byType[key] = [];
      byType[key].push(entry);
    }

    res.json({ byType, total });
  } catch (error) {
    console.error("[Dashboard] Opportunities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
