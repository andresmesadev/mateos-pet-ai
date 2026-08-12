# Cierre del Entregable — Disponibilidad Real de Horarios (Ecosistema)

**Fecha:** 2026-08-12
**Bloque:** Ecosistema (post-Fase 6) — quinto entregable, extiende el Catálogo de Recursos de la API pública v1.
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.27.0`.
**Naturaleza del entregable:** nuevo recurso de solo lectura sobre el catálogo público — traduce un `serviceId` a horarios reales disponibles, reutilizando infraestructura de disponibilidad ya consolidada en 6.2.

---

## Objetivo del entregable

`POST /api/public/availability` (Catálogo v1) resuelve "qué staff puede atender", no "qué horarios concretos hay disponibles hoy/esta semana" — la pregunta real que necesita una UI de reserva. Ese cómputo ya existía, tenant-aware, en `availability-db.service.js` (`suggestAvailableVetSlots`, `findNextAvailableGroomingSlot`), pero operaba sobre un vocabulario legado de "bucket" (`vet`/`grooming`), no sobre el `serviceId` del catálogo público.

## Diseño congelado (Macroetapa 1)

- Ambas funciones de disponibilidad, ya exportadas y tenant-aware desde 6.2, reutilizables sin tocar los archivos protegidos.
- Puente limpio encontrado: `ServiceCategory.name` ya usa exactamente `"veterinary"`/`"grooming"` (mismos nombres que `CATEGORY_REQUIRED_MODULE`) — evita replicar el normalizador legado de decenas de sub-servicios en español.
- Decisiones congeladas: categoría sin bucket conocido → `{ available: false, slots: null }`, nunca error ni bucket inventado; reutilizar el scope `read:availability` existente, sin scope nuevo.

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Durante la implementación se identificó que "resolver el servicio dentro del tenant" no tenía ningún caso de uso existente que devolviera la categoría de un `serviceId` — se agregó `get-service-category.usecase.js`, siguiendo el patrón canónico de verificación de propiedad por tenant, sin ampliar el alcance del entregable (era la pieza de wiring necesaria, no una capacidad nueva independiente).

## Resumen de implementación

- **`backend/src/contexts/services/application/use-cases/get-service-category.usecase.js`** (nuevo) — resuelve `categoryName` de un `serviceId`, verificado por `tenantId` (`ServiceNotFoundError` si no existe o pertenece a otro tenant).
- **`backend/src/contexts/services/index.js`** — exporta `getServiceCategory`.
- **`backend/src/routes/public-api.routes.js`** — `POST /availability/slots` (`read:availability`), mapa `{ veterinary: "vet", grooming: "grooming" }`, llama a `suggestAvailableVetSlots`/`findNextAvailableGroomingSlot` según el bucket resuelto, con `tenantId` exclusivamente de `req.apiKey.tenantId`.
- **Tests nuevos (13):** `get-service-category.usecase.test.js` (4), `public-api-availability-slots-wiring.test.js` (9).

## 1. Validación Técnica

- **Suite completa:** **100/100 suites · 640/640 tests** en verde (antes 98/98 · 627 — +2 suites, +13 tests, cero regresiones).
- `git diff --stat -- prisma/` vacío — sin cambios de schema ni migraciones.
- `git diff --stat` del entregable: 3 archivos modificados + 3 nuevos.

## 2. Validación Funcional (grep exhaustivo)

- **Router público con exactamente 5 rutas** (`GET /services`, `POST /availability`, `POST /availability/slots`, `POST /auth/request-code`, `POST /auth/verify-code`) — ninguna adicional, sin endpoints fuera del alcance acumulado del bloque Ecosistema.
- **`clientAuth` confirmado sin relación con `/availability/slots`** — la única aparición de `clientAuth*` en el router es el rate limiter de `request-code`, ajeno a este entregable.
- **Motor conversacional y archivos protegidos de disponibilidad (`availability.service.js`, `availability-db.service.js`) confirmados sin diff.**

## 3. Validación de Invariantes

- **Autenticación:** sin API key → 401, sin llegar a `getServiceCategory`.
- **Scope:** key sin `read:availability` → 403, sin llegar a `getServiceCategory`.
- **Aislamiento por tenant:** `tenantId` resuelto exclusivamente de `req.apiKey.tenantId` — verificado con `tenantId` falsificado en el body, ignorado tanto en la resolución del servicio como en la llamada a la función de disponibilidad.
- **`serviceId` inexistente o de otro tenant:** 404, verificado explícitamente, sin invocar ninguna función de disponibilidad.
- **`veterinary` → `vet`:** verificado, llama a `suggestAvailableVetSlots` y no a `findNextAvailableGroomingSlot`.
- **`grooming` → `grooming`:** verificado, llama a `findNextAvailableGroomingSlot` y no a `suggestAvailableVetSlots`.
- **Categoría desconocida:** verificado, responde `{ available: false, slots: null }`, sin error, sin invocar ninguna de las dos funciones de disponibilidad.
- **Sin horas libres:** verificado, `available: false` con el `dateKey` real resuelto, no un valor vacío genérico.

## 4. Validación Arquitectónica

- **Motor conversacional y disponibilidad protegida intactos** — confirmado por `git diff --stat`.
- **Sin Reconciliación Arquitectónica** — se reutilizan exports ya públicos de los archivos protegidos, sin modificarlos.
- **Sin cambios de schema ni migraciones.**
- **`clientAuth` sigue sin montar en ningún recurso** — confirmado.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación coincidió exactamente con el diseño congelado, incluyendo la pieza de wiring (`get-service-category.usecase.js`) ya reportada como checkpoint en la Macroetapa 2.

## Alcance restante (fuera de este entregable)

Reserva de cita y gestión de cita (ver/cancelar) — dependientes de Identidad de Cliente (ya resuelta, v2.26.0), pero no incluidas aquí por decisión explícita del roadmap de Ecosistema.

## Versionado

Versión declarada del proyecto actualizada de `2.26.0` a `2.27.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): un recurso nuevo, observable externamente (`POST /api/public/availability/slots`), sobre el Catálogo de Recursos de la API pública. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva antes de proponer diseño; puente `ServiceCategory.name` → bucket encontrado con evidencia, sin replicar el normalizador legado.
- ✅ Alcance implementado exactamente según lo congelado, incluyendo la pieza de wiring (`get-service-category.usecase.js`) reportada como parte necesaria del alcance ya autorizado.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional y archivos protegidos de disponibilidad sin cambios.
- ✅ `clientAuth` sin participación.
- ✅ Suite completa en verde (100/100 · 640/640).
- ✅ Macroetapa 4 (versionado a `2.27.0`, commit, tag, push) completada.
