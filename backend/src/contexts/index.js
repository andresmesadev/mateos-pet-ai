/**
 * Root de integración entre contextos (Entregable Puente, Etapa 3).
 * Es el ÚNICO lugar del sistema que conoce qué contextos se escuchan entre sí:
 * construye el dispatcher, registra las suscripciones a CitaCompletada y
 * ensambla el contexto Agenda con la Unidad de Trabajo compartida.
 *
 * Decisión de Etapa 2: la entrega es síncrona y dentro de la misma transacción
 * del comando Completar Cita — si un reactivo falla, la cita no queda completada.
 */
const { DomainEventDispatcher } = require("./shared/events/domain-event-dispatcher");
const { PrismaUnitOfWork } = require("./shared/persistence/prisma-unit-of-work");
const { buildAgendaContext } = require("./agenda");
const staff = require("./staff");
const finance = require("./finance");
const events = require("./events");
const automation = require("./automation");
const logger = require("../lib/logger");

const dispatcher = new DomainEventDispatcher();
const unitOfWork = new PrismaUnitOfWork();

// Staff: registra la comisión. Solo aplica cuando la cita tiene staff y servicio
// asignados (precondiciones del caso de uso — no es un fallo silencioso: sin
// staff/servicio no existe hecho de reparto que registrar).
dispatcher.subscribe("CitaCompletada", async (payload, ctx) => {
  if (!payload.staffId || !payload.serviceId) {
    logger.info("[Integración] CitaCompletada sin staff/servicio — no genera comisión", {
      appointmentId: payload.appointmentId,
    });
    return;
  }
  await staff.recordCommissionOnAppointmentCompleted(
    {
      tenantId: payload.tenantId,
      appointmentId: payload.appointmentId,
      staffId: payload.staffId,
      serviceId: payload.serviceId,
      resolvedPrice: payload.resolvedPrice,
      priceSource: payload.priceSource,
      completedAt: payload.completedAt,
    },
    ctx
  );
});

// Finanzas: registra el cobro de sistema — el ingreso oficial del servicio (ADR 007-D1).
dispatcher.subscribe("CitaCompletada", async (payload, ctx) => {
  await finance.recordChargeOnAppointmentCompleted(
    {
      tenantId: payload.tenantId,
      appointmentId: payload.appointmentId,
      resolvedPrice: payload.resolvedPrice,
      completedAt: payload.completedAt,
    },
    ctx
  );
});

// Entregable 5.4 — Automatizaciones Multi-Evento: reemplaza la suscripción
// puntual de 3.3 (que solo cubría CitaCompletada, único evento antes
// dispatchado a través del DomainEventDispatcher). Se engancha directamente
// al punto de certificación (`events.setDomainEventReactor`), que TODO evento
// certificado atraviesa sin importar su contexto productor — Agenda vía
// dispatcherWithCertification más abajo, y los otros 6 contextos vía
// CertifyingDomainEventPublisher (5.2) — sin modificar ninguno de ellos.
// Exclusión permanente (no negociable, ver checkpoint de contradicción de la
// Macroetapa 2 del Entregable 5.4): los eventos propios de Automatizaciones
// son infraestructura interna y nunca deben disparar sus propias reglas —
// mismo criterio de carve-out aplicado al contexto Eventos durante el
// Entregable 5.2, documentado explícitamente y no dejado implícito.
const AUTOMATION_INTERNAL_EVENT_TYPES = new Set([
  "ReglaDeAutomatizacionRegistrada",
  "ReglaDeAutomatizacionActivada",
  "ReglaDeAutomatizacionDesactivada",
  "PlantillaDeAutomatizacionRegistrada",
  "PlantillaDeAutomatizacionActivada",
]);

events.setDomainEventReactor(async ({ domainEvent, eventTypeName, payload }, ctx) => {
  if (AUTOMATION_INTERNAL_EVENT_TYPES.has(eventTypeName)) return;
  await automation.evaluateAndExecuteRules({ domainEvent, eventPayload: payload }, ctx);
});

// Entregable 3.0 — Infraestructura de Eventos: la certificación de un hecho
// como Evento de Dominio forma parte del cierre exitoso de la misma
// transacción lógica del comando que publica (Etapa 3, sección 3) — NO es un
// handler más entre los suscriptores del dispatcher, ni depende del orden de
// ejecución de estos. Se implementa como un envoltorio de la operación de
// publicación misma, en este root de integración — el DomainEventDispatcher
// del Puente permanece intacto, sin abrirse.
//
// Entregable 3.3 — el `ctx` (ya opaco para el dominio, solo se propaga) se
// extiende con el Evento de Dominio certificado, para que Automatizaciones
// pueda registrar su propia Entrega de Evento sin que el dispatcher ni los
// suscriptores existentes (Staff/Finanzas) necesiten cambiar — ambos ignoran
// el campo nuevo.
const dispatcherWithCertification = {
  subscribe: dispatcher.subscribe.bind(dispatcher),
  async publish(eventName, payload, ctx) {
    const { domainEvent } = await events.registerDomainEvent(
      {
        tenantId: payload.tenantId,
        eventTypeName: eventName,
        payload,
        origin: "Agenda",
        occurredAt: payload.completedAt ?? new Date(),
      },
      ctx
    );
    await dispatcher.publish(eventName, payload, { ...ctx, domainEvent });
  },
};

const agenda = buildAgendaContext({ unitOfWork, eventPublisher: dispatcherWithCertification });

module.exports = {
  dispatcher,
  completeAppointment: agenda.completeAppointment,
  events,
  automation,
};
