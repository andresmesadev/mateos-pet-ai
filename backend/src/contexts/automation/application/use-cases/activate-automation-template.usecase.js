const { AutomationTemplateNotFoundError } = require("../../domain/errors");

/**
 * ActivateAutomationTemplateUseCase (Activar Plantilla) — Administración. Caso 4.
 * Crea una Regla de Automatización propia del tenant a partir de la Plantilla
 * (Etapa 1, decisión de detalle): la Regla resultante es independiente desde
 * su creación — editarla no modifica ni depende de la Plantilla.
 */
function createActivateAutomationTemplateUseCase({ automationTemplateRepository, automationRuleRepository, eventPublisher }) {
  return async function execute({ tenantId = null, templateId, name = null }) {
    const template = await automationTemplateRepository.findById(templateId);
    if (!template) throw new AutomationTemplateNotFoundError(templateId);

    const rule = await automationRuleRepository.create({
      tenantId,
      name: name?.trim() || template.name,
      triggerEventTypeId: template.triggerEventTypeId,
      condition: template.defaultCondition,
      actionType: template.defaultActionType,
      actionConfig: template.defaultActionConfig,
      active: true,
      templateId: template.id,
    });
    await eventPublisher.publish("PlantillaDeAutomatizacionActivada", { rule, template });
    return { rule };
  };
}
module.exports = { createActivateAutomationTemplateUseCase };
