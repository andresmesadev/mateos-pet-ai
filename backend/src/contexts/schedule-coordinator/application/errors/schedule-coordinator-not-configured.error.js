/**
 * Sin capa de dominio propia (Etapa 1, Decisión 1: cero entidades nuevas) —
 * este error vive en application/ porque describe una condición operativa
 * (falta de seed), no una regla de negocio. Mismo criterio que
 * ReceptionistNotConfiguredError (3.4).
 */
class ScheduleCoordinatorNotConfiguredError extends Error {
  constructor(tenantId) {
    super(`No existe un Empleado Digital con especialización "coordinador_agenda" para el tenant "${tenantId ?? "(global)"}".`);
    this.name = this.constructor.name;
  }
}

module.exports = { ScheduleCoordinatorNotConfiguredError };
