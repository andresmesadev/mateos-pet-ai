# Diseño Técnico — Sistema Operativo de Finanzas

**Entregable:** 2.3 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Reconciliada por ADR 005 (ver nota de reconciliación antes de la sección de Decisiones Diferidas) y corregida en la Validación Funcional (entrada de `RecordChargeOnAppointmentCompletedUseCase` simplificada, retirando `serviceId`/`priceSource`). Cierre en `docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`.
**Implementa:** `docs/architecture/use-cases/sistema-operativo-finanzas.md` (contrato funcional aprobado)
**Contexto de dominio:** `Finanzas`

Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, ni endpoints, ni esquema de base de datos. Sigue exactamente la misma disciplina y los mismos Principios Permanentes de la arquitectura de aplicación ya establecidos en los Entregables 2.1 y 2.2 — no se redefinen aquí, se heredan.

## Principio nuevo, incorporado por este entregable

**"Los patrones arquitectónicos se aplican cuando el dominio los necesita, no por uniformidad entre contextos."**

Este entregable es el primero de la Fase 2 sin un Aggregate Root compartido. En 2.1 (`Servicio` → `PriceRule`) y 2.2 (`Staff` → `StaffAvailability`/`StaffCapability`) existía una entidad raíz con hijos internos cuya integridad dependía de un único escritor autorizado. En `Finanzas`, ninguna de las cuatro entidades (`Gasto`, `Cobro`, `Cierre del Día`, `Período Financiero`) contiene a otra como hijo mutable: `Período Financiero` referencia `Cierre del Día` ya existentes, pero los lee y los agrupa — nunca los posee ni los escribe. Forzar un Aggregate Root aquí por costumbre habría sido aplicar una plantilla donde el dominio no la pide. Este principio queda incorporado como criterio permanente de diseño para toda la Fase 2 y lo que venga después: cada patrón (Aggregate Root, doble protección, resolución, etc.) se evalúa por si el dominio de cada entregable lo requiere, no se replica automáticamente porque el entregable anterior lo usó.

---

## 1. Capa de aplicación

| Caso de uso (nombre oficial) | Servicio de aplicación | Responsabilidad |
|---|---|---|
| Registrar Gasto | `RegisterExpenseUseCase` | Administración |
| Anular Gasto | `VoidExpenseUseCase` | Administración |
| Registrar Cobro al Completarse una Cita | `RecordChargeOnAppointmentCompletedUseCase` | Operación (reactivo) |
| Generar Cierre del Día | `GenerateDailyCloseUseCase` | Administración |
| Generar Período Financiero | `GenerateFinancialPeriodUseCase` | Administración |
| Consultar Cierre del Día | `GetDailyCloseUseCase` | Consulta |
| Consultar Historial Financiero | `GetFinancialHistoryUseCase` | Consulta |
| Consultar Período Financiero | `GetFinancialPeriodUseCase` | Consulta |

`Gasto` se traduce técnicamente como `Expense`, `Cobro` como `Charge`, `Cierre del Día` como `DailyClose`, `Período Financiero` como `FinancialPeriod` — consistente con el inglés ya usado en el resto del código del proyecto. Ningún caso de uso invoca a otro del mismo contexto, salvo la dependencia de lectura ya declarada en el mapa conceptual: `GenerateFinancialPeriodUseCase` lee registros de `DailyClose` ya persistidos (a través de su propio repositorio, no invocando `GenerateDailyCloseUseCase`).

---

## 2. Contratos de entrada y salida

### RegisterExpenseUseCase
- **Entrada:** `{ tenantId, amount, category, responsible, date }`
- **Salida:** `{ expense }`
- **Errores de dominio posibles:** `InvalidExpenseAttributesError` (monto no positivo, categoría no reconocida), `DailyCloseAlreadyExistsForDateError` (ya existe un Cierre del Día oficial para esa fecha — un gasto no puede incorporarse a un día ya congelado).

### VoidExpenseUseCase
- **Entrada:** `{ expenseId, reason }`
- **Salida:** `{ expense }`
- **Errores de dominio posibles:** `ExpenseNotFoundError`, `ExpenseAlreadyVoidedError`, `DailyCloseAlreadyExistsForDateError` (mismo criterio que en `RegisterExpenseUseCase`: no se anula un gasto de un día ya cerrado).

