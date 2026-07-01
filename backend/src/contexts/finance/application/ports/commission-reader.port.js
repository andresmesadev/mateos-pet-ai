/**
 * Puerto mínimo de solo lectura hacia Staff. Expone únicamente lo que
 * financial-summary.rules.js necesita para consolidar — nunca el modelo
 * completo de Commission. Mismo criterio que ADR 002 y ADR 004.
 */
class CommissionReaderPort {
  /** @returns {Promise<Array<{staffId:?string, resolvedPrice:any, staffShare:any, businessShare:any, completedAt:Date, appointmentId:string}>>} */
  async listByDateRange(_tenantId, _dateStart, _dateEnd) {
    throw new Error("CommissionReaderPort.listByDateRange no implementado");
  }
}

module.exports = { CommissionReaderPort };
