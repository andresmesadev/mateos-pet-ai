const { DomainError } = require("./domain-error");

const VALID_ACTION_TYPES = ["enviar_mensaje", "asignar_tarea_empleado"];

class InvalidAutomationRuleAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}
class AutomationRuleNotFoundError extends DomainError {
  constructor(id) {
    super(`La Regla de Automatización "${id}" no existe.`);
  }
}
class TriggerEventTypeNotFoundError extends DomainError {
  constructor(name) {
    super(`El Tipo de Evento "${name}" no existe o no está activo en el Catálogo — no puede usarse como disparador.`);
  }
}

module.exports = {
  VALID_ACTION_TYPES,
  InvalidAutomationRuleAttributesError,
  AutomationRuleNotFoundError,
  TriggerEventTypeNotFoundError,
};
