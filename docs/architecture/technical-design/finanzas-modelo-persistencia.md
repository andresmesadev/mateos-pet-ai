# Modelo Conceptual de Persistencia — Sistema Operativo de Finanzas

**Entregable:** 2.3 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Reconciliada por ADR 005 (ver nota de reconciliación al final del documento). Cierre en `docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`.
**Implementa:** el contrato funcional y la arquitectura técnica ya aprobados para el contexto `Finanzas` (`docs/architecture/use-cases/sistema-operativo-finanzas.md`, `docs/architecture/technical-design/sistema-operativo-finanzas.md`).

Este documento describe qué necesita persistir el dominio, no cómo se va a guardar. Sigue exactamente los mismos Principios Permanentes del modelo de persistencia ya establecidos en el Entregable 2.1 — no se redefinen aquí, se heredan. Incorpora, además, el principio nuevo aprobado en la Etapa 3: los patrones se aplican cuando el dominio los necesita, no por uniformidad entre contextos.

**Punto de partida (corregido por ADR 005):** a diferencia de lo que este documento afirmaba originalmente, Finanzas **sí reutiliza entidades físicas existentes de Fase 1** — igual que Staff en 2.2. `Expense` se extiende para representar `Gasto`. `Transaction` (Fase 1, "POS / Facturación") se extiende para convertirse en la entidad oficial de ingreso del negocio — la especialización `Cobro`, ya prevista por `domain-model-v1.md` como "la transacción específica del pago de un servicio", deja de ser una entidad nueva y pasa a ser un origen de `Transaction`. Solo `Cierre del Día` y `Período Financiero` son enteramente nuevos. Finanzas también reutiliza, por lectura, `Commission` (propiedad de Staff) — sin modelarla aquí, sin copiarla, y sin relación física.

---

## 1. Entidades persistentes

| Entidad | Origen |
|---|---|
| Gasto | Ya existe (Fase 1, `Expense`) — se extiende con estado de anulación |
| Cobro | **Corregido por ADR 005** — deja de ser una entidad nueva. Se materializa como un origen (`system_appointment_completed`) de `Transaction` (Fase 1, extendida) |
| Cierre del Día | Nueva |
| Período Financiero | Nueva |

No se modela aquí ninguna entidad de `Agenda`, `Clientes`, `Mascotas` ni `Staff`. `Cobro` referencia una cita por identificador, sin incorporar la estructura de `Agenda`; el desglose consolidado de `Cierre del Día` y `Período Financiero` lee `Commission` (Staff) en el momento de generarse, sin modelarla ni copiarla como entidad propia.

---

## 2. Responsabilidad de cada entidad

### Gasto (reutiliza `Expense`, Fase 1)
Representa un egreso operativo del negocio. Ya existía físicamente desde Fase 1, con validación de monto y categoría; este entregable le agrega el `estado` (activo/anulado) y la inmutabilidad que el contrato funcional exige.

### Cobro (corregido por ADR 005 — reutiliza `Transaction`, Fase 1, con origen `system_appointment_completed`)
Representa el ingreso que resulta de una cita completada. **Ya no se modela como una entidad independiente.** `domain-model-v1.md` (sección 7) ya definía a `Cobro` como "la transacción específica del pago de un servicio" — una especialización de `Transacción`, no su propia entidad. Se materializa como una fila de `Transaction` con `origin = "system_appointment_completed"`, sin ítems, con el monto ya resuelto por el evento `CitaCompletada`. Separa el hecho de "el cliente pagó por este servicio" (`Transaction`, Finanzas) del hecho de "el staff generó esta comisión" (`Commission`, Staff) — ambos conceptos relacionados pero distintos, coexistencia ya prevista por el propio Modelo de Dominio ("el desglose de split si aplica").

### Cierre del Día
Representa el hecho financiero oficial e inmutable de un día: cuánto entró, cuánto salió, y a quién le corresponde qué. Existe porque, sin él, la única forma de saber "qué pasó financieramente ese día" era recalcularlo cada vez que alguien preguntaba (como hace hoy `daily-close.routes.js` de Fase 1), sin que quedara nunca un registro fijo de que ese cálculo fue oficial.

### Período Financiero
Representa el mismo tipo de hecho financiero oficial e inmutable que `Cierre del Día`, pero a la escala de un rango de días. Por esa misma naturaleza —ser un hecho oficial, no una vista— constituye una **partición del tiempo**: ningún día puede pertenecer a más de un `Período Financiero` oficial activo. Existe porque el negocio necesita reportes semanales o mensuales sin tener que sumar cierres de día sueltos cada vez.

