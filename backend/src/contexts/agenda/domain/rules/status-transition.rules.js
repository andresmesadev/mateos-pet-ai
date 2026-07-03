/**
 * Regla de transición hacia "completed" — Entregable Puente, caso de uso 1.
 * Espejo exacto de la máquina de estados de Fase 1 (appointment-status.service.js):
 * solo "in_progress" puede transicionar a "completed". El resto de transiciones
 * sigue siendo responsabilidad del flujo legacy (decisión de Etapa 1: convivencia).
 */
const COMPLETABLE_FROM = ["in_progress"];

function canComplete(fromStatus) {
  return COMPLETABLE_FROM.includes(fromStatus);
}

module.exports = { canComplete, COMPLETABLE_FROM };