### RecordChargeOnAppointmentCompletedUseCase
- **Entrada:** `{ tenantId, appointmentId, resolvedPrice, completedAt }` — recibido ya resuelto desde el evento `CitaCompletada`, vía el adaptador de eventos, nunca desde un canal humano. **Corregido en la Validación Funcional (simplificación derivada de ADR 005):** la versión original de esta entrada incluía `serviceId` y `priceSource`, copiando literalmente el criterio de completitud de `RecordCommissionOnAppointmentCompletedUseCase` en Staff (2.2) sin verificar si Finanzas realmente los necesita. Tras la reconciliación del ADR 005, `Transaction` (la entidad que materializa a `Cobro`) solo necesita registrar el ingreso oficial del negocio — `tenantId`, `appointmentId`, `resolvedPrice`, `completedAt` y `origin` — sin depender de qué servicio lo originó ni de la procedencia del precio. Esos dos datos pertenecen al contexto que resolvió el precio (Servicios/Staff) y no aportan información que Finanzas necesite conservar. Se retiran de la entrada; no se agrega ninguna columna al esquema físico para persistirlos.
- **Salida:** `{ transaction }` — **corregido por ADR 005**: originalmente `{ charge }`. El caso de uso ya no crea una entidad `Charge`/`Cobro` propia; crea una fila de `Transaction` (Fase 1, reutilizada) con `origin = "system_appointment_completed"`.
- **Errores de dominio posibles:** `InvalidChargeInputError` (precio nulo o negativo, `appointmentId` faltante) — el nombre del error se conserva porque describe la validación de entrada del caso de uso, no la entidad persistida.

### GenerateDailyCloseUseCase
- **Entrada:** `{ tenantId, date }`
- **Salida:** `{ dailyClose }` — incluye ingresos totales, egresos totales, desglose de comisiones por staff (consultado, no recalculado), neto.
- **Errores de dominio posibles:** `DuplicateDailyCloseError` (ya existe un cierre activo para esa fecha).

### GenerateFinancialPeriodUseCase
- **Entrada:** `{ tenantId, periodStart, periodEnd }`
- **Salida:** `{ financialPeriod }`
- **Errores de dominio posibles:** `IncompleteFinancialPeriodError` (falta un Cierre del Día oficial para al menos un día del rango — rechazo total, sin períodos parciales), `DuplicateFinancialPeriodError` (ya existe un período activo para ese mismo rango).

### GetDailyCloseUseCase
- **Entrada:** `{ tenantId, date }`
- **Salida:** `{ dailyClose }`
- **Errores de dominio posibles:** `DailyCloseNotFoundError`.

### GetFinancialHistoryUseCase
- **Entrada:** `{ tenantId, rangeStart, rangeEnd }`
- **Salida:** `{ days: [{ date, closed: boolean, dailyClose? , preview? }] }` — por cada día del rango, o el `DailyClose` oficial si existe, o una vista preliminar (`preview`) si el día aún no está cerrado. El campo `closed` nunca es ambiguo.
- **Errores de dominio posibles:** ninguno (siempre responde, incluso con rangos sin ningún cierre).
- **Regla de consistencia (incorporada en la aprobación de esta etapa):** `preview` se calcula invocando exactamente `financial-summary.rules.js` sobre los `Cobro`/`Gasto`/`Commission` del día aún no cerrado — la misma regla que usa `GenerateDailyCloseUseCase`. No existe un segundo algoritmo de consolidación. La diferencia entre una vista preliminar y un hecho consolidado está únicamente en el estado de los datos que se le pasan a la regla (un `DailyClose` ya persistido vs. datos sueltos todavía abiertos), nunca en el cálculo.

### GetFinancialPeriodUseCase
- **Entrada:** `{ tenantId, periodStart, periodEnd }`
- **Salida:** `{ financialPeriod }`
- **Errores de dominio posibles:** `FinancialPeriodNotFoundError`.

---

## 3. Dependencias

**Servicios de dominio que consume el contexto `Finanzas`:**
- `financial-summary.rules.js` — consolida `Cobro` + `Gasto` + `Commission` (leída, no recalculada) en el resultado de un `Cierre del Día`; y consolida `Cierre del Día` ya existentes en el resultado de un `Período Financiero`. Pura, sin efectos secundarios. **Es la única regla de consolidación del contexto**: también la usa `GetFinancialHistoryUseCase` para construir sus vistas preliminares de días aún no cerrados — principio confirmado en la aprobación de esta etapa: *"Una vista preliminar y un hecho consolidado deben compartir las mismas reglas de dominio. La diferencia entre ambos debe estar únicamente en el estado de los datos, nunca en el algoritmo que los interpreta."*
- `period-completeness.rules.js` — determina, dado un rango de fechas, si todos los días tienen `Cierre del Día` oficial. Usada exclusivamente por `GenerateFinancialPeriodUseCase`.

