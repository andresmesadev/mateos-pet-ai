# Cierre del Entregable — Gestión de Cita (Portal del Cliente)

**Bloque:** Ecosistema (post-Fase 6) — séptimo entregable, cierre del ciclo de vida de citas en la API pública.
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.29.0`.
**Naturaleza del entregable:** primer recurso de lectura/gestión sobre las propias citas del cliente — `GET /api/public/appointments` (listar) y `POST /api/public/appointments/:id/cancel` (cancelar), sin edición ni reprogramación.

---

## Objetivo del entregable

Con Reserva de Cita (v2.28.0) cerrada, el cliente autenticado podía crear una cita pero no verla ni cancelarla desde el Portal. Este entregable cierra ese ciclo mínimo, reutilizando la infraestructura de identidad (`clientAuth`) y de citas ya existente.

## Diseño congelado (Macroetapa 1)

- `getUserAppointments(userId)` reutilizable sin modificar — ya filtra por estados activos y fecha futura; `userId` llega siempre acotado a un tenant por `ClientSession`, sin necesidad de un filtro adicional por `tenantId`.
- `cancelAppointment` (legado) cancela "la cita activa más reciente" del usuario, sin parámetro `appointmentId` — inservible para que un cliente con varias citas elija cuál cancelar. No se modifica; se construye la orquestación de cancelación directamente en la ruta nueva, siguiendo el mismo patrón que `PATCH /appointments/:id` del dashboard (precedente citado en la auditoría).
- Ownership obligatorio vía una sola consulta `findFirst({ id, userId, tenantId })` antes de cualquier operación.
- Reutiliza `isAllowedTransition` (`appointment-status.service.js`) para validar la transición a `"cancelled"`, sin duplicar la tabla de transiciones.
- **Hallazgo resuelto en Macroetapa 1:** `syncCancelToCalendar` (sincronización con Google Calendar al cancelar) era una función privada, no exportada, usada internamente solo por `cancelAppointment` legado. Para mantener consistencia de calendario entre citas canceladas por WhatsApp y por el Portal, se decidió exportarla — cambio de visibilidad únicamente, sin alterar su comportamiento (decisión tomada explícitamente por el responsable del proyecto).
- Scopes reutilizados: `read:appointments` (nuevo, sin necesidad de schema), `write:appointments` (ya existente de Reserva de Cita).

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Sin contradicciones nuevas.

## Resumen de implementación (Macroetapa 2)

**Archivos modificados:**
- `backend/src/services/appointment.service.js` — un único cambio: `syncCancelToCalendar` agregada a `module.exports`. Confirmado por diff exacto: ninguna otra línea del archivo cambió.
- `backend/src/routes/public-api.routes.js` — dos rutas nuevas:
  - `GET /appointments` (`clientAuth` + `requireScope("read:appointments")`): verificación cruzada `req.apiKey.tenantId === req.clientAuth.tenantId` (403 si difiere) → `getUserAppointments(userId)` reutilizado sin modificar → respuesta `{ appointments: [...] }` en forma pública mínima.
  - `POST /appointments/:id/cancel` (`clientAuth` + `requireScope("write:appointments")`): misma verificación cruzada → ownership vía `findFirst({ id, userId, tenantId })` (404 si no existe/es de otro usuario/es de otro tenant, misma respuesta en los tres casos) → `isAllowedTransition(status, "cancelled")` (422 si no permitido) → `update` a `"cancelled"` → `syncCancelToCalendar(cancelled)` → respuesta pública mínima.

**Tests nuevos (13):** `public-api-appointment-management-wiring.test.js`.

## 1. Validación Técnica

- **Suite completa:** **102/102 suites · 666/666 tests** en verde (antes 101/101 · 654/654 — +1 suite, +12 tests netos, cero regresiones).
- Ejecución conjunta de los dos archivos de test de citas (reserva + gestión): **26/26 passed**.
- `git diff --stat -- ../prisma/` vacío — sin cambios de schema.

## 2. Validación Funcional (grep exhaustivo)

- **Rutas únicas en todo el árbol:** `GET /appointments` y `POST /appointments/:id/cancel` existen exactamente una vez en `public-api.routes.js`; no colisionan con el namespace del dashboard (`/appointments/:id/complete`, `PATCH /appointments/:id`, `/appointments/:id/medical-record`, todas bajo `routes/dashboard/`, prefijo y montaje distintos).
- **`clientAuth` montado en las tres rutas de cliente** (`POST /appointments`, `GET /appointments`, `POST /appointments/:id/cancel`) y en ninguna otra — confirmado por grep.
- **`getUserAppointments` y `isAllowedTransition` reutilizados, no duplicados** — únicos consumidores: el motor legado (sin cambios) y la nueva ruta pública.

## 3. Validación de Invariantes — exhaustiva, por cada propiedad exigida

- **Aislamiento tenant/cliente end-to-end:** sin API key → 401; sin `X-Client-Token` → 401; sin scope correspondiente → 403 — verificado en ambas rutas, antes de cualquier acceso a datos.
- **Verificación cruzada ApiKey↔ClientSession:** `ClientSession` de un tenant usada con `ApiKey` de otro → 403 en ambas rutas, sin llamar a `getUserAppointments` ni a `prisma.appointment.findFirst`.
- **Ownership obligatorio (id + userId + tenantId) en una sola consulta:** verificado con assertion exacta sobre el `where` de `findFirst`; cita inexistente, de otro usuario o de otro tenant → 404 idéntico en los tres casos (sin distinguir el motivo, evitando fuga de información).
- **Transición de estado validada, no duplicada:** cancelar una cita en `"completed"` → 422, sin llamar a `update`; cancelar desde `"confirmed"` o `"pending"` → 200, ambas transiciones ya permitidas por la tabla existente de `appointment-status.service.js`.
- **Sincronización de calendario:** `syncCancelToCalendar` invocada con la cita ya actualizada a `"cancelled"`, verificado por assertion exacta.
- **Todos los caminos de error verificados con su código HTTP exacto:** 401 (sin key/sin token), 403 (sin scope, tenant/cliente no coincide), 404 (cita no encontrada/ajena/de otro tenant), 422 (transición no permitida).
- **Forma exacta de la respuesta pública:** verificada por comparación exacta de claves — `{ id, date, status, petName, petType }` únicamente, tanto en el listado como en la cancelación, sin exponer `tenantId`, `userId` ni `googleEventId`.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — `git diff --stat` vacío sobre los 5 archivos protegidos.
- **`createAppointment`, `cancelAppointment` (legado), `isAllowedTransition` sin modificar** — confirmado por diff exacto/vacío.
- **`appointment.service.js`:** único cambio es la línea de export de `syncCancelToCalendar`, sin alterar su comportamiento interno.
- **Sin duplicación de lógica de ownership, transición de estados ni sincronización de calendario** — todo reutilizado.
- **Sin cambios de schema ni migraciones.**
- **Sin edición ni reprogramación de citas** — fuera de alcance, no implementado.
- **Sin Reconciliación Arquitectónica.**

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo — el único hallazgo del entregable (visibilidad de `syncCancelToCalendar`) fue identificado y resuelto en la Macroetapa 1.

## Alcance restante (fuera de este entregable)

Edición/reprogramación de citas desde el Portal, de requerirse en el futuro, queda deliberadamente fuera — no evaluada en este entregable. Cierra el ciclo mínimo de gestión (ver, cancelar) planteado para el bloque Ecosistema.

## Versionado

Versión declarada del proyecto actualizada de `2.28.0` a `2.29.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): capacidad nueva y observable, un cliente autenticado puede ver y cancelar sus propias citas desde el Portal. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva de `getUserAppointments` y `cancelAppointment` antes de proponer diseño; hallazgo de visibilidad de `syncCancelToCalendar` encontrado y resuelto antes de implementar.
- ✅ Alcance implementado exactamente según lo congelado.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional sin cambios.
- ✅ Suite completa en verde (102/102 · 666/666).
- ✅ Macroetapa 4 (versionado a `2.29.0`, commit, tag, push) completada.
