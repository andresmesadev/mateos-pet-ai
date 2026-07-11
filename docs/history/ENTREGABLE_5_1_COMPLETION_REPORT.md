# Cierre del Entregable 5.1 — Outbox de Eventos de Dominio

**Fecha:** 2026-07-11
**Fase:** Fase 5 — Operaciones Inteligentes (primer entregable del roadmap interno: 5.1 → 5.4)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.13.0`.
**Proceso aplicado:** macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 + Gate Review → Checkpoint obligatorio de contradicción → Implementación completa → Validación Técnica → Validación Funcional → Documentación)
**Gate Review de diseño (Macroetapa 1):** aprobado por el responsable del proyecto en esta misma conversación, sin documento físico independiente — congelado antes de iniciar la Macroetapa 2.

---

## Objetivo del entregable

Cerrar la brecha detectada en la Macroetapa 1: `EventDelivery` certificaba el resultado de cada entrega de Evento de Dominio a un consumidor (`"delivered"` | `"failed"`), pero ningún componente del sistema volvía a invocar al consumidor cuando la entrega fallaba. `retryEventDelivery` (existente desde el Entregable 3.0) era código muerto — registraba un resultado conocido, no reintentaba nada. Sin este entregable, un fallo transitorio de Automatizaciones ante un `CitaCompletada` quedaba certificado como `"failed"` de forma permanente, sin ningún mecanismo de recuperación.

## Checkpoint obligatorio de contradicción (previo a la Macroetapa 2)

Resuelto explícitamente, con evidencia del código real, antes de escribir cualquier línea de implementación:

1. **Idempotencia de los reintentos.** `AutomationExecution` ya almacena `(automationRuleId, domainEventId)` sin requerir migración. Se decidió verificar, antes de ejecutar la acción de cada Regla, si ya existe una `AutomationExecution` con `status: "success"` para ese par exacto — si existe, la Regla se omite. Evita que un reintento duplique un efecto secundario ya confirmado (p. ej. reenviar un mensaje de WhatsApp ya entregado).
2. **Estrategia de ejecución del mecanismo de reintentos.** Comparación basada en evidencia, no en precedente asumido: `package.json` no declara ninguna dependencia de cola (Redis, Bull, BullMQ, Agenda, Bee-Queue); la tabla `EventDelivery` tiene 0 filas en producción (confirmado en la Macroetapa 1); el único mecanismo de programación periódica existente en el proyecto es `node-cron` (`jobs/reminder.job.js`, tenant-aware desde 4.1). Introducir un worker dedicado o una cola externa sería desproporcionado frente al volumen real. Se eligió `node-cron`, replicando el patrón exacto de `reminder.job.js` (incluyendo su convención de wiring en `app.js`).

Ninguno de los dos checkpoints generó una Reconciliación Arquitectónica — ambos se resolvieron dentro del diseño ya congelado en la Macroetapa 1.

## Resumen de implementación

- **`EventDeliveryRepositoryPort.findDomainEventsAwaitingRetry(consumer)`** (+ implementación Prisma) — único mecanismo de descubrimiento de Eventos de Dominio pendientes de reintento para un consumidor dado, resolviendo el hueco de que el mecanismo previo (`findLastFailedForConsumer`) exigía conocer de antemano el `domainEventId`. Resuelto en memoria (última entrega por `domainEventId`, filtrado a `"failed"`), justificado explícitamente por el volumen real confirmado (0 filas), sin agregación SQL.
- **`AutomationExecutionRepositoryPort.hasSuccessfulExecution(automationRuleId, domainEventId)`** (+ implementación Prisma) — soporte de idempotencia.
- **`evaluateAndExecuteRules`** modificado para consultar `hasSuccessfulExecution` antes de ejecutar la acción de cada Regla — misma función, sin cambio de firma, reutilizada tanto por el flujo original (dispatcher síncrono de `CitaCompletada`) como por el job de reintento.
- **`list-domain-events-awaiting-retry.mechanism.js`** (nuevo) — operación de infraestructura del contexto Eventos, mismo estatus que `register-event-delivery.mechanism.js` y `retry-event-delivery.mechanism.js` (no es un caso de uso de negocio), wireada en `contexts/events/index.js`.
- **`jobs/event-delivery-retry.job.js`** (nuevo) — job `node-cron` cada 15 minutos que descubre entregas `"failed"` para el consumidor `"Automatizaciones"` y reintenta `evaluateAndExecuteRules` para cada una, con aislamiento de fallos entre elementos del lote (mismo principio que `reminder.job.js`).
- **`app.js`** — `startEventDeliveryRetryJob()` wireado junto a `startReminderJob()`.
- **`retryEventDelivery`** (3.0) permanece exportado en `contexts/events/index.js`, disponible como building block de bajo nivel — no fue invocado por este entregable porque `evaluateAndExecuteRules` ya se auto-certifica vía `eventDelivery.register(...)`; no queda huérfano de forma incorrecta, es una decisión de diseño explícita, no un descuido.

## Validación Técnica (Macroetapa 3)

- **Suite completa:** 73/73 suites · 436/436 tests en verde (14 tests nuevos de este entregable: 2 de idempotencia y 2 de reintento en `evaluate-and-execute-rules.mechanism.test.js`, 2 de `findDomainEventsAwaitingRetry` en `prisma-event-delivery.repository.test.js`, 4 de wiring en `event-delivery-retry-job-wiring.test.js`, más ajuste de fixture sin nuevos tests en 4 casos preexistentes).
- **`prisma migrate status`** → 33 migraciones, base de datos al día, sin diferencias.
- **`git diff --stat -- prisma/schema.prisma`** → vacío. **Sin cambios de schema en este entregable** — los modelos `EventDelivery`/`DomainEvent`/`EventType` (3.0) y `AutomationExecution` (3.3) ya tenían todo lo necesario.
- **`npx prisma generate`** ejecutado sin errores, cliente regenerado en sincronía con el schema sin cambios.

## Validación Funcional

- **Mecanismo único de descubrimiento confirmado por grep exhaustivo:** `findDomainEventsAwaitingRetry`/`listDomainEventsAwaitingRetry` tienen exactamente una definición de puerto, una implementación Prisma, un mecanismo de aplicación y un punto de consumo (`event-delivery-retry.job.js`). Cero implementaciones paralelas.
- **`hasSuccessfulExecution` confirmado por grep e inspección directa:** un único punto de definición de puerto, una implementación Prisma, y un único punto de consumo dentro del bucle de `evaluateAndExecuteRules`, ejecutado antes del `try/catch` que dispara la acción — confirmado por test que una Regla con `AutomationExecution` previa en `"success"` no vuelve a invocar al `actionExecutor`, mientras que una Regla previamente `"failed"` sí se re-ejecuta.
- **`evaluateAndExecuteRules` confirmado con exactamente dos llamadores reales** (`contexts/index.js`, el dispatcher síncrono de `CitaCompletada`; y `jobs/event-delivery-retry.job.js`, el reintento) — cero caminos alternos que invoquen la evaluación de Reglas evitando el control de idempotencia.
- **Job de reintentos confirmado correctamente registrado** en `app.js`, junto a `startReminderJob()`, con el mismo patrón de invocación.
- **Job confirmado reutilizando exclusivamente infraestructura existente:** `node-cron` (ya presente en `package.json` por `reminder.job.js`), sin ninguna dependencia nueva añadida.
- **`retryEventDelivery` confirmado no huérfano de forma incorrecta:** sigue exportado y disponible en `contexts/events/index.js`; su ausencia de invocación es la decisión de diseño documentada en el checkpoint, no un descuido — verificado por inspección directa del wiring.

## Grep exhaustivo — resultado

- Cero implementaciones duplicadas de `findDomainEventsAwaitingRetry`/`hasSuccessfulExecution`.
- Cero mecanismos de retry paralelos al job de 5.1 (única ocurrencia del término "retry"/"reintent" fuera de los archivos de este entregable: ninguna).
- Cero caminos que invoquen `evaluateAndExecuteRules` sin pasar por el chequeo de idempotencia (la función tiene un único cuerpo, el chequeo es interno a ella).
- Cero cambios en el motor conversacional: `git diff --stat` vacío para `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`.
- Cero cambios en los contextos de negocio: `git diff --stat` vacío para Agenda, Servicios, Staff, Finanzas, Comunicación. Los únicos contextos modificados (Automatizaciones, Eventos) son explícitamente infraestructura/orquestación dentro del alcance declarado de la Fase 5.

## Validación Arquitectónica — Principio Permanente de la Fase 5

> "Ningún entregable modifica reglas de negocio; únicamente infraestructura reactiva."

**Confirmado sin violaciones.** Todo cambio de este entregable ocurrió dentro de los contextos Automatizaciones y Eventos — ambos infraestructura/orquestación por diseño, no contextos de negocio. Ninguna regla de negocio (condiciones de Automatización, cálculo de precio, disponibilidad, comisión) fue alterada; el único comportamiento nuevo es la posibilidad de que una Regla ya evaluada se vuelva a evaluar tras un fallo, sin re-ejecutar su acción si ya tuvo éxito. No fue necesaria ninguna Reconciliación Arquitectónica.

## Hallazgos encontrados durante la implementación

Ninguno nuevo — la implementación coincidió con el diseño congelado en la Macroetapa 1. Un ajuste mecánico sin impacto de alcance: el fake de `automationExecutionRepository` en el test preexistente de `evaluate-and-execute-rules.mechanism.test.js` no implementaba `hasSuccessfulExecution`, causando que el nuevo chequeo lanzara una excepción no capturada por el `try/catch` interno (el chequeo ocurre antes de él) y se interpretara como colapso total del evaluador en 3 tests existentes — corregido añadiendo el método al fake, sin alterar la semántica de ningún test previo.

## Estado final

El Outbox de Eventos de Dominio queda funcionalmente cerrado para su primer y único consumidor real (Automatizaciones): toda entrega fallida es descubierta y reintentada automáticamente cada 15 minutos, sin duplicar efectos secundarios ya confirmados. `retryEventDelivery` permanece disponible para un futuro segundo consumidor sin necesidad de rediseño. El motor conversacional y los cinco contextos de negocio permanecen sin ningún cambio, verificado por grep exhaustivo y `git diff --stat`.

## Versionado

Versión declarada del proyecto actualizada de `2.12.0` a `2.13.0` (nueva capacidad funcional: reintento real de entregas de Eventos de Dominio, idempotente por Regla) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Estrategia de idempotencia resuelta y verificada antes de implementar, con evidencia del código existente.
- ✅ Estrategia de ejecución del reintento justificada por comparación basada en evidencia, no por precedente asumido.
- ✅ `findDomainEventsAwaitingRetry` es el único mecanismo de descubrimiento (verificado por grep).
- ✅ `hasSuccessfulExecution` bloquea correctamente la re-ejecución de Reglas ya exitosas (verificado por test).
- ✅ Job de reintentos correctamente registrado en `app.js` (verificado por inspección directa).
- ✅ Job reutiliza exclusivamente infraestructura existente (`node-cron`), sin dependencias nuevas.
- ✅ `retryEventDelivery` no queda huérfano de forma incorrecta — decisión de diseño documentada.
- ✅ Cero caminos alternos que eviten el control de idempotencia.
- ✅ Motor conversacional sin ningún cambio (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Contextos de negocio sin ningún cambio (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Principio Permanente de la Fase 5 respetado — sin Reconciliación Arquitectónica necesaria.
- ✅ Suite completa en verde (73/73 · 436/436).
- ✅ Migraciones consistentes (`migrate status` limpio, sin cambios de schema, `prisma generate` ejecutado).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión) completada — ver commit y tag correspondientes.
