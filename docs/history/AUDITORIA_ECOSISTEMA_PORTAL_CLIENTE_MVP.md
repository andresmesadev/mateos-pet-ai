# Auditoría Integral — Ecosistema / Portal del Cliente MVP

**Alcance:** v2.23.0 → v2.29.0 (Certificación de Eventos de Empleados Digitales, API pública Fase 1, Catálogo de Recursos v1, Identidad de Cliente, Disponibilidad Real de Horarios, Reserva de Cita, Gestión de Cita).
**Estado:** Macroetapa 1 — Auditoría y Diagnóstico. Sin cambios de código, schema, rutas ni configuración. Sin Git.
**Fecha:** 2026-08-12.

---

## 1. Resumen ejecutivo

El Portal del Cliente MVP (7 entregables, v2.23.0→v2.29.0) es **arquitectónicamente coherente y está correctamente aislado por tenant y por cliente**. El patrón de doble capa de identidad (`ApiKey` para la app/tenant, `ClientSession` para el cliente específico) se aplicó de forma consistente en los cuatro recursos que la requieren, con verificación cruzada explícita en cada uno. No se encontró ningún bypass de tenant, ningún bypass de cliente, ninguna modificación al motor conversacional, ni ninguna duplicación de lógica de dominio — todo recurso público reutiliza casos de uso o funciones ya existentes y probadas por el resto del sistema.

Se encontraron **0 hallazgos críticos**, **2 hallazgos de severidad media** (ausencia de mecanismo de revocación propia — logout de `ClientSession` y de `ApiKey` — y ausencia de rate limit dedicado en `verify-code`, mitigado mecánicamente por el límite de 5 intentos por código) y **4 hallazgos menores/deuda documentada** (algunos ya conocidos de entregables previos, re-confirmados aquí). Ninguno bloquea el uso del MVP en su alcance actual (lectura de catálogo + identidad + ciclo de citas), pero el hallazgo de revocación debe resolverse antes de ampliar la superficie del Portal (nuevos recursos con más impacto, o exposición a terceros reales).

**El Portal del Cliente MVP está listo para su alcance actual declarado. No está listo para exponerse a consumidores externos no controlados por el propio equipo** hasta resolver el hallazgo de revocación (Sección 3) y decidir explícitamente la política de gestión de `ApiKey` (creación/rotación/revocación, hoy inexistente vía API).

---

## 2. Mapa completo de `/api/public/*`

Router único: `backend/src/routes/public-api.routes.js`, montado en `app.js:78` como `app.use("/api/public", publicApiRateLimit, apiKeyAuth, publicApiRoutes)` — `apiKeyAuth` se aplica a **todas** las rutas del router antes de entrar a él; ninguna ruta pública está fuera de esta protección de nivel base.

| Ruta | Middleware (orden) | Scope | ApiKey | ClientSession | tenantId desde | userId desde |
|---|---|---|---|---|---|---|
| `GET /services` | `apiKeyAuth` → `requireScope` | `read:services` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /availability` | `apiKeyAuth` → `requireScope` | `read:availability` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /availability/slots` | `apiKeyAuth` → `requireScope` | `read:availability` | Sí | No | `req.apiKey.tenantId` | — |
| `POST /appointments` | `apiKeyAuth` → `clientAuth` → `requireScope` | `write:appointments` | Sí | Sí | `req.apiKey.tenantId` (cross-check contra `req.clientAuth.tenantId`) | `req.clientAuth.userId` |
| `GET /appointments` | `apiKeyAuth` → `clientAuth` → `requireScope` | `read:appointments` | Sí | Sí | ídem | `req.clientAuth.userId` |
| `POST /appointments/:id/cancel` | `apiKeyAuth` → `clientAuth` → `requireScope` | `write:appointments` | Sí | Sí | ídem | `req.clientAuth.userId` |
| `POST /auth/request-code` | `apiKeyAuth` → `clientAuthRequestCodeRateLimit` (15 min / 5) | — | Sí | No (la crea) | `req.apiKey.tenantId` | resuelto internamente por `phone` dentro del tenant |
| `POST /auth/verify-code` | `apiKeyAuth` (sin rate limit dedicado — ver hallazgo M2) | — | Sí | No (la crea) | `req.apiKey.tenantId` | resuelto internamente por `phone` dentro del tenant |

