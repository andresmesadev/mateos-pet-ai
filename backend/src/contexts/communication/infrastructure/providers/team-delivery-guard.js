const { ConversationControlError } = require("../../application/use-cases/control-conversation.usecase");

function createTeamDeliveryGuard({ repository, runExclusive }) {
  return (input, deliver) => runExclusive(input.phone, async () => {
    const current = await repository.findCanonical(input.userId, input.tenantId);
    if (input.author) {
      if (!input.author.id || !input.author.name || !["admin", "vet", "groomer", "receptionist"].includes(input.author.role) ||
          !current || current.id !== input.conversationId || current.assignedActorId !== input.author.id ||
          current.controlVersion !== input.expectedVersion || current.status !== "esperando_humano") {
        throw new ConversationControlError(409, "La conversación cambió de responsable. Actualiza el chat; tu borrador se conserva.");
      }
    } else if (input.origin === "agente" && (current?.assignedActorId ||
      (current?.controlChangedAt && !input.preparedAt) ||
      (input.preparedAt && (Number.isNaN(new Date(input.preparedAt).getTime()) ||
        (current?.controlChangedAt && new Date(input.preparedAt) <= current.controlChangedAt))))) {
      // Una respuesta preparada antes de la toma/devolución no se entrega.
      // El worker puede cerrar ese checkpoint sin reintentar el mensaje obsoleto.
      return { message: null, skipped: true };
    }
    return deliver();
  });
}
module.exports = { createTeamDeliveryGuard };
