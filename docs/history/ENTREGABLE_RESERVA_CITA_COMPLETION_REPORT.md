# Cierre del Entregable — Reserva de Cita (Portal del Cliente)

**Fecha:** 2026-08-12
**Bloque:** Ecosistema (post-Fase 6) — sexto entregable, primer recurso de escritura del catálogo público.
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.28.0`.
**Naturaleza del entregable:** primer endpoint de escritura de la API pública — permite que un cliente autenticado reserve una cita real, reutilizando `createAppointment` sin modificarlo.

---

## Objetivo del entregable

Con Identidad de Cliente (v2.26.0) y Disponibilidad Real de Horarios (v2.27.0) ya cerrados, el bloque Ecosistema desbloqueó la posibilidad de reservar una cita real desde un cliente autenticado, sin tocar el motor conversacional.

## Diseño congelado (Macroetapa 1)

- `createAppointment` (no protegido) ya tiene una firma razonablemente channel-agnostic y su protección de doble-reserva/concurrencia ya es atómica (índice único `(tenantId, availabilityBucket, date)`, desde 4.1/A6) — sin necesidad de mecanismo nuevo.
- **Hallazgo crítico:** `mapToAvailabilityServiceType` (interno a `createAppointment`) no reconoce `"veterinary"` (nombre de categoría del catálogo público) — solo `"vet"`/`"grooming"`/sub-servicios legados. Pasar la categoría cruda rompería la protección anti-colisión. Resuelto reutilizando el mismo mapa de 2 entradas ya construido en Disponibilidad Real de Horarios.
- Modelo de aislamiento: `userId` exclusivamente de `ClientSession` (vía `clientAuth`, montado por primera vez), `tenantId` exclusivamente de `ApiKey`, con verificación cruzada obligatoria entre ambos.
- Scope nuevo `write:appointments` — sin necesidad de schema (`ApiKey.scopes` ya es `String[]`).

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Sin contradicciones nuevas.

## Resumen de implementación

**Único archivo de producción modificado:** `backend/src/routes/public-api.routes.js` — `POST /appointments`, montado con `clientAuth` (primer uso) + `requireScope("write:appointments")`.

Flujo: verificación cruzada `req.apiKey.tenantId === req.clientAuth.tenantId` (403 si difiere) → validación de `serviceId`/`petName`/`petType` (400) → `getServiceCategory` reutilizado (404 si no existe/otro tenant) → mapa `{ veterinary: "vet", grooming: "grooming" }` reutilizado (422 si sin bucket) → `buildAppointmentDateTime` reutilizado (400 si inválido) → `createAppointment` reutilizado sin modificar (409 si `SlotAlreadyBookedError`) → respuesta 201 con forma pública mínima.

**Tests nuevos (14):** `public-api-appointments-wiring.test.js`.

## 1. Validación Técnica

- **Suite completa:** **101/101 suites · 654/654 tests** en verde (antes 100/100 · 640 — +1 suite, +14 tests, cero regresiones).
- `git diff --stat -- prisma/` vacío.
- `git diff --stat` del entregable: 1 archivo modificado + 1 nuevo.

## 2. Validación Funcional (grep exhaustivo)

- **`clientAuth` montado exactamente una vez**, exclusivamente en `POST /appointments` — confirmado, ningún otro recurso lo requiere.
- **`createAppointment` sin modificar** — `git diff --stat` vacío sobre `appointment.service.js`. Sus únicos consumidores son `whatsapp.service.js` (legado, sin cambios) y la nueva ruta pública — ningún otro camino la invoca.
- **Una única ruta `POST /appointments`** en todo el árbol de rutas del backend (el namespace del dashboard usa subrutas distintas, `/appointments/today`, `/appointments/:id`, etc. — sin colisión ni ruta duplicada).

## 3. Validación de Invariantes — exhaustiva, por cada propiedad exigida

- **Aislamiento tenant/cliente end-to-end:** verificado que sin API key → 401 (sin tocar nada); sin `X-Client-Token` → 401; sin scope → 403 — los tres antes de cualquier resolución de datos.
- **Imposibilidad de `tenantId`/`userId` proporcionados por el cliente:** verificado explícitamente enviando `userId`/`tenantId` falsificados en el body — `createAppointment` siempre recibe `req.clientAuth.userId` y `req.apiKey.tenantId`, nunca el valor del body.
- **Verificación cruzada ApiKey↔ClientSession:** verificado — una `ClientSession` de un tenant usada con una `ApiKey` de otro → 403, sin llamar a `getServiceCategory` ni a `createAppointment`.
- **Aislamiento del `serviceId`:** reutiliza `getServiceCategory` (ya prueba tenant ownership) — `serviceId` inexistente o de otro tenant → 404, verificado.
- **Conversión `veterinary`→`"vet"` y `grooming`→`"grooming"`:** ambas verificadas por separado, comprobando el valor exacto de `serviceType` recibido por `createAppointment`.
- **Concurrencia/doble reserva:** sin mecanismo nuevo — se confirma que `SlotAlreadyBookedError` (ya lanzado por el índice único atómico de `createAppointment`) se traduce a 409, verificado explícitamente.
- **Todos los caminos de error verificados con su código HTTP exacto:** 401 (sin key/sin token), 403 (sin scope, tenant/cliente no coincide), 400 (sin `serviceId`/`petName`/`petType`, fecha inválida), 404 (`serviceId` no encontrado), 422 (categoría sin bucket), 409 (slot ya reservado).
- **Forma exacta de la respuesta pública:** verificada por comparación exacta de claves — `{ id, date, status, petName, petType }` únicamente, aunque `createAppointment` devuelva `tenantId`, `userId`, `googleEventId` y `availabilityBucket` en el objeto real.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — confirmado, `git diff --stat` vacío sobre los 5 archivos protegidos.
- **`createAppointment` sin modificar** — confirmado.
- **Sin duplicación de lógica de aislamiento, disponibilidad ni resolución de servicios** — todo reutilizado (`getServiceCategory`, el mapa de bucket, `buildAppointmentDateTime`, `createAppointment`).
- **Sin cambios de schema ni migraciones.**
- **Sin Reconciliación Arquitectónica.**

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo.

## Alcance restante (fuera de este entregable)

Gestión de cita (ver/cancelar) — dependiente de este entregable y de Identidad de Cliente, no incluida aquí. `serviceId` no queda vinculado en el `Appointment` creado (limitación heredada de `createAppointment`, documentada en la Macroetapa 1, no corregida por decisión explícita de no modificar esa función).

## Versionado

Versión declarada del proyecto actualizada de `2.27.0` a `2.28.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): es el primer endpoint de escritura de toda la API pública, capacidad nueva y observable (un cliente autenticado puede crear una cita real). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva de `createAppointment` y sus efectos secundarios antes de proponer diseño; hallazgo crítico del mapeo de categoría encontrado y resuelto antes de implementar.
- ✅ Alcance implementado exactamente según lo congelado — sin modificar `createAppointment`, sin duplicar aislamiento/disponibilidad/resolución de servicios ya existentes.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional sin cambios.
- ✅ `clientAuth` montado exclusivamente en este recurso.
- ✅ Suite completa en verde (101/101 · 654/654).
- ✅ Macroetapa 4 (versionado a `2.28.0`, commit, tag, push) completada.