**Repositorios que necesita (puertos, sin implementación):**
- `ExpenseRepositoryPort` — registrar, consultar y anular `Gasto` (extiende el repositorio ya existente de `Expense`, Fase 1 — ver ADR 005 y reconciliación de la Etapa 4).
- `TransactionRepositoryPort` — **corregido por ADR 005**: originalmente `ChargeRepositoryPort`, operando sobre una entidad `Cobro` propia. `Cobro` no existe como entidad independiente; este puerto registra y consulta `Transaction` (Fase 1, reutilizada), filtrando por `origin` cuando corresponde. No es exclusivo de Finanzas — es el mismo repositorio físico que ya usa el flujo POS, pero Finanzas solo opera sobre las filas con `origin = "system_appointment_completed"`.
- `DailyCloseRepositoryPort` — registrar y consultar `Cierre del Día`, con su invariante de unicidad e inmutabilidad.
- `FinancialPeriodRepositoryPort` — registrar y consultar `Período Financiero`, con la misma invariante.
- `CommissionReaderPort` — puerto mínimo de solo lectura hacia `Staff`: expone únicamente lo necesario para consolidar (`staffId`, `resolvedPrice`, `staffShare`, `businessShare`, `completedAt`, `appointmentId`). Mismo criterio que ADR 002 y ADR 004: nunca el modelo completo del contexto consultado.
- `DomainEventPublisherPort` — mismo patrón ya usado en Servicios y Staff.

**Qué NO debe conocer esta capa:**
- El cliente de Prisma directamente.
- `req` / `res` de Express, ni ningún concepto de HTTP.
- Las entidades `Cita`, `Cliente`, `Mascota` — `Finanzas` no conoce `Agenda`, `Clientes` ni `Mascotas` directamente; el `Cobro` referencia una cita por id, no la entidad completa.
- El modelo completo de `Staff` — solo lo que `CommissionReaderPort` expone.
- Ningún Empleado Digital ni canal de comunicación.

**Decisión sobre Categorías de Gasto (resuelta en la validación de arquitectura de alto nivel):** las categorías de `Gasto` pertenecen al propio dominio `Finanzas` — no forman parte de la configuración operativa de `Negocio` ni dependen de un puerto hacia ese contexto. `Finanzas` valida la categoría contra un conjunto propio, sin consultar a `Negocio`.

**Decisión sobre `daily-close.routes.js` (Fase 1) (resuelta en la validación de arquitectura de alto nivel):** mismo criterio que en el Entregable 2.1 frente a código legado. `Finanzas` convive temporalmente con el adaptador legado; la migración hacia el nuevo contexto se hará por adaptación progresiva (el endpoint legado se reescribe internamente para leer del nuevo contexto, sin cambiar su contrato hacia el frontend), evitando romper el frontend o los consumidores actuales. El detalle de esa adaptación se decide en la Etapa 5 (Esquema Físico), no aquí.

---

## 4. Eventos de dominio

| Caso de uso | Evento que produce | Contextos que podrían consumirlo a futuro |
|---|---|---|
| Registrar Gasto | `GastoRegistrado` | — |
| Anular Gasto | `GastoAnulado` | — |
| Registrar Cobro al Completarse una Cita | `CobroRegistrado` | — |
| Generar Cierre del Día | `CierreDíaGenerado` | `Automatizaciones` (Fase 3 — alertar sobre un día con neto negativo) |
| Generar Período Financiero | `PeríodoFinancieroGenerado` | `Automatizaciones` (Fase 3 — reportes automáticos) |
| Consultar Cierre del Día, Consultar Historial Financiero, Consultar Período Financiero | Ninguno (lectura) | — |

Los eventos se publican después de confirmar la persistencia, nunca antes — mismo principio de 2.1 y 2.2.

---

## 5. Estructura de carpetas propuesta

```
backend/src/contexts/finance/
  domain/
    rules/
      financial-summary.rules.js
      period-completeness.rules.js
    errors/
      (InvalidExpenseAttributesError, ExpenseNotFoundError, ExpenseAlreadyVoidedError,
       InvalidChargeInputError, DuplicateDailyCloseError, DailyCloseNotFoundError,
       DailyCloseAlreadyExistsForDateError, IncompleteFinancialPeriodError,
       DuplicateFinancialPeriodError, FinancialPeriodNotFoundError)

  application/
    use-cases/
      (los 8 casos de uso de la sección 1)
    ports/
      expense-repository.port.js
      transaction-repository.port.js   // corregido por ADR 005 — antes charge-repository.port.js
      daily-close-repository.port.js
      financial-period-repository.port.js
      commission-reader.port.js
      domain-event-publisher.port.js

  infrastructure/
    persistence/
      (implementaciones Prisma de cada puerto)
    events/
      finance-domain-events.publisher.js
```

Misma forma que `contexts/services/` y `contexts/staff/`: `domain/` no importa nada de `application/` ni `infrastructure/`; `application/` solo conoce `infrastructure/` a través de los puertos.

---

## 6. Validación arquitectónica

**Contra el Plan Maestro y el Modelo de Dominio:** las entidades y eventos coinciden con `domain-model-v1.md` sección 7 (`Finanzas`). Ningún caso de uso conoce `Clientes`, `Mascotas` ni `Agenda` directamente; `Staff` se consulta exclusivamente por `CommissionReaderPort`.

