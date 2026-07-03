const { DomainError } = require("./domain-error");
const { InvalidEventTypeAttributesError } = require("./invalid-event-type-attributes.error");
const { DuplicateEventTypeNameError } = require("./duplicate-event-type-name.error");
const { EventTypeNotFoundError } = require("./event-type-not-found.error");
const { EventTypeAlreadyInactiveError } = require("./event-type-already-inactive.error");
const { EventTypeNotActiveError } = require("./event-type-not-active.error");
const { InvalidDomainEventAttributesError } = require("./invalid-domain-event-attributes.error");
const { DomainEventNotFoundError } = require("./domain-event-not-found.error");

module.exports = {
  DomainError,
  InvalidEventTypeAttributesError,
  DuplicateEventTypeNameError,
  EventTypeNotFoundError,
  EventTypeAlreadyInactiveError,
  EventTypeNotActiveError,
  InvalidDomainEventAttributesError,
  DomainEventNotFoundError,
};
