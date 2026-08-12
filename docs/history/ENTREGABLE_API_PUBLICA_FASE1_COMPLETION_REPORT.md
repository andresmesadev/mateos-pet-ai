# Cierre del Entregable — API pública, Fase 1 (autenticación de terceros + cierre de A5)

**Fecha:** 2026-08-11
**Bloque:** Ecosistema (post-Fase 6) — segundo entregable, tras la precondición de certificación de eventos (v2.23.0).
**Estado:** ✅ Completo y operativo (Macroetapas 1-4 completas, versión `2.24.0`). Migración de base de datos aplicada exitosamente (actualizado 2026-08-11) — ver "Estado real de la migración" abajo.
**Naturaleza del entregable:** infraestructura de autenticación nueva (mecanismo `ApiKey`) + cierre de un hueco de seguridad real y concreto (deuda A5 en `/api/billing/*`). Sin catálogo de recursos públicos — decisión de producto explícitamente diferida.

---

## Objetivo del entregable

Construir el mecanismo mínimo de identidad que un futuro consumidor externo (API pública) necesitaría, y cerrar en el mismo movimiento la deuda A5 (Auditoría v2.1.0) sobre `/api/billing/*`, confirmada abierta en cada cierre de fase desde la Fase 4.

## Diseño congelado (Macroetapa 1)

- Hallazgo central: no existe ninguna autenticación de terceros, y tampoco existe autenticación humana por tenant en el dashboard (hallazgo nuevo, documentado y explícitamente diferido — el dashboard sigue usando una única cuenta admin compartida vía variables de entorno).
- Decisión de alcance: construir solo `ApiKey` (mecanismo de máquina), dejando la ausencia de login humano por tenant como hallazgo separado, fuera de este entregable.
- Sin catálogo de recursos — este entregable es exclusivamente el mecanismo de identidad.

## Checkpoint de contradicción (previo a Macroetapa 2)

El diseño dejaba abierto un fork sobre cómo cerrar A5: usar `ApiKey`, o mantener el modelo de confianza actual vía `X-Internal-Token`. La auditoría del código real reveló que `frontend/app/api/proxy/billing/route.ts` **ya enviaba** `X-Internal-Token` en cada request — evidencia de que la intención de diseño original ya era esa, y que el backend simplemente nunca la validaba. Reportado como checkpoint y resuelto explícitamente: cerrar A5 con `requireInternalToken` (el mismo criterio que `resolveTenant.js` ya usa), sin requerir `ApiKey` para esto — `ApiKey` queda como el mecanismo real para futuros consumidores externos genuinos.

## Resumen de implementación

- **`prisma/schema.prisma`** — modelo `ApiKey` nuevo (`tenantId`, `keyHash` único, `scopes String[]`, `createdAt`, `revokedAt`, `lastUsedAt`) + relación inversa `apiKeys ApiKey[]` en `Tenant`.
- **`backend/src/lib/apiKeyHash.js`** (nuevo) — `hashApiKey()`, SHA-256 determinístico. La key en texto plano nunca se persiste.
- **`backend/src/middleware/apiKeyAuth.js`** (nuevo) — resuelve `tenantId` exclusivamente desde `ApiKey.tenantId`, tras validar la key por su hash y confirmar que no está revocada; actualiza `lastUsedAt`; audita éxito/rechazo vía `logger`. **No está montado en ninguna ruta de producción** — es infraestructura lista para el primer recurso real, que queda fuera de este entregable.
- **`backend/src/middleware/requireInternalToken.js`** (nuevo) — replica exactamente el criterio de validación de `X-Internal-Token` que `resolveTenant.js` ya usa (bypass en `NODE_ENV=test`, sin bloqueo si `INTERNAL_API_SECRET` no está configurado).
- **`backend/src/app.js`** — `/api/billing` monta ahora `requireInternalToken` antes del router; `/api/billing/webhook` no se ve afectado (ruta exacta registrada antes, ya protegida por firma Stripe).
- **Tests nuevos (19):** `requireInternalToken.test.js` (5), `apiKeyAuth.test.js` (10, incluye verificación explícita de que `tenantId` nunca proviene de `body`/`params`/`query`, que la key se busca por hash y nunca por valor en texto plano, y que `hashApiKey` es determinístico y no reversible por inspección directa), `billing-internal-token-wiring.test.js` (4, monta la app exactamente como `app.js`).

## 1. Validación Técnica

- **Suite completa:** **93/93 suites · 587/587 tests** en verde (antes 90/90 · 568 — +3 suites, +19 tests, cero regresiones).
- `git diff --stat` total: 2 archivos modificados (`app.js`, `schema.prisma`) + 6 nuevos (3 test, 2 middleware, 1 lib).

### Estado real de la migración — actualizado 2026-08-11

`npx prisma generate` se ejecutó **con éxito** en la Macroetapa 4 (v2.24.0). En su momento, `npx prisma db push` no pudo ejecutarse desde este entorno (`P1001`, sin conectividad de red hacia Neon) y el entregable se cerró documentando explícitamente esa condición pendiente, sin darla por aplicada.

