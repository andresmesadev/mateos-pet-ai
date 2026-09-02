// Entregable 8.2 (Fase 8), D-E3 — Reconciliación Arquitectónica: ADR 010
// (misma autorización que 8.1, sigue vigente para este bloque).
//
// Antes de este entregable, dos mensajes del mismo remitente llegados en
// rápida sucesión se procesaban en paralelo: ambos leían `sessions[phone]`
// desde el mismo estado inicial y el último en escribir ganaba — sesiones
// corruptas, preguntas repetidas, riesgo de citas duplicadas.
//
// Solución elegida (Gate Review 8.2, checkpoint 1.2): NO un advisory lock de
// PostgreSQL (patrón de Sancho Agent IA) — el backend corre hoy una única
// instancia (verificado en el VPS), y aplicar un lock `_xact_` exigiría
// envolver todo `processSingleIncomingMessage` en una única transacción
// Prisma, la reescritura que el principio "no reescribir el motor
// conversacional" existe para evitar. Un mutex en memoria por remitente basta
// mientras haya un solo proceso. Si el proyecto escala horizontalmente, el
// lock de Postgres queda como Decisión Arquitectónica Diferida explícita —
// no resuelta por adelantado sin evidencia de que haga falta.

/** @type {Map<string, Promise<unknown>>} */
const queues = new Map();

/**
 * Encadena `fn` detrás de cualquier ejecución pendiente para el mismo `key`
 * (normalmente el teléfono del remitente). Dos llamadas con el mismo `key`
 * nunca corren en paralelo; llamadas con `key` distinto no se bloquean entre
 * sí. La entrada se libera del mapa en cuanto la cadena queda vacía — sin
 * esto, `queues` crecería sin límite (mismo defecto que D-M4 señala sobre
 * `sessions{}`, evitado desde el diseño).
 *
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
const runExclusive = (key, fn) => {
  const previous = queues.get(key) || Promise.resolve();

  const run = previous.then(fn, fn);

  // Encadena la limpieza después de `run`, ignorando su resultado/error —
  // el mapa solo debe reflejar si queda trabajo pendiente para `key`, nunca
  // propagar el error de `fn` (eso ya lo hace el `return run` de abajo).
  const cleanup = run.then(
    () => {},
    () => {}
  );

  queues.set(key, cleanup);
  cleanup.finally(() => {
    if (queues.get(key) === cleanup) {
      queues.delete(key);
    }
  });

  return run;
};

module.exports = { runExclusive };
