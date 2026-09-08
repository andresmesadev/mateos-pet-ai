const {
  InvalidMessageAttributesError,
  NoActiveChannelError,
  MessageDeliveryFailedError,
  ConversationNotFoundError,
} = require("../../domain/errors");

/**
 * SendTemplateMessageUseCase (Enviar Mensaje de Plantilla) — mejora post-Fase
 * 8 (2026-09-08). Calcado de SendMessageUseCase (Enviar Mensaje) — misma
 * regla transversal ("todo mensaje saliente pasa exclusivamente por un caso
 * de uso de este contexto, nunca directo a un proveedor de canal"), mismo
 * contrato todo-o-nada. Única diferencia real: invoca
 * `channelProvider.sendTemplate` (plantilla pre-aprobada de Meta) en vez de
 * `channelProvider.send` (texto libre) — necesario para iniciar contacto
 * fuera de la ventana de 24h de mensajería libre de WhatsApp, una
 * restricción de la plataforma, no de este código.
 *
 * `content` sigue siendo el texto renderizado (con las variables ya
 * sustituidas) — es lo que se persiste en `Message` y lo que ve el negocio
 * en el historial del dashboard; `templateName`/`languageCode`/`components`
 * son exclusivamente lo que se envía a la Cloud API.
 *
 * @param {Object} deps — mismas dependencias que SendMessageUseCase
 */
function createSendTemplateMessageUseCase({
  channelRepository,
  conversationRepository,
  messageRepository,
  channelProvider,
  eventPublisher,
}) {
  return async function execute({
    tenantId,
    userId,
    phone,
    content,
    origin,
    conversationId = null,
    templateName,
    languageCode,
    components = [],
  }) {
    if (!userId) {
      throw new InvalidMessageAttributesError("userId es obligatorio.");
    }
    if (!phone || !String(phone).trim()) {
      throw new InvalidMessageAttributesError("phone es obligatorio.");
    }
    if (!content || !String(content).trim()) {
      throw new InvalidMessageAttributesError("content no puede estar vacío.");
    }
    if (!templateName || !String(templateName).trim()) {
      throw new InvalidMessageAttributesError("templateName es obligatorio.");
    }
    if (!languageCode || !String(languageCode).trim()) {
      throw new InvalidMessageAttributesError("languageCode es obligatorio.");
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

    const delivered = await channelProvider.sendTemplate(channel.type, phone, templateName, languageCode, components);
    if (!delivered) {
      throw new MessageDeliveryFailedError(`proveedor del canal "${channel.type}" no confirmó el envío de la plantilla "${templateName}"`);
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

module.exports = { createSendTemplateMessageUseCase };
