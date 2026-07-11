const logger = require("../../../lib/logger");

/**
 * Entregable 5.2 (Fase 5) — Certificación Real de Eventos por Contexto.
 * Adaptador único, reutilizado por los publishers log-only de los contextos
 * productores (Empleados Digitales, Automatizaciones, Comunicación, Finanzas,
 * Servicios, Staff): convierte publish(eventName, payload) en una
 * certificación real vía events.registerDomainEvent (3.0), sin rediseñar ese
 * caso de uso ni la infraestructura de reintento de 5.1 — ambos se reutilizan
 * sin ningún cambio.
 *
 * Garantía no negociable (Macroetapa 1, riesgo de consistencia): publish()
 * nunca debe fallar para su llamador — es la misma garantía que ya ofrecía el
 * publisher log-only que reemplaza. Un fallo de certificación (Tipo de
 * Evento inactivo/inexistente, tenantId no resoluble, error de
 * infraestructura) se registra por logger y jamás se relanza.
 *
 * Excluido deliberadamente: el propio contexto Eventos. Su publisher log-only
 * (`EventsDomainEventsPublisher`) permanece sin cambios — certificar sus
 * propios eventos (`EventoDeDominioRegistrado`, etc.) con este adaptador
 * generaría una llamada recursiva a `registerDomainEvent` dentro de sí mismo
 * (hallazgo del checkpoint de contradicción de la Macroetapa 2).
 */
function defaultTenantIdExtractor(payload) {
  if (!payload || typeof payload !== "object") return undefined;
  if (payload.tenantId) return payload.tenantId;
  for (const value of Object.values(payload)) {
    if (value && typeof value === "object" && value.tenantId) return value.tenantId;
  }
  return undefined;
}

class CertifyingDomainEventPublisher {
  constructor({ registerDomainEvent, originContext, tenantIdExtractor = defaultTenantIdExtractor }) {
    this.registerDomainEvent = registerDomainEvent;
    this.originContext = originContext;
    this.tenantIdExtractor = tenantIdExtractor;
  }

  async publish(eventName, payload) {
    try {
      const tenantId = this.tenantIdExtractor(payload);
      if (!tenantId) {
        logger.info(
          `[${this.originContext}] "${eventName}" no certificado — tenantId no resoluble (entidad global o payload incompleto)`
        );
        return;
      }
      await this.registerDomainEvent({
        tenantId,
        eventTypeName: eventName,
        payload,
        origin: this.originContext,
        occurredAt: new Date(),
      });
    } catch (error) {
      logger.error(`[${this.originContext}] Fallo al certificar Evento de Dominio "${eventName}" — no propagado`, {
        error: error.message,
      });
    }
  }
}

module.exports = { CertifyingDomainEventPublisher, defaultTenantIdExtractor };
