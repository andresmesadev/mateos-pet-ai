# Entregable 8.1 — Contención y Memoria Conversacional

**Fecha de cierre:** 2026-09-02
**Fase:** Fase 8 — Calidad del Motor Conversacional (primer entregable del roadmap interno)
**Estado:** ✅ Completado
**Reconciliación Arquitectónica habilitante:** ADR 010, Opción A+B combinada
**Gate Review:** `docs/history/ENTREGABLE_8_1_GATE_REVIEW.md`

---

## Objetivo del entregable

Cerrar cinco carencias reales del motor conversacional, identificadas por un informe comparativo externo y verificadas línea por línea contra el código antes de aceptarse: mensajes del batch de Meta descartados, ausencia de deduplicación de webhook, respuesta generativa acoplada al RAG, sin reintentos ante error transitorio de OpenAI, y el historial de conversación nunca enviado al LLM.

## Resumen de implementación

- **D-E5 (mensajes del batch):** `whatsapp.service.js` — `normalizeIncomingMessage` extraído como función compartida; `parseIncomingMessages(body)` (nueva) itera `entry[]`/`changes[]`/`messages[]` completos; `processSingleIncomingMessage` (renombrada, cuerpo idéntico al `processIncomingMessage` anterior) se invoca una vez por mensaje. `parseIncomingMessage` (singular) preservada sin cambios — sigue siendo el contrato de `resolve-tenant-id.js`. `processIncomingMessage(body)` es ahora el driver: procesa todos los mensajes del batch en orden (cada uno persiste y actualiza sesión), retorna el resultado del último para preservar el contrato de una única respuesta por webhook hacia `webhook.controller.js`. Limitación documentada: los mensajes intermedios de un batch ya no se pierden, pero solo el último recibe respuesta enviada — resolverlo del todo exigiría cambiar el contrato de respuesta única del controlador, fuera de alcance de este entregable.
- **D-F4 (respuesta acoplada al RAG):** el guard real vivía en `conversation.service.js:595` (`if (!contextText || shouldUseRuleReplyOnly(...))`), no solo en `openai.service.js` como describía el informe externo — corregido en ambos puntos. Un cliente sin contexto semántico ahora intenta redactar con IA igual.
- **D-F2 (reintentos OpenAI):** `getClient()` en `openai.service.js` instancia el SDK con `maxRetries: 2`.
- **D-E4 (deduplicación de webhook):** `Message.externalId String? @unique` (migración vía `prisma db push`, sin tabla nueva). `findMessageByExternalId` (nuevo, `conversation-persistence.service.js`) consultado al inicio de `processSingleIncomingMessage`, antes de cualquier efecto secundario (transcripción, LLM, persistencia) — un reintento de Meta por timeout corta ahí. `wamid` (`message.id` de Meta) transportado desde `normalizeIncomingMessage` hasta `persistUserMessage`/`saveMessage`.
- **D-M1 (historial al LLM):** `context-builder.service.js` (nuevo) — función pura, sin acceso a BD, que recorre el historial newest→oldest acumulando contra un presupuesto de caracteres (ventana: 20 mensajes / 6000 caracteres, fijada con evidencia real del volumen actual — máx. 27 mensajes por conversación, promedio 43 caracteres por mensaje). Diseño inspirado en `context_builder.py` de Sancho Agent IA (ver ADR 010), reescrito desde cero en JS. `whatsapp.service.js` lee `getConversationMessages(conversation.id)` (ya existía, nunca antes consultada para esto), excluye el mensaje actual (ya persistido antes de este punto) y pasa el historial a `analyzeMessage`/`generateReply`. `openai.service.js` inserta el historial normalizado entre el `system` prompt y el mensaje actual en ambas llamadas al SDK.

## Cambios de esquema

- `prisma/schema.prisma`: `Message.externalId String? @unique` — aplicado vía `prisma db push --accept-data-loss` (advertencia esperada e inocua: la constraint nueva no colisiona porque todas las filas existentes tienen `externalId` nulo). `prisma generate` sincronizado, local y en el build del contenedor VPS.

## Decisiones Arquitectónicas Diferidas resueltas al implementar

Las tres señaladas en el Gate Review, resueltas con evidencia real de la base de datos antes de escribir código (no arbitrariamente):
1. Deduplicación: columna en `Message`, no tabla nueva — mínima huella.
2. Presupuesto de historial: 20 mensajes / 6000 caracteres.
3. Compactación (D-M2 del informe externo): diferida a 8.2 — con el volumen actual (máx. 27 mensajes por conversación), el truncado por presupuesto ya cubre el caso real; no hay nada que compactar todavía.

## Validación

- Suite completa del backend: **107/107 suites · 692/692 tests**, sin regresión, antes y después de cada bloque de cambios.
- Grep exhaustivo: `parseIncomingMessage` (singular) con exactamente su consumidor original (`resolve-tenant-id.js`) sin cambios de firma; `git diff --stat -- src/contexts/` vacío — cero cambios en los bounded contexts de negocio; `git diff --stat -- prisma/` solo la columna nueva.
- Desplegado a VPS (`docker compose up -d --build backend`); `/api/health` responde `{"database":"ok","openai":"ok"}`; logs de arranque sin errores.
- Principio Permanente de la Fase 8 respetado: ningún flujo de negocio nuevo, ninguna regla de dominio modificada — las cinco correcciones son de la capa de runtime (memoria, idempotencia, resiliencia), habilitadas explícitamente por el ADR 010.

## Estado final

Las cinco carencias del bloque "Contención y Memoria Conversacional" quedan corregidas: el motor conversacional ahora procesa todos los mensajes de un batch de Meta, deduplica reintentos de webhook, genera respuesta con IA incluso sin RAG, reintenta ante error transitorio de OpenAI, y envía el historial real de la conversación al LLM en cada llamada. Fuera de alcance, diferido explícitamente a 8.2/8.3: locks de concurrencia (D-E3), cola durable (D-F1), FSM de estado (D-E1/D-E2), gobierno de memoria semántica (D-M3), sesión sin TTL (D-M4), compactación de historial largo (D-M2).

## Versionado

Versión declarada del proyecto actualizada de `2.32.0` a `2.33.0` (nueva capacidad funcional: memoria conversacional real, primer entregable de la Fase 8) en los puntos que deben coincidir — `backend/package.json` y el endpoint de salud (`version` ya reportado por `health.controller.js` desde `package.json`) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Las cinco carencias (D-E5, D-F4, D-F2, D-E4, D-M1) corregidas y verificadas.
- ✅ Ningún cambio en `contexts/` (verificado por `git diff --stat`).
- ✅ Contrato externo del motor preservado (`processIncomingMessage(body)` sigue devolviendo un único resultado; `parseIncomingMessage` singular intacto para su consumidor).
- ✅ Suite completa en verde (107/107 · 692/692).
- ✅ Desplegado y verificado en VPS (`/api/health` ok).
- ✅ Reconciliación Arquitectónica (ADR 010) documentada, aceptada y respetada — ningún cambio de dominio ni de regla de negocio.
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.33.0`).
