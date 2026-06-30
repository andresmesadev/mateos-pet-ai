# Modelo Conceptual de Persistencia — Sistema Operativo de Staff

**Entregable:** 2.2 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado. Ver cierre en `docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`.
**Implementa:** el contrato funcional y la arquitectura técnica ya aprobados para el contexto `Staff`.

Este documento describe qué necesita persistir el dominio, no cómo se va a guardar. Sigue exactamente los mismos Principios Permanentes del modelo de persistencia ya establecidos en el Entregable 2.1 — no se redefinen aquí, se heredan.

**Punto de partida distinto al de Servicios:** a diferencia de 2.1, el contexto Staff no parte de cero. `Miembro del Staff` y `Comisión` ya existen físicamente desde la Fase 1. Este documento distingue explícitamente qué se reutiliza, qué se extiende y qué es enteramente nuevo — para no rediseñar en silencio lo que ya funciona.

---

## 1. Entidades persistentes

| Entidad | Origen |
|---|---|
| Miembro del Staff | Ya existe (Fase 1) — se extiende con un campo nuevo |
| Comisión | Ya existe (Fase 1) — se reutiliza sin cambios conceptuales |
| Disponibilidad del Staff | Nueva — reemplaza conceptualmente al campo JSON libre actual |
| Capacidad del Staff | Nueva |
| Liquidación | Nueva |

No se modela aquí ninguna entidad de `Agenda`, `Clientes`, `Mascotas` ni `Finanzas`. `Capacidad del Staff` referencia un servicio por identificador, sin incorporar la estructura de `Servicios`.

---

## 2. Responsabilidad de cada entidad

### Miembro del Staff
Representa a la persona que trabaja en el establecimiento. Ya cumplía este rol desde la Fase 1; en este entregable se le agrega la capacidad de declarar explícitamente si genera comisiones, en vez de inferirlo implícitamente del rol en cada cálculo.

### Disponibilidad del Staff
Representa cuándo puede atender un miembro: su horario semanal por defecto, y las excepciones sobre ese horario (ausencias programadas e imprevistas). Reemplaza al campo `Staff.availability` (JSON libre) como fuente de verdad para el nuevo Sistema Operativo — ver la nota de alcance al final de este documento, porque ese campo JSON ya es consumido por código de Fase 1 que no se toca en este entregable.

### Capacidad del Staff
Representa qué servicios está habilitado a prestar un miembro — su aptitud profesional, no su disponibilidad operativa. Existe porque, sin ella, cualquier miembro podría ser asignado a cualquier servicio sin ninguna validación de si está calificado para prestarlo.

### Liquidación
Representa el resumen inmutable de las comisiones generadas por un miembro del staff en un período. Existe porque el negocio necesita saber cuánto pagarle a alguien sin sumar comisiones a mano cada vez — y porque, como hecho financiero, su corrección debe dejar rastro, no reescribir silenciosamente un monto ya comunicado.

### Comisión (reutilizada)
Sin cambios respecto a Fase 1: el registro inmutable de lo que un miembro generó en una cita completada, con el split ya congelado en el momento del cálculo.

---

## 3. Campos

### Miembro del Staff (extensión sobre el modelo físico ya existente)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id`, `tenantId`, `name`, `role`, `phone`, `email`, `active` | *(ya existen, sin cambios)* | — | — |
| `generatesCommission` | Booleano | Sí (con valor inicial derivado del rol) | **Nuevo campo.** Editable después vía Actualizar Staff. Cambiarlo nunca reinterpreta comisiones ya registradas — `Commission.splitRate` y `Commission.staffShare` ya están congelados en cada fila al momento de su creación. |

### Disponibilidad del Staff (nueva)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `staffId` | Identificador (referencia a Miembro del Staff) | Sí | Toda disponibilidad pertenece exactamente a un miembro. |
| `tipo` | Enumerado (`horario_base` \| `ausencia_programada` \| `ausencia_imprevista`) | Sí | Determina qué otros campos de esta fila son relevantes. |
| `díaSemana` | Numérico (0–6) | Solo si `tipo = horario_base` | Un horario base se define por día de la semana, no por fecha. |
| `horaInicio`, `horaFin` | Hora del día | Solo si `tipo = horario_base` | `horaInicio` debe ser anterior a `horaFin`. |
| `inicioEn`, `finEn` | Fecha y hora | Solo si `tipo` es una ausencia (programada o imprevista) | `inicioEn` debe ser anterior a `finEn`. |
| `motivo` | Texto | Opcional, solo en ausencias | — |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

### Capacidad del Staff (nueva)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `staffId` | Identificador (referencia a Miembro del Staff) | Sí | Toda capacidad pertenece exactamente a un miembro. |
| `servicioId` | Identificador (referencia a Servicio, **sin clave foránea real** — ver sección 4) | Sí | Debe corresponder a un servicio existente al momento de asignarse (validado en la aplicación, no en la base de datos). |
| `estado` | Enumerado (`activa` \| `revocada`) | Sí | Revocar nunca elimina la fila — preserva el historial de que la aptitud existió. |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

