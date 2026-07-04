const { createRegisterAutomationRuleUseCase } = require("./register-automation-rule.usecase");
const { createActivateAutomationRuleUseCase } = require("./activate-automation-rule.usecase");
const { createDeactivateAutomationRuleUseCase } = require("./deactivate-automation-rule.usecase");
const { createRegisterAutomationTemplateUseCase } = require("./register-automation-template.usecase");
const { createActivateAutomationTemplateUseCase } = require("./activate-automation-template.usecase");
const { createGetAutomationRulesUseCase } = require("./get-automation-rules.usecase");
const { createGetAutomationTemplatesUseCase } = require("./get-automation-templates.usecase");
const { createGetAutomationExecutionsUseCase } = require("./get-automation-executions.usecase");
const { createEvaluateAndExecuteRulesMechanism } = require("./evaluate-and-execute-rules.mechanism");

module.exports = {
  createRegisterAutomationRuleUseCase,
  createActivateAutomationRuleUseCase,
  createDeactivateAutomationRuleUseCase,
  createRegisterAutomationTemplateUseCase,
  createActivateAutomationTemplateUseCase,
  createGetAutomationRulesUseCase,
  createGetAutomationTemplatesUseCase,
  createGetAutomationExecutionsUseCase,
  // Operación de infraestructura — no exponer vía HTTP (ver Etapa 3, sección 2/5).
  createEvaluateAndExecuteRulesMechanism,
};
