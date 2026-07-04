class AutomationExecutionRepositoryPort {
  async create(_data, _ctx) {
    throw new Error("AutomationExecutionRepositoryPort.create no implementado");
  }
  async listByRule(_automationRuleId) {
    throw new Error("AutomationExecutionRepositoryPort.listByRule no implementado");
  }
}
module.exports = { AutomationExecutionRepositoryPort };
