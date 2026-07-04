class AutomationRuleRepositoryPort {
  async create(_data) {
    throw new Error("AutomationRuleRepositoryPort.create no implementado");
  }
  async findById(_id) {
    throw new Error("AutomationRuleRepositoryPort.findById no implementado");
  }
  async activate(_id) {
    throw new Error("AutomationRuleRepositoryPort.activate no implementado");
  }
  async deactivate(_id) {
    throw new Error("AutomationRuleRepositoryPort.deactivate no implementado");
  }
  async list(_tenantId) {
    throw new Error("AutomationRuleRepositoryPort.list no implementado");
  }
  async listActiveByTrigger(_tenantId, _triggerEventTypeId, _ctx) {
    throw new Error("AutomationRuleRepositoryPort.listActiveByTrigger no implementado");
  }
}
module.exports = { AutomationRuleRepositoryPort };
