# Entregable 8.4 — Reintento de Envío (D-F6)

**Fecha de cierre:** 2026-09-02
**Fase:** Fase 8 — Calidad del Motor Conversacional (extensión posterior al cierre de 8.1-8.3)
**Estado:** ✅ Completado
**Reconciliación Arquitectónica:** ninguna requerida — no toca el motor conversacional protegido ni `contexts/`, solo `jobs/inbound-message.job.js` (infraestructura de 8.2).

---

## Objetivo del entregable

Cerrar D-F6 del informe externo: un fallo de `sendMessage` (contexts/communication) se registraba por consola y se descartaba en silencio — el `InboundJob` quedaba `done` (el análisis sí ocurrió) pero el cliente nunca recibía su respuesta y nada la reintentaba.

## Decisión de diseño

Reintentar el **job completo** (reprocesar `processIncomingMessage` desde cero) habría sido incorrecto: el pipeline no es idempotente para efectos secundarios como crear una mascota o una cita — reintentar todo el análisis solo porque el envío falló arriesgaba duplicarlos. El reintento se acotó exclusivamente al envío: hasta `MAX_SEND_ATTEMPTS = 3` intentos con backoff corto (1s, 2s), dentro de la misma ejecución del job, en `jobs/inbound-message.job.js` (`deliverReply`). Un fallo permanente (token inválido, número inexistente) seguiría fallando igual en un reintento del job completo, así que diferirlo no habría ganado nada — solo cubre el caso real: fallas transitorias de Meta o de red.

## Validación

- Suite completa del backend: **110/110 suites · 709/709 tests** (2 casos nuevos en `inbound-message.job.test.js`: reintento agotado tras 3 fallos persistentes, y recuperación al tercer intento tras 2 fallos transitorios — con `jest.useFakeTimers()` para no alargar la suite con los backoffs reales).
- Sin cambios de schema, sin cambios en `contexts/` ni en el motor conversacional.
- Desplegado a VPS; `/api/health` verificado.

## Estado final

El envío de la respuesta al cliente ahora tolera fallas transitorias del proveedor de WhatsApp sin intervención manual. D-F6 queda cerrado; el resto del backlog identificado en la Fase 8 (D-M2, D-M3, D-M4, D-E6, D-M5, D-F3, D-F5, Zod, versionado de prompts, credenciales globales) permanece diferido explícitamente, sin evidencia de urgencia real al volumen actual del producto.

## Versionado

Versión declarada del proyecto actualizada de `2.35.0` a `2.36.0` en `backend/package.json`, `health.service.js` y `health.controller.js`.
