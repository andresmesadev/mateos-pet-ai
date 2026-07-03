const { calculateCommissionSplit } = require("../../domain/rules/commission-calculation.rules");
const {
  StaffNotFoundError,
  ReferencedServiceNotFoundError,
  InvalidCommissionInputError,
} = require("../../domain/errors");

/**
 * RecordCommissionOnAppointmentCompletedUseCase — Operación (reactivo).
 * Implementa "Registrar Comisión por Cita Completada". Actor: el propio
 * Sistema Operativo, reaccionando al evento CitaCompletada (de Agenda) a
 * través de un adaptador de eventos — nunca invocado directamente por
 * Agenda ni por un operador humano.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/commission-repository.port").CommissionRepositoryPort} deps.commissionRepository
 * @param {import("../ports/service-category-reader.port").ServiceCategoryReaderPort} deps.serviceCategoryReader
 * @param {import("../ports/business-config-reader.port").BusinessConfigReaderPort} deps.businessConfigReader
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRecordCommissionOnAppointmentCompletedUseCase({
  staffRepository,
  commissionRepository,
  serviceCategoryReader,
  businessConfigReader,
  eventPublisher,
}) {
  // ctx: contexto de la Unidad de Trabajo — el reactivo corre en la misma
  // transacción que el comando Completar Cita (Etapa 2 del Puente).
  return async function execute({ tenantId, appointmentId, staffId, serviceId, resolvedPrice, priceSource, completedAt }, ctx) {
    if (!appointmentId || !staffId || !serviceId) {
      throw new InvalidCommissionInputError("appointmentId, staffId y serviceId son obligatorios.");
    }
    if (resolvedPrice == null || Number(resolvedPrice) < 0) {
      throw new InvalidCommissionInputError("resolvedPrice no puede ser nulo ni negativo.");
    }

    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new StaffNotFoundError(staffId);
    }

    const category = await serviceCategoryReader.getCategoryForService(serviceId);
    if (!category) {
      throw new ReferencedServiceNotFoundError(serviceId);
    }

    const splitRate = category.appliesCommissionSplit
      ? await businessConfigReader.getCommissionSplitRate(tenantId, category.id)
      : 0;

    const { staffShare, businessShare } = calculateCommissionSplit(Number(resolvedPrice), splitRate);

    const commission = await commissionRepository.create(
      {
        tenantId: tenantId ?? null,
        appointmentId,
        staffId,
        resolvedPrice: Number(resolvedPrice),
        priceSource: priceSource ?? "unresolved",
        splitRate,
        staffShare,
        businessShare,
        serviceCategory: category.name,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      },
      ctx
    );

    await eventPublisher.publish("ComisiónRegistrada", { commission });

    return { commission };
  };
}

module.exports = { createRecordCommissionOnAppointmentCompletedUseCase };
