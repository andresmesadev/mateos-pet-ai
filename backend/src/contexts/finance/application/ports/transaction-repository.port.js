/**
 * Puerto sobre Transaction (Fase 1, extendida — ADR 005). Finanzas solo
 * escribe filas con origin = "system_appointment_completed"; el flujo de
 * venta de mostrador ("manual_pos_sale") sigue siendo escrito por
 * transactions.routes.js, fuera de este contexto.
 */
class TransactionRepositoryPort {
  async createSystemCharge(_data) {
    throw new Error("TransactionRepositoryPort.createSystemCharge no implementado");
  }
  async listByDateRange(_tenantId, _dateStart, _dateEnd) {
    throw new Error("TransactionRepositoryPort.listByDateRange no implementado");
  }
}

module.exports = { TransactionRepositoryPort };
