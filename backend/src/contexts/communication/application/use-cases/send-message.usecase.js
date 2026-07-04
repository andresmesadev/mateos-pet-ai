const {
  InvalidMessageAttributesError,
  NoActiveChannelError,
  MessageDeliveryFailedError,
  ConversationNotFoundError,
} = require("../../domain/errors");

/**
 * SendMessageUseCase (Enviar Mensaje) — Operación. Caso de uso 3 (Etapa 2).
 *
 * Regla transversal congelada: "Todo mensaje saliente del sistema deberá
 * invocar exclusivamente este caso de uso. Ningún adaptador, servicio, job o
 * productor podrá comunicarse directamente con un proveedor de canal."
 *
 * Contrato único para triggers de sistema (bot, recordatorios) y para un
 * operador humano (respuesta manual) — el actor es un dato de invocación
 * (origin), no una bifurcación de lógica.
 *
 * Todo-o-nada (Etapa 3): si el proveedor falla, no se persiste ningún Message.
 *
 * Precisión del contrato de entrada (incorporada durante la implementación,
 * sin reabrir ninguna decisión de diseño — ver Completion Report):
 * `conversationId` es opcional.
 *  - Si el productor ya conoce el hilo específico al que responde (p. ej.
 *    POST /conversations/:id/send), lo provee y el caso de uso usa
 *    exactamente esa conversación — preserva el contrato existente de ese
 *    endpoint, que responde a una conversación concreta, no a "la activa".
 *  - Si el productor no conoce un hilo específico (recordatorios,
 *    notificaciones, futuros productores automáticos), no lo provee y el
 *    caso de uso reutiliza el mecanismo ya aprobado de resolver la
 *    conversación activa a partir del userId (Etapa 4, pregunta 1).
 *

 * @param {Object} deps
 * @param {import("../ports/channel-repository.port").ChannelRepositoryPort} deps.channelRepository
 * @param {import("../ports/conversation-repository.port").ConversationRepositoryPort} deps.conversationRepository
 * @param {import("../ports/message-repository.port").MessageRepositoryPort} deps.messageRepository
 * @param {import("../ports/channel-provider.port").ChannelProviderPort} deps.channelProvider
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createSendMessageUseCase({
  channelRepository,
  conversationRepository,
  messageRepository,
  channelProvider,
  eventPublisher,
}) {
  return async function execute({ tenantId, userId, phone, content, origin, conversationId = null }) {
    if (!userId) {
      throw new InvalidMessageAttributesError("userId es obligatorio.");
    }
    if (!phone || !String(phone).trim()) {
      throw new InvalidMessageAttributesError("phone es obligatorio.");
    }
    if (!content || !String(content).trim()) {
      throw new InvalidMessageAttributesError("content no puede estar vacío.");
    }
    if (origin !== "agente" && origin !== "sistema") {
      throw new InvalidMessageAttributesError('origin debe ser "agente" o "sistema".');
    }

    const channel = await channelRepository.findActiveDefault(tenantId ?? null);
    if (!channel) {
      throw new NoActiveChannelError(tenantId ?? null);
    }

    let conversation;
    if (conversationId) {
      conversation = await conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
    } else {
      conversation = await conversationRepository.findOrCreateActiveForUser(userId, channel.id);
    }

    const delivered = await channelProvider.send(channel.type, phone, content);
    if (!delivered) {
      throw new MessageDeliveryFailedError(`proveedor del canal "${channel.type}" no confirmó el envío`);
    }

    const message = await messageRepository.create({
      conversationId: conversation.id,
      role: "assistant",
      origin,
      content,
    });

    await eventPublisher.publish("MensajeEnviado", { message, channel });

    return { message };
  };
}

module.exports = { createSendMessageUseCase };
