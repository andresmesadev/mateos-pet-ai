# Cierre del Entregable 4.1 — Saneamiento Tenant-Blind

**Fecha de cierre:** 2026-07-09
**Fase:** Fase 4 — Plataforma Comercial (primer entregable del roadmap interno)
**Estado:** ✅ Completado
**Proceso aplicado:** proceso de macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 → Gate Review → Implementación completa → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_4_1_GATE_REVIEW.md` (Macroetapa 1, incluida en el mismo hilo de trabajo)

---

## Objetivo del entregable

Sanear los cuatro puntos ciegos de tenant identificados por la Auditoría v2.1.0 (A6, M4, B2, M1) y diferidos desde entonces como "precondición del alta de un segundo tenant". Es el único ítem del backlog de deuda técnica acumulada promovido a entregable de Fase 4, por tener dependencia arquitectónica directa y demostrable con el objetivo estratégico de la fase (Plataforma Comercial).

## Reconciliaciones arquitectónicas aprobadas durante la implementación

Durante la Macroetapa 2 se detectaron dos contradicciones reales entre el diseño congelado de la Macroetapa 1 y el código existente, resueltas por decisión explícita antes de continuar:

1. **M4** — el diseño original no contemplaba que el único consumidor real de `availability-db.service.js` fuera el motor conversacional (`scheduling.service.js`/`conversation.service.js`), protegido desde 3.4 por el principio "no reescribir el motor conversacional existente". Se acotó el alcance del saneamiento a los consumidores externos al motor (recordatorios vía `schedule-coordinator`); el consumo interno del motor queda registrado como deuda técnica pendiente de un futuro rediseño del motor conversacional, fuera del alcance de 4.1.
2. **A6** — el diseño original asumía conflicto por `(tenantId, staffId, date)`, pero el sistema real reserva por bucket de tipo de servicio (`vet`/`grooming`) compartido, no por staff (`staffId` no participa en ninguna lógica de disponibilidad existente). Se reconcilió el Modelo de Persistencia (Etapa 4) para proteger la unidad real de reserva: `(tenantId, availabilityBucket, date)`.

Ninguna de las dos reconciliaciones modificó el objetivo funcional del entregable — ambas ajustan el *cómo*, no el *qué*.

## Resumen de implementación

- **A6:** nuevo campo `Appointment.availabilityBucket` (derivado del tipo de servicio en escritura) + índice único parcial `appointment_tenant_bucket_slot_active_unique` sobre `(tenantId, availabilityBucket, date)`, excluyendo citas canceladas. `appointment.service.js:createAppointment` traduce la violación (P2002) en `SlotAlreadyBookedError`, reemplazando la verificación previa no atómica (`checkAppointmentConflict`, que seguía siendo racy) con una garantía real a nivel de base de datos. El motor conversacional no requirió ningún cambio: ya envuelve la creación de citas en un `try/catch` que absorbe cualquier error y responde con un mensaje genérico de reintento.
- **M4:** las cinco funciones de consulta de `reminder.service.js` (`getAppointmentsForReminder`, `getUpcomingVaccineReminders`, `getUpcomingDewormingReminders`, `getUpcomingGroomingReminders`, `getConsultationsForFollowUp`) ahora exigen `tenantId` y filtran por tenant (directo en `Appointment`, vía relación `pet.owner.tenantId` en `MedicalRecord`). `schedule-coordinator.resolveActiveCoordinator` exige `tenantId`. `jobs/reminder.job.js` reescrito para iterar sobre `listActiveTenants()` (nuevo en `tenant.service.js`) y procesar cada tenant de forma aislada, con el mismo principio de aislamiento de fallos institucionalizado en 3.3/3.4/3.5: el fallo de un tenant no detiene a los demás.
- **B2:** `process-incoming-message.usecase.js` (contexto Recepcionista, 3.4) rechaza explícitamente el mensaje entrante si el tenant no resuelve o está inactivo, antes de invocar al motor conversacional o de resolver la Recepcionista — sin tocar `webhook.controller.js` ni el motor.
- **M1:** `User.phone` pasó de `@unique` global a `@@unique([tenantId, phone])`. Consecuencia necesaria, encontrada durante la implementación: `user.service.js` (`findUserByPhone`/`findOrCreateUser`) usaba `prisma.user.findUnique({ where: { phone } })`, inválido en cuanto `phone` deja de ser único por sí solo; se corrigió para buscar por la clave compuesta `(tenantId, phone)` cuando hay tenant resuelto, sin cambiar la firma que el motor ya invoca.

## Cambios de esquema y migración

- Migración `20260708120000_saneamiento_tenant_blind`: `DROP INDEX User_phone_key` + `CREATE UNIQUE INDEX User_tenantId_phone_key`; `ALTER TABLE Appointment ADD COLUMN availabilityBucket`, backfill de filas existentes por el mismo mapeo bucket que usa `appointment.service.js`, y creación del índice único parcial.
- Verificación previa a la migración contra los datos reales: 2903/2903 usuarios con `tenantId` poblado, 0 teléfonos duplicados, 0 colisiones de `(tenantId, bucket, date)` entre citas activas — migración segura confirmada antes de aplicar, no solo asumida.
- `prisma migrate deploy` aplicada; `prisma migrate diff` posterior vacío; `prisma generate` regenerado.

## Validación Técnica

- `prisma migrate status` → 32 migraciones, base de datos al día, sin diferencias.
- Suite completa: **64/64 suites · 396/396 tests** en verde (13 tests nuevos: 3 de conflicto de slot en `appointment.service.js`, 1 de rechazo de tenant no resuelto en Recepcionista, 5 de wiring de `reminder.job.js` por tenant, más ajustes a tests existentes).
- Verificación empírica directa contra la base real (no solo tests mockeados) para los dos cambios de esquema más sensibles: inserción doble de cita colisionante → `SlotAlreadyBookedError` correctamente traducido; búsqueda por clave compuesta `(tenantId, phone)` → resuelve correctamente.
- **Grep exhaustivo confirma que ningún llamador de las cinco funciones de `reminder.service.js` las invoca sin `tenantId`** — cero llamadas residuales sin argumento.
- **Grep exhaustivo confirma un único punto de escritura de `Appointment`** (`appointment.service.js:createAppointment`) — no hay otro camino que pueda crear una cita sin pasar por la validación del índice único.
- **Grep exhaustivo confirma que `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js` y `webhook.controller.js` no registran ningún cambio** (`git diff --stat` vacío para los cuatro) — el principio "no reescribir el motor conversacional" (3.4) se mantuvo íntegro durante todo el entregable.
- **Grep exhaustivo confirma que no queda ningún otro `findUnique` sobre `phone` como campo único aislado** fuera de `Tenant.phone` (modelo distinto, sin cambios) — el único caso corregido (`user.service.js`) fue el correcto.

## Validación Funcional

- **A6 resuelto:** dos solicitudes concurrentes para el mismo tenant/bucket/instante ya no pueden generar doble reserva — la segunda recibe `SlotAlreadyBookedError`, absorbido por el manejo de errores ya existente del motor conversacional (mensaje de reintento al usuario), sin regresión de comportamiento visible.
- **M4 resuelto (alcance externo al motor):** el job de recordatorios ya no procesa un catálogo global sin distinción de tenant — itera explícitamente cada tenant activo, con aislamiento de fallos entre ellos. El consumo interno del motor conversacional queda documentado como deuda pendiente, no resuelta en este entregable, según la reconciliación aprobada.
- **B2 resuelto:** un mensaje entrante cuyo tenant no resuelve o está inactivo ya no depende, de forma incidental, de que no exista un Empleado Digital con `tenantId` nulo — se rechaza explícitamente y de forma auditable (log dedicado), antes de tocar el motor.
- **M1 resuelto:** dos tenants distintos pueden ahora tener, cada uno, un usuario con el mismo número de teléfono, sin colisión. Sin regresión: la ruta de creación de mascota por teléfono (`pets.routes.js`) ya operaba con `findFirst` tenant-scoped y no requirió cambios.
- Sin regresión: la suite completa del backend (incluidas Fase 2, Puente, Eventos, Comunicación, Empleados Digitales, Automatizaciones, Recepcionista IA, Coordinador de Agenda IA) permanece en 396/396 tras el saneamiento y el bump de versión.

## Hallazgos encontrados durante la implementación y su resolución

Uno no anticipado en el diseño de la Macroetapa 1 (adicional a las dos reconciliaciones ya aprobadas antes de implementar): `user.service.js` dependía de la unicidad global de `phone` para su búsqueda (`findUnique({ where: { phone } })`), y dejó de ser válido en cuanto se aplicó M1. Resuelto ajustando la búsqueda a la clave compuesta `(tenantId, phone)` sin cambiar la firma consumida por el motor conversacional — mismo patrón de "wrap sin reescribir" aplicado consistentemente en todo el entregable.

## Estado final

Los cuatro puntos ciegos de tenant (A6, M4 en su alcance externo, B2, M1) están saneados, verificados contra datos reales y cubiertos por tests. El motor conversacional (`whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`) permanece completamente intacto durante todo el entregable. Dos decisiones quedan explícitamente registradas como deuda no resuelta en 4.1, ninguna bloqueante para el cierre:

1. **M4 residual** — la disponibilidad consultada desde el propio motor conversacional (`scheduling.service.js`) sigue sin distinguir tenant; precondición de un futuro rediseño del motor, no de este entregable.
2. Backlog arquitectónico general de la Fase 4 (Outbox de Eventos, `AgentAutonomyLimit` sin aplicar, certificación de eventos propios de Empleados Digitales, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`) permanece fuera de alcance, sin relación de dependencia demostrable con este entregable.

## Versionado

Versión declarada del proyecto actualizada de `2.8.0` a `2.9.0` (nueva capacidad funcional: saneamiento tenant-blind, primer entregable de la Fase 4) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ A6: índice único parcial `(tenantId, availabilityBucket, date)` previene la colisión atómicamente; verificado empíricamente contra la base real.
- ✅ M4 (alcance externo al motor, reconciliado): recordatorios procesados por tenant explícito, con aislamiento de fallos entre tenants.
- ✅ B2: mensaje entrante con tenant no resuelto/inactivo rechazado explícitamente antes de invocar al motor.
- ✅ M1: unicidad de `User.phone` es ahora por tenant; migración verificada segura contra datos reales antes de aplicarse.
- ✅ Motor conversacional (`whatsapp.service.js`/`conversation.service.js`/`scheduling.service.js`) y `webhook.controller.js` sin ningún cambio (verificado por `git diff --stat`).
- ✅ Suite completa en verde (64/64 · 396/396).
- ✅ Migraciones aplicadas y verificadas (`migrate status` limpio, `migrate diff` vacío).
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.9.0`).
