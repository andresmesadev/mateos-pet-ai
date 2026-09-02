# Entregable 8.2 — Concurrencia y Durabilidad

**Fecha de cierre:** 2026-09-02
**Fase:** Fase 8 — Calidad del Motor Conversacional (segundo entregable del roadmap interno)
**Estado:** ✅ Completado
**Reconciliación Arquitectónica habilitante:** ADR 010 (misma autorización de 8.1)
**Gate Review:** `docs/history/ENTREGABLE_8_2_GATE_REVIEW.md`

---

## Objetivo del entregable

Cerrar D-E3 (sin exclusión mutua entre mensajes concurrentes del mismo remitente) y D-F1 (procesamiento inline sin cola durable) — y, descubierto al diseñar, la regresión real que 8.1 introdujo: con deduplicación de webhook activa, un crash del proceso entre persistir el mensaje del cliente y responderle deja el mensaje sin ninguna vía de recuperación, porque un reintento de Meta ya se descarta por `wamid`.

## Resumen de implementación

- **D-E3 (exclusión mutua):** `phone-lock.service.js` (nuevo) — mutex en memoria por remitente (`Map<phone, Promise>`), no un advisory lock de PostgreSQL. Decisión tomada en el Gate Review tras verificar por inspección directa que el backend corre una única instancia en el VPS — un lock `_xact_` de Postgres habría exigido envolver todo `processSingleIncomingMessage` (~15 llamadas Prisma independientes) en una única transacción, la reescritura que el principio de la Fase 3 existe para evitar. `whatsapp.service.js` invoca `runExclusive(parsed.from, ...)` alrededor de cada mensaje procesado — único punto de edición del motor. Lock de Postgres queda como Decisión Arquitectónica Diferida explícita, condicionada a evidencia real de escalado horizontal.
- **D-F1 (cola durable):** `InboundJob` (modelo nuevo, sin relación con `Message`/`Conversation`) + `inbound-job.service.js` (encolado idempotente por `(provider, providerEventId)`, reclamo atómico vía `FOR UPDATE SKIP LOCKED`, marcado done/failed con reintento hasta `MAX_ATTEMPTS=5`). `webhook.controller.js` reescrito: ya no procesa inline — usa `parseIncomingMessage` (sin efectos secundarios, solo para obtener el wamid) para encolar y responde 200 de inmediato. `jobs/inbound-message.job.js` (nuevo, mismo patrón `node-cron` que `event-delivery-retry.job.js` de 5.1, intervalo de 5s con drenado completo por tick) reclama y ejecuta `processIncomingMessage` — el mismo pipeline de siempre, sin duplicar lógica — y hereda el envío de respuesta vía `communication.sendMessage` que antes vivía en el controlador.

## Cambios de esquema

- `prisma/schema.prisma`: modelo `InboundJob` nuevo — `@@unique([provider, providerEventId])`, `@@index([status, createdAt])`. Aplicado vía `prisma db push --accept-data-loss` (tabla nueva, sin advertencia real de pérdida de datos). `prisma generate` sincronizado, local y en el build del contenedor VPS.

## Validación

- Suite completa del backend: **109/109 suites · 702/702 tests** (3 nuevos archivos: `phone-lock.service.test.js`, `inbound-message.job.test.js`, y `webhook-receptionist-wiring.test.js` reescrito para el nuevo contrato de encolado — hereda las mismas verificaciones de wiring hacia Comunicación que antes vivían en el controlador, ahora contra el worker).
- Grep exhaustivo: `git diff --stat -- src/contexts/` vacío — cero cambios en los bounded contexts de negocio; único llamador nuevo de `communication.sendMessage` es `jobs/inbound-message.job.js` (el resto de llamadores son productores preexistentes, sin cambios); `git diff --stat -- prisma/` solo el modelo `InboundJob`.
- Desplegado a VPS; `/api/health` responde `{"database":"ok","openai":"ok"}`; logs de arranque confirman `[InboundMessageJob] Scheduled every 5 seconds`, sin errores.
- Principio Permanente de la Fase 8 respetado: ninguna regla de negocio nueva; el motor conversacional (`whatsapp.service.js`) solo recibió la envoltura del mutex alrededor de una llamada ya existente.

## Estado final

El motor conversacional ya no pierde mensajes por procesamiento concurrente del mismo remitente ni por crash a mitad de turno — el encolado durable convierte cualquier fallo transitorio (crash, timeout, error de OpenAI) en un reintento automático del worker, en vez de una pérdida silenciosa. Cierra el roadmap funcional planteado en el Gate Review de 8.1 para este bloque. Pendiente, sin fecha: 8.3 (Modelado de Estado — FSM explícita).

## Versionado

Versión declarada del proyecto actualizada de `2.33.0` a `2.34.0` (nueva capacidad funcional: cola durable + exclusión mutua, segundo entregable de la Fase 8) en `backend/package.json`, `health.service.js` y `health.controller.js` — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ D-E3 y D-F1 corregidos, más la regresión de 8.1 (mensaje irrecuperable tras dedup) cerrada como efecto directo del diseño.
- ✅ Ningún cambio en `contexts/` (verificado por `git diff --stat`).
- ✅ Motor conversacional tocado en un único punto mínimo (`runExclusive` alrededor de una llamada existente).
- ✅ Suite completa en verde (109/109 · 702/702).
- ✅ Desplegado y verificado en VPS (`/api/health` ok, worker programado).
- ✅ Reconciliación Arquitectónica (ADR 010) respetada — decisiones de infraestructura (mutex vs. lock de Postgres) tomadas con evidencia real del despliegue, no por copiar el patrón de Sancho sin adaptarlo.
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.34.0`).
