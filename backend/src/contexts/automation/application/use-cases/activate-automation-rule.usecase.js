const { AutomationRuleNotFoundError } = require("../../domain/errors");

/**
 * ActivateAutomationRuleUseCase — Administración. Caso 2.
 * Idempotente por diseño (Etapa 1, decisión 2 del detalle de casos): activar
 * una Regla ya activa no es un error de negocio.
 */
function createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher }) {
  return async function execute({ automationRuleId }) {
    const rule = await automationRuleRepository.findById(automationRuleId);
    if (!rule) throw new AutomationRuleNotFoundError(automationRuleId);

    const activated = rule.active ? rule : await automationRuleRepository.activate(automationRuleId);
    await eventPublisher.publish("ReglaDeAutomatizacionActivada", { rule: activated });
    return { rule: activated };
  };
}
module.exports = { createActivateAutomationRuleUseCase };
