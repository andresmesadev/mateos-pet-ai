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

const agenda = buildAgendaContext({ unitOfWork, eventPublisher: dispatcher });

module.exports = {
  dispatcher,
  completeAppointment: agenda.completeAppointment,
};
