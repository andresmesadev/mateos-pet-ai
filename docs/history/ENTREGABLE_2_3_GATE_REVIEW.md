# Gate Review — Entregable 2.3: Sistema Operativo de Finanzas

**Fecha:** 2026-07-01
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.3 — Sistema Operativo de Finanzas
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md`

---

## Propósito de este registro

Este documento certifica que el Entregable 2.3 completó, en orden, las cinco etapas de diseño exigidas por la Regla de Ejecución de la Fase 2, que cada una fue revisada y aprobada antes de avanzar a la siguiente, y que la Reconciliación Arquitectónica realizada durante la Etapa 5 (ADR 005) dejó nuevamente congeladas todas las etapas que afectó. Queda como el registro histórico de ese cierre.

---

## Etapas aprobadas

**✓ 1. Definición Funcional — Aprobada.**
Identifica la ausencia de un cierre financiero real (hoy calculado sobre la marcha por `daily-close.routes.js`, sin quedar nunca como hecho oficial) y la ausencia total de un concepto de gasto operativo dentro del Sistema Operativo. Incorpora la sección "Qué cambia conceptualmente en el negocio": las finanzas dejan de ser un resultado obtenido consultando otros contextos y pasan a ser un contexto propio, responsable de sus propios hechos económicos.
Documento: `docs/architecture/use-cases/sistema-operativo-finanzas.md` (Etapa 1)

**✓ 2. Casos de Uso — Aprobados, reconciliados por ADR 005.**
Ocho casos de uso, clasificados por responsabilidad (Administración, Operación reactiva, Consulta) — sin casos de uso de Resolución: el cálculo del neto se modeló, correctamente, como regla de dominio interna (`financial-summary.rules.js`), no como intención de negocio propia. Incluye el mapa conceptual del contexto y la regla de negocio derivada de él: un Período Financiero es una partición del tiempo. La Reconciliación Arquitectónica (ADR 005) corrigió la traducción técnica del caso de uso 3 (`Registrar Cobro al Completarse una Cita`) para reflejar que `Cobro` es un origen de `Transaction`, no una entidad propia — el contrato funcional en sí no cambió.
Documento: `docs/architecture/use-cases/sistema-operativo-finanzas.md` (Etapa 2) — **reconciliada y vuelta a congelar.**

**✓ 3. Arquitectura Técnica — Aprobada, reconciliada por ADR 005.**
Incorpora un principio nuevo para toda la Fase 2: los patrones arquitectónicos se aplican cuando el dominio los necesita, no por uniformidad entre contextos — justificando la ausencia deliberada de un Aggregate Root compartido, el primer entregable de la fase en no tenerlo. `ChargeRepositoryPort` se corrigió a `TransactionRepositoryPort` tras la reconciliación.
Documento: `docs/architecture/technical-design/sistema-operativo-finanzas.md` — **reconciliada y vuelta a congelar.**

**✓ 4. Modelo de Persistencia — Aprobado, reconciliado por ADR 005.**
Sin Aggregate Root compartido (consecuencia del principio de la Etapa 3). `Cierre del Día` y `Período Financiero` como hechos oficiales e inmutables; snapshot congelado para su desglose, en vez de entidades relacionales, por no tener ciclo de vida propio. Principio derivado incorporado: los hechos oficiales son particiones del tiempo, las consultas son vistas — solo los primeros están sujetos a invariantes de exclusión temporal. Tras la auditoría de entidades físicas de Fase 1 y el ADR 005, se corrigió: `Gasto` reutiliza `Expense`; `Cobro` reutiliza `Transaction` como origen especializado, no como entidad nueva.
Documento: `docs/architecture/technical-design/finanzas-modelo-persistencia.md` — **reconciliada y vuelta a congelar.**

**✓ 5. Esquema Físico — Aprobado.**
`Expense` y `Transaction` se extienden de forma aditiva, sin backfill manual más allá de los valores por defecto. La unicidad de `Transaction.appointmentId` se especializa a `(appointmentId, origin)` — analizada explícitamente como refinamiento de la invariante ya existente (consistente con el principio "una entidad, un concepto del dominio", `origin` particiona invariantes igual que `StaffAvailability.type`), no como una reducción de garantías. La partición del tiempo de `Período Financiero` se protege sin necesitar `btree_gist`, mediante `DailyClose.financialPeriodId` (inmutable una vez asignado, por diseño) y una actualización transaccional condicionada — a diferencia de 2.2, este entregable no requirió ninguna excepción documentada al Principio Permanente de doble protección.
Documento: `docs/architecture/technical-design/finanzas-esquema-fisico.md`

---

## La Reconciliación Arquitectónica — ADR 005

Durante el inicio de la Etapa 5, una auditoría de las entidades físicas de Fase 1 (`Expense`, `Transaction`, `TransactionItem`) reveló que `docs/architecture/domain-model-v1.md` (sección 7, `Finanzas`) ya definía a `Cobro` como **especialización de `Transacción`**, no como entidad independiente — definición que las Etapas 2 y 4 de este entregable no habían vuelto a consultar. Se abrió formalmente una Reconciliación Arquitectónica (mecanismo incorporado, a partir de este entregable, como parte permanente de `docs/PHASE_2_EXECUTION_RULE.md`), documentada en `docs/decisions/005-cobro-especializacion-transaccion.md`.

**Verificación de que las etapas afectadas quedaron nuevamente congeladas:**
- Etapa 2: nota de reconciliación incorporada al final del documento y en el caso de uso 3. Contrato funcional sin cambios; traducción técnica corregida. **Congelada.**
- Etapa 3: `TransactionRepositoryPort` reemplaza a `ChargeRepositoryPort`; nota de reconciliación incorporada antes de las Decisiones Diferidas. **Congelada.**
- Etapa 4: entidades, campos, relaciones e invariantes de `Gasto` y `Cobro` corregidos; nota de reconciliación de cierre incorporada. **Congelada.**
- Etapa 5 (redactada ya con la reconciliación incorporada desde su origen, no requirió reapertura posterior): refleja `Transaction`/`Expense` como entidades reutilizadas desde su primera versión.

No quedó ninguna etapa reconciliada sin volver a congelarse formalmente.

---

## Decisiones arquitectónicas registradas (cinco en total)

| # | Decisión | Estado | ¿Bloquea implementación? |
|---|---|---|---|
| 1 | Cómo corregir un hecho económico de un período ya cerrado, sin romper la inmutabilidad del cierre | Diferida explícitamente — formulada desde el dominio, no se resuelve en este entregable | No |
| 2 | Pertenencia futura de `Commission`/`Settlement` a `Finanzas` | Diferida, hereda la Decisión Diferida #1 de 2.2 — puerta abierta desde ambos lados | No |
| 3 | Ritmo y alcance de la migración de `daily-close.routes.js` | **Resuelta** en la Etapa 5: adaptación progresiva dentro de este mismo entregable, sin cambiar el contrato hacia el frontend | No |
| 4 | Automatización del Cierre del Día y del Período Financiero | Excluida explícitamente por decisión del responsable del proyecto en la Etapa 1 — candidata para una fase futura (Automatizaciones) | No |
| 5 | Categorización interna de los ítems de una venta de mostrador (`TransactionItem`) | Diferida — no se necesita para el desglose de `Cierre del Día` en este entregable | No |

**La Reconciliación Arquitectónica (ADR 005) no se cuenta como una decisión diferida**: quedó completamente resuelta durante este mismo Gate Review, con las cuatro etapas afectadas ya verificadas y congeladas arriba.

## ¿Existe alguna decisión arquitectónica abierta que bloquee la implementación?

**No.** Las cinco decisiones diferidas registradas están correctamente fuera de alcance, sin ninguna dependencia que impida comenzar a construir los ocho casos de uso, las cuatro entidades (dos reutilizadas, dos nuevas) y sus puertos. La Reconciliación Arquitectónica del ADR 005 —la única situación que habría podido bloquear el cierre— ya fue resuelta y verificada como parte de este mismo Gate Review, no queda pendiente para la implementación.

---

## Conclusión

El diseño del Entregable 2.3 queda **oficialmente congelado**, incluyendo las correcciones introducidas por la Reconciliación Arquitectónica (ADR 005).

A partir de este momento, cualquier cambio estructural a los casos de uso, la arquitectura técnica, el modelo de persistencia o el esquema físico aprobados deberá realizarse mediante una decisión arquitectónica explícita (un nuevo ADR) o, si contradice una fuente oficial ya vigente, mediante una nueva Reconciliación Arquitectónica — nunca modificando silenciosamente el diseño aprobado durante la implementación.

Comienza ahora la implementación del Entregable 2.3.

---

*Gate Review · Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