**Actualización:** `npx prisma db push` fue ejecutado exitosamente contra la base de datos de producción (Neon) fuera de este entorno. Verificado en esta sesión mediante `npx prisma db pull --print`, que confirma la existencia real del modelo `ApiKey` (incluyendo la relación inversa `apiKeys ApiKey[]` en `Tenant`) en la base de datos productiva. **La condición operativa queda resuelta — el entregable es ahora completamente operativo para lo que su alcance cubre** (el mecanismo de identidad existe end-to-end; sigue sin haber ningún endpoint público que lo consuma, por diseño — ver "Alcance restante" del cierre original).

## 2. Validación Funcional (grep exhaustivo)

- **`apiKeyAuth` no está montado en ninguna ruta:** grep exhaustivo de `apiKeyAuth` en todo `backend/src` (excluyendo tests) solo encuentra su propia definición — ningún `app.use`/`router.use`/`require` lo conecta a una ruta real. Confirma que el catálogo de recursos públicos sigue fuera de alcance.
- **Cierre de A5 exhaustivo:** los 4 endpoints de `billing.routes.js` (`POST /checkout`, `POST /cancel`, `POST /change-plan`, `GET /status/:tenantId`) comparten un único mount (`app.js:73`) protegido por `requireInternalToken` — no hay ninguna ruta de billing fuera de ese mount. `POST /api/billing/webhook` (`app.js:55`) se registra antes, con ruta exacta, y responde antes de que la request pueda llegar al mount protegido — confirmado que no requiere `X-Internal-Token` (usa verificación de firma Stripe, sin cambios).
- **`/api/onboarding/*` confirmado sin cambios:** grep de `x-internal-token`/`apiKeyAuth`/`requireInternalToken` en `onboarding.routes.js` — vacío. Sigue siendo la única superficie deliberadamente pública, sin autenticación, tal como documenta `CLAUDE.md`.
- **Sin endpoint ni recurso público nuevo** — confirmado, ningún archivo de rutas nuevo, ninguna ruta agregada a `billing.routes.js` ni `onboarding.routes.js`.

## 3. Validación de Invariantes

- **`tenantId` de una API key proviene exclusivamente de `ApiKey.tenantId`** — verificado con un test que fija `req.body.tenantId` y `req.params.tenantId` a valores distintos ("falsificados") y confirma que `req.apiKey.tenantId` solo refleja el valor resuelto de la base de datos.
- **Solo se almacena `keyHash`, nunca la key original** — el schema no tiene ningún campo de texto plano para la key; `apiKeyAuth.js` nunca persiste `rawKey`; el test de "busca la key por su hash, nunca por el valor en texto plano" verifica que la consulta a `prisma.apiKey.findUnique` usa el hash, no el valor recibido.
- **Rechazo de keys inválidas y revocadas** — verificado (401 en ambos casos, sin llamar a `prisma.apiKey.update` cuando la key está revocada).
- **`lastUsedAt` se actualiza en cada autenticación exitosa** — verificado por assertion exacta del `update`.
- **Auditoría vía `logger` existente** — confirmado en el código (`logger.info` en éxito y en rechazo), sin tabla nueva.
- **`X-Internal-Token` exigido en los 4 endpoints de billing, correcto permite continuar, incorrecto/ausente rechaza con 401** — verificado explícitamente.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — confirmado, `git diff --stat` vacío sobre los 5 archivos protegidos.
- **Ningún otro contexto de negocio tocado** — confirmado, `git diff --stat -- backend/src/contexts` vacío.
- **Sin Reconciliación Arquitectónica** — el cambio vive en middleware nuevo, un mount en `app.js`, y un modelo aditivo de schema.
- **Email/SMS/apps de cliente-staff:** sin cambios, siguen fuera de alcance según decisión ya congelada.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación coincidió exactamente con el diseño congelado y el checkpoint resuelto en Macroetapa 2.

## Alcance restante (fuera de este entregable)

- Catálogo de recursos de la API pública — decisión de producto pendiente.
- Emisión/gestión de `ApiKey` (creación, rotación, revocación vía dashboard o script) — no construida en este entregable; el modelo y el middleware de validación existen, pero no hay ningún flujo para generar una key real todavía.
- Ausencia de autenticación humana por tenant en el dashboard — hallazgo documentado, explícitamente diferido.
- Ejecución real de `prisma db push` contra la base de datos — pendiente, bloqueada por conectividad en este entorno.

## Versionado

Versión declarada del proyecto actualizada de `2.23.0` a `2.24.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): introduce una capacidad nueva (mecanismo `ApiKey`) y cierra un hueco de seguridad real (`billing/cancel`/`change-plan`/`status` alcanzables antes con cualquier `tenantId`). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (con condición operativa explícita)

- ✅ Auditoría exhaustiva antes de proponer diseño.
- ✅ Checkpoint de contradicción (fork de A5) reportado y resuelto antes de implementar.
- ✅ Alcance implementado exactamente según lo congelado — sin recursos públicos nuevos, sin autenticación humana por tenant, sin tabla de auditoría nueva.
- ✅ Motor conversacional, otros contextos de negocio, Email/SMS y apps sin cambios.
- ✅ Suite completa en verde (93/93 · 587/587).
- ✅ Macroetapa 4 (versionado a `2.24.0`, commit, tag, push) completada.
- ⚠️ **Condición operativa pendiente, explícita y no oculta:** migración de base de datos (`prisma db push`) no aplicada por falta de conectividad en este entorno — debe ejecutarse antes de que el entregable sea operativo.
