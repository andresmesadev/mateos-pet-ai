/**
 * Domain rule — cálculo de split de comisión del contexto Staff.
 *
 * Generaliza la regla ya vigente en src/services/domain/commission.service.js
 * (Fase 1, GROOMING_SPLIT_RATE = 0.5) sin modificarla — ambas conviven sobre
 * la misma tabla Commission hasta una migración futura explícita
 * (Decisión Arquitectónica Diferida #2, resuelta en la Etapa 5).
 *
 * Función pura: no conoce Prisma, no decide de dónde sale splitRate —
 * solo calcula, dado un precio resuelto y una tasa, cuánto corresponde
 * a cada parte. Redondeo: staffShare se redondea a 2 decimales;
 * businessShare es el remanente exacto, garantizando que
 * staffShare + businessShare === resolvedPrice.
 */
function calculateCommissionSplit(resolvedPrice, splitRate) {
  const raw = resolvedPrice * splitRate;
  const staffShare = Math.round(raw * 100) / 100;
  const businessShare = Math.round((resolvedPrice - staffShare) * 100) / 100;
  return { staffShare, businessShare, splitRate };
}

module.exports = { calculateCommissionSplit };
