# Cierre del Entregable — Trazabilidad Mínima (B5)

**Bloque:** Ecosistema (post-Fase 6) — noveno entregable, derivado de la Auditoría Integral v2 (`AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP_V2.md`, hallazgo B5).
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.31.0`.
**Naturaleza del entregable:** logging estructurado del evento de revocación (`POST /auth/logout`, `POST /api-keys/:id/revoke`) — Alcance A únicamente. Alcance B (atribución por staff individual) explícitamente diferido.

---

## Objetivo del entregable

Cerrar la brecha detectada en la Auditoría Integral v2: los caminos de éxito de revocación de `ApiKey` y logout de cliente no dejaban ningún rastro estructurado, a diferencia de `apiKeyAuth.js`/`clientAuth.js`, que sí registran `logger.info` en sus propios flujos.

## Diseño congelado (Macroetapa 1)

- **Checkpoint de contradicción central, resuelto en Macroetapa 1:** la atribución "quién revocó" para `ApiKey` (Alcance B) requeriría extender el contrato de headers confiables del proxy Next.js (`frontend/app/api/proxy/dashboard/[...path]/route.ts` + `resolveTenant.js`) y un modelo de identidad multi-staff que hoy no existe — confirmado que `frontend/auth.ts` usa una única credencial de admin por variables de entorno, sin ningún precedente en el proyecto de registrar un actor humano en una acción. Se decidió explícitamente **no** abordar esto en este entregable — mismo criterio del Alcance B diferido en Entregable 4.3.
- **Alcance A congelado (único implementado):** un `logger.info` en el camino de éxito de ambas rutas, mismo patrón ya usado por `apiKeyAuth`/`clientAuth`. Sin schema, sin frontend, sin nueva tabla de auditoría.
- Logout ya tenía trazabilidad completa por construcción (el actor es inequívocamente el dueño de la sesión) — el log solo añade visibilidad operativa, no cierra ninguna brecha de aislamiento nueva.

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Sin contradicciones nuevas.

## Resumen de implementación (Macroetapa 2)

**Archivos modificados (solo Alcance A):**
- `backend/src/routes/public-api.routes.js` — import de `logger` + `logger.info("[PublicApi] Sesión de cliente cerrada", { tenantId, userId, sessionId })` tras el `update` exitoso de `POST /auth/logout`.
- `backend/src/routes/dashboard/tenant.routes.js` — import de `logger` + `logger.info("[Dashboard] ApiKey revocada", { tenantId, apiKeyId })` tras el `update` exitoso de `POST /api-keys/:id/revoke`.

**Tests:** 2 tests existentes ampliados (no se crearon archivos nuevos) con `jest.spyOn(logger, "info")` para verificar mensaje y campos exactos en cada camino de éxito.

## 1. Validación Técnica

- **Suite completa:** **103/103 suites · 674/674 tests** en verde — mismo conteo que antes de este entregable (los 2 tests ampliados ya existían, no se añadieron tests nuevos), sin regresiones.
- `git diff --stat -- prisma/` vacío — sin cambios de schema, como correspondía al Alcance A.

## 2. Validación Funcional (grep exhaustivo)

- **Diff de producción limitado a exactamente lo diseñado:** `git diff` sobre los 2 archivos modificados muestra únicamente el import de `logger` y la línea de `logger.info` en cada uno — ninguna otra línea de comportamiento cambió.
- **`apiKeyAuth.js` y `clientAuth.js` sin ningún diff** — confirmado, el Alcance A no tocó la resolución de identidad, solo el registro posterior al éxito de la mutación.
- **Campos del log verificados exactamente:** `{ tenantId, userId, sessionId }` en logout; `{ tenantId, apiKeyId }` en revocación de `ApiKey` — ambos coinciden con el diseño congelado, sin campos adicionales ni faltantes.

## 3. Validación de Invariantes

- **Log invocado exactamente una vez por evento exitoso**, verificado por assertion exacta sobre el spy de `logger.info` en ambas rutas.
- **Sin cambio de comportamiento observable para el llamador:** las respuestas HTTP, códigos de estado y forma de las respuestas de ambas rutas permanecen idénticas a las del entregable anterior — confirmado por lectura del diff (el `logger.info` se inserta entre el `update` y la respuesta, sin alterar ninguna rama de control).
- **Alcance B no implementado:** confirmado — ningún campo de actor/staff se agregó a ningún modelo, ningún header nuevo se agregó a `resolveTenant.js`, ningún archivo de `frontend/` fue tocado.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — `git diff --stat` vacío sobre los 5 archivos protegidos.
- **`apiKeyAuth.js`/`clientAuth.js` sin modificar** — confirmado.
- **Sin duplicación de lógica de logging** — mismo patrón (`logger.info(mensaje, meta)`) ya usado en el resto del proyecto, sin una nueva abstracción.
- **Sin cambios de schema ni migraciones.**
- **Sin Reconciliación Arquitectónica** — el Alcance B, que sí la habría requerido, quedó explícitamente fuera.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo.

## Alcance restante (fuera de este entregable)

Alcance B (atribución por staff individual) permanece diferido — bloqueado por la ausencia de un modelo de identidad multi-staff en el dashboard, documentado en la Auditoría Integral v2 y en el Gate Review de Macroetapa 1 de este entregable. No se resuelve aquí ni se planea resolver sin una decisión de producto explícita sobre autenticación por staff.

## Versionado

Versión declarada del proyecto actualizada de `2.30.0` a `2.31.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): capacidad operativa nueva y observable en los logs del servidor (trazabilidad de revocaciones de `ApiKey` y de cierres de sesión de cliente). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Checkpoint de contradicción central (Alcance A vs. B) identificado y resuelto en Macroetapa 1, sin implementar el Alcance B.
- ✅ Alcance A implementado exactamente según lo congelado.
- ✅ Sin cambios de schema, migraciones, frontend, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional sin cambios.
- ✅ Suite completa en verde (103/103 · 674/674).
- ✅ Macroetapa 4 (versionado a `2.31.0`, commit, tag, push) completada.
