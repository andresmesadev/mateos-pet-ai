# Auditoría Integral v2 — Ecosistema / Portal del Cliente MVP sobre v2.30.0

**Alcance:** v2.23.0 → v2.30.0 (los 7 entregables de la auditoría v1 más el octavo, Revocación de Sesión y Gestión Mínima de ApiKey).
**Línea base:** `docs/history/AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP.md` (auditoría v1, sobre v2.29.0). Este documento no repite el análisis completo de lo ya auditado — lo re-verifica contra el estado actual del código y documenta explícitamente qué cambió.
**Estado:** Macroetapa 1 — Auditoría y Diagnóstico. Sin cambios de código, schema, rutas ni configuración. Sin Git.
**Fecha:** 2026-08-13.

---

## 1. Resumen ejecutivo

El octavo entregable (v2.30.0) **cerró efectivamente los dos hallazgos de severidad media de la auditoría v1** (M1 — sin revocación; M2 — `verify-code` sin rate limit dedicado) sin introducir ningún hallazgo nuevo. Se re-verificó línea a línea la superficie completa (10 rutas ahora, antes 8) y se confirma que **todo lo validado en la auditoría v1 sigue siendo cierto**: aislamiento tenant/cliente intacto, cero valores de `tenantId`/`userId` provenientes de body/params/query en ninguna ruta, `keyHash` nunca expuesto, motor conversacional sin tocar desde su último cambio legítimo (Entregable 6.2), y sin Reconciliación Arquitectónica pendiente.

**0 hallazgos críticos. 0 hallazgos de severidad media nuevos.** Las 3 deudas menores de la auditoría v1 que seguían abiertas (B1 CORS, B2 expiración de ApiKey, B3 `resolve-service-price`, B4 `serviceId`↔`Appointment`) permanecen exactamente en el mismo estado — ninguna se agravó ni se corrigió, tal como estaba fuera de alcance del octavo entregable. Se añade una observación menor nueva (B5, ver sección 9) sobre la superficie de gestión de `ApiKey`, sin severidad de seguridad real.

**El Portal del Cliente MVP está en mejor estado que en la auditoría v1**: el riesgo más relevante entonces (sesión de cliente comprometida sin revocación remota) ya no existe. Sigue sin estar listo para exponerse a terceros no controlados por el propio equipo, ahora exclusivamente por las deudas de producto ya conocidas (CORS, expiración/creación de `ApiKey`), no por ningún defecto de aislamiento o autenticación.

---

## 2. Superficie completa de `/api/public/*` (actualizada)

Router único, mismo montaje que en v1: `app.use("/api/public", publicApiRateLimit, apiKeyAuth, publicApiRoutes)` (`app.js:78`, sin cambios). **10 rutas** (antes 8) — las 8 ya auditadas más las 2 nuevas de este entregable.

