# Cierre del Entregable 5.4 — Automatizaciones Multi-Evento

**Fecha:** 2026-07-27
**Fase:** Fase 5 — Operaciones Inteligentes (cuarto y último entregable funcional del roadmap interno: 5.1 → 5.4)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.16.0`. Cierra el roadmap interno funcional de la Fase 5.
**Proceso aplicado:** macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 + Gate Review → Checkpoint obligatorio de contradicción → Implementación → Validación Técnica → Validación Funcional → Validación de Invariantes → Grep exhaustivo → Validación Arquitectónica → Documentación)

---

## Objetivo del entregable

Completar la infraestructura reactiva construida en la Fase 3 (Automatizaciones, 3.3) y la Fase 5 (Outbox, 5.1; Certificación Real de Eventos, 5.2) permitiendo que el motor de Automatizaciones reaccione automáticamente a cualquiera de los Eventos de Dominio certificados — no solo `CitaCompletada`, único disparador real hasta este entregable — sin crear un motor nuevo, sin modificar reglas de negocio y sin tocar el motor conversacional.

## Hallazgo central de la Macroetapa 1

`evaluateAndExecuteRules` (3.3) ya era completamente genérico por `eventTypeId` — el bloqueo no estaba en el mecanismo de evaluación, sino en el **wiring**: solo Agenda (`completeAppointment`) publicaba a través de `dispatcherWithCertification`, el único wrapper que certifica **y** dispatcha a suscriptores. Los otros 6 contextos productores (Empleados Digitales, Automatizaciones, Comunicación, Finanzas, Servicios, Staff) certifican vía `CertifyingDomainEventPublisher` (5.2) directamente contra `events.registerDomainEvent`, sin pasar nunca por el `DomainEventDispatcher` — sus 31 tipos de evento quedaban certificados en el Catálogo pero sin ningún consumidor.

## Checkpoint obligatorio de contradicción (previo a la Macroetapa 2)

Verificado nuevamente contra el código real, sin contradicciones:

1. **`contexts/index.js` seguía siendo el único wiring cruzado conocido.**
2. **`evaluateAndExecuteRules` seguía siendo completamente genérico por `eventTypeId`**, sin ningún hardcode adicional.
3. **`AutomationRule.triggerEventTypeId` seguía siendo el único mecanismo de disparo**, sin caminos alternos.
4. **La infraestructura de 5.1 (`DomainEvent`, `EventDelivery`, retry) y 5.2 (`CertifyingDomainEventPublisher`) permanecía compatible sin requerir modificaciones.**

**Precisión de diseño resuelta durante el checkpoint (no fue una Reconciliación Arquitectónica — no hubo contradicción, solo una decisión de mecanismo dentro del alcance ya aprobado):** la Decisión congelada 2 ("único punto centralizado de wiring, descartado modificar individualmente los seis contextos productores") no podía satisfacerse extendiendo `contexts/index.js` para suscribirse directamente a 31 nombres de evento en el `DomainEventDispatcher`, porque los 6 contextos productores nunca dispatchan a ese bus — solo certifican. Se resolvió con un **punto de extensión genérico dentro del propio `registerDomainEvent`** (un `reactor` inyectable, no-op por defecto): el único punto de configuración real de ese reactor sigue siendo `contexts/index.js`, cumpliendo la Decisión 2 sin tocar ninguno de los 6 contextos productores.

## Resumen de implementación

- **`events/application/use-cases/register-domain-event.usecase.js`** — parámetro opcional `reactor = { notify: async () => {} }`, invocado tras certificar exitosamente, envuelto en `try/catch` que nunca propaga (misma garantía de no-propagación de toda la certificación desde 3.0/5.2).
- **`events/index.js`** — expone `setDomainEventReactor(handler)`, que sustituye `domainEventReactor.notify` sobre el mismo objeto mutable ya inyectado en el caso de uso construido — sin reconstruirlo, sin nuevo caso de uso.
- **`contexts/index.js`** — único llamador real de `setDomainEventReactor`: excluye explícitamente (mediante un `Set`, documentado en el código con el mismo criterio de carve-out aplicado al contexto Eventos en 5.2) los 5 eventos internos de Automatizaciones (`ReglaDeAutomatizacionRegistrada/Activada/Desactivada`, `PlantillaDeAutomatizacionRegistrada/Activada`); para cualquier otro evento certificado, invoca `automation.evaluateAndExecuteRules`. Se eliminó la suscripción puntual de 3.3 (`dispatcher.subscribe("CitaCompletada", ...)` hacia Automatización), redundante desde este entregable.

**Ajuste respecto al diseño de Macroetapa 1:** para `CitaCompletada`, la evaluación de Automatización pasa a ejecutarse dentro de `registerDomainEvent` — antes de que el `DomainEventDispatcher` notifique a Staff/Finanzas — en vez de después, como con la suscripción puntual eliminada. Sin dependencia funcional detectada entre ese orden y los efectos de Staff/Finanzas (Automatización evalúa contra el `eventPayload`, no contra efectos colaterales de otros suscriptores); confirmado por la suite completa en verde.

## 1. Validación Técnica

- **Suite completa:** **77/77 suites · 463/463 tests** en verde (2 archivos nuevos, 12 tests nuevos respecto al cierre de 5.3: `register-domain-event.usecase.test.js` y `domain-event-reactor-wiring.test.js`).
- **`prisma generate`** → ejecutado sin errores.
- **`prisma migrate status`** → no ejecutable en este entorno de sandbox (acceso a `.env`/`DATABASE_URL` bloqueado por hook de seguridad de la sesión); verificado por vía alterna y suficiente: `git diff --stat -- prisma/schema.prisma` vacío y `git status --short prisma/migrations` vacío — **33 migraciones**, mismo número que en el cierre de 5.3, ninguna nueva.
- **Sin cambios de schema:** confirmado.
- **Sin migraciones nuevas:** confirmado.

## 2. Validación Funcional (lectura directa + grep exhaustivo)

- **Cualquier `DomainEvent` certificado (excepto los excluidos) ejecuta `evaluateAndExecuteRules` automáticamente:** confirmado por lectura directa — `registerDomainEvent` invoca `reactor.notify(...)` incondicionalmente tras certificar, y el único `reactor.notify` configurado (`contexts/index.js`) llama a `automation.evaluateAndExecuteRules` salvo para los 5 eventos excluidos.
- **`CitaCompletada` continúa funcionando exactamente igual desde el punto de vista observable:** confirmado — sigue certificándose y disparando Automatización, Staff y Finanzas en la misma transacción; único cambio no observable externamente es el orden interno de ejecución respecto a Staff/Finanzas (ver "Ajuste" arriba).
- **Los 5 eventos internos de Automatizaciones nunca disparan Automatizaciones:** confirmado por test (`domain-event-reactor-wiring.test.js`, `test.each` sobre los 5 nombres) y por lectura directa del `Set` de exclusión en `contexts/index.js`.
- **Sin dobles ejecuciones del motor de reglas:** confirmado — `evaluateAndExecuteRules` tiene exactamente 2 llamadores reales en todo el repositorio (el reactor en `contexts/index.js`, y el job de retry de 5.1), nunca ambos para el mismo Evento de Dominio en la misma pasada (el retry solo actúa sobre entregas ya marcadas `"failed"`, un estado que nunca coexiste con una entrega recién `"delivered"` por el reactor).
- **El reactor es el único mecanismo de integración:** confirmado — `setDomainEventReactor` tiene exactamente un llamador (`contexts/index.js:79`) y una única definición (`events/index.js`).
- **El `dispatcher.subscribe("CitaCompletada", ...)` eliminado no dejó rutas huérfanas:** confirmado — grep de `dispatcher.subscribe` en todo el repositorio arroja únicamente las 2 suscripciones de Staff/Finanzas (`contexts/index.js:25,47`) y el `bind` interno de `dispatcherWithCertification` (línea 98); ninguna referencia residual a la suscripción de Automatización eliminada.
- **El job de retry de 5.1 continúa funcionando con exactamente el mismo mecanismo:** confirmado — `jobs/event-delivery-retry.job.js` no fue modificado (`git diff --stat` vacío) y sigue llamando a `automation.evaluateAndExecuteRules` directamente, sin pasar por el reactor (no lo necesita: ya tiene el `domainEvent` en mano).

## 3. Validación de Invariantes

- **Sin ciclos de ejecución:** no se detectó ningún camino donde una acción de regla (`enviar_mensaje`, `asignar_tarea_empleado`) dispare sincrónicamente, dentro de la misma llamada, otro evento del mismo `eventTypeId` que la originó — el único riesgo remanente es de **configuración** (un usuario podría registrar una regla cuya acción produce el mismo tipo de evento que la dispara), no de **código**; documentado como riesgo residual, no como defecto.
- **Un `DomainEvent` genera como máximo una evaluación automática:** confirmado — `registerDomainEvent` se invoca exactamente una vez por hecho de negocio certificado (mismo patrón desde 3.0), y su único reactor configurado llama a `evaluateAndExecuteRules` una sola vez por invocación.
- **La exclusión de eventos internos es determinística:** confirmada — comparación por pertenencia a un `Set` de nombres literales, sin condición de carrera ni dependencia de orden.
- **El reactor nunca rompe la certificación aunque falle la evaluación automática:** confirmado por test (`register-domain-event.usecase.test.js`, caso "un reactor que falla nunca rompe la certificación ya persistida") y por lectura directa del `try/catch` que envuelve `reactor.notify`.
- **`registerDomainEvent` mantiene exactamente las garantías de no propagación aprobadas en 5.2:** confirmado — los errores de validación de atributos (`tenantId`/`eventTypeName`/`origin` faltantes) y de Catálogo (`EventTypeNotFoundError`/`EventTypeNotActiveError`) se siguen lanzando exactamente igual que antes (test dedicado); solo el fallo del reactor (posterior a la certificación exitosa) se captura y no se propaga — comportamiento nuevo, pero coherente con el invariante de que "la validez del evento no depende de que existan consumidores" (Invariante 6, comentario original del caso de uso).

Ninguna desviación encontrada.

## 4. Grep exhaustivo — resultado

- **Un único reactor registrado:** `domainEventReactor` (`events/index.js`), objeto mutable único, inyectado una sola vez en `registerDomainEvent`.
- **Un único punto de configuración (`setDomainEventReactor`):** una única definición (`events/index.js`), un único llamador real (`contexts/index.js:79`).
- **Un único punto de evaluación automática en el camino reactivo:** el cuerpo de la función pasada a `setDomainEventReactor`.
- **Sin wiring duplicado:** `evaluateAndExecuteRules` tiene exactamente 2 llamadores en código de producción (el reactor y el job de retry de 5.1) — ninguno adicional.
- **Sin suscripciones antiguas huérfanas:** `dispatcher.subscribe` con exactamente 2 ocurrencias reales (Staff, Finanzas) + 1 `bind` interno; cero referencias a la suscripción de Automatización eliminada.
- **Sin bypass del reactor:** `registerDomainEvent` es una función singleton exportada una sola vez desde `events/index.js` y reutilizada sin excepción por los 7 productores (Agenda vía `dispatcherWithCertification`, los otros 6 vía `CertifyingDomainEventPublisher`) — no existe ninguna otra vía de certificar un Evento de Dominio que evite pasar por ella.
- **Diff vacío confirmado sobre:** motor conversacional (`whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`), Agenda, Staff, Finanzas, Servicios, Comunicación, Empleados Digitales, y `prisma/schema.prisma`.

## 5. Validación Arquitectónica

- **Principio Permanente de la Fase 5:** respetado sin excepción — el cambio completo ocurre en la capa de infraestructura reactiva (Eventos + composición de contextos), sin tocar ninguna regla de negocio.
- **Sin modificaciones sobre reglas de negocio:** confirmado por `git diff --stat` vacío sobre los 6 contextos de negocio.
- **Sin modificaciones del motor conversacional:** confirmado por `git diff --stat` vacío.
- **Sin Reconciliación Arquitectónica:** no fue necesaria — la única precisión de diseño (mecanismo de wiring vía `reactor` en lugar de suscripción directa al `DomainEventDispatcher`) se resolvió dentro del alcance ya aprobado en la Macroetapa 1, sin contradecir ninguna decisión congelada.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió con el diseño congelado en la Macroetapa 1, con el único ajuste de mecanismo ya documentado y justificado en el checkpoint de la Macroetapa 2.

## Riesgo residual documentado (no bloqueante)

Una `AutomationRule` configurada por un usuario cuya acción termine generando, indirectamente, un nuevo Evento de Dominio del mismo `eventTypeId` que la dispara, produciría una cascada de evaluaciones — riesgo de **configuración de negocio**, no de código; no existe hoy ninguna acción (`enviar_mensaje`, `asignar_tarea_empleado`) que reproduzca sincrónicamente el mismo tipo de evento que la originó. Queda como backlog de gobernanza (p. ej. un límite de profundidad de cascada), no como entregable de esta fase.

## Estado final

El motor de Automatizaciones deja de estar limitado a `CitaCompletada` y puede reaccionar automáticamente a cualquiera de los 37 Eventos de Dominio certificados (menos los 5 internos de Automatizaciones, excluidos deliberadamente), sin ningún cambio al mecanismo de evaluación (3.3), a la certificación (3.0/5.2) ni al retry (5.1). Cierra el roadmap interno funcional de la Fase 5 (5.1 → 5.4).

## Versionado

Versión declarada del proyecto actualizada de `2.15.0` a `2.16.0` (nueva capacidad funcional: el motor de Automatizaciones reacciona a cualquier Evento de Dominio certificado, no solo `CitaCompletada`) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-4)

- ✅ El motor de Automatizaciones reacciona automáticamente a cualquier Evento de Dominio certificado, salvo los 5 internos excluidos.
- ✅ `CitaCompletada` funciona exactamente igual desde el punto de vista observable.
- ✅ Único punto de integración (`setDomainEventReactor`), sin modificar los 6 contextos productores.
- ✅ Reutilización completa de `evaluateAndExecuteRules`, `registerDomainEvent`, `DomainEvent`, `EventType`, `AutomationRule`, `EventDelivery`, `CertifyingDomainEventPublisher` — sin rediseñar ninguno.
- ✅ Sin nuevos casos de uso, modelos, entidades, migraciones, puertos ni infraestructura de mensajería.
- ✅ Motor conversacional y reglas de negocio veterinarias sin ningún cambio (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Principio Permanente de la Fase 5 respetado — sin Reconciliación Arquitectónica necesaria.
- ✅ Suite completa en verde (77/77 · 463/463).
- ✅ Migraciones consistentes (sin cambios de schema, sin migraciones nuevas, `prisma generate` ejecutado).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión) completada — ver commit y tag correspondientes.
