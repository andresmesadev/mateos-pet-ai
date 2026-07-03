const { DomainError } = require("./domain-error");

// Hallazgo M1: los hechos financieros oficiales exigen tenant explícito.
class MissingTenantError extends DomainError {
  constructor() {
    super("tenantId es obligatorio para operar sobre hechos financieros oficiales.");
  }
}

// ADR 007-D2: un cierre no puede congelarse si falta el cobro de sistema de
// alguna cita facturable completada del día.
class IncompleteDailyCloseError extends DomainError {
  constructor(date, missingAppointmentIds) {
    super(
      `El día ${date} tiene ${missingAppointmentIds.length} cita(s) completada(s) sin cobro de sistema; ` +
        `el cierre no puede generarse. Citas: ${missingAppointmentIds.join(", ")}`
    );
    this.missingAppointmentIds = missingAppointmentIds;
  }
}

class TransactionNotFoundError extends DomainError {
  constructor(transactionId) {
    super(`La transacción "${transactionId}" no existe.`);
  }
}

class TransactionAlreadyVoidedError extends DomainError {
  constructor(transactionId) {
    super(`La transacción "${transactionId}" ya está anulada.`);
  }
}

class InvalidTransactionOperationError extends DomainError {}

module.exports = {
  MissingTenantError,
  IncompleteDailyCloseError,
  TransactionNotFoundError,
  TransactionAlreadyVoidedError,
  InvalidTransactionOperationError,
};
