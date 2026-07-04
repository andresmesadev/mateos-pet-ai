function createGetAutomationRulesUseCase({ automationRuleRepository }) {
  return async function execute({ tenantId = null } = {}) {
    const rules = await automationRuleRepository.list(tenantId);
    return { rules };
  };
}
module.exports = { createGetAutomationRulesUseCase };
