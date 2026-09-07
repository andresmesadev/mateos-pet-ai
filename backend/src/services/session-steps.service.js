// Entregable 8.3 (Fase 8), D-E1 — Reconciliación Arquitectónica: ADR 010
// (misma autorización de 8.1/8.2).
//
// Antes de este entregable, cualquier parte del código podía escribir
// cualquier valor en `session.step` — un bug que asignara un paso inválido
// no fallaba ruidosamente, caía en el `else` genérico del wizard y el
// cliente recibía una respuesta desconcertante, sin ningún rastro en logs.
//
// No es una tabla de transiciones `from → to` (patrón de
// session_transitions.py, Sancho Agent IA): el wizard de reserva es
// intencionalmente interrumpible desde cualquier paso (cancelar, hablar con
// un humano, saludar), así que "cualquier paso → reset" es una regla
// legítima, no una excepción — modelarla como tabla de transiciones sería,
// en la práctica, una lista blanca de valores disfrazada de FSM. Lo que
// corrige el daño real descrito (D-E1) es un vocabulario cerrado.
//
// No bloquea: registra. Sin cobertura exhaustiva de cada camino del wizard,
// rechazar en duro arriesga cortar un flujo legítimo no identificado en la
// auditoría de este entregable (ver Gate Review, 1.1). El objetivo es
// visibilidad de diagnóstico — el daño concreto que el informe describe.

const { STEPS } = require("./conversation.service");

const VALID_STEPS = new Set(Object.values(STEPS));

const isValidStep = (step) => step === null || step === undefined || VALID_STEPS.has(step);

/**
 * @param {unknown} step
 * @param {Record<string, unknown>} [context] Datos para el log — nunca lanza.
 */
const assertValidStep = (step, context = {}) => {
  if (isValidStep(step)) return;

  console.error(
    "[SessionSteps] Paso fuera del vocabulario cerrado de STEPS:",
    JSON.stringify({ step, ...context })
  );
};

module.exports = { isValidStep, assertValidStep, VALID_STEPS };
