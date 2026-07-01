# Sistema Operativo de Finanzas — Entregable 2.3

**Fase:** Fase 2 — Sistema Operativo del Negocio
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md`
**Estado de este documento:** Implementado y validado. Etapa 1 y Etapa 2 congeladas — Etapa 2 reconciliada por ADR 005 y corregida en la Validación Funcional (simplificación de la entrada de `Registrar Cobro al Completarse una Cita`, ver `docs/decisions/005-cobro-especializacion-transaccion.md`). Cierre en `docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`.
**Contexto de dominio que cubre:** `Finanzas` (ver `docs/architecture/domain-model-v1.md`, sección 7)

---

## Etapa 1 — Definición Funcional

### Qué problema del negocio resuelve

Hoy el negocio no tiene un **cierre financiero real**: lo que existe en Fase 1 (`GET /daily-close`) es un cálculo *sobre la marcha*, generado en el momento en que alguien lo consulta, leyendo `Appointment` y `Commission` en vivo. No existe un registro de que "el día X se cerró", ni una fuente de verdad estable para consultarlo después. Si se agenda o completa una cita nueva para una fecha ya pasada, el "cierre" de ese día cambiaría retroactivamente sin que nadie lo decidiera. Tampoco existe ningún concepto de **gasto operativo** (insumos, nómina, servicios), por lo que el negocio no puede ver su neto real — solo sus ingresos.

Este entregable resuelve eso: convierte el cierre financiero en un **hecho consolidado y estable**, e incorpora el lado de los egresos que hoy no existe en ninguna parte del sistema.

### Qué trabajo humano elimina

- Sumar manualmente ingresos y comisiones del día para saber "cuánto entró hoy" (hoy se puede consultar, pero no queda un registro fijo de que ese cálculo fue el cierre oficial del día).
- Llevar los gastos del negocio (insumos, nómina, servicios) en una libreta, hoja de cálculo o cualquier sistema externo a la plataforma.
- Recalcular manualmente reportes semanales o mensuales combinando varios días sueltos.

### Cuál es su objetivo dentro del Sistema Operativo

Responder de forma consolidada y confiable, para cualquier período: **¿cuánto entró, cuánto salió, y a quién le corresponde qué?** — sin que la respuesta cambie después de haberse cerrado, y sin exportar nada fuera de la plataforma para obtenerla.

A diferencia de Servicios (2.1) o Staff (2.2), que son fuentes de verdad sobre *cómo opera* el negocio, Finanzas es la fuente de verdad sobre *qué produjo* esa operación en dinero — consolidando, no recalculando, lo que Agenda y Staff ya generaron.

### Cuáles son sus límites de contexto

**Lo que Finanzas SÍ hace:**
- Registrar cada movimiento de dinero del negocio: cobros (vinculados a una cita completada) y gastos operativos.
- Calcular y fijar el neto del negocio para un día o período determinado.
- Consolidar las comisiones que Staff ya generó, sin recalcularlas.
- Dejar cerrado un período para que su resultado no cambie retroactivamente.
- Responder reportes financieros por cualquier período, sin recalcular sobre la marcha.

**Lo que Finanzas NO hace (pertenece a otro contexto):**
- No agenda ni completa citas — Agenda decide cuándo un servicio se completó; Finanzas solo registra el cobro que resulta de eso.
- No calcula el split de comisión — eso ya lo resuelve Staff (`commission-calculation.rules.js`); Finanzas consolida el resultado, no lo recalcula.
- No conoce a Clientes ni Mascotas directamente — el cobro referencia una cita, no a la persona ni al animal.
- No decide reglas de negocio sobre categorías de servicio o splits — esas reglas viven en Negocio/Servicios/Staff; Finanzas las consume ya resueltas.
- No pertenece al Dominio Clínico — un gasto clínico es, para efectos financieros, un gasto operativo más, sin tratamiento especial.

**Brecha respecto al estado actual:** el `daily-close.routes.js` de Fase 1 seguirá funcionando mientras este entregable no lo reemplace explícitamente; ese reemplazo (si aplica) se decidirá en Arquitectura Técnica, no aquí.

### Qué cambia conceptualmente en el negocio

Antes de este entregable, las finanzas eran un **resultado obtenido consultando otros contextos**: no existía un dato financiero propio, sino un cálculo derivado en el momento, leyendo `Appointment` y `Commission` desde un endpoint de Fase 1. El negocio no tenía, en ningún punto, un registro que dijera "esto es lo que pasó financieramente ese día" — solo tenía la capacidad de volver a calcularlo cada vez que alguien preguntaba.

Después de este entregable, las finanzas se convierten en un **contexto propio**, responsable de registrar y consolidar los hechos económicos como una fuente de verdad independiente. Un cobro, un gasto o un cierre de día dejan de ser una consulta y pasan a ser un hecho registrado, con su propia identidad y su propia estabilidad en el tiempo — de la misma forma en que Servicios dejó de ser un campo de texto libre y Staff dejó de ser un JSON de disponibilidad. Finanzas completa ese mismo patrón para el dinero.

### Qué habilita para la siguiente fase

Este es, según el propio Plan Maestro, el **entregable de cierre de la Fase 2**: al completarlo, el operador podrá gestionar toda la operación diaria —agenda, servicios, staff, comisiones, cierre del día, reportes históricos— desde la plataforma sin intervención de ningún agente ni exportación externa. Eso habilita directamente la Fase 3 (Empleados Digitales), que necesita eventos financieros estables (`TransacciónRegistrada`, `CierreDíaGenerado`) para poder, por ejemplo, notificar automáticamente a un miembro del staff que su liquidación está lista, o alertar sobre un día con neto negativo.

---

## Etapa 2 — Casos de Uso

### Clasificación por responsabilidad

Se mantiene el criterio de diseño establecido en los Entregables 2.1 y 2.2: Administración, Operación, Resolución, Consulta. En este entregable no hay ningún caso de uso de Resolución: la lógica de consolidación del neto financiero es una regla de dominio interna (`financial-summary.rules.js` o equivalente, a definir en Arquitectura Técnica), no una intención de negocio independiente — fue evaluada explícitamente y descartada como caso de uso propio.

| # | Caso de uso | Responsabilidad | Actor |
|---|---|---|---|
| 1 | Registrar Gasto | Administración | Humano |
| 2 | Anular Gasto | Administración | Humano |
| 3 | Registrar Cobro al Completarse una Cita | Operación (reactivo) | Sistema (`CitaCompletada` de Agenda) |
| 4 | Generar Cierre del Día | Administración | Humano |
| 5 | Generar Período Financiero | Administración | Humano |
| 6 | Consultar Cierre del Día | Consulta | Humano |
| 7 | Consultar Historial Financiero | Consulta | Humano |
| 8 | Consultar Período Financiero | Consulta | Humano |

### Mapa conceptual del contexto

```
                         ACTOR SISTEMA                         ACTOR HUMANO
                    (eventos de otros contextos)            (operador del negocio)

  Agenda: CitaCompletada                                    ┌─────────────────┐
          │                                                  │  Registrar Gasto │
          ▼                                                  └────────┬─────────┘
  ┌──────────────────────────────┐                                    │
  │ 3. Registrar Cobro al        │                                    │ (si el gasto fue
  │    Completarse una Cita      │                                    │  incorrecto)
  │    (genera HECHO: Cobro)     │                                    ▼
  └───────────────┬───────────────┘                          ┌──────────────────┐
                  │                                          │  2. Anular Gasto  │
                  │                                          │  (anula + nuevo)  │
                  │                                          └──────────────────┘
                  │
                  │  Staff: Commission ya existe
                  │  (fuente de verdad externa, no evento consumido aquí)
                  │
                  ▼
      ┌─────────────────────────────────────────────┐
      │  HECHOS FINANCIEROS ATÓMICOS YA REGISTRADOS  │
      │  Cobro · Gasto · Commission (de Staff)       │
      └───────────────────┬───────────────────────────┘
                           │
                           │  consolida (regla de dominio interna,
                           │  no es caso de uso: financial-summary.rules.js)
                           ▼
              ┌─────────────────────────────┐
              │ 4. Generar Cierre del Día   │◄── Humano, acción explícita
              │    (HECHO INMUTABLE)        │
              └──────────────┬───────────────┘
                              │
                              │ agrupa ÚNICAMENTE Cierres del Día
                              │ ya generados — nunca transacciones sueltas
                              ▼
              ┌─────────────────────────────┐
              │ 5. Generar Período           │◄── Humano, acción explícita
              │    Financiero                │     Requiere: Cierre del Día
              │    (HECHO INMUTABLE)         │     oficial para TODOS los días
              └──────────────┬───────────────┘     del rango, sin excepción
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────────┐ ┌───────────────────────┐
│ 6. Consultar      │ │ 7. Consultar          │ │ 8. Consultar           │
│    Cierre del Día │ │    Historial          │ │    Período Financiero │
│    (lee un hecho  │ │    Financiero         │ │    (lee un hecho       │
│    ya cerrado)    │ │    (lee cierres/      │ │    ya cerrado)         │
└──────────────────┘ │    cobros/gastos       │ └───────────────────────┘
                      │    por rango libre,    │
                      │    hayan sido cerrados │
                      │    o no)               │
                      └──────────────────────┘