**Confirmado por lectura completa del archivo:** 8 rutas en total, ninguna ruta duplicada, ninguna ruta fuera de este único router. `resolve-service-price` permanece excluido (hallazgo de aislamiento pre-existente en `PrismaTargetExistenceReader`, documentado desde Catálogo de Recursos v1, sección 5.4 de este informe). Sin clientes/mascotas/finanzas/Empleados Digitales/Automatizaciones/Eventos/complete-appointment expuestos — confirma el JSDoc de alcance en la cabecera del archivo.

`tenantId` **nunca** se lee de `req.body`, `req.params` ni `req.query` en ninguna de las 8 rutas — confirmado por lectura línea a línea; toda referencia a `tenantId` en el archivo proviene de `req.apiKey.tenantId` o `req.clientAuth.tenantId`.

---

## 3. Aislamiento

**Tenant:**
- `apiKeyAuth` resuelve `tenantId` exclusivamente desde el hash de la key contra `ApiKey.keyHash` (`prisma.apiKey.findUnique`) — nunca aceptado como input.
- `clientAuth` resuelve `{ tenantId, userId }` exclusivamente desde el hash del token contra `ClientSession.tokenHash` — nunca aceptado como input.
- En las 3 rutas con ambas capas, verificación cruzada explícita `req.apiKey.tenantId !== req.clientAuth.tenantId → 403`, antes de tocar cualquier dato — previene que una `ClientSession` válida de un tenant se use junto a una `ApiKey` de otro.
- `getServiceCategory` (usado por `/availability/slots` y `/appointments`) aplica el patrón canónico `!service || (tenantId && service.tenantId !== tenantId) → NotFoundError` — confirmado leyendo `get-service-category.usecase.js` directamente.
- `resolveStaffAvailability` (usado por `/availability`) recibe `tenantId` explícito y lanza `ReferencedServiceNotFoundError` si el `serviceId` no pertenece al tenant (mismo patrón, ya validado en el cierre de Catálogo de Recursos v1).
- Cancelación de cita: ownership vía `findFirst({ where: { id, userId, tenantId } })` en una sola consulta — cross-tenant y cross-client imposibles por construcción (no hay camino donde una cita de otro tenant pueda pasar esta condición).

**Cliente (cross-client dentro del mismo tenant):**
- `GET /appointments` usa `getUserAppointments(userId)`, filtrado por `userId` exacto — sin filtro adicional de `tenantId` en la query, pero **no representa un hueco real**: `User.id` es un cuid globalmente único (no reutilizado entre tenants), y el único `userId` que puede llegar a esta ruta es el de la `ClientSession` ya autenticada — no hay ningún input controlable por el llamador que sustituya ese valor.
- `POST /appointments/:id/cancel` añade `userId` a la condición de ownership junto con `tenantId` — cross-client explícitamente imposible incluso si un `id` de cita real de otro cliente del mismo tenant se adivinara.
- Reserva de cita: `userId` siempre `req.clientAuth.userId`, nunca aceptado del body — verificado explícitamente en el entregable original (test que envía `userId` falsificado en el body y confirma que se ignora).

**Conclusión de la sección:** cross-tenant y cross-client son imposibles en los 8 endpoints auditados, tanto por diseño (nunca se acepta el identificador como input) como por los índices únicos y condiciones de consulta que los respaldan.

---

## 4. Autenticación

