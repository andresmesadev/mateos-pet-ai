const { DomainError } = require("./domain-error");

class DuplicateChannelError extends DomainError {
  constructor(type, tenantId) {
    super(
      tenantId
        ? `Ya existe un Canal de tipo "${type}" para este tenant.`
        : `Ya existe un Canal global de tipo "${type}".`
    );
  }
}

module.exports = { DuplicateChannelError };
