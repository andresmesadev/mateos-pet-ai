/**
 * Composition root del contexto Agenda (mínimo — Entregable Puente, Etapa 3):
 * nace con un único comando, Completar Cita. El resto de transiciones de estado
 * permanece en el flujo legacy (decisión de Etapa 1). El publisher se inyecta
 * desde el root de integración (contexts/index.js), que es quien conoce las
 * suscripciones entre contextos.
 */
const { PrismaAppointmentRepository } = require("./infrastructure/persistence/prisma-appointment.repository");
const { PriceResolverAdapter } = require("./infrastructure/price/price-resolver.adapter");
const { createCompleteAppointmentUseCase } = require("./application/use-cases/complete-appointment.usecase");

function buildAgendaContext({ unitOfWork, eventPublisher }) {
  const appointmentRepository = new PrismaAppointmentRepository();
  const priceResolution = new PriceResolverAdapter();

  const completeAppointment = createCompleteAppointmentUseCase({
    appointmentRepository,
    priceResolution,
    unitOfWork,
    eventPublisher,
  });

  return { completeAppointment };
}

module.exports = { buildAgendaContext };