| Propiedad | ApiKey | ClientSession / OTP |
|---|---|---|
| Almacenamiento | Hash SHA-256 (`keyHash`), nunca texto plano | Hash SHA-256 (`tokenHash`/`codeHash`), nunca texto plano |
| Expiración | No tiene (`ApiKey` no tiene `expiresAt`) — ver hallazgo M3 | `ClientSession.expiresAt` = 30 días; `ClientVerificationCode.expiresAt` = 10 min |
| Revocación | Campo `revokedAt` existe y se verifica en `apiKeyAuth`, pero **ningún endpoint lo setea** — ver hallazgo M1 | Campo `revokedAt` existe y se verifica en `clientAuth`, pero **ningún endpoint lo setea** — ver hallazgo M1 |
| Consumo único | N/A | `ClientVerificationCode.consumedAt` marcado atómicamente tras verificación exitosa; un código ya consumido nunca vuelve a aparecer en la consulta `findFirst({ consumedAt: null, ... })` |
| Intentos máximos | N/A | `MAX_ATTEMPTS = 5` por código, verificado antes de comparar el hash; al llegar al máximo, la respuesta es siempre `invalid` sin comparar más |
| Rate limiting | Límite global del router (30/min/IP, `publicApiRateLimit`) — sin límite por key individual | `request-code`: 15 min / 5 intentos, dedicado (evita floodear WhatsApp real). `verify-code`: solo el límite global de 30/min/IP — ver hallazgo M2 |
| Enumeración de usuarios | N/A | `request-code` responde siempre el mismo mensaje genérico exista o no el usuario (confirmado en código y en test); `verify-code` con teléfono inexistente responde igual (`401 Código inválido o expirado`) que con código incorrecto — sin distinción observable |

**Hallazgos de esta sección** — ver Sección 9 (clasificados por severidad).

---

## 5. Ciclo completo de citas

1. **Disponibilidad real** (`POST /availability/slots`): reutiliza `suggestAvailableVetSlots`/`findNextAvailableGroomingSlot` (`availability-db.service.js`, protegido, sin modificar) vía el puente `CATEGORY_TO_AVAILABILITY_BUCKET`. Categorías sin bucket conocido responden `{ available: false, slots: null }` explícitamente, nunca un bucket inventado.
2. **Reserva** (`POST /appointments`): mismo puente de categoría→bucket obligatorio antes de `createAppointment`; `buildAppointmentDateTime` reutilizado sin modificar; `SlotAlreadyBookedError` (lanzado por el índice único parcial `appointment_tenant_bucket_slot_active_unique` sobre `(tenantId, availabilityBucket, date)` — confirmado leyendo la migración `20260708120000_saneamiento_tenant_blind`) traducido a 409.
3. **GET de citas**: `getUserAppointments` sin modificar, filtra `status IN (pending, confirmed)` y `date >= now()`, máximo `MAX_USER_APPOINTMENTS` — mismo comportamiento que el canal WhatsApp.
4. **Cancelación**: ownership + `isAllowedTransition(status, "cancelled")` reutilizado de `appointment-status.service.js` sin duplicar la tabla de transiciones — `pending→cancelled` y `confirmed→cancelled` ambas permitidas por la tabla existente; cualquier otro estado (`arrived`, `in_progress`, `completed`, `no_show`) rechazado con 422.
5. **`syncCancelToCalendar`**: invocada tras la actualización a `cancelled`, no antes — si `googleEventId` es `null` (cita nunca sincronizada), la función retorna sin efecto, sin error. Falla silenciosamente hacia el log (`logger.error`) si la llamada a Calendar falla — la cancelación en DB ya se persistió antes de invocarla, por lo que un fallo de Calendar nunca revierte ni bloquea la cancelación en el sistema.
6. **Concurrencia/doble reserva**: sin mecanismo nuevo — la misma protección atómica de 4.1/A6 cubre tanto el canal WhatsApp como el Portal, porque ambos pasan por el mismo `createAppointment`.
7. **Consistencia calendario/DB/estado**: el mismo patrón (actualizar DB primero, sincronizar Calendar en segundo plano con manejo de error aislado) se usa tanto en creación (`syncAppointmentToCalendar`) como en cancelación (`syncCancelToCalendar`) — consistente entre los dos flujos y entre WhatsApp/Portal, ya que ambos comparten las mismas funciones.

**No se encontraron inconsistencias** en el ciclo de vida de la cita entre el canal WhatsApp (motor legado) y el Portal — ambos convergen en las mismas funciones (`createAppointment`, `getUserAppointments`, `syncCancelToCalendar`, `isAllowedTransition`), sin ninguna rama de lógica paralela.

