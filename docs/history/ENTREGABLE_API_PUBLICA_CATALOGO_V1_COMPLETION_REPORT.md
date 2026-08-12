# Cierre del Entregable — Catálogo de Recursos de la API pública v1

**Fecha:** 2026-08-12
**Bloque:** Ecosistema (post-Fase 6) — tercer entregable, sobre la infraestructura de identidad de la Fase 1 (`ApiKey`, v2.24.0).
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.25.0`.
**Naturaleza del entregable:** primer catálogo real de recursos consumibles por terceros — dos endpoints de solo lectura, sin capacidad de escritura, sin exposición de datos sensibles.

---

## Objetivo del entregable

Con el mecanismo de identidad (`ApiKey`) ya operativo y aplicado en la base de datos productiva, este entregable expone los dos primeros recursos reales: catálogo de servicios y disponibilidad de staff — ambos ya channel-agnostic en el dominio, sin necesidad de tocar ningún caso de uso existente.

## Diseño congelado (Macroetapa 1)

- Auditoría de casos de uso existentes en Servicios, Staff y Agenda para identificar candidatos con aislamiento por `tenantId` ya correcto.
- **Hallazgo central:** no existe ningún caso de uso de dominio para "crear cita" — solo vive dentro del motor conversacional protegido (`whatsapp.service.js`). Excluido del catálogo, sin fecha de resolución.
- **Checkpoint de contradicción resuelto durante la auditoría:** `resolve-service-price.usecase.js` tenía un bypass real de aislamiento — `TargetExistenceReaderPort.getPetAttributes`/`petExists`/`clientExists` no filtran por `tenantId`, permitiendo que una API key de un tenant use datos (`breed`) de un `petId` de otro tenant para calcular precio. Excluido del catálogo v1, documentado como deuda separada.
- Catálogo v1 congelado: `GET /services` (`read:services`), `POST /availability` (`read:availability`) — ambos con aislamiento por `tenantId` verificado en el código real antes de congelar.

## Checkpoint de contradicción (previo a Macroetapa 2)

Verificado que `listAvailableServices` y `resolveStaffAvailability` ya estaban exportados en sus composition roots pero sin ningún consumidor real — confirma que son seguros de reutilizar sin efectos sobre ningún llamador existente. Sin contradicciones.

## Resumen de implementación

- **`backend/src/middleware/requireScope.js`** (nuevo) — 403 si `req.apiKey.scopes` no incluye el scope exigido por la ruta.
- **`backend/src/routes/public-api.routes.js`** (nuevo) — `GET /services` y `POST /availability`. `tenantId` tomado exclusivamente de `req.apiKey.tenantId` (resuelto por `apiKeyAuth`, Fase 1) — nunca de `body`/`params`/`query`. Validación de entrada: `serviceId` requerido y string; `rangeStart`/`rangeEnd` requeridos, parseables como fecha ISO, y `rangeStart < rangeEnd`. Mapeo de respuesta a una forma pública mínima (`toPublicService`, `toPublicStaff`) que excluye campos internos.
- **`backend/src/middleware/rateLimit.js`** — `publicApiRateLimit` (30 req/min, ventana global por IP, mismo mecanismo que el resto del proyecto).
- **`backend/src/app.js`** — `/api/public` montado como `publicApiRateLimit → apiKeyAuth → publicApiRoutes`, un único punto de entrada; `requireScope` aplicado por ruta dentro del router.
- **Tests nuevos (18):** `requireScope.test.js` (3), `public-api-wiring.test.js` (15).

## 1. Validación Técnica

- **Suite completa:** **95/95 suites · 602/602 tests** en verde (antes 93/93 · 587 — +2 suites, +18 tests (uno de los tests nuevos forma parte de `requireScope`), cero regresiones).
- `git diff --stat -- prisma/` vacío — sin cambios de schema ni migraciones.
- `git diff --stat` total del entregable: 2 archivos de infraestructura modificados (`app.js`, `rateLimit.js`) + 4 nuevos (2 producción, 2 test).

## 2. Validación Funcional (grep exhaustivo)

- **Mount único, sin bypass:** `app.js:78` — `/api/public` es el único punto que monta `apiKeyAuth`; ninguna otra ruta del proyecto lo requiere.
- **`requireScope` usado exactamente 2 veces**, una por endpoint, con el scope correcto en cada uno (`read:services` en `/services`, `read:availability` en `/availability`) — sin intercambio ni omisión.
- **`resolve-service-price` confirmado ausente** de `public-api.routes.js` — solo aparece en un comentario explicando su exclusión.
- **Ningún otro contexto de negocio tocado** — `git diff --stat` vacío sobre `finance`, `agents`, `automation`, `events`, `communication`, `agenda`, `schedule-coordinator`, `receptionist`.

## 3. Validación de Invariantes — aislamiento, scopes, autenticación, forma de respuesta

- **Autenticación:** sin API key → 401 en ambos endpoints, verificado, sin llegar a invocar el caso de uso.
- **Scopes:** una key sin el scope correspondiente → 403 en ambos endpoints, verificado, sin invocar el caso de uso.
- **Aislamiento cross-tenant:** ambos endpoints verificados con un `tenantId` "falsificado" enviado en query/body — el caso de uso siempre recibe el `tenantId` real de la key autenticada, nunca el valor suministrado por el consumidor.
- **Validación de entrada:** `serviceId` ausente → 400; fechas no parseables → 400; `rangeStart >= rangeEnd` → 400; `serviceId` inexistente → 404 (`ReferencedServiceNotFoundError`, capturado explícitamente por `instanceof`, no por comparación de string).
- **Forma exacta de la respuesta pública, verificada por comparación exacta de objeto (no solo `toMatchObject`):**
  - `/services`: `{ id, name, categoryId, duration, basePrice, requiresAppointment }` — `tenantId`, `active`, `createdAt`, `updatedAt` confirmados ausentes.
  - `/availability`: `{ id, name }` únicamente — `tenantId`, `phone`, `email`, `active` confirmados ausentes.
- **Rate limiting:** `publicApiRateLimit` aplicado en el mount, antes de `apiKeyAuth` — una IP que agote el límite nunca llega a consultar la base de datos de `ApiKey`, coherente con el resto de superficies públicas del proyecto (mismo patrón que `publicRateLimit` en billing/onboarding).

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — confirmado, `git diff --stat` vacío sobre los 5 archivos protegidos.
- **Sin Reconciliación Arquitectónica** — el entregable reutiliza casos de uso ya channel-agnostic sin modificarlos.
- **Sin cambios de schema ni migraciones.**
- **Email/SMS/apps de cliente-staff:** sin cambios.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación coincidió exactamente con el diseño congelado.

## Alcance restante (fuera de este entregable)

- `resolve-service-price` — bloqueado por el bypass de aislamiento documentado en la Macroetapa 1; requiere su propio entregable de saneamiento (cerrar el scoping en `PrismaTargetExistenceReader`) antes de poder exponerse.
- Creación/modificación de citas — bloqueado por el motor conversacional protegido; sin fecha.
- Rate limiting por API key individual (hoy es por IP, global) — mejora futura, no requerida por el alcance congelado.
- Cualquier recurso adicional (clientes, mascotas, finanzas, Empleados Digitales, Automatizaciones, Eventos, `complete-appointment`) — explícitamente excluido del catálogo v1.

## Versionado

Versión declarada del proyecto actualizada de `2.24.0` a `2.25.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): es el primer catálogo real de recursos consumibles por terceros, una capacidad nueva observable externamente (dos endpoints públicos que antes no existían). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva de candidatos antes de proponer diseño; bypass real de `resolve-service-price` encontrado y excluido antes de implementar.
- ✅ Alcance implementado exactamente según lo congelado — 2 recursos, ambos de solo lectura, ambos con aislamiento verificado por test.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional y todos los demás contextos de negocio sin cambios.
- ✅ Suite completa en verde (95/95 · 602/602).
- ✅ Macroetapa 4 (versionado a `2.25.0`, commit, tag, push) completada.
