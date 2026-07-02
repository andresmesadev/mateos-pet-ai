# Cierre del Entregable 2.3 — Sistema Operativo de Finanzas

**Fecha de cierre:** 2026-07-01
**Fase:** Fase 2 — Sistema Operativo del Negocio (✅ Completa con este cierre)
**Estado:** ✅ Completado
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md` (las ocho etapas, completas, incluyendo una Reconciliación Arquitectónica)
**Gate Review previo:** `docs/history/ENTREGABLE_2_3_GATE_REVIEW.md`

---

## Qué problema resolvía este entregable

Al cierre del Entregable 2.2, el negocio podía gestionar servicios, staff, disponibilidad y comisiones desde la plataforma, pero las finanzas seguían siendo, en la práctica, un cálculo *sobre la marcha*: `daily-close.routes.js` (Fase 1) leía `Appointment` y `Commission` en vivo cada vez que alguien preguntaba "¿cuánto entró hoy?", sin que ese cálculo quedara jamás registrado como un hecho oficial. Tampoco existía, dentro del Sistema Operativo, ningún concepto propio de gasto operativo con reglas de negocio — `Expense` (Fase 1) era un registro plano, sin inmutabilidad ni trazabilidad de responsable.

Este entregable resuelve eso: convierte el cierre financiero en un **hecho consolidado, inmutable y consultable**, e incorpora reglas de negocio propias sobre los gastos que hoy ya existían físicamente pero sin gobierno de dominio.

## Qué capacidades incorpora ahora la Plataforma Operativa Inteligente

- **Un cierre financiero real, no un cálculo repetido**: `Generar Cierre del Día` congela, para una fecha exacta, el resultado de consolidar ingresos (`Transaction`, ambos orígenes), egresos (`Gasto`) y comisiones (`Commission`, leída de Staff) — una sola vez, de forma inmutable.
- **Reportes por período sin recalcular ni exportar**: `Generar Período Financiero` consolida Cierres del Día ya oficiales, con la garantía de que un mismo día nunca pertenece a dos períodos — una partición real del tiempo, no una vista aproximada.
- **Gastos con gobierno de dominio**: un gasto ahora requiere responsable, nace inmutable, y se corrige por anulación + nuevo registro — nunca por edición directa, igual que ya rige para `Commission` desde 2.2.
- **El ingreso del negocio como una única fuente de verdad**: `Transaction` (ya existente desde Fase 1 como ticket de venta de mostrador) se convirtió, tras la Reconciliación Arquitectónica del ADR 005, en la entidad oficial del ingreso — capaz de originarse tanto de una venta manual como de una cita completada automáticamente, sin duplicar el concepto bajo dos nombres distintos.
- **Historial financiero honesto sobre qué está cerrado y qué no**: `Consultar Historial Financiero` distingue explícitamente, para cada día de un rango, si el resultado es un hecho oficial o una vista preliminar — calculada con exactamente la misma regla de consolidación que el cierre oficial.

Esto elimina trabajo humano concreto: sumar manualmente ingresos y comisiones para saber si un día "quedó cerrado", y llevar los gastos del negocio en un registro sin reglas ni trazabilidad de quién los autorizó.

## Qué decisiones arquitectónicas importantes quedaron establecidas

- **Los patrones arquitectónicos se aplican cuando el dominio los necesita, no por uniformidad entre contextos.** Este es el primer entregable de la Fase 2 sin Aggregate Root compartido — decisión justificada explícitamente porque ninguna de las cuatro entidades del contexto contiene a otra como hijo mutable.
- **La partición del tiempo de `Período Financiero` se protege sin `btree_gist`.** A diferencia del solapamiento de horario base en 2.2, aquí el invariante protege filas discretas (`Cierre del Día`) ya existentes, no rangos continuos — `DailyClose.financialPeriodId`, inmutable una vez asignado, resuelve la partición con una asignación condicionada y transaccional, sin requerir infraestructura adicional.
- **Reconciliación Arquitectónica — ADR 005 — `Cobro` deja de ser una entidad independiente.** Una auditoría de las entidades físicas de Fase 1 (`Expense`, `Transaction`, `TransactionItem`), realizada al iniciar la Etapa 5, reveló que `domain-model-v1.md` ya definía a `Cobro` como "la transacción específica del pago de un servicio" — una especialización de `Transacción`, no una entidad propia. Las Etapas 2 y 4 de este entregable se habían apartado de esa definición sin advertirlo. Se abrió, por primera vez en el proyecto, una Reconciliación Arquitectónica formal: se documentó la evidencia, se reabrieron únicamente las tres etapas afectadas (Casos de Uso, Arquitectura Técnica, Modelo de Persistencia), se registró la decisión en el ADR 005, y el diseño volvió a congelarse antes de continuar con el Esquema Físico.
- **La unicidad de `Transaction.appointmentId` se especializa por `origin`, no se relaja.** `origin` particiona las invariantes de una única entidad (el ingreso del negocio) — mismo patrón ya usado en `StaffAvailability.type`, `PriceRule.targetType` y `Commission.priceSource` — en vez de convertir a `Transaction` en un contenedor de dos conceptos distintos.
- **El mecanismo de Reconciliación Arquitectónica quedó incorporado como parte permanente del proceso.** `docs/PHASE_2_EXECUTION_RULE.md` ahora define formalmente cuándo abrir una, cómo se diferencia de una Decisión Diferida o un ADR ordinario, y su procedimiento de cinco pasos — con el ADR 005 como precedente registrado.

## Qué aprendimos durante su construcción

**Una auditoría de las entidades físicas ya existentes debe hacerse antes de diseñar el Esquema Físico, no después.** Si esa auditoría se hubiera hecho al inicio de la Etapa 1, la Reconciliación Arquitectónica se habría evitado por completo — las Etapas 2 y 4 nunca habrían modelado `Cobro` como entidad independiente. La lección queda incorporada como criterio: cuando un entregable toca un concepto que Fase 1 ya materializó físicamente (como ocurrió también con `Staff`/`Commission` en 2.2), verificar el código real debería ocurrir antes de la primera etapa de diseño, no solo antes de decidir un ADR puntual.

**Distinguir "documento comercial" de "hecho financiero" evitó una fusión conceptual incorrecta.** El análisis inicial post-auditoría concluyó, erróneamente, que `Transaction` se convertía en un contenedor de dos conceptos distintos. Insistir en el principio "una entidad, un concepto del dominio" — ya consolidado en entregables anteriores — llevó a la reformulación correcta: `origin` particiona invariantes dentro de una única entidad, exactamente como ya lo hacía `StaffAvailability.type`. El principio no se abandonó ante la primera tensión; se aplicó con más rigor.

**Una invariante de partición del tiempo no siempre necesita infraestructura de rangos.** El invariante "ningún día pertenece a más de un Período Financiero" parecía, a primera vista, requerir la misma solución que el solapamiento de horario base en 2.2 (`btree_gist`, diferido por no estar justificado). Pero al examinar el dominio con cuidado —`Período Financiero` solo agrupa filas discretas ya existentes, nunca rangos continuos— apareció una solución más simple y más fuerte: una columna de asignación inmutable. La lección: antes de asumir que una tensión técnica requiere la misma solución que una tensión anterior con apariencia similar, verificar si la naturaleza del dominio es realmente la misma.

**El mecanismo de Reconciliación Arquitectónica demostró su valor en su primer uso real.** Permitió corregir una inconsistencia genuina con el Modelo de Dominio sin recurrir a una corrección silenciosa ni a un rediseño completo del entregable — reabriendo solo lo que debía reabrirse, con trazabilidad explícita en cada documento afectado.

## Qué habilita el cierre de este entregable

**Con el cierre de 2.3, la Fase 2 — Sistema Operativo del Negocio queda completa.** El criterio de cierre declarado en `docs/PLAN_MAESTRO.md` está cumplido: el operador puede gestionar la operación diaria completa —agenda, servicios, staff, comisiones, cierre del día, reportes históricos— desde la plataforma, sin intervención de ningún agente, y ningún canal orquesta reglas de negocio directamente. Agenda, Servicios, Staff y Finanzas operan, cada uno, mediante su propia capa de casos de uso.

Esto habilita directamente la Fase 3 (Empleados Digitales): eventos financieros estables (`GastoRegistrado`, `CobroRegistrado`, `CierreDíaGenerado`, `PeríodoFinancieroGenerado`) ya existen para que un futuro Empleado Digital pueda, por ejemplo, notificar automáticamente sobre un día con neto negativo o generar un reporte periódico sin intervención humana. Antes de iniciar la Fase 3, corresponde construir el mapa conceptual de esa fase — ya solicitado por el responsable del proyecto y pendiente de realizarse en una sesión dedicada a esa planificación, no como parte de este cierre.

> **Nota de reconciliación (ADR 006, 2026-07-02):** los dos párrafos anteriores sobredeclaraban el estado del sistema. Una auditoría externa de v2.1.0 demostró que: (a) los casos de uso de este entregable no están expuestos a ningún canal — solo `getDailyClose` es invocado por la aplicación real (lectura en `daily-close.routes.js`); el operador no puede generar cierres, períodos ni anular gastos; (b) lo que "existe" de los eventos es el contrato `publish(name, payload)` con una implementación que solo escribe en el log — no hay bus, suscripción ni entrega, y `CobroRegistrado` es inalcanzable porque nada invoca su caso de uso; (c) el criterio de cierre de la fase queda pendiente de cumplirse mediante el entregable puente "Exposición del Sistema Operativo". El contenido validado de este reporte (dominio, casos de uso, persistencia, migración, tests) permanece correcto. Ver `docs/decisions/006-reconciliacion-cierre-fase-2.md`.

---

*Cierre del Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
