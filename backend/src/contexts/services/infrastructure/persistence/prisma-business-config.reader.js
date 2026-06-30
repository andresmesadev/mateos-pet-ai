const { BusinessConfigReaderPort } = require("../../application/ports/business-config-reader.port");

/**
 * Implementación provisional. El contexto Negocio todavía no persiste la
 * entidad "Módulo" descrita en domain-model-v1.md (Tenant no tiene un campo
 * de módulos activos hoy) — eso pertenece a un entregable propio del
 * contexto Negocio, fuera del alcance congelado del Entregable 2.1.
 *
 * Hasta que ese entregable exista, se retorna el conjunto permisivo de
 * módulos ("grooming", "veterinary") para no bloquear categorías que hoy
 * el sistema ya opera sin gate de módulos. Esta limitación queda registrada
 * aquí explícitamente, no oculta: cuando el contexto Negocio incorpore la
 * persistencia real de módulos, esta clase se reemplaza por una consulta
 * real, sin tocar el puerto ni los casos de uso que la consumen.
 */
class PrismaBusinessConfigReader extends BusinessConfigReaderPort {
  async getActiveModules(_tenantId) {
    return ["grooming", "veterinary"];
  }
}

module.exports = { PrismaBusinessConfigReader };
