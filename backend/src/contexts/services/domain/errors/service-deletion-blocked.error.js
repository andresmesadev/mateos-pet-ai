const { DomainError } = require("./domain-error");

class ServiceDeletionBlockedError extends DomainError {
  constructor(message) { super("SERVICE_DELETION_BLOCKED", message); }
}
module.exports = { ServiceDeletionBlockedError };
