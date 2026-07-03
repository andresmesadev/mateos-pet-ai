# ADR 009 — `Commission` incorpora el patrón de anulación; la unicidad pasa a "una comisión activa por cita"

**Fecha:** 2026-07-02
**Estado:** Aceptado (2026-07-02) — congelado
**Origen:** Hallazgo A4 de la auditoría v2.1.0; reconcilia la regla de CLAUDE.md ("anulación + nuevo registro") con un esquema físico que la hacía imposible (`appointmentId @unique`, sin campos de anulación)

---

## Decisión 1 — Patrón de anulación

`Commission` gana `status` (`"active"` | `"voided"`, default `"active"`), `voidedAt`, `voidReason` y `replacesCommissionId` (autorrelación, mismo diseño que `Settlement.replacesSettlementId`). Los registros siguen siendo inmutables: la corrección es anulación + nuevo registro, ejecutados **atómicamente** por un único comando.

## Decisión 2 — Especialización de la unicidad

`appointmentId @unique` se reemplaza por la invariante real: como máximo **una comisión activa por cita**. Doble protección: en base de datos, índice único parcial (`CREATE UNIQUE INDEX ... ON "Commission"("appointmentId") WHERE status = 'active'`, vía migración SQL manual — precedente: migración 2.3, ya registrada en el historial de Prisma tras el baseline del ADR 006/C3), y en la capa de aplicación. Es una especialización de la invariante, no una reducción de garantías (mismo criterio que el ADR 005).

## Decisión 3 — Propiedad y comando único atómico

"Anular Comisión" (Administración, actor humano, `reason` obligatorio) pertenece al **contexto Staff** (la comisión es un hecho de Staff — ratificado en ADR 007, Decisión 5). El comando anula la comisión vigente y crea su reemplazo **en una sola transacción de base de datos**. No existen comandos separados de anulación y creación: introducirían el estado intermedio inválido "cita completada sin comisión activa", que la verificación de completitud del cierre (ADR 007, Decisión 2) no vigila — esa verificación cubre cobros, no comisiones. La anulación sin reemplazo solo existe como decisión explícita del comando (caso: una cita que nunca debió generar comisión).

## Decisión 4 — Fronteras

- **(a) Con el Cierre del Día:** no puede anularse ni crearse una comisión cuyo `completedAt` cae en un día civil (ADR 008) que ya tiene `DailyClose` oficial — espejo exacto de la regla ya aprobada para `Expense` (`DailyCloseAlreadyExistsForDateError`). La corrección de hechos pertenecientes a días/períodos ya cerrados sigue siendo la pregunta abierta registrada en la Etapa 2 del Entregable 2.3 y **no se resuelve en este ADR** — se hereda como restricción.
- **(b) Con la Liquidación:** no puede anularse una comisión ya consolidada en una `Settlement` activa. Primero se anula la liquidación (mecanismo que `Settlement` ya posee), luego la comisión. Orden inverso al de consolidación, sin excepciones.

## Decisión 5 — CLAUDE.md queda correcto sin cambios de fondo

La regla permanente "Las comisiones son inmutables. Las correcciones se hacen con anulación + nuevo registro" pasa de físicamente imposible a implementable tal como está escrita. Solo se le añadirá la referencia a este ADR en las correcciones documentales del Entregable Puente.

## Qué NO decide este ADR

- El split configurable: `GROOMING_SPLIT_RATE = 0.5` hardcodeado queda registrado como deuda hacia Configuración del Negocio (Modelo de Dominio §1, "reglas de split de comisiones") — decisión del contexto Negocio, fuera de este alcance. El registro corregido usa las reglas de split vigentes al ejecutar el comando.
- La corrección de hechos en días/períodos ya cerrados (pregunta abierta de 2.3, heredada).
- Ninguna implementación: schema, migración y casos de uso llegan con el Entregable Puente.
