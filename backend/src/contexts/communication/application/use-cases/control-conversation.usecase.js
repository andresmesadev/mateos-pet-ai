class ConversationControlError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function createControlConversationUseCase({ repository, runExclusive, eventPublisher = { publish: async () => {} } }) {
  return async function execute({ tenantId, conversationId, actor, action, expectedVersion, takeOver = false }) {
    if (!tenantId || !actor?.id || !actor.name || !["admin", "vet", "groomer", "receptionist"].includes(actor.role)) {
      throw new ConversationControlError(403, "No se pudo verificar tu identidad para atender el chat.");
    }
    if (!["take", "release"].includes(action) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new ConversationControlError(400, "Actualiza el chat antes de cambiar quién lo atiende.");
    }
    const anchor = await repository.findScoped(conversationId, tenantId);
    if (!anchor) throw new ConversationControlError(404, "Conversación no encontrada.");
    let eventType = null;
    const result = await runExclusive(anchor.user?.phone || `conversation:${anchor.userId}`, async () => {
      const current = await repository.findCanonical(anchor.userId, tenantId);
      if (!current) throw new ConversationControlError(404, "Conversación no encontrada.");
      if (current.id !== conversationId || current.controlVersion !== expectedVersion) {
        throw new ConversationControlError(409, "La atención cambió. Actualiza el chat y vuelve a intentarlo.");
      }
      const assignedToOther = current.assignedActorId && current.assignedActorId !== actor.id;
      if (assignedToOther && !(actor.role === "admin" && (action === "release" || takeOver === true))) {
        throw new ConversationControlError(409, `${current.assignedActorName || "Otro integrante"} está atendiendo esta conversación.`);
      }
      if (action === "take" && current.assignedActorId === actor.id) return current;
      if (action === "release" && !current.assignedActorId && current.status !== "esperando_humano") return current;
      const changed = await repository.changeControl(current, action === "take" ? actor : null);
      if (!changed) throw new ConversationControlError(409, "Otro integrante actualizó la atención. Recarga el chat.");
      if (action === "release" && current.status === "esperando_humano") {
        eventType = "EscalaciónDeConversaciónResuelta";
      } else if (action === "take" && current.status !== "esperando_humano") {
        eventType = "ConversaciónEscalada";
      }
      return changed;
    });
    if (eventType) await eventPublisher.publish(eventType, { conversation: result });
    return result;
  };
}

module.exports = { createControlConversationUseCase, ConversationControlError };
