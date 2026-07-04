const { DomainError } = require("./domain-error");
const { InvalidChannelAttributesError } = require("./invalid-channel-attributes.error");
const { DuplicateChannelError } = require("./duplicate-channel.error");
const { ChannelNotFoundError } = require("./channel-not-found.error");
const { ChannelAlreadyInactiveError } = require("./channel-already-inactive.error");
const { NoActiveChannelError } = require("./no-active-channel.error");
const { InvalidMessageAttributesError } = require("./invalid-message-attributes.error");
const { MessageDeliveryFailedError } = require("./message-delivery-failed.error");
const { ConversationNotFoundError } = require("./conversation-not-found.error");
const {
  ConversationAlreadyEscalatedError,
  ConversationNotEscalatedError,
} = require("./conversation-status.errors");

module.exports = {
  DomainError,
  InvalidChannelAttributesError,
  DuplicateChannelError,
  ChannelNotFoundError,
  ChannelAlreadyInactiveError,
  NoActiveChannelError,
  InvalidMessageAttributesError,
  MessageDeliveryFailedError,
  ConversationNotFoundError,
  ConversationAlreadyEscalatedError,
  ConversationNotEscalatedError,
};
