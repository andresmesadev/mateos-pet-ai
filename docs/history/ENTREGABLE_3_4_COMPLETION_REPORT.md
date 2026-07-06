# Cierre del Entregable 3.4 — Recepcionista IA

**Fecha de cierre:** 2026-07-06
**Fase:** Fase 3 — Empleados Digitales Especializados (en curso)
**Estado:** ✅ Completado
**Proceso aplicado:** proceso de macroetapas de Fase 3 (Auditoría → Diseño Etapas 1-5 → Gate Review → Implementación completa → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_3_4_GATE_REVIEW.md`
**Diseño de referencia (congelado, sin cambios de fondo durante la implementación):** `docs/architecture/use-cases/recepcionista-ia.md`, `docs/architecture/technical-design/recepcionista-ia*.md`

---

## Objetivo del entregable

Convertir el motor conversacional de WhatsApp — ya funcional y probado desde Fase 1 — en un **Empleado Digital real**: cada mensaje entrante procesado por "Lina" (la Recepcionista) produce ahora una Tarea, una Decisión auditable y, cuando corresponde, una Escalación real y visible en el dashboard. El motor no se reescribió; se le dio un actor de dominio con auditoría.

## Resumen de implementación

Se implementó el contexto `receptionist` (sin capa de dominio propia ni entidades nuevas — por diseño), que envuelve el motor conversacional existente mediante `LegacyWhatsappEngineAdapter` y orquesta el ciclo Tarea → Decisión → (Completar | Escalar) reutilizando exclusivamente casos de uso ya expuestos por Empleados Digitales (3.2) y Comunicación (3.1). Se resolvió la Decisión Diferida 1 del Gate Review de 3.2 (Escalación ↔ `Conversation.status`), cerrando una brecha funcional real confirmada durante la auditoría.

## Cambios realizados

**Sin esquema ni migración:** primer entregable de Fase 3 que no modifica `schema.prisma` — consistente con su naturaleza de orquestación pura (Etapa 4/5 del diseño congelado).

**Contexto `backend/src/contexts/receptionist/`:**
- `application/errors/receptionist-not-configured.error.js` — único error propio, condición operativa (falta de seed), no regla de negocio.
- `application/ports/conversational-engine-adapter.port.js` — frontera hacia el motor conversacional legado.
- `application/use-cases/process-incoming-message.usecase.js` — único caso de uso del contexto (Caso 1, Etapa 2).
- `infrastructure/engine/legacy-whatsapp-engine.adapter.js` — satisface el puerto delegando exclusivamente en `whatsapp.service.processIncomingMessage`.
- `infrastructure/engine/resolve-tenant-id.js` — resuelve el tenant antes de iniciar la Tarea, reutilizando `parseIncomingMessage`/`getTenantByPhone` ya existentes (ver Hallazgos).
- `index.js` — composition root; inyecta exclusivamente `agents.getDigitalEmployees/startAgentTask/registerAgentDecision/completeAgentTask/generateEscalation` y `communication.escalateConversation`, además de las clases de error públicas (`domain/errors`) de ambos contextos para los `instanceof` de control de flujo.

**Integración:** `webhook.controller.js` ya no importa `processIncomingMessage` de `whatsapp.service.js` — importa `contexts/receptionist`. Su llamada posterior a `communication.sendMessage` permanece idéntica (mismo contrato, mismo `conversationId` explícito).

**Seed operativo:** `scripts/seed-digital-employees.js`, mismo mecanismo que `scripts/seed-event-types.js` (3.0), pero usando el caso de uso ya expuesto `agents.registerDigitalEmployee` (no inserción directa por Prisma), consistente con la Etapa 4 del diseño congelado.

## Validación Técnica

- `prisma migrate status` → 31 migraciones, base de datos al día (sin cambios — este entregable no introdujo esquema). `prisma migrate diff` → sin diferencias.
- Suite completa: **60/60 suites · 377/377 tests** en verde (10 tests nuevos: 9 unitarios del caso de uso, 1 archivo de integración de wiring del webhook con 3 casos).
- Smoke-load de `contexts/receptionist` y `webhook.controller.js` → carga sin errores de resolución de módulos.
- **Grep exhaustivo confirma que `whatsapp.service.js` solo se invoca desde exactamente dos puntos**: `webhook.controller.js` (únicamente `verifyWebhookSignature`, verificación de firma) y `contexts/receptionist/infrastructure/engine/` (`legacy-whatsapp-engine.adapter.js` y `resolve-tenant-id.js`) — sin ningún otro punto del sistema llamándolo directamente.
- **Grep exhaustivo confirma que `contexts/receptionist` no importa nada de las capas internas (`application/`, `domain/`, `infrastructure/`) de `agents` ni de `communication`** — únicamente sus composition roots públicos (`require("../agents")`, `require("../communication")`) y sus taxonomías de error públicas (`domain/errors`, mismo patrón ya usado por las rutas de dashboard de ambos contextos).
- Verificado que `contexts/receptionist` no tiene directorio `domain/` ni `infrastructure/persistence/` — cero entidades, cero persistencia propia, confirmando la Etapa 1/4/5 del diseño congelado.

## Validación Funcional

- **Recepcionista IA opera exclusivamente como especialización de `DigitalEmployee`:** verificado que no se creó ninguna entidad ni tabla nueva; el contexto resuelve el agente filtrando `specialization === "recepcionista"` sobre `agents.getDigitalEmployees`, sin tocar el esquema ni los casos de uso de 3.2.
- **Sin bounded contexts nuevos fuera del aprobado:** un único contexto (`receptionist`), sin sub-contextos, tal como quedó congelado.
- **El motor conversacional permanece intacto:** `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `services/domain/intent-detector.service.js`, `services/domain/medical-auto-capture.service.js` no fueron modificados — verificado por ausencia de diffs en esos archivos.
- **Resolución de la brecha de escalamiento verificada por prueba:** el camino de escalamiento invoca `communication.escalateConversation` (idempotente ante `ConversationAlreadyEscalatedError`) y `agents.generateEscalation`, sin llamar a `completeAgentTask` en ese camino — invariante de cierre único de Tarea respetada.
- **Empleado pausado o no configurado:** el caso de uso no invoca el motor conversacional en ninguno de los dos casos — verificado por prueba (`engineSpy` no invocado).
- Sin regresión: la suite completa del backend (incluidas Fase 2, Puente, Eventos, Comunicación, Empleados Digitales, Automatizaciones) permanece en 377/377 tras la incorporación del contexto nuevo, el cambio de wiring en `webhook.controller.js` y el bump de versión.

## Hallazgos encontrados durante la implementación y su resolución

**Hallazgo 1 — Brecha de escalamiento confirmada (anticipada en la auditoría de la Macroetapa 1).** El código real nunca invocaba `communication.escalateConversation` al detectar una solicitud de atención humana — un cliente que pedía hablar con una persona no aparecía en `GET /escalations` del dashboard. **Resolución:** implementada exactamente según el diseño congelado (Etapa 3, sección 6); verificada por prueba.

**Hallazgo 2 — Detalle de implementación no especificado a nivel de código en la Etapa 3: orden de resolución del `tenantId`.** El diseño asumía `tenantId` conocido antes de invocar el motor, pero la resolución real ocurre *dentro* del motor (`getTenantByPhone`, vía `phone_number_id`). **Resolución:** se reutilizaron `parseIncomingMessage` y `getTenantByPhone` — ambos ya exportados y ya utilizados en el sistema — para resolver el tenant una vez, antes de delegar en el motor, sin duplicar lógica de negocio ni modificar el motor. No contradice ninguna decisión congelada; es una clarificación de un detalle de bajo nivel que la Etapa 3 no especificó.

**Hallazgo 3 — Limitación aceptada del motor conversacional actual (documentada, no corregida por diseño).** Cuando el Recepcionista no está configurado o está pausado, el mensaje entrante no se responde al cliente (solo se registra en logs y se responde 200 al webhook), porque enviar una respuesta de respaldo real exigiría resolver `user`/`conversation`, algo que hoy solo hace el motor internamente. Corregirlo habría exigido reimplementar parte de la lógica del motor fuera de él, contradiciendo la instrucción explícita de no reescribirlo. Se documenta como comportamiento de borde aceptado — mismo criterio que el Hallazgo 4 de 3.1.

Ninguno de los tres hallazgos generó Reconciliación Arquitectónica ni ADR nuevo.

## Estado final

El contexto Recepcionista IA está implementado, integrado y validado, sin ninguna entidad ni tabla nueva. Es el primer Empleado Digital real del sistema, operando exclusivamente a través de la infraestructura ya construida por 3.1/3.2. Las 5 Decisiones Diferidas del Gate Review permanecen registradas y sin resolver — no bloquean este cierre: (1) migración de la persistencia de recepción; (2) aplicación de Límite de Autonomía a acciones concretas; (3) certificación de eventos propios de Empleados Digitales en Eventos; (4) reubicación física del motor conversacional; (5) mapeo detallado hacia el Coordinador de Agenda IA (3.5).

## Versionado

Versión declarada del proyecto actualizada de `2.6.0` a `2.7.0` (nueva capacidad funcional: primer Empleado Digital real, Recepcionista IA) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Recepcionista IA opera exclusivamente como especialización de `DigitalEmployee`, sin entidades ni tablas nuevas.
- ✅ Sin bounded contexts nuevos fuera del aprobado.
- ✅ El motor conversacional permanece intacto y solo es consumido a través de `LegacyWhatsappEngineAdapter` (y `resolveTenantId`, mismo módulo legado, sin lógica de negocio propia).
- ✅ `webhook.controller.js` depende de `contexts/receptionist`, no del motor conversacional directamente.
- ✅ Cero llamadas directas al motor fuera de los dos puntos previstos (verificado por grep exhaustivo).
- ✅ Integración con Comunicación y Empleados Digitales reutiliza exclusivamente sus casos de uso públicos (verificado por grep exhaustivo — cero acceso a sus capas internas).
- ✅ Suite completa en verde (60/60 · 377/377).
- ✅ Versión del proyecto consistente entre código, documentación y endpoint de salud (`2.7.0`).
