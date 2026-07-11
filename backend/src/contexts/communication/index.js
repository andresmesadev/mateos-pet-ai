/**
 * Composition root del contexto Comunicación. Ensambla las implementaciones
 * de infraestructura e inyecta los puertos en los casos de uso de aplicación.
 * Diseño congelado: docs/history/ENTREGABLE_3_1_GATE_REVIEW.md
 *
 * Entregable 5.2: depende de Eventos únicamente para certificar sus propios
 * eventos como Evento de Dominio real (events.registerDomainEvent, reutilizado
 * sin cambios).
 */
const { PrismaChannelRepository } = require("./infrastructure/persistence/prisma-channel.repository");
const { PrismaConversationRepository } = require("./infrastructure/persistence/prisma-conversation.repository");
const { PrismaMessageRepository } = require("./infrastructure/persistence/prisma-message.repository");
const { buildChannelProviderRegistry } = require("./infrastructure/providers/channel-provider-registry");
const { CommunicationDomainEventsPublisher } = require("./infrastructure/events/communication-domain-events.publisher");
const events = require("../events");

const {
  createRegisterChannelUseCase,
  createDeactivateChannelUseCase,
  createSendMessageUseCase,
  createEscalateConversationUseCase,
  createResolveConversationEscalationUseCase,
  createGetChannelsUseCase,
  createGetUserCommunicationHistoryUseCase,
  createListEscalatedConversationsUseCase,
} = require("./application/use-cases");

const channelRepository = new PrismaChannelRepository();
const conversationRepository = new PrismaConversationRepository();
const messageRepository = new PrismaMessageRepository();
const channelProvider = buildChannelProviderRegistry();
const eventPublisher = new CommunicationDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });

const registerChannel = createRegisterChannelUseCase({ channelRepository, eventPublisher });
const deactivateChannel = createDeactivateChannelUseCase({ channelRepository, eventPublisher });
const sendMessage = createSendMessageUseCase({
  channelRepository,
  conversationRepository,
  messageRepository,
  channelProvider,
  eventPublisher,
});
const escalateConversation = createEscalateConversationUseCase({ conversationRepository, eventPublisher });
const resolveConversationEscalation = createResolveConversationEscalationUseCase({ conversationRepository, eventPublisher });
const getChannels = createGetChannelsUseCase({ channelRepository });
const getUserCommunicationHistory = createGetUserCommunicationHistoryUseCase({ messageRepository });
const listEscalatedConversations = createListEscalatedConversationsUseCase({ conversationRepository });

module.exports = {
  registerChannel,
  deactivateChannel,
  sendMessage,
  escalateConversation,
  resolveConversationEscalation,
  getChannels,
  getUserCommunicationHistory,
  listEscalatedConversations,
};
