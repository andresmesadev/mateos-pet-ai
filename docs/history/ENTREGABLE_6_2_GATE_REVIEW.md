# Gate Review consolidado — Entregable 6.2 (Agenda Multi-Establecimiento)

**Fase:** Fase 6 — Operación Multi-Establecimiento Real
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.17.0).

---

## 1. Diseño congelado (Macroetapa 1)

- **Brecha real:** `isBusinessDay`/`isWithinBusinessHours` sin `tenantId`; `Tenant.businessHours` persistido y editable desde el dashboard, pero nunca vinculante en la reserva real.
- **Decisión no negociable:** el patrón de wrapper de 4.3/6.1 no aplica — ambos consumidores directos viven dentro de archivos protegidos. Se acepta una Reconciliación Arquitectónica puntual y mínima: solo sustituye el origen de la configuración, preserva el algoritmo.
- **Alcance dividido:** horario de atención (este entregable) vs. zona horaria (backlog explícito, sin fecha — blast radius de 9 archivos y sin necesidad evidenciada hoy).

## 2. Checkpoints de contradicción (3, todos reportados y resueltos antes de escribir el código correspondiente)

| # | Hallazgo | Resolución |
|---|---|---|
| 1 | `tenantId` no fluía hasta `scheduling.service.js` — requería tocar también `whatsapp.service.js`/`conversation.service.js` | Autorizado — transporte de un identificador ya disponible en `user`, cero cambio de algoritmo/I/O |
| 2 | `availability-db.service.js` era un segundo consumidor real con constantes duplicadas para generar sugerencias | Autorizado — Reconciliación ampliada a 5 archivos, misma fuente de verdad para validación y sugerencias |
| 3 | `checkAppointmentConflict` (confirmación final, `appointment.service.js`/`whatsapp.service.js`) era el único consumidor de `isSlotAvailable` sin `tenantId` — bypass real, detectado en la Macroetapa 3 | Autorizado — mismo mecanismo, cierre del bypass, revalidación completa posterior |

Ninguno de los tres fue una contradicción de diseño — los tres fueron precisiones de implementación descubiertas al trazar el flujo real de llamadas, dentro del mismo criterio aprobado desde la Macroetapa 1.

## 3. Implementación (Macroetapa 2) — bloques

1. `business-config.service.js` — `getBusinessHours(tenantId)`.
2. `availability.service.js` — `isBusinessDay`/`isWithinBusinessHours` con configuración opcional; `resolveHourWindow` como fuente única de ventana horaria.
3. `availability-db.service.js` — `isSlotAvailable`/`suggestAvailableVetSlots`/`findNextAvailableGroomingSlot` tenant-aware; constantes duplicadas eliminadas.
4. `scheduling.service.js` — resolvers reciben `tenantId`, propagan configuración a los 4 guards y 3 llamadas a `availabilityDb`.
5. `conversation.service.js`/`whatsapp.service.js` — transporte de `tenantId`.
6. `appointment.service.js` — `checkAppointmentConflict` tenant-aware (cierre del hallazgo #3).
7. `tenant.routes.js` — validación de `businessHours` endurecida.
8. Cobertura de regresión: 3 archivos nuevos, 32 tests — construida **antes** del cambio en `availability.service.js`/`availability-db.service.js`.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **80/80 suites · 495/495 tests**.
- `prisma generate` sin errores; `git diff --stat -- prisma/` vacío — sin cambios de schema ni migraciones.
- Grep exhaustivo: `isSlotAvailable` con exactamente 3 llamadores, todos transportando `tenantId`; `checkAppointmentConflict` con exactamente 1 llamador, transportando `tenantId`; `resolveHourWindow` como única fuente de ventana horaria; sin bypass remanente.
- Invariantes verificados por test: sin configuración → comportamiento legado exacto; festivo cierra siempre; fallo de lectura de configuración nunca rompe la verificación; validación y sugerencias comparten fuente.
- `git diff --stat` vacío sobre `contexts/` (negocio) y sobre los archivos de zona horaria (`lib/timezone.js`, `reminder.job.js`, `reminder.service.js`, `google-calendar.service.js`) — alcance respetado sin desviación.
- Principio Permanente de la Fase 6: respetado en las tres Reconciliaciones Arquitectónicas puntuales — ninguna introdujo regla de negocio nueva ni cambio de algoritmo.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.17.0`, tag y push realizados bajo autorización explícita del responsable del proyecto.
