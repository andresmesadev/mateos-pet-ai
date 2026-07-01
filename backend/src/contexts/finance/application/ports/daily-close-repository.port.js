class DailyCloseRepositoryPort {
  async findByDate(_tenantId, _date) {
    throw new Error("DailyCloseRepositoryPort.findByDate no implementado");
  }
  async create(_data) {
    throw new Error("DailyCloseRepositoryPort.create no implementado");
  }
  async listByDateRange(_tenantId, _dateStart, _dateEnd) {
    throw new Error("DailyCloseRepositoryPort.listByDateRange no implementado");
  }
  /**
   * Asigna financialPeriodId únicamente a los DailyClose indicados que todavía
   * no pertenecen a ningún período (where financialPeriodId IS NULL).
   * Devuelve la cantidad de filas efectivamente actualizadas — protege la
   * partición del tiempo contra condiciones de carrera (finanzas-esquema-fisico.md).
   */
  async assignToPeriod(_dailyCloseIds, _financialPeriodId) {
    throw new Error("DailyCloseRepositoryPort.assignToPeriod no implementado");
  }
}

module.exports = { DailyCloseRepositoryPort };
