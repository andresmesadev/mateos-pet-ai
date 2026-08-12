# Gate Review consolidado — Revocación de Sesión y Gestión Mínima de ApiKey

**Bloque:** Ecosistema (post-Fase 6)
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.30.0).

---

## 1. Diseño congelado (Macroetapa 1)

- Origen: hallazgos M1 (sin revocación) y M2 (sin rate limit dedicado en `verify-code`) de `AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP.md`.
- Checkpoint resuelto: `sessionId` agregado a `req.clientAuth` (cambio aditivo, `clientAuth.js`), necesario para que logout revoque exactamente la sesión del token presentado sin duplicar el lookup por hash.
- Creación de `ApiKey` explícitamente fuera de alcance — inexistente en todo el repo, revocar no depende de ello.
- Revocación de `ApiKey` con ownership `id+tenantId`, idempotente por diseño.
- Rate limit de `verify-code`: 10/15min (segunda capa; la principal sigue siendo el límite de 5 intentos por código).

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

Ninguno — estado del código verificado limpio e idéntico al auditado.

## 3. Implementación (Macroetapa 2)

`POST /api/public/auth/logout` en `public-api.routes.js`; `GET /api/dashboard/api-keys` y `POST /api/dashboard/api-keys/:id/revoke` en `tenant.routes.js`; `clientAuthVerifyCodeRateLimit` nuevo en `rateLimit.js`, montado en `verify-code`.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **103/103 suites · 674/674 tests** (antes 102/102 · 666/666 — cero regresiones).
- Verificado exhaustivamente: logout revoca únicamente la sesión presentada (`where: { id: sessionId }`, nunca `userId`), sesión revocada no reutilizable, ownership obligatorio de `ApiKey` (404 cross-tenant), idempotencia de la revocación (timestamp original preservado), `keyHash` ausente de toda respuesta (grep exhaustivo, única mención es un comentario), `tenantId`/`userId` nunca desde body/params/query, `ApiKey`/`ClientSession` sin acoplarse entre sí (`apiKeyAuth.js` sin diff).
- Grep exhaustivo confirma: rutas únicas sin duplicados; rate limit de `verify-code` montado exclusivamente en esa ruta.
- `apiKeyAuth.js`, los 5 archivos protegidos del motor conversacional, y `prisma/schema.prisma` confirmados sin diff; `clientAuth.js` con diff de una única línea, exactamente la aprobada.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.30.0`, tag y push realizados bajo autorización explícita del responsable del proyecto.
