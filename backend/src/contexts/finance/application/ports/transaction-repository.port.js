/**
 * Puerto sobre Transaction (Fase 1, extendida — ADR 005). Finanzas solo
 * crea obligaciones de cita con paidAt nulo (ADR 024) e ingresos de POS.
 * Liquidar conserva fila y monto; listByDateRange devuelve dinero recibido.
 * El adaptador ofrece lockByAppointment(tenantId, id, ctx) para confirmar
 * el pago una sola vez dentro de la transacción y gate del día.
 */
class TransactionRepositoryPort {
  async createSystemCharge(_data) {
    throw new Error("TransactionRepositoryPort.createSystemCharge no implementado");
  }
  async listByDateRange(_tenantId, _dateStart, _dateEnd, _ctx) {
    throw new Error("TransactionRepositoryPort.listByDateRange no implementado");
  }
}

module.exports = { TransactionRepositoryPort };
