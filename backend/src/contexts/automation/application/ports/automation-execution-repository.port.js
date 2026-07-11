class AutomationExecutionRepositoryPort {
  async create(_data, _ctx) {
    throw new Error("AutomationExecutionRepositoryPort.create no implementado");
  }
  async listByRule(_automationRuleId) {
    throw new Error("AutomationExecutionRepositoryPort.listByRule no implementado");
  }
  /**
   * Entregable 5.1 — Outbox de Eventos de Dominio: soporta la idempotencia
   * del reintento (no re-ejecutar una Regla que ya tuvo éxito para este Evento).
   */
  async hasSuccessfulExecution(_automationRuleId, _domainEventId) {
    throw new Error("AutomationExecutionRepositoryPort.hasSuccessfulExecution no implementado");
  }
}
module.exports = { AutomationExecutionRepositoryPort };
