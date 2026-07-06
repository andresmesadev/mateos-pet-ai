/**
 * Sin capa de dominio propia (Etapa 1, Decisión 1: cero entidades nuevas) —
 * este error vive en application/ porque describe una condición operativa
 * (falta de seed), no una regla de negocio.
 */
class ReceptionistNotConfiguredError extends Error {
  constructor(tenantId) {
    super(`No existe un Empleado Digital con especialización "recepcionista" para el tenant "${tenantId ?? "(global)"}".`);
    this.name = this.constructor.name;
  }
}

module.exports = { ReceptionistNotConfiguredError };
