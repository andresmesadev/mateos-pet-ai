const { canComplete } = require("../../domain/rules/status-transition.rules");
const {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
  UnresolvedPriceError,
} = require("../../domain/errors");

/**
 * CompleteAppointmentUseCase — Operación (actor humano). Entregable Puente, caso 1.
 *
 * Invariante ADR 007-D4: una cita facturable no puede completarse sin precio
 * resuelto (el cero es un precio; el indeterminado no).
 * Decisión de Etapa 2: la transición, la comisión (Staff) y el cobro (Finanzas)
 * ocurren en la MISMA transacción lógica — si un reactivo falla, la cita no
 * queda completada.
 *
 * @param {Object} deps
 * @param {import("../ports/appointment-repository.port").AppointmentRepositoryPort} deps.appointmentRepository
 * @param {import("../ports/price-resolution.port").PriceResolutionPort} deps.priceResolution
 * @param {{ run(fn: Function): Promise<any> }} deps.unitOfWork
 * @param {{ publish(name: string, payload: Object, ctx?: Object): Promise<void> }} deps.eventPublisher
 */
function createCompleteAppointmentUseCase({ appointmentRepository, priceResolution, unitOfWork, eventPublisher }) {
  return async function execute({ tenantId, appointmentId, completedAt }) {
    const appointment = await appointmentRepository.findById(tenantId ?? null, appointmentId);
    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }
    if (!canComplete(appointment.status)) {
      throw new InvalidStatusTransitionError(appointment.status, "completed");
    }

    const priceResolutionResult = priceResolution.resolve(appointment);
    if (priceResolutionResult.finalPrice == null) {
      throw new UnresolvedPriceError(appointmentId);
    }

    const endedAt = completedAt ? new Date(completedAt) : new Date();

    const updated = await unitOfWork.run(async (ctx) => {
      const completed = await appointmentRepository.markCompleted(appointmentId, endedAt, ctx);

      await eventPublisher.publish(
        "CitaCompletada",
        {
          tenantId: appointment.tenantId ?? null,
          appointmentId: appointment.id,
          staffId: appointment.staffId ?? null,
          serviceId: appointment.serviceId ?? null,
          serviceType: appointment.serviceType ?? null,
          resolvedPrice: priceResolutionResult.finalPrice,
          priceSource: priceResolutionResult.source,
          completedAt: endedAt,
        },
        ctx
      );

      return completed;
    });

    return { appointment: updated, priceResolution: priceResolutionResult };
  };
}

module.exports = { createCompleteAppointmentUseCase };
