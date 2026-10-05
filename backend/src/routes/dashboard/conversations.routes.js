const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { readFollowups } = require("../../services/dashboard-followup.service");
const {
  listConversations,
  getConversationMessages,
} = require("../../services/dashboard-conversation.service");
// Entregable 3.1 — Comunicación: escalation.service.js y whatsapp-api.service.js
// (llamada directa) quedan retirados de este archivo — casos de uso 3/5/8.
const { sendMessage, controlConversation, listEscalatedConversations } = require("../../contexts/communication");
const { ConversationControlError } = require("../../contexts/communication/application/use-cases/control-conversation.usecase");
const { getConversationContext } = require("../../services/dashboard-conversation-context.service");
function operator(req) {
  const actor = req.actor;
  return { id: actor?.staffId ? `staff:${actor.staffId}` : actor?.email ? `admin:${actor.email}` : null,
    name: actor?.name || "Administrador", role: actor?.type || "admin" };
}
function withViewer(detail, req) {
  const actor = operator(req);
  const mine = Boolean(detail.conversation.assignment?.actorId === actor.id);
  return { ...detail, viewer: { role: actor.role, isMine: mine,
    canRelease: mine || actor.role === "admin", canTakeOver: actor.role === "admin",
    canCreateAppointment: req.access ? req.access.capabilities.schedule : ["admin", "receptionist"].includes(actor.role) } };
}

// Mismo contrato externo que el legacy escalation.service.js — mapEscalation.
function mapEscalation(conversation) {
  const sessionData =
    conversation.sessionData && typeof conversation.sessionData === "object" && !Array.isArray(conversation.sessionData)
      ? conversation.sessionData
      : {};
  const lastMessage = conversation.messages?.[0] ?? null;

  return {
    id: conversation.id,
    userId: conversation.userId,
    phone: conversation.user?.phone ?? null,
    petName: sessionData.pet_name ?? null,
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conversation.updatedAt,
    updatedAt: conversation.updatedAt,
    requiresHumanAttention: conversation.status === "esperando_humano",
  };
}

router.get("/escalations", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { conversations } = await listEscalatedConversations({ tenantId });
    res.json(conversations.map(mapEscalation));
  } catch (error) {
    console.error("[Dashboard] Escalations error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Fix post-auditoría de seguridad (2026-09-07, hallazgos F5/F6/F8): las
// rutas de conversación por :id resolvían el registro solo por su id, sin
// comparar contra req.tenant.tenantId, permitiendo a un usuario de un
// tenant leer, responder o resolver escalamientos de otro. tenantId===null
// se deja pasar sin filtro (vista cross-tenant explícita de super admin,
// ya gateada en resolveTenant.js vía X-View-All-Tenants) — mismo criterio
// que el resto de las rutas de este archivo (ver /opportunities).
async function assertConversationBelongsToTenant(conversationId, tenantId) {
  if (!tenantId) return true;
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    select: { id: true },
  });
  return Boolean(conversation);
}

async function changeControl(req, res, action = req.body?.action) {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    if (!(await assertConversationBelongsToTenant(id, tenantId))) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await controlConversation({ tenantId, conversationId: id, actor: operator(req), action,
      expectedVersion: req.body?.expectedVersion, takeOver: req.body?.takeOver === true });
    const detail = await getConversationMessages(id);
    return res.json(withViewer(detail, req));
  } catch (error) {
    if (error instanceof ConversationControlError) return res.status(error.status).json({ error: error.message });
    console.error("[Dashboard] Resolve escalation error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
}
router.patch("/conversations/:id/control", (req, res) => changeControl(req, res));
router.patch("/escalations/:id/resolve", (req, res) => changeControl(req, res, "release"));

router.get("/conversations/:id/context", async (req, res) => {
  try {
    if (!req.tenant.tenantId) return res.status(400).json({ error: "Selecciona un establecimiento." });
    const context = await getConversationContext(req.params.id, req.tenant.tenantId, operator(req).role, req.access);
    return context ? res.json(context) : res.status(404).json({ error: "Cliente no disponible en este establecimiento." });
  } catch (error) {
    console.error("[Dashboard] Conversation context:", error.message);
    return res.status(500).json({ error: "No se pudo cargar el contexto de la conversación." });
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
    const { tenantId } = req.tenant;

    if (!(await assertConversationBelongsToTenant(id, tenantId))) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const result = await getConversationMessages(id);

    if (!result) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    res.json(withViewer(result, req));
  } catch (error) {
    console.error("[Dashboard] Conversation messages error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/conversations/:id/send", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { id } = req.params;
    const { message } = req.body ?? {};

    if (typeof message !== "string" || !message.trim() || message.length > 4096) {
      return res.status(400).json({ error: "El mensaje no puede estar vacío" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { user: { select: { phone: true } } },
    });

    if (!conversation || (tenantId && conversation.tenantId !== tenantId)) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }

    const phone = conversation.user?.phone;
    if (!phone) {
      return res.status(400).json({ error: "El cliente no tiene teléfono registrado" });
    }

    let result;
    try {
      result = await sendMessage({
        tenantId: tenantId ?? conversation.tenantId ?? null,
        userId: conversation.userId,
        conversationId: conversation.id,
        phone,
        content: String(message).trim(),
        origin: "agente",
        author: operator(req),
        expectedVersion: req.body?.expectedVersion,
      });
    } catch (error) {
      if (error instanceof ConversationControlError) return res.status(error.status).json({ error: error.message });
      console.error("[Dashboard] Send message error:", error.message);
      return res.status(502).json({ error: "No se pudo enviar el mensaje por WhatsApp. Verifica las credenciales." });
    }

    res.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("[Dashboard] Send message error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bandeja de oportunidades ──────────────────────────────────────────────────
// Read the expediente actions and non-duplicated legacy follow-ups.
router.get("/opportunities", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    res.json(await readFollowups(tenantId, req.access.activeModules, req.query));
  } catch (error) {
    console.error("[Dashboard] Opportunities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
