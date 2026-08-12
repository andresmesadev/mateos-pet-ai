# Cierre del Entregable — Identidad de Cliente (Portal del Cliente)

**Fecha:** 2026-08-12
**Bloque:** Ecosistema (post-Fase 6) — cuarto entregable, precondición para reserva/gestión de citas del Portal del Cliente.
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.26.0`.
**Naturaleza del entregable:** segunda capa de identidad — autenticación de cliente final, separada de `ApiKey` (nivel tenant/app) y de la sesión de staff (NextAuth, admin compartido).

---

## Objetivo del entregable

El bloque Ecosistema identificó que ninguna capacidad de reserva/gestión de citas para un Portal del Cliente puede construirse de forma segura sin saber qué cliente específico está detrás de una request — `ApiKey` solo identifica la app/tenant. Este entregable resuelve exclusivamente esa precondición: login por teléfono + código de un solo uso, entregado por WhatsApp.

## Diseño congelado (Macroetapa 1)

- `User.phone` con `@@unique([tenantId, phone])` (desde 4.1) ya es el ancla de identidad correcta — sin cambios necesarios ahí.
- Sin infraestructura de OTP preexistente — confirmado por grep exhaustivo antes de diseñar.
- `send-message.usecase.js` (Comunicación, 3.1) ya permite enviar un mensaje de WhatsApp fuera de una conversación activa (mismo mecanismo de los recordatorios) — reutilizable sin cambios, sin tocar el motor conversacional, exclusivamente WhatsApp.
- Sin JWT: se reutiliza el patrón ya establecido por `ApiKey` (hash SHA-256, nunca texto plano, búsqueda por hash) para un segundo tipo de credencial.
- Dos modelos nuevos aditivos: `ClientVerificationCode`, `ClientSession`.

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con el estado auditado; `sendMessage` confirmado exportado. Sin contradicciones.

## Resumen de implementación

- **`prisma/schema.prisma`** — `ClientVerificationCode` (`tenantId`, `userId`, `codeHash`, `attempts`, `expiresAt`, `consumedAt`) y `ClientSession` (`tenantId`, `userId`, `tokenHash` único, `expiresAt`, `revokedAt`, `lastUsedAt`), ambos aditivos. Migración aplicada exitosamente contra Neon (`npx prisma db push`, conectividad disponible en esta sesión).
- **`backend/src/lib/clientAuthCrypto.js`** — hash SHA-256 (mismo criterio que `apiKeyHash.js`), generación de código de 6 dígitos (`crypto.randomInt`) y de token de sesión opaco (`crypto.randomBytes(32)`).
- **`backend/src/services/client-auth.service.js`** — `requestVerificationCode` (respuesta siempre genérica; solo crea código y envía WhatsApp si el usuario existe en ese tenant) y `verifyCodeAndCreateSession` (consumo único, límite de 5 intentos, expiración de 10 minutos, emite sesión de 30 días).
- **`backend/src/middleware/clientAuth.js`** — resuelve `{ tenantId, userId }` exclusivamente desde `ClientSession`; **no montado en ninguna ruta** en este entregable.
- **`backend/src/middleware/rateLimit.js`** — `clientAuthRequestCodeRateLimit` (5 cada 15 min), independiente y más estricto que `publicApiRateLimit`.
- **`backend/src/routes/public-api.routes.js`** — `POST /auth/request-code`, `POST /auth/verify-code`, ambas dentro del router ya protegido por `apiKeyAuth` (heredado del mount de `app.js`, sin cambios ahí).
- **Tests nuevos (25):** `client-auth.service.test.js` (13), `clientAuth.test.js` (6), `public-api-client-auth-wiring.test.js` (6).

## 1. Validación Técnica

- **Suite completa:** **98/98 suites · 627/627 tests** en verde (antes 95/95 · 602 — +3 suites, +25 tests, cero regresiones).
- Migración aplicada y verificada contra la base de datos productiva.
- `git diff --stat` del entregable: 3 archivos modificados (`schema.prisma`, `rateLimit.js`, `public-api.routes.js`) + 6 nuevos.

## 2. Validación Funcional (grep exhaustivo)

- **`clientAuth` confirmado sin montar en ninguna ruta** — ni en `app.js` ni en ningún router, más allá de su propia definición. Ningún recurso posterior (reserva/gestión de citas) fue expuesto.
- **Rutas `/auth/request-code` y `/auth/verify-code` existen exactamente una vez cada una**, dentro del único router de la API pública.
- **Sin texto plano persistido:** grep de los objetos `data` pasados a Prisma confirma que solo `codeHash`/`tokenHash` se escriben — nunca `code` ni `token` crudos. El `logger` tampoco registra el código ni el token en ningún punto (solo mensajes genéricos y `error.message`).

## 3. Validación de Invariantes — exhaustiva, por cada propiedad de seguridad exigida

- **Aislamiento tenant:** el `tenantId` usado en la búsqueda de `User` y en la creación de `ClientVerificationCode`/`ClientSession` proviene exclusivamente de `req.apiKey.tenantId` — verificado con un `tenantId` "falsificado" en el body en ambos endpoints, en la integración end-to-end.
- **Aislamiento cliente:** `clientAuth` resuelve `{ tenantId, userId }` exclusivamente desde el registro de `ClientSession` encontrado por el hash del token — verificado con `body.tenantId`/`body.userId` falsificados, ignorados.
- **Enumeración de teléfonos:** `request-code` responde `200` idéntico exista o no el `User`, y también si el envío por WhatsApp falla — verificado en los tres escenarios.
- **Expiración:** el código deja de ser válido pasados los 10 minutos (`expiresAt: { gt: new Date() }` en la consulta) — verificado que un código sin fila `findFirst` coincidente (simulando expiración) resulta en respuesta inválida. La sesión de cliente expirada es rechazada por `clientAuth` (`session.expiresAt <= new Date()`) — verificado explícitamente.
- **Consumo único:** la consulta de verificación exige `consumedAt: null`; al validar correctamente, se marca `consumedAt` de inmediato, antes de emitir la sesión — verificado por assertion exacta del `update`.
- **Límite de intentos:** un código con `attempts >= 5` se rechaza sin siquiera comparar el hash ni tocar `ClientSession` — verificado. Un intento fallido incrementa `attempts` en 1 — verificado por assertion exacta.
- **Hashing:** `codeHash`/`tokenHash` verificados con formato SHA-256 (`/^[a-f0-9]{64}$/`) y comprobados distintos del valor original en texto plano, en ambos flujos.
- **Resolución de sesión (`clientAuth`):** sin token → 401; token inexistente → 401; sesión revocada → 401; sesión expirada → 401; sesión válida → continúa con `{ tenantId, userId }` correctos.
- **Sin bypass encontrado en ningún punto** — todos los caminos de error (código incorrecto, expirado, consumido, límite agotado, usuario inexistente) devuelven la misma familia de respuesta inválida sin distinción explotable, y ninguno de los dos endpoints es alcanzable sin `apiKeyAuth` primero.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — confirmado, `git diff --stat` vacío sobre los 5 archivos protegidos.
- **`ApiKey` y autenticación de staff sin cambios** — confirmado.
- **Sin Reconciliación Arquitectónica** — toda la implementación vive en módulos nuevos, sin modificar ningún caso de uso ni servicio existente (`send-message.usecase.js` se invoca, no se modifica).

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación coincidió exactamente con el diseño congelado.

## Alcance restante (fuera de este entregable)

- Montar `clientAuth` sobre cualquier recurso real (reserva, gestión de citas, disponibilidad extendida) — entregables futuros, dependientes de este.
- Revocación de sesión por el propio cliente ("cerrar sesión en todos los dispositivos") — no incluida, `revokedAt` existe en el modelo para uso administrativo futuro.
- Auto-registro de clientes nuevos vía el Portal (hoy solo pueden autenticarse `User` ya existentes) — decisión de alcance explícita, a revisar si se necesita.

## Versionado

Versión declarada del proyecto actualizada de `2.25.0` a `2.26.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): introduce una capacidad nueva (autenticación de cliente final vía WhatsApp), observable como dos endpoints nuevos y dos modelos de schema nuevos. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva antes de proponer diseño; precondición de identidad de cliente identificada y resuelta con evidencia de reutilización (`send-message.usecase.js`, patrón de hash de `ApiKey`).
- ✅ Alcance implementado exactamente según lo congelado — sin montar `clientAuth` sobre ningún recurso.
- ✅ Migración aplicada y verificada contra la base de datos productiva (`prisma db pull` confirma ambos modelos).
- ✅ Motor conversacional, `ApiKey` y autenticación de staff sin cambios.
- ✅ Suite completa en verde (98/98 · 627/627).
- ✅ Macroetapa 4 (versionado a `2.26.0`, commit, tag, push) completada.
