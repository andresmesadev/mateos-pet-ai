const { DomainError } = require("./domain-error");

/**
 * Protección de aplicación del invariante "no dos StaffCapability activas
 * para el mismo staff y servicio" (staff-modelo-persistencia.md, sección 6).
 * Complementada por el índice único parcial en base de datos
 * (staff-esquema-fisico.md, sección 3 — "mismo patrón que PriceRule en 2.1").
 */
class DuplicateStaffCapabilityError extends DomainError {
  constructor(staffId, serviceId) {
    super(
      "DUPLICATE_STAFF_CAPABILITY",
      `Ya existe una capacidad activa para el staff "${staffId}" y el servicio "${serviceId}".`
    );
    this.staffId = staffId;
    this.serviceId = serviceId;
  }
}

module.exports = { DuplicateStaffCapabilityError };