### Commission (consultada, no modelada aquí)
Sin cambios respecto a su definición en el Entregable 2.2: el registro inmutable de lo que un miembro del staff generó en una cita completada. `Finanzas` la consulta vía `CommissionReaderPort` al generar un `Cierre del Día`; no la posee, no la copia como entidad, no la modela en este documento.

---

## 3. Campos

### Gasto (extensión de `Expense`, Fase 1)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id`, `tenantId`, `amount` (monto), `category`, `date` | *(ya existen en `Expense`, Fase 1, sin cambios)* | — | `category` se reinterpreta: deja de ser un valor libre de conveniencia y pasa a validarse contra el enumerado propio de Finanzas decidido en la Etapa 3 (no configurable desde Negocio). |
| `responsable` | Texto | Sí | **Campo nuevo**, exigido por el contrato funcional (2.3) — no existía en `Expense` de Fase 1. |
| `estado` | Enumerado (`activo` \| `anulado`) | Sí | **Campo nuevo.** Nace siempre `activo`. Nunca se edita — solo transiciona a `anulado`. `Expense` de Fase 1 no tenía este concepto; los gastos ya existentes se consideran `activo` por defecto. |
| `anuladoEn`, `motivoAnulación` | Fecha / Texto | Solo si `estado = anulado` | **Campos nuevos.** |
| `createdAt` | Fecha | Sí | *(ya existe, sin cambios)* |

### Cobro — corregido por ADR 005 (origen de `Transaction`, Fase 1)

`Cobro` no se modela como una entidad ni un conjunto de campos propio. Se materializa como una fila de `Transaction` (Fase 1) con:

| Campo de `Transaction` | Valor cuando el origen es Cobro | Regla de negocio asociada |
|---|---|---|
| `origin` | `"system_appointment_completed"` | **Campo nuevo** sobre `Transaction`. Distingue esta fila de una venta de mostrador (`"manual_pos_sale"`, el comportamiento ya existente de Fase 1). |
| `appointmentId` | El id de la cita completada, **sin clave foránea, sin validación de existencia** — ver sección 4 | El id llega ya confirmado por el evento `CitaCompletada`; Agenda es el origen de verdad del hecho. `Transaction.appointmentId` ya era único desde Fase 1 — esa unicidad ya protege "una sola fila de origen sistema por cita". |
| `total` | El precio ya resuelto de la cita, recibido del evento — no recalculado | — |
| `items` | Vacío (sin ítems) | Un Cobro no se descompone en líneas — el monto ya viene resuelto como un único valor por Servicios. |
| `paidAt` | La fecha de `completedAt` del evento | Determina a qué día pertenece para efectos de un futuro Cierre del Día. |

No existe `estado` para esta fila: no hay anulación de Cobro en este entregable — una cita completada erróneamente se corrige en `Agenda`, no en `Finanzas` (ya establecido en la Etapa 2). Esto es consistente con `Transaction` de Fase 1, que tampoco tiene hoy ningún mecanismo de anulación.

