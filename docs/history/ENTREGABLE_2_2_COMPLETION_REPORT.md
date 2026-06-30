# Cierre del Entregable 2.2 — Sistema Operativo de Staff

**Fecha de cierre:** 2026-07-01
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Estado:** ✅ Completado
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md` (las ocho etapas, completas)
**Gate Review previo:** `docs/history/ENTREGABLE_2_2_GATE_REVIEW.md`

---

## Qué problema resolvía este entregable

Al cierre del Entregable 2.1, el Catálogo de Servicios ya era un Sistema Operativo completo, pero el contexto `Staff` seguía siendo, en gran parte, el mismo de la Fase 1: un roster con disponibilidad guardada como JSON libre, comisiones que se registraban automáticamente pero sin ninguna forma de consolidarlas en una liquidación por período, y ninguna noción explícita de qué servicios estaba habilitado a prestar cada miembro. La Definición Funcional de este entregable identificó cuatro brechas concretas: ausencia de liquidación por período, disponibilidad sin reglas ni casos de uso propios, ausencia de una capa de aplicación para Staff, y capacidades operativas no modeladas — esta última llevó a ampliar formalmente el Modelo de Dominio con la entidad **Capacidad del Staff** antes de avanzar.

## Qué capacidades incorpora ahora la Plataforma Operativa Inteligente

- **Un roster administrable mediante casos de uso propios**: registrar, actualizar, desactivar y reactivar miembros del staff, sin pasar por ningún canal que orqueste la lógica directamente.
- **Disponibilidad estructurada y con reglas**: horario base, ausencias programadas y ausencias imprevistas como conceptos distintos, cada uno con su propio peso (administrativo vs. operativo), reemplazando conceptualmente al JSON libre de Fase 1 sin romperlo.
- **Capacidades profesionales explícitas**: qué servicios puede prestar cada miembro, administradas como un conjunto completo de una sola vez, con eventos por cada cambio real.
- **Liquidaciones por período, inmutables**: el cálculo manual de cuánto pagarle a un miembro del staff queda reemplazado por un resumen consolidado, generado una sola vez por período, protegido en dos niveles contra duplicación.
- **Resolución de disponibilidad combinada**: la primera capacidad de "Resolución" de este contexto — responde, combinando capacidad y disponibilidad real, quién puede atender un servicio en un momento dado. Es la base para que `Agenda`, en el futuro, deje de asignar staff a ciegas.

Esto elimina trabajo humano concreto: sumar comisiones a mano para liquidar a alguien, y decidir manualmente (sin registro) quién está calificado para qué servicio.

## Qué decisiones arquitectónicas importantes quedaron establecidas

- **Reactivar Staff no muta datos.** La restauración de capacidades al reactivar a un miembro es un efecto emergente del filtro de actividad, no una operación sobre `StaffCapability` — una decisión de diseño que evitó introducir estado redundante.
- **`Commission` y `Settlement` quedan deliberadamente fuera del agregado `Staff`.** Ambas representan hechos financieros cuya pertenencia definitiva a `Finanzas` permanece abierta a revisión futura (Decisión Arquitectónica Diferida #1) — modelarlas como entidades que solo referencian a `Staff`, no contenidas en su agregado, preserva esa puerta abierta.
- **Excepción documentada y acotada al Principio Permanente de doble protección** (Decisión Diferida #6): el solapamiento de horario base se protege solo en la capa de aplicación, porque introducir la extensión `btree_gist` de PostgreSQL para un único invariante de un único entregable no estaba justificado por el dominio en este momento de la plataforma. Es una excepción explícita, no una reducción del estándar — con condición de reapertura ya definida.
- **ADR 003 — convivencia entre `StaffAvailability` y `Staff.availability` (JSON, Fase 1).** Backfill de una sola vez, sin sincronización continua, sin tocar el campo legado. Verificado contra el código real antes de decidir: el JSON solo se usaba en dos puntos de `staff.routes.js`.
- **ADR 004 — `Resolver Disponibilidad del Staff` puede consultar `Servicios`.** Mismo criterio que el ADR 002 del Entregable 2.1: un puerto mínimo de existencia, nunca el modelo completo del contexto consultado.
- **`DuplicateStaffCapabilityError` incorporado durante la Validación Técnica**, no como funcionalidad nueva sino como cumplimiento de una promesa de doble protección que el propio Esquema Físico ya había hecho.

## Qué aprendimos durante su construcción

**Los documentos de un mismo entregable pueden entrar en tensión entre sí, no solo con la implementación.** A diferencia de 2.1 —donde las desviaciones encontradas eran entre el contrato y el código—, dos de las tres desviaciones de este entregable (`DuplicateStaffCapabilityError` y la consulta a `Servicios` desde `Resolver Disponibilidad`) eran inconsistencias entre la Arquitectura Técnica (Etapa 3) y el Esquema Físico (Etapa 5) del mismo entregable, ambas ya aprobadas. La auditoría funcional no solo verifica código contra contrato: también verifica que un entregable sea internamente consistente consigo mismo a lo largo de sus propias etapas.

**Verificar el código real antes de diseñar una convivencia evita sobre-diseñar.** El ADR 003 partió de la suposición de que `availability-db.service.js` (311 líneas) estaba involucrado en la disponibilidad del staff. No lo estaba. Revisar el código real redujo el alcance de la decisión a algo mucho más simple y seguro de lo que el diseño preliminar anticipaba.

**Una migración aditiva con valores por defecto razonables es categóricamente más segura que una que reemplaza una columna.** A diferencia de 2.1 (que requirió tocar 7 archivos de Fase 1 por eliminar `Service.category`), este entregable no requirió modificar ningún archivo existente — `generatesCommission` se agregó con `@default(true)`, y las tres tablas nuevas no necesitaron backfill de datos previos. La lección queda incorporada como criterio de diseño: preferir columnas aditivas con default sobre reemplazos, cuando el dominio lo permite.

## Qué habilita para el Entregable 2.3

El Entregable 2.3 (Finanzas como Sistema Operativo) depende explícitamente de las comisiones y liquidaciones que este entregable ya genera: el cierre financiero por período consolidará `Commission` y `Settlement` —ambas ya existentes y pobladas correctamente— sin tener que esperar a que Finanzas las construya desde cero.

Más allá de los datos, este entregable confirma que el patrón establecido en 2.1 —clasificación por responsabilidad, Principios Permanentes heredados sin redefinir, doble protección de invariantes críticos, Decisiones Arquitectónicas Diferidas como estándar— se sostiene en un segundo contexto con una forma de datos distinta (entidades reutilizadas de Fase 1, no solo nuevas). Eso es exactamente lo que el proceso de la Fase 2 se propuso demostrar.

---

*Cierre del Entregable 2.2 · Plataforma Operativa Inteligente · Mateos Pet*