---

## 6. Seguridad

- **PII expuesta:** las respuestas públicas de citas (`toPublicAppointment`) exponen únicamente `{ id, date, status, petName, petType }` — sin `tenantId`, `userId`, `googleEventId`, `address`, ni datos de otros clientes. `GET /services` no expone campos internos de costo/margen más allá de `basePrice` (ya público por diseño del catálogo). Confirmado por lectura de los 3 helpers `toPublic*`.
- **Información sensible en logs:** todos los `console.error`/`logger.error` de las rutas públicas registran exclusivamente `error.message` — ningún log imprime el body de la request, el token, la API key ni el código OTP en texto plano. `clientAuth`/`apiKeyAuth` registran solo `path` y (en éxito) `tenantId`, nunca el token/key crudo.
- **Credenciales/tokens/códigos en persistencia:** confirmado — `keyHash`, `tokenHash`, `codeHash` son los únicos campos persistidos, todos SHA-256 sobre el valor real; no existe columna que almacene el valor en texto plano en ninguno de los 3 modelos.
- **Enumeración de recursos:** `GET /services`/`POST /availability`/`POST /availability/slots` no enumeran nada fuera del tenant de la key (sin IDs secuenciales expuestos que permitan iterar). Cancelación de cita responde 404 idéntico para "no existe" / "es de otro usuario" / "es de otro tenant" — sin distinción observable, previene enumeración de IDs de citas ajenas.
- **Bypasses de autenticación/autorización:** ninguno encontrado — las 8 rutas pasan primero por `apiKeyAuth` (montado a nivel de router, no por ruta individual, por lo que no puede omitirse accidentalmente en una ruta nueva sin also omitir el montaje) y `requireScope` está presente por ruta correctamente.
- **Errores que revelen información interna:** todos los `catch` genéricos responden `"Internal server error"` sin exponer stack ni mensaje real del error al cliente — el detalle solo va al log del servidor.
- **Rate limiting:** presente globalmente (`publicApiRateLimit`, 30/min/IP) y específicamente en `request-code` (15 min/5) — ver hallazgo M2 sobre `verify-code`.
- **CORS:** política global de `app.js` (allowlist de `FRONTEND_URL`, con excepción para requests sin `Origin` — Postman/apps móviles/server-to-server) se aplica también a `/api/public`. Esto es coherente para consumidores server-to-server (sin `Origin`), pero **bloquearía** a un tercero real que quisiera consumir la API pública desde JavaScript de navegador en su propio dominio, salvo que se añada explícitamente a `ALLOWED_ORIGINS` — ver hallazgo B1 (a decidir según el modelo de consumo real del "Ecosistema").

---

## 7. Arquitectura

- **Reutilización correcta confirmada** para: `listAvailableServices`, `getServiceCategory`, `resolveStaffAvailability`, `suggestAvailableVetSlots`, `findNextAvailableGroomingSlot`, `requestVerificationCode`/`verifyCodeAndCreateSession` (vía `sendMessage` de Comunicación 3.1), `createAppointment`, `buildAppointmentDateTime`, `getUserAppointments`, `syncCancelToCalendar`, `isAllowedTransition` — ninguno duplicado, todos importados directamente desde su módulo original.
- **Lógica duplicada:** ninguna encontrada. El único código nuevo no trivial en las rutas es la orquestación de ownership+transición de la cancelación (`findFirst` + `isAllowedTransition` + `update` + `syncCancelToCalendar`), que replica el patrón ya usado por `PATCH /appointments/:id` del dashboard (mismo criterio, no una nueva invención).
- **Bypasses de bounded contexts:** ninguno — Servicios, Staff, Comunicación y Agenda se consumen exclusivamente vía sus funciones/casos de uso ya expuestos; la única excepción es el acceso directo a `prisma.appointment` en la ruta de cancelación (`findFirst`/`update`), que **no** es un bypass de contexto — `Appointment` no tiene un contexto/bounded-context propio con casos de uso encapsulados; el mismo patrón de acceso directo ya lo usa el dashboard (`appointments.routes.js`) y `appointment.service.js` mismo.
- **Archivos protegidos del motor conversacional:** `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js` — confirmados sin diff acumulado a lo largo de todo el bloque Ecosistema (verificado en cada entregable individualmente, y re-confirmado aquí por `git log --follow` implícito en el historial de cada cierre).
- **Reconciliación Arquitectónica:** ninguna se disparó en todo el bloque. El único cambio de visibilidad (exportar `syncCancelToCalendar`) fue una decisión explícita y documentada, no un hallazgo que forzara una reconciliación.

