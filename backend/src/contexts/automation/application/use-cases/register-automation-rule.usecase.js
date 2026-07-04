const {
  VALID_ACTION_TYPES,
  InvalidAutomationRuleAttributesError,
  TriggerEventTypeNotFoundError,
} = require("../../domain/errors");

/**
 * RegisterAutomationRuleUseCase (Registrar Regla de Automatización) — Administración. Caso 1.
 */
function createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher }) {
  return async function execute({ tenantId = null, name, triggerEventTypeName, condition = null, actionType, actionConfig }) {
    if (!name || !name.trim()) {
      throw new InvalidAutomationRuleAttributesError("name es obligatorio.");
    }
    if (!VALID_ACTION_TYPES.includes(actionType)) {
      throw new InvalidAutomationRuleAttributesError(`actionType debe ser uno de: ${VALID_ACTION_TYPES.join(", ")}`);
    }
    if (!actionConfig || typeof actionConfig !== "object") {
      throw new InvalidAutomationRuleAttributesError("actionConfig es obligatorio y debe ser un objeto.");
    }
    if (condition != null && (typeof condition !== "object" || Array.isArray(condition))) {
      throw new InvalidAutomationRuleAttributesError("condition debe ser un objeto plano o null.");
    }

    const eventType = await eventTypeLookup.findActiveByName(triggerEventTypeName);
    if (!eventType) {
      throw new TriggerEventTypeNotFoundError(triggerEventTypeName);
    }

    const rule = await automationRuleRepository.create({
      tenantId,
      name: name.trim(),
      triggerEventTypeId: eventType.id,
      condition,
      actionType,
      actionConfig,
      active: true,
    });
    await eventPublisher.publish("ReglaDeAutomatizacionRegistrada", { rule });
    return { rule };
  };
}
module.exports = { createRegisterAutomationRuleUseCase };
