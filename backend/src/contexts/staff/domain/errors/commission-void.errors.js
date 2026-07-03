const { DomainError } = require("./domain-error");

class CommissionNotFoundError extends DomainError {
  constructor(commissionId) {
    super(`La comisión "${commissionId}" no existe.`);
  }
}

class CommissionAlreadyVoidedError extends DomainError {
  constructor(commissionId) {
    super(`La comisión "${commissionId}" ya está anulada.`);
  }
}

// ADR 009-D4(a): no se corrige una comisión de un día con Cierre oficial.
class CommissionDayClosedError extends DomainError {
  constructor(ymd) {
    super(`El día ${ymd} ya tiene un Cierre del Día oficial; la comisión no puede corregirse.`);
  }
}

// ADR 009-D4(b): primero se anula la liquidación, luego la comisión.
class CommissionInActiveSettlementError extends DomainError {
  constructor(commissionId, settlementId) {
    super(
      `La comisión "${commissionId}" está consolidada en la liquidación activa "${settlementId}". ` +
        `Anula primero la liquidación.`
    );
  }
}

module.exports = {
  CommissionNotFoundError,
  CommissionAlreadyVoidedError,
  CommissionDayClosedError,
  CommissionInActiveSettlementError,
};