```

### Regla de negocio congelada a partir del mapa

**Un Período Financiero solo puede generarse si todos los días que abarca poseen un Cierre del Día oficial.** Período Financiero no consolida transacciones individuales (Cobro, Gasto, Commission) en ningún caso — consolida exclusivamente Cierres del Día ya generados. Si el rango solicitado incluye un día sin cierre, la generación del período debe rechazarse en su totalidad; no se generan períodos parciales ni con huecos. Esta regla preserva el principio de inmutabilidad: un período financiero nunca puede cambiar de resultado porque uno de sus días estaba todavía abierto en el momento de generarlo.

**Mapa conceptual aprobado y congelado.** El detalle de cada caso de uso se documenta a continuación, en el orden natural que este mapa define: los que generan hechos primero, luego los que consolidan, luego los que consultan.

---

## 1. Registrar Gasto

**Responsabilidad:** Administración

**Objetivo**
Dejar constancia de un egreso operativo del negocio (insumos, nómina, servicios u otro).

**Actor principal**
Operador del negocio.

**Precondiciones**
- El monto es positivo.
- La categoría del gasto es una de las categorías válidas del establecimiento.

**Flujo principal**
1. El operador provee monto, categoría, responsable y fecha del gasto.
2. El caso de uso valida los datos.
3. El gasto se registra como un hecho financiero activo.

**Reglas de negocio involucradas**
- Un gasto, una vez registrado, es inmutable: no se edita. Una corrección se hace anulándolo (caso de uso 2) y registrando uno nuevo.
- Un gasto no puede pertenecer a un día que ya tenga un Cierre del Día generado — el cierre es inmutable y un gasto nuevo lo invalidaría retroactivamente. Pregunta abierta para Arquitectura Técnica (no resuelta en esta etapa): **¿Cómo corrige el dominio un hecho económico perteneciente a un período ya cerrado sin romper la inmutabilidad del cierre financiero?**

**Eventos de dominio que produce**
- `GastoRegistrado`

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Agenda`, `Staff`, Dominio Clínico.

