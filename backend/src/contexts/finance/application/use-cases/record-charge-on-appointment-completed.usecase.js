const { InvalidChargeInputError } = require("../../domain/errors");

/**
 * RecordChargeOnAppointmentCompletedUseCase — Operación (reactivo).
 * Implementa "Registrar Cobro al Completarse una Cita". Actor: el propio
 * Sistema Operativo, reaccionando al evento CitaCompletada (Agenda), nunca
 * invocado por un operador humano.
 *
 * Corregido por ADR 005: no crea una entidad Cobro propia. Crea una fila de
 * Transaction (Fase 1, extendida) con origin = "system_appointment_completed".
 *
 * @param {Object} deps
 * @param {import("../ports/transaction-repository.port").TransactionRepositoryPort} deps.transactionRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRecordChargeOnAppointmentCompletedUseCase({ transactionRepository, eventPublisher }) {
  return async function execute({ tenantId, appointmentId, resolvedPrice, completedAt }) {
    if (!appointmentId) {
      throw new InvalidChargeInputError("appointmentId es obligatorio.");
    }
    if (resolvedPrice == null || Number(resolvedPrice) < 0) {
      throw new InvalidChargeInputError("resolvedPrice no puede ser nulo ni negativo.");
    }

    const transaction = await transactionRepository.createSystemCharge({
      tenantId: tenantId ?? null,
      appointmentId,
      total: Number(resolvedPrice),
      paidAt: completedAt ? new Date(completedAt) : new Date(),
    });

    await eventPublisher.publish("CobroRegistrado", { transaction });

    return { transaction };
  };
}

module.exports = { createRecordChargeOnAppointmentCompletedUseCase };