### Cierre del Día (nueva)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `tenantId` | Identificador | Sí | — |
| `fecha` | Fecha | Sí | Único por `tenantId` + `fecha` entre los cierres activos. |
| `ingresoTotal`, `egresoTotal`, `neto` | Decimal | Sí | Resultado de `financial-summary.rules.js` en el momento de generarse. Nunca se recalculan después. |
| `desglosePorStaff` | **Snapshot congelado** (estructura serializada, no relación) | Sí | Decisión de la Etapa 4: no posee ciclo de vida propio ni se consulta de forma aislada — nace y queda fijo junto con el resto del cierre. |
| `estado` | Implícito — no existe transición de estado | — | Un `Cierre del Día` no se anula ni se edita en este entregable; su única "corrección" es la pregunta explícitamente diferida (Decisión Diferida #1 de la Etapa 3). |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal — coincide, en la práctica, con el momento de generación. |

### Período Financiero (nueva)

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `tenantId` | Identificador | Sí | — |
| `períodoInicio`, `períodoFin` | Fecha | Sí | Define la partición de tiempo que este período representa. |
| `ingresoTotal`, `egresoTotal`, `neto` | Decimal | Sí | Resultado de `financial-summary.rules.js` aplicado sobre los `Cierre del Día` del rango. Nunca se recalculan después. |
| `desgloseConsolidado` | **Snapshot congelado** (estructura serializada, no relación) | Sí | Mismo criterio que en Cierre del Día. |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

No se almacena una lista explícita de los ids de `Cierre del Día` que componen el período: el rango `períodoInicio`/`períodoFin` ya lo determina, y esos cierres son inmutables una vez generados — no hace falta fijar una relación para preservar la integridad histórica.

---

## 4. Relaciones

**Ninguna entidad de este documento contiene a otra como hijo mutable.** Las cuatro son raíces de tamaño uno — ver sección 5.

**`Transaction` (origen Cobro) referencia `Appointment` (Agenda) únicamente por identificador, sin clave foránea adicional ni validación de existencia nueva en el momento de escribir.** Decisión de la Etapa 4, distinta del criterio usado en `Capacidad del Staff` → `Servicio` (2.2): allí el id lo escribía un operador humano y podía ser inválido, por lo que se validaba vía `ServiceExistenceReaderPort`. Aquí el id llega ya confirmado por el propio evento `CitaCompletada` — no hay operador humano que pueda escribir un id equivocado, así que no hace falta un puerto de verificación de existencia. (`Transaction.appointmentId` ya tenía, desde Fase 1, una relación física opcional hacia `Appointment` — se conserva sin cambios.)

**`Cierre del Día` no tiene relación física con `Gasto`, `Transaction` (ni con el origen Cobro) ni `Commission`.** Los consulta en el momento de generarse (vía sus repositorios y `CommissionReaderPort`), y una vez generado su snapshot es autosuficiente — no depende de que esas filas sigan existiendo o sin cambiar.

**`Período Financiero` no tiene relación física con `Cierre del Día`.** Se define por rango de fechas; los cierres que abarca se determinan por consulta al generarse (`period-completeness.rules.js`), no por una relación persistida.

**Relación con `Commission` (Staff):** consultada vía `CommissionReaderPort`, sin clave foránea — mismo criterio de desacoplamiento entre contextos ya usado en 2.1 y 2.2 para referencias cruzadas.

---

## 5. Agregados

**No existe un Aggregate Root compartido en este contexto.** Decisión ya explícita desde la Etapa 3: ninguna de las cuatro entidades (`Gasto`, `Cobro`, `Cierre del Día`, `Período Financiero`) contiene a otra como hijo mutable — `Período Financiero` referencia `Cierre del Día` por rango de fechas, pero los lee y los agrupa, nunca los posee ni los escribe. Forzar un Aggregate Root aquí replicaría la forma de 2.1/2.2 sin que el dominio lo requiera.

Cada entidad es su propia raíz, de tamaño uno, con su propio caso de uso como única vía de escritura: `RegisterExpenseUseCase`/`VoidExpenseUseCase` para `Gasto`; `RecordChargeOnAppointmentCompletedUseCase` para el origen Cobro de `Transaction` (corregido por ADR 005); `GenerateDailyCloseUseCase` para `Cierre del Día`; `GenerateFinancialPeriodUseCase` para `Período Financiero`. La venta de mostrador (`origin = "manual_pos_sale"`) sigue teniendo su propio flujo de escritura ya existente en Fase 1 (`POST /transactions`), fuera del alcance de los casos de uso de este entregable.

---

## 6. Invariantes

- Un `Gasto` (`Expense`), una vez creado, nunca se edita. La única mutación permitida es la transición a `estado = anulado`, con su fecha y motivo. **Invariante nueva sobre una entidad reutilizada** — `Expense` de Fase 1 no la tenía.
- Un `Gasto` no puede registrarse ni anularse para una fecha que ya tenga un `Cierre del Día` activo generado.
- Una fila de `Transaction` con `origin = "system_appointment_completed"` (el origen Cobro) es inmutable desde su creación — no existe operación de edición ni anulación en este entregable. Esta invariante aplica únicamente a ese origen; el origen `"manual_pos_sale"` conserva su comportamiento actual de Fase 1, sin nuevas restricciones impuestas por este entregable.
- No pueden coexistir dos `Cierre del Día` con estado equivalente a "activo" para el mismo `tenantId` y la misma fecha. *(El mecanismo exacto de protección — aplicación, base de datos, o ambos — se decide en la Etapa 5, igual que ocurrió con `Regla de Precio` en 2.1 y `Capacidad del Staff`/`Liquidación` en 2.2.)*
- Un `Cierre del Día`, una vez generado, nunca cambia sus totales ni su desglose.
- **Un `Período Financiero` es un hecho financiero oficial e inmutable, no una vista — constituye una partición del tiempo.** Ningún día puede pertenecer a más de un `Período Financiero` activo para el mismo `tenantId`. Esta invariante es más fuerte que "no duplicar exactamente el mismo rango": prohíbe cualquier solapamiento, total o parcial, entre períodos activos.
- Un `Período Financiero` solo puede generarse si todos los días de su rango tienen `Cierre del Día` oficial — sin excepción, sin períodos parciales.
- Un `Período Financiero`, una vez generado, nunca cambia sus totales ni su desglose.
- `Commission` conserva sin cambios su invariante de inmutabilidad ya vigente desde Fase 1 y confirmada en 2.2.

### Principio derivado, incorporado por este entregable

**"Los hechos financieros oficiales representan particiones del tiempo; las consultas históricas representan vistas sobre los datos. Solo los hechos oficiales están sujetos a invariantes de exclusión temporal."**

Esto explica por qué `Consultar Historial Financiero` puede mostrar información sobre cualquier rango, incluso solapado con un `Período Financiero` existente o con días sin cerrar, sin violar ninguna invariante: no produce un hecho oficial, solo una vista construida con la misma regla de consolidación (`financial-summary.rules.js`) pero sobre datos que no están congelados.

---

## 7. Preparación para evolución

`Gasto.categoría`, al ser un enumerado propio del dominio Finanzas, puede extenderse con nuevas categorías agregando un valor nuevo, sin alterar la forma de las filas existentes — mismo patrón de evolución por extensión usado en `Disponibilidad del Staff.tipo` (2.2) y `tipoDeDestino` en `Regla de Precio` (2.1).

El snapshot (`desglosePorStaff`, `desgloseConsolidado`) puede ganar nuevas dimensiones de desglose en el futuro (por ejemplo, por categoría de servicio) sin requerir una migración de esquema relacional — es una estructura serializada, no una tabla.

Si la Decisión Diferida #2 de la Etapa 3 (pertenencia futura de `Commission`/`Settlement`) se resuelve hacia `Finanzas`, ese traslado no debería afectar la forma de `Cierre del Día`: ya la consume por puerto, no por relación física, así que el desacoplamiento actual ya está preparado para ese movimiento.

No se modela todavía ningún mecanismo de corrección para un hecho financiero de un período ya cerrado (Decisión Diferida #1 de la Etapa 3) — anticiparlo ahora sería resolver, en el modelo de datos, una pregunta que se decidió dejar explícitamente abierta hasta un ADR propio.

---

## 8. Validación final

**Contra el Plan Maestro y el Modelo de Dominio (corregido por ADR 005):** las entidades corresponden ahora, con mayor fidelidad que la versión original de este documento, a lo que `domain-model-v1.md` describe para el contexto `Finanzas` — incluyendo la relación `Transacción` → `Cobro` como especialización, no como entidades separadas.

**Contra el contrato funcional:** cada campo existe porque algún caso de uso lo requiere explícitamente (p. ej. `desglosePorStaff` existe porque `Generar Cierre del Día` promete ese desglose, y `Consultar Historial Financiero` lo reutiliza en sus vistas preliminares mediante la misma regla).

**Contra la arquitectura técnica:** el modelo es compatible con los puertos ya definidos — `ExpenseRepositoryPort`, `TransactionRepositoryPort` (corregido por ADR 005), `DailyCloseRepositoryPort`, `FinancialPeriodRepositoryPort` y `CommissionReaderPort` operan cada uno sobre exactamente una de estas entidades (o, en el último caso, sobre una entidad ajena consultada por lectura).

**Contra los Principios Permanentes del modelo de persistencia (heredados de 2.1) y el principio nuevo de la Etapa 3:** no se fuerza un Aggregate Root donde el dominio no lo requiere; el modelo evoluciona por extensión (nuevos valores de enumerado, nuevas dimensiones de snapshot), nunca por ruptura; la ambigüedad sobre la pertenencia futura de `Commission`/`Settlement` a `Finanzas` se preserva intencionalmente, no se resuelve aquí.

---

## Nota de reconciliación — ADR 005

Este documento originalmente afirmaba que "Finanzas no reutiliza ninguna entidad física existente" y modelaba `Gasto` y `Cobro` como entidades enteramente nuevas. Una auditoría de las entidades físicas de Fase 1 (`Expense`, `Transaction`, `TransactionItem`), realizada al iniciar la Etapa 5, mostró que ambas afirmaciones eran incorrectas:

- `Expense` (Fase 1) ya representaba el mismo concepto de dominio que `Gasto` — se confirmó que debía extenderse, no reemplazarse.
- `domain-model-v1.md` ya definía a `Cobro` como especialización de `Transacción`, no como entidad propia — hallazgo que llevó al ADR 005.

**Esta es una reconciliación con el Modelo de Dominio y con el estado real del código ya existente, no una corrección de errores de diseño de este documento.** Los campos, invariantes y relaciones de `Gasto` y `Cobro` se actualizaron en las secciones 1 a 6 de este mismo documento, marcados explícitamente donde corresponde. No cambia: `Cierre del Día`, `Período Financiero`, la ausencia de Aggregate Root, el snapshot congelado, ni la invariante de partición del tiempo. Ver `docs/decisions/005-cobro-especializacion-transaccion.md` para el análisis y las consecuencias completas.

---

*Modelo de Persistencia aprobado y congelado · Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
*Etapa 4 reconciliada con el Modelo de Dominio v1 y con las entidades físicas reales de Fase 1, por ADR 005*
