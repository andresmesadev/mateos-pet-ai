/**
 * Puerto que encapsula la invocación de la Acción de una Regla. La
 * implementación de infraestructura es quien conoce los casos de uso reales
 * de Comunicación y Empleados Digitales (Etapa 3, sección 2) — este puerto
 * mantiene la capa de aplicación de Automatizaciones sin conocerlos
 * directamente.
 */
class ActionExecutorPort {
  async execute(_actionType, _actionConfig, _eventPayload, _tenantId) {
    throw new Error("ActionExecutorPort.execute no implementado");
  }
}
module.exports = { ActionExecutorPort };
