const {
  VALID_ACTION_TYPES,
  InvalidAutomationTemplateAttributesError,
  TriggerEventTypeNotFoundError,
} = require("../../domain/errors");

/**
 * RegisterAutomationTemplateUseCase — Administración. Caso 3.
 */
function createRegisterAutomationTemplateUseCase({ automationTemplateRepository, eventTypeLookup, eventPublisher }) {
  return async function execute({
    name,
    description = null,
    triggerEventTypeName,
    defaultCondition = null,
    defaultActionType,
    defaultActionConfig,
  }) {
    if (!name || !name.trim()) {
      throw new InvalidAutomationTemplateAttributesError("name es obligatorio.");
    }
    if (!VALID_ACTION_TYPES.includes(defaultActionType)) {
      throw new InvalidAutomationTemplateAttributesError(`defaultActionType debe ser uno de: ${VALID_ACTION_TYPES.join(", ")}`);
    }
    if (!defaultActionConfig || typeof defaultActionConfig !== "object") {
      throw new InvalidAutomationTemplateAttributesError("defaultActionConfig es obligatorio y debe ser un objeto.");
    }

    const eventType = await eventTypeLookup.findActiveByName(triggerEventTypeName);
    if (!eventType) {
      throw new TriggerEventTypeNotFoundError(triggerEventTypeName);
    }

    const template = await automationTemplateRepository.create({
      name: name.trim(),
      description,
      triggerEventTypeId: eventType.id,
      defaultCondition,
      defaultActionType,
      defaultActionConfig,
      active: true,
    });
    await eventPublisher.publish("PlantillaDeAutomatizacionRegistrada", { template });
    return { template };
  };
}
module.exports = { createRegisterAutomationTemplateUseCase };
