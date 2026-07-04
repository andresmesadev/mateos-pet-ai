const { AutomationRuleNotFoundError } = require("../../domain/errors");

function createGetAutomationExecutionsUseCase({ automationRuleRepository, automationExecutionRepository }) {
  return async function execute({ automationRuleId }) {
    const rule = await automationRuleRepository.findById(automationRuleId);
    if (!rule) throw new AutomationRuleNotFoundError(automationRuleId);
    const executions = await automationExecutionRepository.listByRule(automationRuleId);
    return { executions };
  };
}
module.exports = { createGetAutomationExecutionsUseCase };
