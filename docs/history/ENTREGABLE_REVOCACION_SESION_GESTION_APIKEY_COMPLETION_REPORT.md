# Cierre del Entregable — Revocación de Sesión y Gestión Mínima de ApiKey

**Bloque:** Ecosistema (post-Fase 6) — octavo entregable, primer entregable derivado directamente de la Auditoría Integral del Portal del Cliente MVP (hallazgo M1).
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.30.0`.
**Naturaleza del entregable:** cierre del hallazgo M1 (ausencia de revocación) de `AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP.md` — logout de cliente y gestión mínima (listar/revocar) de `ApiKey`, más el rate limit dedicado de `verify-code` (hallazgo M2).

---

## Objetivo del entregable

`ClientSession` y `ApiKey` tenían `revokedAt` respetado por sus middlewares pero ningún endpoint lo seteaba nunca. Este entregable cierra esa brecha con el mínimo necesario: un cliente puede cerrar su propia sesión, un tenant puede revocar una `ApiKey` comprometida, y `verify-code` queda protegido por una segunda capa de rate limiting.

## Diseño congelado (Macroetapa 1)

- **Checkpoint de contradicción resuelto en Macroetapa 1:** `clientAuth.js` no exponía `session.id` — necesario para revocar exactamente la sesión del token presentado sin duplicar el lookup por hash. Resuelto con un cambio aditivo (`sessionId` agregado a `req.clientAuth`), mismo criterio que la exportación de `syncCancelToCalendar` en Gestión de Cita.
- Ownership de `ApiKey` vía `findFirst({ id, tenantId })`, mismo patrón canónico del proyecto.
- Revocación idempotente por diseño explícito.
- Creación de `ApiKey` explícitamente fuera de alcance — no existe hoy vía API en ningún punto del repo (confirmado por grep exhaustivo en Macroetapa 1); revocar no depende de poder crear.
- Rate limit dedicado para `verify-code`: 10/15min, análogo a `request-code` (5/15min) pero más laxo, ya que la defensa principal contra fuerza bruta es el límite de 5 intentos por código (`client-auth.service.js`, sin cambios).

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Sin contradicciones nuevas.

## Resumen de implementación (Macroetapa 2)

**Archivos modificados:**
- `backend/src/middleware/clientAuth.js` — un único cambio: `sessionId: session.id` agregado a `req.clientAuth`. Confirmado por diff exacto: ninguna otra línea cambió.
- `backend/src/middleware/rateLimit.js` — nuevo `clientAuthVerifyCodeRateLimit` (10/15min), mismo constructor que `clientAuthRequestCodeRateLimit`.
- `backend/src/routes/public-api.routes.js` — `POST /auth/logout` (nueva, `clientAuth` sin scope adicional); `clientAuthVerifyCodeRateLimit` montado en `POST /auth/verify-code`.
- `backend/src/routes/dashboard/tenant.routes.js` — `GET /api-keys` (lista, `select` explícito sin `keyHash`) y `POST /api-keys/:id/revoke` (ownership + idempotente).

**Tests nuevos/actualizados:** 4 tests de logout + 1 assertion actualizada en `public-api-client-auth-wiring.test.js`; 5 tests nuevos en `dashboard-api-keys-wiring.test.js` (nuevo archivo).

## 1. Validación Técnica

- **Suite completa:** **103/103 suites · 674/674 tests** en verde (antes 102/102 · 666/666 — +1 suite, +8 tests netos, cero regresiones). Los logs de error visibles en la ejecución (`[Finanzas]`/`[Staff]` fallo al certificar evento) son ruido pre-existente de rutas de error ya cubiertas por otros tests, no relacionados con este entregable — confirmado que no aparecen en ningún test nuevo de este bloque.
- `git diff --stat -- ../prisma/` vacío — sin cambios de schema.

## 2. Validación Funcional (grep exhaustivo)

- **Rutas únicas en todo el árbol:** `POST /auth/logout` existe exactamente una vez en `public-api.routes.js`; `GET /api-keys` y `POST /api-keys/:id/revoke` existen exactamente una vez en `tenant.routes.js` — sin duplicados en ningún otro archivo de rutas.
- **`keyHash` nunca aparece en ninguna respuesta:** grep exhaustivo sobre las dos rutas de gestión de `ApiKey` confirma que la única mención de `keyHash` en `tenant.routes.js` es un comentario explicativo — el `select`/`data` de ambas consultas Prisma lo excluye explícitamente en las dos rutas.
- **`apiKeyAuth.js` sin ningún cambio** — `git diff --stat` vacío, confirma que `ApiKey` y `ClientSession` permanecen como credenciales independientes, sin acoplarse entre sí.
- **Rate limit de `verify-code` correctamente montado** — `clientAuthVerifyCodeRateLimit` importado y aplicado exclusivamente en `POST /auth/verify-code`, sin afectar `request-code` (que conserva su propio limiter, sin cambios).

## 3. Validación de Invariantes — exhaustiva, por cada propiedad exigida

- **Logout revoca únicamente la sesión presentada:** verificado por assertion exacta — el `update` de revocación siempre usa `where: { id: sessionId }` (el `sessionId` resuelto por `clientAuth` desde el hash del token, nunca desde el body), nunca `where: { userId }` ni ningún filtro que pudiera afectar otras sesiones del mismo cliente.
- **Logout no reutilizable:** verificado — una sesión ya revocada (`revokedAt` seteado) hace que `clientAuth` la rechace con 401 en cualquier intento posterior, incluyendo un segundo intento de logout con el mismo token.
- **Revocación de `ApiKey` con ownership obligatorio:** verificado — `findFirst({ id, tenantId })` siempre antes de `update`; una key de otro tenant (o inexistente) responde 404 sin llamar a `update`.
- **Idempotencia de la revocación de `ApiKey`:** verificado explícitamente — revocar una key que ya tenía `revokedAt` seteado reescribe el mismo valor (`apiKey.revokedAt ?? new Date()`), sin generar un nuevo timestamp ni fallar.
- **`tenantId`/`userId` nunca desde body/params/query:** confirmado en las 3 rutas nuevas — `logout` no acepta ningún identificador del cliente (todo viene de `req.clientAuth`); `api-keys` usa exclusivamente `resolveTenantId(req)` (mismo helper ya usado por el resto de `tenant.routes.js`).
- **`ApiKey` y `ClientSession` como credenciales independientes:** confirmado — ninguna de las dos rutas nuevas cruza ambos modelos entre sí más allá de lo que ya existía (verificación cruzada de tenant en las rutas de cliente, sin cambios en este entregable).
- **Todos los caminos de error verificados con su código HTTP exacto:** 401 (logout sin API key/sin token/con token inválido), 404 (revocar `ApiKey` inexistente/ajena), 200 (listado, revocación exitosa, revocación idempotente, logout exitoso).

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — `git diff --stat` vacío sobre los 5 archivos protegidos.
- **`apiKeyAuth.js` sin modificar** — confirmado.
- **`clientAuth.js`:** único cambio es la línea de `sessionId`, sin alterar su comportamiento de validación (`revokedAt`/`expiresAt`) ni los 3 consumidores existentes (rutas de citas), que no desestructuran el objeto completo y no se ven afectados por el campo adicional.
- **Sin duplicación de lógica de hash/lookup** — el logout reutiliza el `sessionId` ya resuelto por `clientAuth`, sin repetir el `findUnique` por `tokenHash`.
- **Sin creación de `ApiKey`** — confirmado, fuera de alcance como estaba congelado.
- **Sin cambios a `resolve-service-price` ni a la vinculación `serviceId`↔`Appointment`** — confirmado, ningún archivo relacionado aparece en el diff de este entregable.
- **Sin cambios de schema ni migraciones.**
- **Sin Reconciliación Arquitectónica.**

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo — la implementación coincide exactamente con el diseño congelado en Macroetapa 1, sin contradicciones detectadas durante la validación.

## Alcance restante (fuera de este entregable)

Creación de `ApiKey` vía API/dashboard, expiración de `ApiKey` (B2), política de CORS para terceros (B1) — deudas ya documentadas en la Auditoría Integral, ninguna resuelta ni agravada por este entregable.

## Versionado

Versión declarada del proyecto actualizada de `2.29.0` a `2.30.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): capacidad nueva y observable, un cliente puede cerrar su propia sesión y un tenant puede revocar una `ApiKey` comprometida. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva previa (Macroetapa 1), incluyendo el checkpoint de `sessionId` resuelto antes de implementar.
- ✅ Alcance implementado exactamente según lo congelado.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional sin cambios.
- ✅ Suite completa en verde (103/103 · 674/674).
- ✅ Macroetapa 4 (versionado a `2.30.0`, commit, tag, push) completada.
