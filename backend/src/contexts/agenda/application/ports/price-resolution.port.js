/**
 * Puerto de resolución de precio (patrón ADR 002/004: el contexto dueño de la
 * operación consulta al dueño del dato en el momento de la operación).
 * Su implementación envuelve price-resolver.service.js — la fuente única de
 * precio del proyecto (regla de CLAUDE.md).
 */
class PriceResolutionPort {
  // finalPrice/servicePrice: importe del servicio (base de comisión).
  // totalPrice: cobro al cliente; transportPrice y transportPending explican
  // el desglose. Toda decisión procede del resolver central, nunca del canal.
  resolve(appointment) {
    throw new Error("PriceResolutionPort.resolve no implementado");
  }
}

module.exports = { PriceResolutionPort };