**Resultado esperado**
Un gasto activo, disponible para ser incluido en el próximo Cierre del Día que se genere para su fecha.

---

## 2. Anular Gasto

**Responsabilidad:** Administración

**Objetivo**
Corregir un gasto registrado incorrectamente, sin editarlo ni eliminarlo.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El gasto existe y está activo (no anulado previamente).
- El gasto no pertenece a un día que ya tenga un Cierre del Día generado (mismo criterio que en Registrar Gasto).

**Flujo principal**
1. El operador identifica el gasto a anular y provee un motivo.
2. El caso de uso marca el gasto original como anulado, preservando el registro original intacto.
3. Si corresponde, el operador registra un nuevo gasto con el monto correcto (caso de uso 1, flujo separado).

**Reglas de negocio involucradas**
- Un gasto anulado nunca se borra ni se modifica en su forma original — el mismo principio de inmutabilidad ya usado para `Commission` en el Entregable 2.2.
- Un gasto anulado no se incluye en ningún Cierre del Día futuro.

**Eventos de dominio que produce**
- `GastoAnulado`

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Agenda`, `Staff`, Dominio Clínico.

**Resultado esperado**
El gasto original queda marcado como anulado y excluido de cualquier consolidación futura, sin perder su historial.

---

## 3. Registrar Cobro al Completarse una Cita

**Responsabilidad:** Operación (reactivo — no iniciado por un operador humano)

**Objetivo**
Registrar el hecho financiero de ingreso que resulta de una cita completada.

**Actor principal**
Sistema — proceso reactivo al evento `CitaCompletada` producido por `Agenda`.

**Precondiciones**
- La cita está efectivamente completada.
- Existe un precio resuelto para el servicio de esa cita (ya resuelto por `Servicios` en el momento de completarse la cita, no recalculado aquí).

**Flujo principal**
1. `Agenda` completa una cita y produce `CitaCompletada`.
2. Este caso de uso recibe el hecho ya confirmado y registra el Cobro correspondiente: monto, servicio, cita referenciada, fecha.
3. El Cobro queda disponible para el próximo Cierre del Día de su fecha.

**Reglas de negocio involucradas**
- Este caso de uso no calcula precio ni split de comisión — ambos ya fueron resueltos por otros contextos antes de que la cita se marcara como completada.
- No conoce al cliente ni a la mascota: el Cobro referencia únicamente la cita.
- Un Cobro es inmutable desde su creación — no existe "editar Cobro"; una cita completada erróneamente se corrige en `Agenda`, no en `Finanzas`.

**Eventos de dominio que produce**
- `CobroRegistrado`

**Qué contextos consume**
- `Agenda` — exclusivamente vía el evento `CitaCompletada`, nunca por llamada directa.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas` directamente, `Staff` (las comisiones se consultan aparte, no se reciben aquí), Dominio Clínico.

