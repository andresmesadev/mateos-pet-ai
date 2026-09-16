const { createRegisterChannelUseCase } = require("./register-channel.usecase");
const { createDeactivateChannelUseCase } = require("./deactivate-channel.usecase");
const { createSendMessageUseCase } = require("./send-message.usecase");
const { createSendTemplateMessageUseCase } = require("./send-template-message.usecase");
const { createEscalateConversationUseCase } = require("./escalate-conversation.usecase");
const { createResolveConversationEscalationUseCase } = require("./resolve-conversation-escalation.usecase");
const { createGetChannelsUseCase } = require("./get-channels.usecase");
const { createGetUserCommunicationHistoryUseCase } = require("./get-user-communication-history.usecase");
const { createListEscalatedConversationsUseCase } = require("./list-escalated-conversations.usecase");

module.exports = {
  createRegisterChannelUseCase,
  createDeactivateChannelUseCase,
  createSendMessageUseCase,
  createSendTemplateMessageUseCase,
  createEscalateConversationUseCase,
  createResolveConversationEscalationUseCase,
  createGetChannelsUseCase,
  createGetUserCommunicationHistoryUseCase,
  createListEscalatedConversationsUseCase,
};
