const { AutomationRuleNotFoundError } = require("../../domain/errors");

/**
 * DeactivateAutomationRuleUseCase — Administración. Caso 2.
 * Idempotente por diseño (misma decisión que Activate).
 */
function createDeactivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher }) {
  return async function execute({ automationRuleId }) {
    const rule = await automationRuleRepository.findById(automationRuleId);
    if (!rule) throw new AutomationRuleNotFoundError(automationRuleId);

    const deactivated = !rule.active ? rule : await automationRuleRepository.deactivate(automationRuleId);
    await eventPublisher.publish("ReglaDeAutomatizacionDesactivada", { rule: deactivated });
    return { rule: deactivated };
  };
}
module.exports = { createDeactivateAutomationRuleUseCase };