| Ruta | Middleware (orden) | Scope | ApiKey | ClientSession | tenantId desde | userId/sessionId desde |
|---|---|---|---|---|---|---|
| `GET /services` | `apiKeyAuth` → `requireScope` | `read:services` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /availability` | `apiKeyAuth` → `requireScope` | `read:availability` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /availability/slots` | `apiKeyAuth` → `requireScope` | `read:availability` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /appointments` | `apiKeyAuth` → `clientAuth` → `requireScope` | `write:appointments` | Sí | Sí | cross-check | `req.clientAuth.userId` |
| `GET /appointments` | `apiKeyAuth` → `clientAuth` → `requireScope` | `read:appointments` | Sí | Sí | cross-check | `req.clientAuth.userId` |
| `POST /appointments/:id/cancel` | `apiKeyAuth` → `clientAuth` → `requireScope` | `write:appointments` | Sí | Sí | cross-check | `req.clientAuth.userId` |
| `POST /auth/request-code` | `apiKeyAuth` → `clientAuthRequestCodeRateLimit` (15min/5) | — | Sí | No (la crea) | `req.apiKey.tenantId` | — |
| `POST /auth/verify-code` | `apiKeyAuth` → **`clientAuthVerifyCodeRateLimit` (15min/10, nuevo)** | — | Sí | No (la crea) | `req.apiKey.tenantId` | — |
| **`POST /auth/logout`** *(nuevo)* | `apiKeyAuth` → `clientAuth` | — | Sí | Sí (la revoca) | — | **`req.clientAuth.sessionId`** (nuevo) |
| `GET /api/dashboard/api-keys` *(nuevo, distinto router)* | `resolveTenant` | — | — | — | `req.tenant.tenantId` | — |
| `POST /api/dashboard/api-keys/:id/revoke` *(nuevo, distinto router)* | `resolveTenant` | — | — | — | `req.tenant.tenantId` | — |

**Confirmado por lectura completa de `public-api.routes.js` (394 líneas) y de la sección nueva de `tenant.routes.js` (líneas 243-299):** ninguna ruta duplicada, ninguna ruta fuera de sus dos routers correspondientes. El JSDoc de cabecera de `public-api.routes.js` está actualizado y es consistente con el código real (verificado línea a línea, no solo por confianza en el comentario).

`tenantId` sigue **sin excepción** proveniente exclusivamente de `req.apiKey.tenantId` (rutas de catálogo/citas) o `req.tenant.tenantId` (dashboard) — nunca de `req.body`/`req.params`/`req.query`. Confirmado por grep exhaustivo de todo uso de `req.body`/`req.params`/`req.query` en ambos archivos (sección 3).

---

## 3. Aislamiento (re-verificado + superficie nueva)

Todo lo verificado en la auditoría v1 (tenant, `getServiceCategory`, `resolveStaffAvailability`, ownership de citas por `id+userId+tenantId`) se re-confirmó sin cambios — ninguno de esos archivos fue tocado por el octavo entregable (`git diff --stat` vacío sobre `get-service-category.usecase.js`, `appointment-status.service.js`, `createAppointment`/`getUserAppointments` en `appointment.service.js`).

**Aislamiento de la superficie nueva:**
- **Logout:** no acepta ningún identificador del cliente como input — `sessionId` proviene exclusivamente de `req.clientAuth.sessionId`, resuelto por `clientAuth` desde el hash del token (`X-Client-Token`), nunca desde el body. El `update` de revocación usa `where: { id: sessionId }` — sin ningún filtro adicional que pudiera ampliarse a otras sesiones, confirmado por lectura directa del código, no por inferencia.
- **`GET /api-keys` / `POST /api-keys/:id/revoke`:** `tenantId` exclusivamente de `resolveTenantId(req)` (mismo helper que el resto de `tenant.routes.js`, sin cambios). Revocación con ownership `findFirst({ id, tenantId })` antes de cualquier `update` — una `ApiKey` de otro tenant no puede revocarse ni siquiera adivinando su `id`, responde 404 idéntico a "no existe".
- **Independencia de credenciales confirmada:** `apiKeyAuth.js` no tiene ningún diff desde la auditoría v1 (`git diff --stat` vacío) — la introducción de `sessionId` en `clientAuth.js` no afecta en absoluto la resolución de `ApiKey`. Ambos modelos siguen sin cruzarse entre sí más allá de la verificación cruzada `tenantId` ya existente en las rutas de cliente.

**Conclusión:** cross-tenant y cross-client siguen siendo imposibles en las 10 rutas, incluidas las 2 nuevas — mismo nivel de garantía que en la auditoría v1, sin regresión.

---

## 4. Autenticación y credenciales (actualizado)

| Propiedad | ApiKey | ClientSession / OTP |
|---|---|---|
| Almacenamiento | Hash SHA-256, sin cambios | Hash SHA-256, sin cambios |
| Expiración | Sigue sin `expiresAt` (B2, sin cambios) | Sin cambios: 30 días sesión, 10 min código |
| **Revocación** | **Cerrado — `POST /api-keys/:id/revoke` (dashboard), efectiva de inmediato porque `apiKeyAuth` consulta la DB en cada request, sin caché** | **Cerrado — `POST /auth/logout` (self-service)** |
| Consumo único / intentos máximos | N/A | Sin cambios (consumo único, `MAX_ATTEMPTS=5`) |
| **Rate limiting** | Sin cambios (global 30/min/IP) | `request-code` sin cambios (15min/5). **`verify-code` ahora 15min/10 dedicado, además del global** |
| Enumeración de usuarios | N/A | Sin cambios — mismo comportamiento genérico verificado |
| No persistencia/logging de secretos | Sin cambios — confirmado también en las 2 rutas nuevas: ningún log de `public-api.routes.js`/`tenant.routes.js` imprime `error` completo salvo `error.message`, y ninguna respuesta incluye `keyHash`/`tokenHash`/el token o código en texto plano |

**Verificación de efectividad de la revocación (nueva en esta auditoría v2):** se confirmó por lectura de `apiKeyAuth.js` y `clientAuth.js` que ambos consultan `revokedAt` directamente en la base de datos en cada request — no hay ninguna capa de caché entre la revocación y su efecto. Una `ApiKey` revocada o una `ClientSession` cerrada por logout deja de aceptarse en la siguiente request, sin ventana de gracia.

---

## 5. Ciclo completo de citas

**Sin cambios respecto a la auditoría v1** — ninguno de los archivos del ciclo de citas (`appointment.service.js` más allá de la línea de export ya auditada, `appointment-status.service.js`, `availability-db.service.js`) fue tocado por el octavo entregable. Se re-confirmó por `git diff --stat` que `createAppointment`, `getUserAppointments`, `isAllowedTransition`, `buildAppointmentDateTime` no tienen ningún cambio desde v2.29.0. El índice único parcial `appointment_tenant_bucket_slot_active_unique` sigue siendo la única protección de concurrencia, sin mecanismo nuevo. Todas las conclusiones de la sección 5 de la auditoría v1 siguen vigentes sin modificación.

---

## 6. Dashboard de ApiKeys (nuevo — cobertura completa)

- **Listado (`GET /api-keys`):** proyección explícita vía `select` de Prisma — `{ id, scopes, createdAt, revokedAt, lastUsedAt }` — `keyHash` no puede aparecer accidentalmente porque nunca se solicita a la base de datos, no porque se filtre después de obtenerlo. Es la forma más segura de garantizar la no-exposición (a diferencia de omitir el campo de la respuesta después de tener el objeto completo).
- **Revocación (`POST /api-keys/:id/revoke`):** ownership verificado antes de mutar; misma proyección explícita en la respuesta del `update`.
- **Ownership por tenant:** confirmado — `findFirst({ id, tenantId })`, mismo patrón canónico usado en todo el proyecto desde ADR 009.
- **Autorización del dashboard:** ambas rutas heredan el mismo nivel de autorización que el resto de `/api/dashboard/*` (`resolveTenant`, sin RBAC granular por rol de staff) — consistente con el resto del router, no una regresión ni una expansión de privilegio, tal como se documentó como aceptable en la auditoría v1 y en el Gate Review de Macroetapa 1 de este mismo entregable.
- **Idempotencia:** confirmada por lectura del código (`data: { revokedAt: apiKey.revokedAt ?? new Date() }`) y por test dedicado.

---

## 7. Seguridad de respuestas y errores

Sin cambios respecto a la auditoría v1 en las 8 rutas ya existentes. En las 2 rutas nuevas:
- **PII:** `GET /api-keys` no expone ningún dato de cliente final (solo metadatos de la credencial de aplicación). `POST /auth/logout` no expone nada más que un mensaje genérico.
- **Enumeración:** revocar una `ApiKey` inexistente y una de otro tenant responden idénticamente (404), igual que el patrón ya usado en cancelación de citas — sin distinción observable.
- **Errores internos:** ambas rutas nuevas responden `"Internal server error"` genérico en el `catch`, con el detalle real solo en el log del servidor (`error.message` en logout; `error` completo en las rutas de dashboard, consistente con el resto de `tenant.routes.js`, que también registra el objeto completo — no es una desviación introducida por este entregable).
- **Códigos HTTP:** 401 (logout sin key/sin token), 403 (dashboard sin tenant resuelto), 404 (revocar ApiKey ajena/inexistente), 200 (éxito, incluida la revocación idempotente) — todos verificados por test.

---

## 8. Arquitectura

- **Reutilización correcta confirmada en la superficie nueva:** logout reutiliza `req.clientAuth.sessionId` ya resuelto por `clientAuth` (sin repetir el lookup por hash); las rutas de `ApiKey` reutilizan `resolveTenantId(req)`, el mismo helper que el resto del archivo — cero funciones nuevas de propósito general, todo el código nuevo es orquestación de ruta.
- **Sin duplicación de lógica:** el patrón ownership+respuesta-idempotente de `POST /api-keys/:id/revoke` es análogo al de cancelación de citas (mismo criterio arquitectónico ya usado en Gestión de Cita), no una invención nueva.
- **Sin bypass de bounded contexts:** el acceso directo a `prisma.apiKey`/`prisma.clientSession` en las rutas nuevas sigue el mismo criterio ya aceptado en la auditoría v1 para `prisma.appointment` — ninguno de los dos modelos tiene un bounded context propio con casos de uso encapsulados.
- **Archivos protegidos del motor conversacional:** confirmados sin ningún cambio desde su última modificación legítima (Entregable 6.2, commit `50effd4`) — el octavo entregable no los tocó, verificado por `git log` dirigido a esos 5 archivos.
- **`apiKeyAuth.js` sin ningún cambio acumulado** desde su creación — confirma que `ApiKey` y `ClientSession` siguen siendo credenciales completamente independientes en su mecanismo de resolución, incluso después de que `clientAuth.js` ganara el campo `sessionId`.
- **Reconciliación Arquitectónica:** ninguna pendiente ni disparada por el octavo entregable — el único cambio de comportamiento (aditivo, `sessionId`) fue una decisión de diseño explícita y documentada en su propia Macroetapa 1, no un hallazgo que forzara una reconciliación.

---

## 9. Deudas conocidas (evaluadas, sin implementar)

| Deuda | Estado desde v1 | Evaluación en v2 |
|---|---|---|
| Creación de `ApiKey` vía API | Abierta | Sigue abierta. La gestión mínima (listar/revocar) no dependía de resolverla, y no se resolvió — confirmado que no existe ningún endpoint de creación en todo el repo, igual que en v1. |
| Expiración de `ApiKey` (B2) | Abierta | Sin cambios — `ApiKey` sigue sin `expiresAt` en el schema. |
| CORS para terceros (B1) | Abierta | Sin cambios — política global de `app.js` sin modificar. |
| `resolve-service-price` (B3) | Abierta | Sin cambios — sigue excluido del catálogo público, bypass subyacente sin corregir. |
| `serviceId`↔`Appointment` (B4) | Abierta | Sin cambios — `createAppointment` sigue sin vincular `serviceId` al crear la cita. |
| **B5 — nueva (menor):** ausencia de auditoría/trazabilidad de quién revocó una `ApiKey` o cuándo un cliente cerró sesión más allá del propio `revokedAt` | No existía en v1 (la funcionalidad no existía) | Ninguna de las dos rutas nuevas registra en un log estructurado o tabla de auditoría el evento de revocación/logout más allá del timestamp en el propio registro — no hay forma de responder "quién revocó esta key" si varios miembros del staff tienen acceso al dashboard del mismo tenant. Severidad menor: el propio Entregable Puente y ADR 009 establecieron el criterio de trazabilidad para dominios de negocio (comisiones); esta superficie de identidad/seguridad no tiene ese mismo nivel, pero tampoco lo tenía ningún otro mecanismo de autenticación del proyecto antes de este entregable (no es una regresión, es una ausencia consistente con el resto del sistema). |

Ninguna deuda evaluada representa una dependencia crítica que obligue a reabrir el diseño de este entregable ni de los anteriores.

---

## 10. Testing

**Cobertura acumulada de la superficie `/api/public/*` + dashboard de `ApiKey`:** 80 tests dedicados (12+14+9+12+12 en los 5 archivos de integración de `public-api-*`, 4 en `dashboard-api-keys-wiring.test.js`, 6+11 en los 2 archivos unitarios de identidad de cliente). Suite completa del proyecto: **103/103 suites · 674/674 tests**, verificado en verde en esta misma auditoría.

**Casos críticos con cobertura confirmada:** cross-tenant (todas las rutas con `tenantId`), cross-client (ownership de citas, ahora también revocación de `ApiKey`), revocación (logout no reutilizable, verificado explícitamente; `ApiKey` revocada — cubierto en el wiring genérico existente desde v1), rate limiting (configuración verificada por lectura, mismo criterio no-ejecutar-N-requests-reales del resto del proyecto), estados de citas (transiciones válidas/inválidas).

**Huecos ya identificados en v1, re-confirmados sin cambio:** sin test de concurrencia real (dos requests simultáneas) para `SlotAlreadyBookedError` — la atomicidad depende del índice de Postgres, ya validada fuera de este bloque en 4.1/A6; sin test de rate limiting ejecutando N+1 requests reales.

**Hueco nuevo identificado en v2:** ningún test verifica que revocar una `ApiKey` desde el dashboard bloquee inmediatamente una request en curso o subsiguiente contra `/api/public/*` en un escenario de integración end-to-end (el wiring actual prueba cada router de forma aislada con mocks, no la cadena completa dashboard→revocación→rechazo en `apiKeyAuth`). Riesgo bajo — la lógica que lo garantiza (`apiKeyAuth` sin caché, verificado en sección 4) es la misma para todas las keys, ya cubierta indirectamente por el wiring genérico de `public-api-wiring.test.js` que sí prueba el rechazo de una key con `revokedAt` seteado.

---

## 11. Matriz de riesgos (actualizada)

| Riesgo | Estado en v1 | Estado en v2 |
|---|---|---|
| Sesión de cliente comprometida sin revocación remota | Relevante (M1) | **Cerrado** |
| `verify-code` sin segunda capa de rate limit | Relevante (M2) | **Cerrado** |
| Decisión de producto pendiente sobre CORS | Abierto (B1) | Sin cambios |
| `ApiKey` sin expiración/rotación | Abierto (B2) | Sin cambios |
| Ausencia de trazabilidad de quién revoca una `ApiKey` | No existía | **Nuevo, severidad menor (B5)** |

---

## 12. Funcionalidades realmente listas

Todo lo listado en la auditoría v1 (catálogo, disponibilidad, identidad, reserva, gestión de citas) más: logout de cliente, listado y revocación de `ApiKey` desde el dashboard. Las 10 rutas están, individualmente, correctamente aisladas y probadas.

## 13. Funcionalidades que todavía NO deberían exponerse

Sin cambios respecto a la auditoría v1: edición/reprogramación de citas, apertura a terceros no controlados (ahora bloqueada únicamente por B1/B2, ya no por M1/M2), `resolve-service-price`.

---

## 14. Recomendación del siguiente entregable

Con M1 y M2 cerrados, las deudas restantes (B1 CORS, B2 expiración de `ApiKey`, creación de `ApiKey`) son **decisiones de producto**, no defectos técnicos — dependen de cómo se defina el primer consumidor real externo del Ecosistema, algo que no se puede auditar ni diseñar sin esa definición de producto previa. Se recomienda que el próximo paso **no sea un entregable de código**, sino una decisión explícita del responsable del proyecto sobre el modelo de consumo real de la API pública (¿apps nativas del propio equipo? ¿terceros integradores? ¿ambos?) — de esa decisión se derivan directamente el diseño de creación/expiración de `ApiKey` y la política de CORS, evitando construir cualquiera de los dos sin esa definición y arriesgar una Reconciliación Arquitectónica posterior.

Si se prefiere continuar con trabajo técnico mientras se toma esa decisión, la alternativa de menor riesgo es **B5** (trazabilidad mínima de revocación) — entregable pequeño, autocontenido, sin dependencia de ninguna decisión de producto pendiente.

**Sin autorización para iniciar ningún entregable nuevo en este momento** — este informe cierra exclusivamente la Macroetapa 1 de la Auditoría Integral v2 solicitada.