**Contra los Principios Permanentes ya establecidos:** se heredan sin modificación los Principios Permanentes de la arquitectura de aplicación y del modelo de persistencia establecidos en 2.1 y 2.2. Este entregable incorpora, además, el nuevo principio de la sección "Principio nuevo" arriba: los patrones se aplican por necesidad del dominio, no por uniformidad — justificando explícitamente por qué este contexto no tiene Aggregate Root.

**Contra el criterio de puertos mínimos:** `CommissionReaderPort` expone solo los seis campos que `financial-summary.rules.js` necesita para consolidar, nunca el modelo completo de `Commission` ni acceso a otras entidades de `Staff`.

---

## Nota de reconciliación — ADR 005

Al iniciar la Etapa 5 (Esquema Físico), una auditoría de las entidades físicas de Fase 1 (`Transaction`, `TransactionItem`, `Expense`) reveló que `Cobro` ya estaba definido en `domain-model-v1.md` como una especialización de `Transacción` ("la transacción específica del pago de un servicio"), no como una entidad independiente — definición que este documento no había vuelto a consultar al momento de diseñar `ChargeRepositoryPort` y el evento técnico `CobroRegistrado`.

**Esta es una reconciliación con el Modelo de Dominio ya aprobado, no una corrección de errores de esta arquitectura.** Cambia únicamente:
- `ChargeRepositoryPort` → `TransactionRepositoryPort`, operando sobre `Transaction` (Fase 1, extendida con un campo `origin`), no sobre una entidad `Cobro` propia.
- La salida de `RecordChargeOnAppointmentCompletedUseCase` pasa de `{ charge }` a `{ transaction }`.

No cambia: la capa de aplicación, el resto de los puertos, los eventos de dominio (`CobroRegistrado` se conserva como nombre del evento de negocio, independientemente de cómo se persiste técnicamente), la ausencia de Aggregate Root, ni ninguna otra decisión de este documento. Ver `docs/decisions/005-cobro-especializacion-transaccion.md` para el análisis completo.

---

## Decisiones arquitectónicas diferidas

Estas son preguntas que este entregable identificó deliberadamente pero no resuelve ahora. Quedan registradas para no perderse ni resolverse implícitamente durante la implementación.

**1. Cómo corregir un hecho económico perteneciente a un período ya cerrado, sin romper la inmutabilidad del cierre financiero.**
Formulada explícitamente durante la Etapa 2 (Casos de Uso) desde el punto de vista del dominio, no del comportamiento del sistema. `RegisterExpenseUseCase` y `VoidExpenseUseCase` ya rechazan operar sobre un día con `Cierre del Día` existente (`DailyCloseAlreadyExistsForDateError`), pero eso solo impide el problema — no dice qué hace el negocio cuando de todas formas necesita corregir algo de un día ya cerrado (por ejemplo, un gasto que se descubre tarde). Se difiere explícitamente a un ADR propio antes de que un caso de uso futuro (posible candidato: "Anular Cierre del Día") lo resuelva. No se nombra ni se diseña ese caso de uso en este entregable.

**2. Pertenencia futura de `Commission` y `Settlement`.**
Hereda directamente la Decisión Diferida #1 de 2.2: ambas entidades permanecen en `Staff` durante la Fase 2, consultadas por `Finanzas` vía `CommissionReaderPort`. Este entregable no resuelve si en el futuro deberían pertenecer a `Finanzas` — mantiene la misma puerta abierta, ahora desde el lado consumidor.

**3. Ritmo y alcance exacto de la migración de `daily-close.routes.js`.**
Se decidió el criterio (adaptación progresiva, conviviendo con el legado) en la validación de arquitectura de alto nivel, pero no el mecanismo técnico exacto (¿el endpoint legado se reescribe para leer del nuevo contexto en este mismo entregable, o se pospone a uno posterior?). Se resuelve en la Etapa 5 (Esquema Físico).

**4. Automatización del Cierre del Día y del Período Financiero.**
Ya excluida explícitamente por decisión del operador en la Definición Funcional (Etapa 1): el dominio no debe asumir que esto se automatiza en esta fase. Queda como candidato natural para una Regla de Automatización en una fase futura (consumiendo `CierreDíaGenerado` o la ausencia de un cierre a cierta hora), no en este entregable.

---

**Estado de aprobación:** Documento técnico completo aprobado y congelado, con dos aclaraciones incorporadas en su aprobación: `DailyCloseAlreadyExistsForDateError` confirmado como materialización técnica de una regla ya aprobada (no una decisión nueva), y `GetFinancialHistoryUseCase` reutilizando exactamente `financial-summary.rules.js` para sus vistas preliminares, sin un segundo algoritmo de consolidación.

---

*Diseño Técnico · Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
