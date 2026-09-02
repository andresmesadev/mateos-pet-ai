# Entregable 8.3 — Modelado de Estado

**Fecha de cierre:** 2026-09-02
**Fase:** Fase 8 — Calidad del Motor Conversacional (tercer y último entregable del roadmap interno)
**Estado:** ✅ Completado
**Reconciliación Arquitectónica habilitante:** ADR 010 (misma autorización de 8.1/8.2)
**Gate Review:** `docs/history/ENTREGABLE_8_3_GATE_REVIEW.md`

---

## Objetivo del entregable

Cerrar D-E1 (transiciones de `session.step` no validadas) y D-E2 (tres fuentes de verdad para "esperando humano"), con el alcance reconciliado en el Gate Review tras auditar el estado real del código — más angosto que lo que describía el informe externo, con evidencia concreta de por qué.

## Resumen de implementación

- **D-E1:** `STEPS` (`conversation.service.js`) ganó `HUMAN_TAKEOVER: "human_takeover"` — antes vivía como string literal fuera del enum (línea de detección de transferencia a humano), exactamente el bug que el informe describe. `session-steps.service.js` (nuevo) expone `isValidStep`/`assertValidStep`: vocabulario cerrado, no tabla de transiciones `from→to` — la auditoría de la Macroetapa 1 confirmó que el wizard es intencionalmente interrumpible desde cualquier paso (cancelar, hablar con un humano, saludar), así que una tabla estricta habría prohibido resets legítimos. `assertValidStep` registra (no bloquea) — sin cobertura exhaustiva de cada camino del wizard, rechazar en duro arriesgaba cortar un flujo legítimo no identificado en esta auditoría. `memory.service.js` (`updateSession`, único choke point de escritura de sesión) invoca `assertValidStep` antes de fusionar.
- **D-E2 (parcial, según lo reconciliado):** auditoría encontró que el escalamiento de `Conversation.status` ya tenía una FSM real de dos estados con transiciones validadas desde el Entregable 3.1 (`escalate-conversation.usecase.js`/`resolve-conversation-escalation.usecase.js`, con `ConversationAlreadyEscalatedError`/`ConversationNotEscalatedError`) — el informe externo no la vio por vivir fuera del motor legado. Lo que sí faltaba: la señal que dispara esa transición (`process-incoming-message.usecase.js`) dependía únicamente del flag legado `session.requires_human_attention`. Reforzada para considerar también `session.step === STEPS.HUMAN_TAKEOVER` (inyectado como `humanTakeoverStep` desde el composition root, `contexts/receptionist/index.js`) — ambas señales ya existían, no se introdujo una tercera fuente.

## Alcance explícitamente reducido respecto al informe externo

- No se construyó una tabla de transiciones `from→to` (patrón de `session_transitions.py` de Sancho) — no encaja con el diseño intencional del wizard, documentado en el Gate Review.
- No se eliminó `session.requires_human_attention` — su eliminación completa toca `dashboard-conversation.service.js` y el payload que consume el dashboard, fuera de alcance de este entregable.
- `assertValidStep` no lanza excepción — es diagnóstico, no enforcement duro, por la misma razón de cobertura incompleta.

## Validación

- Suite completa del backend: **110/110 suites · 708/708 tests** (2 archivos nuevos: `session-steps.service.test.js`; caso nuevo en `process-incoming-message.usecase.test.js` cubriendo el refuerzo D-E2 en aislamiento — `requires_human_attention: false` con `step === humanTakeoverStep`).
- Grep exhaustivo: `git diff --stat -- prisma/` vacío (sin cambios de schema en este entregable); único string literal `"human_takeover"` restante en producción es el valor por defecto del parámetro `humanTakeoverStep` en la firma del caso de uso — mismo valor que la constante, no un bypass del enum; cambios en `contexts/` confinados exclusivamente al wiring de `receptionist` (composition root + caso de uso), sin tocar `communication` ni ningún otro contexto.
- Desplegado a VPS; `/api/health` verificado tras el build.
- Principio Permanente de la Fase 8 respetado: sin regla de negocio nueva; el motor conversacional solo ganó un choke point de diagnóstico no bloqueante.

## Estado final

Cierra el roadmap interno completo de la Fase 8 (8.1 → 8.3). El motor conversacional ahora: envía historial real al LLM, deduplica webhooks, procesa todos los mensajes de un batch, no depende del RAG para responder, reintenta ante fallos transitorios, serializa por remitente, tiene cola durable, y valida el vocabulario de sus pasos con diagnóstico explícito. Deuda explícitamente diferida y documentada a lo largo de la fase: gobierno de memoria semántica (D-M3), TTL de sesión (D-M4), compactación de historial largo (D-M2), eliminación completa de `requires_human_attention`, lock de Postgres si el proyecto escala horizontalmente.

## Versionado

Versión declarada del proyecto actualizada de `2.34.0` a `2.35.0` (tercer y último entregable de la Fase 8) en `backend/package.json`, `health.service.js` y `health.controller.js`.

## Criterio de cierre cumplido

- ✅ D-E1 y D-E2 corregidos con el alcance reconciliado y documentado.
- ✅ Cambios en `contexts/` confinados a `receptionist` (wiring), sin tocar `communication` ni otros contextos.
- ✅ Sin cambios de schema.
- ✅ Suite completa en verde (110/110 · 708/708).
- ✅ Desplegado y verificado en VPS.
- ✅ Reconciliación Arquitectónica (ADR 010) respetada — decisiones de alcance tomadas con evidencia real (auditoría de la Macroetapa 1), no copiando el patrón de Sancho sin verificar que encajara.
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.35.0`).
- ✅ **Fase 8 completa (8.1 → 8.3).**