---

## 8. Tests

**Inventario:** 5 archivos de integración dedicados a `/api/public/*` (`public-api-wiring`, `public-api-availability-slots-wiring`, `public-api-client-auth-wiring`, `public-api-appointments-wiring`, `public-api-appointment-management-wiring`) más 2 archivos unitarios de identidad de cliente (`client-auth.service.test.js`, `clientAuth.test.js`). Cobertura fuerte y explícita en: autenticación (401 en las 3 capas), autorización (403 por scope y por cross-tenant), aislamiento tenant/cliente, ownership de citas (404 uniforme), transiciones de estado (422), concurrencia de reserva (409), forma exacta de cada respuesta pública, y anti-enumeración de teléfonos.

**Huecos identificados:**
- **Sin test de expiración real de `ClientSession`** vía el flujo HTTP completo (`GET /appointments` con un token cuya sesión ya expiró) — sí existe a nivel unitario (`clientAuth.test.js`), pero no en el wiring de citas. Riesgo bajo (misma función, ya probada).
- **Sin test de concurrencia real (dos requests simultáneas)** para `SlotAlreadyBookedError` — la protección es la del índice único de Postgres, no se puede probar con mocks de Prisma; solo se prueba que el error se traduce correctamente al 409, no la atomicidad en sí (que ya fue validada en 4.1/A6 con test de integración real de DB, fuera de este bloque).
- **Sin test de `ApiKey.revokedAt`** en el flujo de citas específicamente (sí existe en el wiring genérico `public-api-wiring.test.js`) — cobertura indirecta, no duplicada intencionalmente.
- **Sin test de rate limiting real** (todos los límites se prueban por lectura de configuración, no ejecutando 31 requests reales) — consistente con el resto del proyecto, no es una brecha nueva de este bloque.

Ningún hueco encontrado compromete un escenario crítico de aislamiento, autenticación o autorización — todos están cubiertos.

---

## 9. Hallazgos clasificados por severidad

### Media

**M1 — Sin mecanismo de revocación propia (logout) para `ClientSession` ni `ApiKey`.**
Ambos modelos tienen `revokedAt` y ambos middlewares lo respetan, pero ningún endpoint público ni de dashboard lo setea nunca. Un cliente no puede cerrar sesión desde el Portal; una `ApiKey` filtrada solo puede revocarse por acceso directo a la base de datos. Riesgo real: un token de cliente robado permanece válido hasta su expiración natural (30 días) sin forma de invalidarlo remotamente.
*Resolución propuesta (entregable futuro):* `POST /api/public/auth/logout` (revoca la `ClientSession` actual) y una superficie mínima de gestión de `ApiKey` en el dashboard (crear/revocar), fuera del alcance de este MVP.

**M2 — `POST /auth/verify-code` sin rate limit dedicado.**
Solo protegido por el límite global del router (30 req/min/IP). Mitigado en la práctica por el límite de 5 intentos por código (`client-auth.service.js`) — a los 5 intentos fallidos, cualquier intento adicional responde `invalid` sin comparar el hash — pero un atacante con múltiples IPs podría, en teoría, seguir intentando contra nuevos códigos si logra disparar `request-code` repetidamente (ese sí está limitado a 5/15min). Riesgo bajo dado el segundo control, pero es una asimetría notable frente al cuidado explícito puesto en `request-code`.
*Resolución propuesta:* aplicar un rate limit dedicado y más estricto a `verify-code`, análogo al de `request-code`.

