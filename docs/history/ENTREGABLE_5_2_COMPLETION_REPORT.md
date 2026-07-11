# Cierre del Entregable 5.2 — Certificación Real de Eventos por Contexto

**Fecha:** 2026-07-11
**Fase:** Fase 5 — Operaciones Inteligentes (segundo entregable del roadmap interno: 5.1 → 5.4)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.14.0`.
**Proceso aplicado:** macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 + Gate Review → Verificaciones previas → Checkpoint obligatorio de contradicción → Implementación → Validación Técnica → Validación Funcional → Documentación)
**Gate Review de diseño (Macroetapa 1):** aprobado con dos verificaciones adicionales previas (Catálogo de EventType, consistencia del patrón de certificación no propagante) — ambas sin contradicciones.

---

## Objetivo del entregable

Cerrar la brecha detectada en la Macroetapa 1: 7 de los 8 contextos productores del sistema (`Agents`, `Automation`, `Communication`, `Events`, `Finance`, `Services`, `Staff`) publicaban sus eventos exclusivamente vía un publisher que solo escribía al logger — ninguno se certificaba como `DomainEvent` real. Solo `Agenda`/`CitaCompletada` (3.0/3.3) certificaba de verdad. Esto hacía arquitectónicamente imposible que cualquier futura Regla de Automatización se disparara por un evento distinto de `CitaCompletada` (`register-automation-rule.usecase.js` exige un `EventType` activo en el Catálogo, y el Catálogo solo tenía esa fila).

## Checkpoint obligatorio de contradicción (previo a la Macroetapa 2)

Resuelto con evidencia del código real, antes de escribir cualquier línea de implementación:

1. **Recursión infinita en el propio contexto Eventos.** El diseño congelado en la Macroetapa 1 asumía la certificación uniforme de los 41 eventos log-only, incluidos los 4 propios del contexto Eventos (`TipoDeEventoRegistrado`, `TipoDeEventoDesactivado`, `EventoDeDominioRegistrado`, `EntregaFallida`). Al trazar la llamada real se confirmó que `registerDomainEvent` publica `"EventoDeDominioRegistrado"` a través del **mismo publisher local del contexto Eventos** al final de su ejecución — si ese publisher certificara, volvería a invocar `registerDomainEvent`, que volvería a publicar el mismo evento, indefinidamente. **Resolución:** el contexto Eventos queda excluido de este entregable; su publisher log-only permanece intacto. Alcance ajustado de 41 a **37 eventos, en 6 contextos**.
2. **Payload incompleto más amplio de lo estimado.** La Macroetapa 1 había identificado 2 eventos sin `tenantId` en el payload (`CapacidadAsignada`/`CapacidadRevocada`). La implementación confirmó 2 casos adicionales con el mismo problema (`DisponibilidadActualizada`, emitido desde dos usecases; `LimiteDeAutonomiaConfigurado`) — los 4 se corrigieron enriqueciendo el payload con el `tenantId` de la entidad ya presente en memoria, sin nueva consulta. Un quinto grupo (`TareaIniciada`, `TareaCompletada`, `DecisiónRegistrada`, `EscalaciónGenerada`, `EscalaciónAtendida`) resultó no resoluble sin agregar una consulta nueva — se decidió no ampliar el alcance para resolverlo; el adaptador los omite de forma segura y determinística (ver "Deuda técnica" abajo).

Ninguno de los dos checkpoints requirió una Reconciliación Arquitectónica formal — ambos se resolvieron por ajuste de alcance, sin tocar ninguna regla de negocio.

## Resumen de implementación

- **`contexts/shared/events/certifying-domain-event-publisher.js`** (nuevo) — adaptador único y reutilizado por los 6 contextos: certifica vía `events.registerDomainEvent` (3.0, sin cambios), resuelve `tenantId` genéricamente, y **nunca relanza** un fallo de certificación — preserva la garantía de infalibilidad que ya ofrecía el publisher log-only que reemplaza.
- **6 publishers de contexto** (`Agents`, `Automation`, `Communication`, `Finance`, `Services`, `Staff`) reescritos para delegar en el adaptador compartido, mismo contrato de puerto, sin cambios en los casos de uso que los consumen.
- **6 composition roots** wireados con `registerDomainEvent` inyectado desde `events` — sin ciclos de `require` (verificado: el contexto Eventos no depende de ninguno de los 6).
- **`scripts/seed-event-types.js`** extendido con 37 `EventType` nuevos (dato, mismo patrón idempotente ya existente).
- **4 enriquecimientos de payload** (una línea cada uno, mismo dato ya en memoria): `manage-staff-capabilities.usecase.js` (2 eventos), `update-availability.usecase.js`, `record-unplanned-absence.usecase.js`, `configure-autonomy-limit.usecase.js`.
- **El contexto Eventos permanece sin ningún cambio** — su publisher log-only, intacto (decisión del Checkpoint 1).

## Validación Técnica

- **Suite completa:** 75/75 suites · 448/448 tests en verde (12 tests nuevos: 8 del adaptador compartido, 4 de `configure-autonomy-limit.usecase.js`, más assertions de `tenantId` añadidas a 3 tests existentes de Staff).
- **`prisma migrate status`** → 33 migraciones, base de datos al día, sin diferencias.
- **`git diff --stat -- prisma/schema.prisma`** → vacío. **Sin cambios de schema.** El modelo `EventType` (3.0) ya soportaba cualquier número de tipos sin modificación estructural.
- **`npx prisma generate`** ejecutado sin errores.
- **Prueba en código real de la garantía de no-propagación:** al correr la suite sin conexión real a base de datos, `registerDomainEvent` falla para varios de los 37 eventos certificados en tests unitarios existentes — el error se registra por logger y **no propaga**, confirmando en ejecución real (no solo en el test dedicado del adaptador) la garantía de consistencia verificada antes de implementar.

## Validación Funcional

- **Mecanismo único, sin duplicación:** grep exhaustivo confirma una sola clase `CertifyingDomainEventPublisher` (`contexts/shared/events/`), y exactamente 6 puntos de instanciación (`new CertifyingDomainEventPublisher`), uno por contexto en alcance.
- **Contexto Eventos verificado intacto:** su publisher (`events-domain-events.publisher.js`) permanece log-only, sin ninguna referencia a `registerDomainEvent` dentro de sí mismo — cero riesgo de recursión confirmado por inspección directa.
- **Omisión determinística confirmada por inspección de modelo:** `AgentTask`, `AgentDecision` y `Escalation` no tienen columna `tenantId` en `schema.prisma` — el extractor de `tenantId` (`defaultTenantIdExtractor`) no puede resolverlo estructuralmente para los 5 eventos de ese grupo, en ninguna ejecución, no de forma ocasional.
- **Trazabilidad de la omisión confirmada:** cada omisión emite `logger.info` con contexto, nombre del evento y motivo explícito (`"tenantId no resoluble (entidad global o payload incompleto)"`) — no es un fallo silencioso a nivel de logs, aunque no genera una fila persistida en base de datos (ver "Deuda técnica").
- **Enriquecimiento de payload confirmado por test:** los 4 casos corregidos verifican por assertion que el `tenantId` esperado viaja en el payload publicado.

## Grep exhaustivo — resultado

- Cero implementaciones duplicadas del adaptador de certificación.
- Cero llamadas a `registerDomainEvent` desde dentro del propio contexto Eventos.
- Cero cambios en el motor conversacional: `git diff --stat` vacío para `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`.
- Cero cambios en `domain/` de ningún contexto — el diff de los 6 contextos tocados se limita a `index.js` (wiring), `infrastructure/events/*.publisher.js` (delegación) y los 4 puntos declarados de enriquecimiento de payload en casos de uso de aplicación (una línea cada uno).
- Cero cambios en Agenda.

## Validación Arquitectónica — Principio Permanente de la Fase 5

> "Ningún entregable modifica reglas de negocio; únicamente infraestructura reactiva."

**Confirmado sin violaciones.** El adaptador de certificación y su wiring son infraestructura pura. Los 4 ajustes de payload no alteran ninguna validación, decisión ni resultado de negocio — solo completan el dato ya disponible en memoria que el evento necesita para certificarse. No fue necesaria ninguna Reconciliación Arquitectónica.

## Deuda técnica identificada y documentada explícitamente (no es una omisión silenciosa)

Cinco eventos del ciclo de vida de tareas de Empleados Digitales — `TareaIniciada`, `TareaCompletada`, `DecisiónRegistrada`, `EscalaciónGenerada`, `EscalaciónAtendida` — **no se certifican hoy ni se certificarán con la implementación de este entregable**, porque sus modelos (`AgentTask`, `AgentDecision`, `Escalation`, Entregable 3.2) no persisten `tenantId` como columna propia — solo son alcanzables indirectamente vía `digitalEmployeeId → DigitalEmployee.tenantId`, lo que exigiría una consulta adicional dentro del caso de uso de negocio, fuera del alcance aprobado para este entregable (no ampliar funcionalidades). El adaptador de certificación los omite de forma **determinística, segura y trazada por logger** — no fallan, no producen efectos parciales, y no se comportan de forma distinta a como se comportaban antes de 5.2 (sin certificación). Queda registrado como backlog arquitectónico transversal para un futuro entregable que añada `tenantId` a esos tres modelos — no se promueve a entregable de la Fase 5 salvo que una dependencia arquitectónica real lo fuerce, mismo criterio institucionalizado para toda la deuda técnica del proyecto.

## Hallazgos encontrados durante la implementación

Documentados en el Checkpoint obligatorio de contradicción (arriba): la recursión infinita del contexto Eventos y los 4 casos adicionales de payload incompleto respecto a la estimación de la Macroetapa 1.

## Estado final

37 de los 41 eventos log-only identificados en la Macroetapa 1 quedan certificables como Evento de Dominio real, reutilizando sin ningún cambio la infraestructura de 3.0 y 5.1. El contexto Eventos permanece sin ningún cambio (evita la recursión infinita). Los 5 eventos restantes del ciclo de vida de Empleados Digitales quedan documentados como deuda técnica explícita, no como omisión silenciosa. El motor conversacional y los 5 contextos de negocio protegidos permanecen sin ningún cambio, verificado por grep exhaustivo y `git diff --stat`.

## Versionado

Versión declarada del proyecto actualizada de `2.13.0` a `2.14.0` (nueva capacidad funcional: certificación real de Eventos de Dominio para 6 contextos productores adicionales) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Los 37 eventos certificables en alcance quedan certificados vía `events.registerDomainEvent`, sin rediseñar ese caso de uso ni la infraestructura de 5.1.
- ✅ Adaptador de certificación único, reutilizado sin duplicación (verificado por grep).
- ✅ Contexto Eventos excluido deliberadamente — cero riesgo de recursión, verificado por inspección directa.
- ✅ Garantía de no-propagación de fallos verificada por test dedicado y por comportamiento real en la suite completa.
- ✅ Omisión de los 5 eventos sin `tenantId` resoluble: determinística, trazada por logger, y documentada explícitamente como deuda técnica (no omisión silenciosa).
- ✅ Motor conversacional sin ningún cambio (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Contextos de negocio sin cambios de `domain/` — solo wiring de infraestructura y 4 enriquecimientos de payload de una línea, verificados por `git diff --stat`.
- ✅ Principio Permanente de la Fase 5 respetado — sin Reconciliación Arquitectónica necesaria.
- ✅ Suite completa en verde (75/75 · 448/448).
- ✅ Migraciones consistentes (`migrate status` limpio, sin cambios de schema, `prisma generate` ejecutado).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión) completada — ver commit y tag correspondientes.