**Resultado esperado**
Un Cobro registrado y disponible para consolidación, sin intervención humana.

**Nota de reconciliación (ADR 005, ver Etapa 5):** este caso de uso se mantiene sin cambios como intención de negocio. Su traducción técnica cambió: "Cobro" no se materializa como una entidad física propia, sino como una fila de `Transacción` (la especialización de `Transacción` ya prevista por `domain-model-v1.md`, con origen `system_appointment_completed`). El contrato funcional descrito arriba —actor, precondiciones, flujo, reglas, evento `CobroRegistrado`— no cambia; solo cambia cómo se persiste.

---

## 4. Generar Cierre del Día

**Responsabilidad:** Administración

**Objetivo**
Congelar el resultado financiero de un día operativo como un hecho inmutable.

**Actor principal**
Operador del negocio.

**Precondiciones**
- No existe ya un Cierre del Día generado para esa fecha (un cierre no se regenera; es un hecho único por día).

**Flujo principal**
1. El operador solicita el cierre de una fecha determinada.
2. El caso de uso consolida, para esa fecha exacta: los Cobros registrados, los Gastos activos, y las Commission ya existentes (consultadas como fuente de verdad, no recalculadas) — usando la regla de dominio de consolidación (`financial-summary.rules.js`).
3. El resultado (ingresos, egresos, comisiones por staff, neto) se registra como el Cierre del Día oficial de esa fecha.

**Reglas de negocio involucradas**
- Un Cierre del Día, una vez generado, es inmutable: no se regenera ni se edita.
- Consolida únicamente hechos ya existentes en la fecha exacta del cierre; no recalcula reglas de negocio de otros contextos (precio, split de comisión).
- Pregunta abierta para Arquitectura Técnica (no resuelta en esta etapa): **¿Cómo corrige el dominio un hecho económico perteneciente a un período ya cerrado sin romper la inmutabilidad del cierre financiero?**

**Eventos de dominio que produce**
- `CierreDíaGenerado`