### Liquidación (nueva)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `tenantId` | Identificador | Sí | — |
| `staffId` | Identificador (referencia a Miembro del Staff) | Sí | Toda liquidación pertenece exactamente a un miembro. |
| `períodoInicio`, `períodoFin` | Fecha | Sí | Define el rango sobre el que se consolidaron comisiones. |
| `montoTotal` | Decimal | Sí | Suma congelada del `staffShare` de las comisiones del período al momento de generar — no se recalcula después. |
| `estado` | Enumerado (`activa` \| `anulada`) | Sí | Nace siempre `activa`. Nunca se modifica salvo la transición explícita a `anulada` (con su motivo y fecha) — nunca se reescribe el monto. |
| `anuladaEn`, `motivoAnulación` | Fecha / Texto | Solo si `estado = anulada` | — |
| `reemplazaLiquidaciónId` | Identificador (referencia opcional a otra Liquidación) | Opcional | Si esta liquidación corrige una anulada, lo declara explícitamente — trazabilidad completa de la corrección. |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

### Comisión (reutilizada, sin cambios)
Ver `prisma/schema.prisma`, modelo `Commission` ya existente: `resolvedPrice`, `priceSource`, `splitRate`, `staffShare`, `businessShare`, `serviceCategory` (snapshot de texto, no relación — ya es inmutable por diseño desde Fase 1), `completedAt`.

---

## 4. Relaciones

**Miembro del Staff (1) → Disponibilidad del Staff (N) — uno a muchos.** Un miembro tiene muchas filas de disponibilidad (un horario base por día de la semana, más todas sus ausencias históricas); cada fila pertenece exactamente a un miembro.

**Miembro del Staff (1) → Capacidad del Staff (N) — uno a muchos.** Un miembro puede estar habilitado para muchos servicios; cada capacidad pertenece exactamente a un miembro.

**Miembro del Staff (1) → Liquidación (N) — uno a muchos.** Un miembro tiene muchas liquidaciones a lo largo del tiempo (una por período, más las anuladas que conserva su historial).

**Miembro del Staff (1) → Comisión (N) — uno a muchos.** Ya existente desde Fase 1, sin cambios.

**Liquidación (0..1) → Liquidación — relación reflexiva de trazabilidad.** `reemplazaLiquidaciónId` conecta una liquidación nueva con la anulada que corrige. No es una relación de negocio recurrente — solo existe cuando hubo una corrección.

**Relación con `Servicio`:** `Capacidad del Staff` lo referencia por identificador, pero **deliberadamente sin clave foránea física** — mismo criterio que `Regla de Precio` con `Cliente`/`Mascota` en el Entregable 2.1: Staff no debe acoplarse estructuralmente a la tabla de otro contexto, aunque hoy convivan en la misma base de datos física. La validación de existencia ocurre en la capa de aplicación, vía `ServiceExistenceReaderPort`.

**No hay relación con `Cita` en ninguna entidad nueva de este documento.** `Comisión` ya tiene su propia relación con `Appointment` desde Fase 1 (ver nota de alcance al final) — ninguna entidad nueva de Staff la reproduce.

---

## 5. Agregados

**Aggregate Root: Miembro del Staff**, responsable de la consistencia de **Disponibilidad del Staff** y **Capacidad del Staff** — ambas se crean, modifican o revocan exclusivamente a través de los casos de uso del propio Staff (`UpdateAvailabilityUseCase`, `RecordUnplannedAbsenceUseCase`, `ManageStaffCapabilitiesUseCase`). Ninguna otra vía de escritura está autorizada.

**`Comisión` y `Liquidación` NO se modelan como contenidas dentro del agregado `Miembro del Staff`.** Son entidades independientes que referencian a Staff por identificador, cada una con su propio caso de uso como única vía de escritura (`RecordCommissionOnAppointmentCompletedUseCase` y `GenerateSettlementUseCase`, respectivamente). Esta decisión es deliberada y consistente con la Decisión Arquitectónica Diferida #1 del diseño técnico: ambas representan hechos financieros cuya pertenencia definitiva al contexto `Staff` ya quedó marcada como abierta a revisión futura. Modelarlas como parte íntima del agregado Staff hoy haría más costoso ese eventual traslado a `Finanzas`; modelarlas como entidades que solo *referencian* a Staff dejas esa puerta abierta sin comprometer la integridad actual.

