# ADR 003 — Convivencia entre `StaffAvailability` (nuevo) y `Staff.availability` (Fase 1)

**Fecha:** 2026-07-01
**Estado:** Aceptado
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.2 — Sistema Operativo de Staff
**Origen:** Decisión Arquitectónica Diferida #5 (`docs/architecture/technical-design/sistema-operativo-staff.md`), resuelta antes de iniciar la implementación, según lo decidido explícitamente al cierre del Gate Review (`docs/history/ENTREGABLE_2_2_GATE_REVIEW.md`).

---

## ¿Qué representa realmente `Staff.availability` dentro del dominio?

Antes de decidir, se verificó el código real (no se asumió). `Staff.availability` es un campo JSON usado en exactamente dos lugares, ambos en `backend/src/routes/dashboard/staff.routes.js`:

- **Lectura** (`GET /staff/available`): filtra miembros activos comparando un día y hora contra `availability[díaDeLaSemana]`.
- **Escritura** (`PATCH /staff/:id`): persiste el objeto completo recibido del cliente.

Su forma es: `{ mon: { open: "08:00", close: "18:00", active: true }, tue: {...}, ... }` — un horario semanal por defecto, **sin ningún concepto de ausencia programada ni imprevista**. No es una entidad distinta a lo que el Modelo de Dominio describe como "horario base"; es exactamente eso, expresado como JSON libre en lugar de filas estructuradas. No existe ninguna otra lectura ni escritura de este campo en el resto del backend.

## ¿Cómo convivirá con el nuevo modelo de disponibilidad?

Durante el Entregable 2.2, ambas representaciones **coexisten sin sincronización automática continua**:

- `Staff.availability` (JSON) sigue siendo la fuente que usan `GET /staff/available` y `PATCH /staff/:id` — sin modificarse.
- `StaffAvailability` (filas estructuradas, con sus tres tipos: `base_schedule`, `planned_absence`, `unplanned_absence`) es la fuente que usan exclusivamente los nuevos casos de uso del Sistema Operativo de Staff (`UpdateAvailabilityUseCase`, `RecordUnplannedAbsenceUseCase`, `ResolveStaffAvailabilityUseCase`).

Esta es la misma forma de convivencia ya aceptada para `commission-calculation.rules.js` y `commission.service.js` (Decisión Diferida #2, resuelta en la Etapa 5): dos caminos sobre el mismo concepto de negocio, sin fusionarlos, hasta una migración explícita futura.

## ¿Cuál será la estrategia de migración entre ambos?

**Backfill de una sola vez, no sincronización continua.** Durante la implementación de este entregable:

1. Por cada `Staff` con `availability` (JSON) no nulo, se generan filas `StaffAvailability` con `type = "base_schedule"` — una por cada día de la semana donde `active: true`, con `weekday`, `startTime = open`, `endTime = close`.
2. El campo `Staff.availability` (JSON) **no se elimina ni se modifica**. Permanece intacto como la fuente de verdad de los dos endpoints de Fase 1 ya identificados.
3. No hay sincronización bidireccional: si después del backfill alguien actualiza el horario vía `PATCH /staff/:id` (ruta legada) o vía `UpdateAvailabilityUseCase` (ruta nueva), las dos fuentes pueden divergir. Esto es una limitación conocida y aceptada para este entregable, no un descuido — corregirla pertenece a la migración del adaptador, fuera de alcance aquí.

## ¿Qué compatibilidad debe mantenerse con la Fase 1?

Total, sin excepción. `GET /staff/available` y `PATCH /staff/:id` continúan funcionando exactamente igual que hoy, sin ninguna modificación de código. Ningún otro archivo de Fase 1 depende de `Staff.availability`, según la verificación realizada antes de este ADR — por lo tanto no hay superficie adicional de riesgo.

## ¿Qué parte se implementa ahora y qué parte queda deliberadamente fuera del alcance del Entregable 2.2?

**Se implementa ahora:**
- El modelo `StaffAvailability` completo, con sus tres tipos.
- Los casos de uso nuevos operando exclusivamente sobre `StaffAvailability`.
- El backfill de una sola vez descrito arriba, para que el nuevo modelo no nazca vacío respecto al horario ya configurado por los establecimientos existentes.

**Queda deliberadamente fuera de alcance:**
- Migrar `GET /staff/available` y `PATCH /staff/:id` para que usen los nuevos casos de uso en lugar del campo JSON — es trabajo de adaptador, análogo a lo que quedó pendiente con `service.service.js` (legacy) en el Entregable 2.1.
- Cualquier sincronización continua entre `Staff.availability` (JSON) y `StaffAvailability` (filas) después del backfill inicial.
- Eliminar el campo `Staff.availability` del esquema físico.

---

## Consecuencias

- El Esquema Físico ya aprobado (`staff-esquema-fisico.md`) no requiere modificación: este ADR no agrega columnas ni tablas nuevas, solo formaliza el procedimiento de backfill y los límites de la convivencia.
- La implementación de `UpdateAvailabilityUseCase` y `ResolveStaffAvailabilityUseCase` puede comenzar sin ambigüedad: ambas operan exclusivamente sobre `StaffAvailability`, nunca sobre el JSON legado.
- Cualquier decisión futura de unificar ambas fuentes requiere su propio ADR, con el contexto completo de cómo evolucionó cada lado durante la transición.

---

*ADR 003 · Plataforma Operativa Inteligente · Mateos Pet*