**Qué contextos consume**
- `Staff` — consulta `Commission` como fuente de verdad, sin escuchar eventos.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Agenda` directamente (ya consumió su efecto vía Cobro), Dominio Clínico.

**Resultado esperado**
Un Cierre del Día oficial e inmutable, disponible para ser consultado o para formar parte de un Período Financiero futuro.

---

## 5. Generar Período Financiero

**Responsabilidad:** Administración

**Objetivo**
Congelar el resultado financiero de un rango de días (semana, mes) como un hecho inmutable.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Todos los días del rango solicitado tienen un Cierre del Día oficial ya generado, sin excepción.

**Flujo principal**
1. El operador solicita el período (fecha de inicio, fecha de fin).
2. El caso de uso verifica que todos los días del rango tengan Cierre del Día generado. Si falta uno solo, la generación se rechaza en su totalidad.
3. El caso de uso agrupa los Cierres del Día ya existentes del rango y calcula el resultado consolidado del período.
4. El resultado se registra como el Período Financiero oficial de ese rango.

**Reglas de negocio involucradas**
- Un Período Financiero solo consolida Cierres del Día ya generados — nunca transacciones individuales (Cobro, Gasto, Commission) directamente.
- No se generan períodos parciales ni con huecos: la regla es todo-o-nada.
- Un Período Financiero, una vez generado, es inmutable.

**Eventos de dominio que produce**
- `PeríodoFinancieroGenerado`

**Qué contextos consume**
- Ninguno externo — consolida datos internos de Finanzas (sus propios Cierres del Día).

**Qué contextos no debe conocer**
- Todos los demás contextos — este caso de uso opera exclusivamente sobre datos ya internos de Finanzas.

**Resultado esperado**
Un Período Financiero oficial e inmutable, disponible para consulta.

---

## 6. Consultar Cierre del Día

**Responsabilidad:** Consulta

**Objetivo**
Mostrar el resultado financiero oficial de un día ya cerrado.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Existe un Cierre del Día generado para la fecha solicitada.

**Flujo principal**
1. El operador solicita el cierre de una fecha.
2. El caso de uso devuelve el Cierre del Día ya registrado, sin recalcular nada.

**Reglas de negocio involucradas**
- Es una lectura pura de un hecho ya congelado. Si la fecha no tiene cierre generado, el caso de uso lo informa explícitamente — no genera un cálculo alternativo sobre la marcha.

**Eventos de dominio que produce**
- Ninguno (es una consulta).

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- Todos los demás — es una lectura interna de Finanzas.

**Resultado esperado**
El Cierre del Día tal como fue congelado en el momento de su generación.

---

## 7. Consultar Historial Financiero

**Responsabilidad:** Consulta

**Objetivo**
Mostrar la actividad financiera de un rango arbitrario de fechas, hayan sido cerradas o no.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Ninguna — a diferencia de las demás consultas, este caso de uso no exige que exista un Cierre del Día o Período Financiero previo.

**Flujo principal**
1. El operador solicita un rango de fechas.
2. El caso de uso muestra, para ese rango: los Cierres del Día ya generados (donde existan) y, para los días aún no cerrados, los Cobros y Gastos registrados hasta el momento, señalados explícitamente como "no cerrado" para no confundirse con un hecho congelado.

**Reglas de negocio involucradas**
- Es la única consulta de este contexto que puede mostrar información no congelada. Debe distinguir siempre, en su resultado, qué parte del rango es un hecho inmutable (Cierre del Día) y qué parte es una vista preliminar (transacciones sueltas de un día aún abierto).

**Eventos de dominio que produce**
- Ninguno (es una consulta).

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- Todos los demás — es una lectura interna de Finanzas.

**Resultado esperado**
Una vista del historial financiero que nunca oculta si un día ya está oficialmente cerrado o no.

---

## 8. Consultar Período Financiero

**Responsabilidad:** Consulta

**Objetivo**
Mostrar el resultado financiero oficial de un período ya generado.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Existe un Período Financiero generado que corresponde al rango solicitado.

**Flujo principal**
1. El operador solicita el período.
2. El caso de uso devuelve el Período Financiero ya registrado, sin recalcular nada.

**Reglas de negocio involucradas**
- Es una lectura pura de un hecho ya congelado, igual que Consultar Cierre del Día.

**Eventos de dominio que produce**
- Ninguno (es una consulta).

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- Todos los demás — es una lectura interna de Finanzas.

**Resultado esperado**
El Período Financiero tal como fue congelado en el momento de su generación.

---

## Nota de reconciliación — ADR 005

Durante la Etapa 5 (Esquema Físico) de este entregable, una auditoría de las entidades físicas de Fase 1 (`Transaction`, `TransactionItem`, `Expense`) reveló que `docs/architecture/domain-model-v1.md` (sección 7, `Finanzas`) ya definía a `Cobro` como **"la transacción específica del pago de un servicio"** — es decir, una especialización de `Transacción`, no una entidad independiente. Este contrato funcional se diseñó, en su momento, sin volver a consultar esa definición ya vigente.

**Esto no es una corrección de errores del contrato funcional: es una reconciliación con el Modelo de Dominio ya aprobado.** El contenido de los 8 casos de uso, sus actores, flujos y reglas de negocio permanece sin cambios — la única modificación es la nota agregada al caso de uso 3 (`Registrar Cobro al Completarse una Cita`), aclarando que su traducción técnica cambió de "entidad nueva" a "especialización de `Transacción`". Ver `docs/decisions/005-cobro-especializacion-transaccion.md` para el análisis completo y las consecuencias en las Etapas 3 y 4.

---

*Definición Funcional y Casos de Uso aprobados y congelados · Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
*Etapa 2 reconciliada con el Modelo de Dominio v1 por ADR 005 · Ver nota arriba*