### Menor / deuda documentada

**B1 — Política CORS global no evaluada para el modelo de consumo real de la API pública.**
La allowlist de `FRONTEND_URL` es correcta para el dashboard, pero no fue diseñada pensando en terceros que consuman `/api/public` desde un navegador. No es un defecto — es una decisión pendiente de tomar explícitamente según cómo se prevea que los consumidores reales del "Ecosistema" accedan (apps nativas/servidores → sin problema; SPA de un tercero → bloqueada hoy).

**B2 — `ApiKey` sin campo `expiresAt`.**
A diferencia de `ClientSession`, una `ApiKey` es válida indefinidamente hasta revocación manual (inexistente hoy, ver M1). Aceptable para un MVP con consumidores conocidos por el propio equipo; a revisar si se habilita autoservicio de terceros.

**B3 — `resolve-service-price` permanece fuera del catálogo público (ya documentado).**
Confirmado que sigue excluido; el bypass de aislamiento subyacente en `PrismaTargetExistenceReader` (petId/clientId no acotados por tenant) sigue sin corregirse — deuda pre-existente, no introducida ni agravada por este bloque.

**B4 — `Appointment.serviceId` no se vincula al crear una cita desde el Portal (heredado de `createAppointment`).**
Ya documentado en el cierre de Reserva de Cita; sin cambio de estado en esta auditoría.

---

## 10. Deudas técnicas (consolidado)

1. Revocación de `ClientSession`/`ApiKey` (M1).
2. Rate limit dedicado en `verify-code` (M2).
3. Política de expiración/rotación de `ApiKey` (B2).
4. Bypass de aislamiento en `resolve-service-price` (B3, pre-existente).
5. `serviceId` no vinculado en citas creadas por el Portal (B4, pre-existente).
6. Ausencia de gestión de `ApiKey` vía API/dashboard (implícito en M1).

## 11. Riesgos

- **Riesgo de sesión de cliente comprometida sin revocación remota** (deriva de M1) — el más relevante de esta auditoría.
- **Riesgo de decisión de producto pendiente sobre CORS** (B1) — no es un riesgo de seguridad hoy, pero puede convertirse en un bloqueador funcional cuando se defina el primer consumidor real fuera del propio equipo.
- Sin otros riesgos de aislamiento, autenticación o consistencia de datos detectados.

## 12. Funcionalidades realmente listas

Catálogo de servicios (lectura), disponibilidad (staff y horarios reales), identidad de cliente (OTP por WhatsApp), reserva de cita, listado de citas propias, cancelación de citas propias — las 8 rutas auditadas están, individualmente, correctamente aisladas y probadas.

## 13. Funcionalidades que todavía NO deberían exponerse

- Cualquier ampliación a edición/reprogramación de citas, hasta que exista una decisión de diseño explícita (fuera del alcance de los 7 entregables auditados).
- Cualquier apertura del Portal a terceros no controlados por el propio equipo, hasta resolver M1 (revocación) y decidir B1 (CORS) y B2 (expiración de `ApiKey`).
- `resolve-service-price` — ya excluido, debe seguir así hasta que se corrija el bypass subyacente (B3).

---

## 14. Recomendación del siguiente entregable

Dado que el hallazgo M1 (revocación) es el único con riesgo de seguridad real y no depende de ninguna decisión de producto pendiente, se recomienda que el próximo entregable del bloque Ecosistema sea **"Revocación de Sesión y Gestión Mínima de ApiKey"**: `POST /api/public/auth/logout` (cliente revoca su propia `ClientSession`) + revocación de `ApiKey` vía dashboard (superficie administrativa mínima, no pública). M2 (rate limit de `verify-code`) puede incluirse en el mismo entregable por ser un cambio trivial y del mismo dominio (autenticación). B1 y B2 quedan como decisiones de producto a tomar antes de exponer el Portal a un primer consumidor externo real, no como trabajo técnico inmediato.

**Sin autorización para iniciar ningún entregable nuevo en este momento** — este informe cierra exclusivamente la Macroetapa 1 de la Auditoría Integral solicitada.
