function createGetAutomationTemplatesUseCase({ automationTemplateRepository }) {
  return async function execute() {
    const templates = await automationTemplateRepository.list();
    return { templates };
  };
}
module.exports = { createGetAutomationTemplatesUseCase };