**Reactivar Staff no escribe sobre Capacidad del Staff.** La "restauración automática de capacidades" descrita en el contrato funcional es un efecto emergente, no una operación de datos: las filas de `Capacidad del Staff` nunca se tocan al desactivar o reactivar a un miembro. Solo dejan de ser relevantes (porque el staff está inactivo) y vuelven a serlo (porque vuelve a estar activo) en cualquier consulta que ya filtre por `Miembro del Staff.active`. `ReactivateStaffUseCase` simplemente lee las capacidades vigentes para reportarlas en su salida (`restoredCapabilities`), no las recrea.

---

## 6. Invariantes

- Un `Miembro del Staff` nunca se elimina: solo se desactiva o reactiva.
- Un `Miembro del Staff` inactivo nunca aparece por defecto en Consultar Staff Activo ni en Resolver Disponibilidad del Staff.
- Cambiar `generatesCommission` nunca reinterpreta comisiones o liquidaciones ya registradas — los montos ya congelados en `Commission` y `Liquidación` son la fuente de verdad histórica, no el estado actual del miembro.
- En `Disponibilidad del Staff`, `horaInicio` siempre antecede a `horaFin`; `inicioEn` siempre antecede a `finEn`.
- No pueden coexistir dos franjas de horario base activas que se superpongan para el mismo miembro y el mismo día de la semana. *(El mecanismo exacto de protección — a nivel de aplicación, de base de datos, o ambos — se decide en la Etapa 5, igual que ocurrió con el invariante de Regla de Precio en 2.1.)*
- No pueden coexistir dos `Capacidad del Staff` con estado `activa` para el mismo miembro y el mismo servicio.
- Una `Capacidad del Staff` nunca se elimina al revocarse: solo cambia a `revocada`.
- Una `Liquidación`, una vez creada, nunca cambia su `montoTotal`. La única mutación permitida es la transición a `estado = anulada`, con su fecha y motivo.
- No pueden coexistir dos `Liquidación` con estado `activa` para el mismo miembro y el mismo período exacto.
- `Comisión` conserva sin cambios su invariante de inmutabilidad ya vigente desde Fase 1.

---

## 7. Preparación para evolución

`Capacidad del Staff` ya está preparada para que, en el futuro, una capacidad tenga niveles (por ejemplo, "puede prestar el servicio bajo supervisión" vs. "puede prestarlo de forma autónoma") simplemente agregando un campo nuevo a la fila existente — no una tabla nueva ni una relación nueva.

`Disponibilidad del Staff` ya está preparada para nuevos tipos de excepción (por ejemplo, "disponibilidad extendida temporal") agregando un valor nuevo a `tipo`, sin alterar la forma de las filas existentes — mismo patrón que `tipoDeDestino` en `Regla de Precio` (Entregable 2.1).

No se modela todavía ningún concepto de "tarifa diferenciada por staff" ni "comisión por antigüedad" — no están definidos en el Modelo de Dominio oficial; anticiparlos ahora sería sobreingeniería.

---

## 8. Validación final

**Contra el Plan Maestro y el Modelo de Dominio:** las cinco entidades corresponden exactamente a lo que `domain-model-v1.md` describe para el contexto `Staff`, incluyendo la entidad `Capacidad del Staff` incorporada durante la Etapa 1 de este entregable.

**Contra el contrato funcional:** cada campo nuevo existe porque algún caso de uso lo requiere explícitamente (p. ej. `reemplazaLiquidaciónId` existe porque el contrato exige trazabilidad completa de una corrección, aunque el caso de uso que la ejecuta — Anular Liquidación — esté deliberadamente fuera de alcance de este entregable).

**Contra la arquitectura técnica:** el modelo es compatible con los puertos ya definidos — `StaffRepositoryPort`, `AvailabilityRepositoryPort`, `StaffCapabilityRepositoryPort`, `CommissionRepositoryPort` y `SettlementRepositoryPort` operan cada uno sobre exactamente una de estas entidades.

**Contra los Principios Permanentes del modelo de persistencia (heredados de 2.1):** el Aggregate Root (Miembro del Staff) es la única vía de escritura de sus entidades internas; el modelo evoluciona por extensión (nuevos valores de enumerado), nunca por ruptura; el esquema representa al dominio sin sustituirlo — la ambigüedad sobre la pertenencia futura de Comisión/Liquidación a Finanzas se preserva intencionalmente, no se resuelve aquí.

---

## Nota de alcance — relación con código físico de Fase 1

Este documento identifica, sin resolverla, una tensión entre el modelo conceptual de `Disponibilidad del Staff` aquí descrito y el campo `Staff.availability` (JSON) más `availability-db.service.js` (311 líneas), ya existentes y en uso desde Fase 1. Esta tensión queda formalizada como **Decisión Arquitectónica Diferida #5** en `docs/architecture/technical-design/sistema-operativo-staff.md` — es una decisión pendiente del dominio (qué representa realmente la disponibilidad de un miembro del staff), no un simple cambio de implementación, y se resuelve recién en la Etapa 5 con el modelo conceptual completo ya aprobado como contexto.
