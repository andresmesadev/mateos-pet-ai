const { DomainError } = require("./domain-error");

class InvalidAutomationTemplateAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}
class AutomationTemplateNotFoundError extends DomainError {
  constructor(id) {
    super(`La Plantilla de Automatización "${id}" no existe.`);
  }
}

module.exports = { InvalidAutomationTemplateAttributesError, AutomationTemplateNotFoundError };
