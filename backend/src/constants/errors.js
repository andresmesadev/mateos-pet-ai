/**
 * Mensajes de error centralizados en español.
 * Usar en route handlers para consistencia en respuestas de error.
 */
const ERRORS = {
  INTERNAL: "Error interno del servidor",
  NOT_FOUND: (entity = "Recurso") => `${entity} no encontrado`,
  ALREADY_EXISTS: (entity = "Registro") => `Ya existe un ${entity} con esos datos`,
  REQUIRED: (field) => `${field} es requerido`,
  INVALID: (field) => `${field} inválido`,
  FORBIDDEN: "No tienes permiso para realizar esta acción",
  INVALID_STATUS: "Estado inválido",
  TRANSITION_NOT_ALLOWED: (from, to) => `Transición no permitida: ${from} → ${to}`,
  STAFF_NOT_FOUND: "Profesional no encontrado en este tenant",
  SERVICE_NOT_FOUND: "Servicio no encontrado en este tenant",
};

module.exports = ERRORS;
