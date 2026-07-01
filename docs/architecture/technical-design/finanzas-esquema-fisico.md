# Esquema Físico — Sistema Operativo de Finanzas

**Entregable:** 2.3 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Migración `backend/scripts/migrations/2.3-finanzas-sistema-operativo.sql` aplicada y verificada contra la base real. Cierre en `docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`.
**Implementa:** el modelo conceptual de persistencia aprobado y reconciliado para el contexto `Finanzas` (`docs/architecture/technical-design/finanzas-modelo-persistencia.md`, ADR 005).

---

## 0. Respuestas de diseño (resumen de la verificación previa)

1. **Reutilizadas:** `Expense`, `Transaction`/`TransactionItem` — ambas extendidas, según ADR 005 y la auditoría previa a esta etapa.
2. **Nuevas:** `DailyClose`, `FinancialPeriod`.
3. **Cambios a entidades existentes:** `Expense` gana `responsible`, `status`, `voidedAt`, `voidReason`. `Transaction` gana `origin`. `TransactionItem` no cambia.
4. **Relaciones nuevas:** `DailyClose → FinancialPeriod` (opcional, N a 1). Ninguna relación nueva hacia `Expense` ni `Transaction` — ambas se consultan por rango de fecha, no por FK.
5. **Restricciones desde la base de datos:** `@@unique([tenantId, date])` en `DailyClose` (sin necesidad de índice parcial — ver sección 3); `@@unique([tenantId, periodStart, periodEnd])` en `FinancialPeriod`; `@@unique([appointmentId, origin])` en `Transaction`, reemplazando la unicidad global anterior — **especialización de la invariante, no una reducción de garantías** (ver sección 3 y la reconciliación conceptual ya aprobada).
6. **Índices:** detallados en la sección 3.
7. **Migración:** aditiva sobre `Expense` y `Transaction`, sin backfill de datos históricos hacia `DailyClose`/`FinancialPeriod` — no existe ningún cierre pasado que reconstruir.
8. **Compatibilidad con Fase 1:** total para `Expense`, `Transaction`, `TransactionItem`, `metrics/revenue`, `metrics/cashbox` — todas las columnas nuevas son opcionales o tienen default. `daily-close.routes.js` se adapta progresivamente dentro de este mismo entregable (ver sección 4).
9. **Fuera de alcance:** Decisión Diferida #1 de la Etapa 3 (corrección de un período ya cerrado); nueva Decisión Diferida sobre categorización interna de ítems de venta de mostrador (ver cierre de este documento).

---

## 1. Modelos propuestos

```prisma
model Expense {
  // ...campos existentes sin cambios: id, tenantId, date, category, description, amount, paymentMethod, notes, createdAt...

  responsible    String?           // nuevo — nullable: Fase 1 no lo captura; exigido solo por RegisterExpenseUseCase (2.3), validado en la aplicación
  status         String   @default("active")  // "active" | "voided" — nuevo
  voidedAt       DateTime?         // nuevo
  voidReason     String?           // nuevo
}

model Transaction {
  // ...campos existentes sin cambios: id, tenantId, userId, petId, appointmentId, total, paymentMethod, notes, paidAt, createdAt, items...

  origin String @default("manual_pos_sale") // "manual_pos_sale" | "system_appointment_completed" — nuevo

  @@unique([appointmentId, origin])   // reemplaza el @@unique([appointmentId]) anterior — ver sección 3
}

model DailyClose {
  id               String   @id @default(cuid())
  tenantId         String?
  tenant           Tenant?  @relation(fields: [tenantId], references: [id])

  date             DateTime
  incomeTotal      Decimal  @db.Decimal(10, 2)
  expenseTotal     Decimal  @db.Decimal(10, 2)
  netAmount        Decimal  @db.Decimal(10, 2)
  staffBreakdown   Json     // snapshot congelado — no relación, ver Modelo de Persistencia sección 3

  financialPeriodId String?
  financialPeriod   FinancialPeriod? @relation(fields: [financialPeriodId], references: [id])

  createdAt        DateTime @default(now())

  @@unique([tenantId, date])
  @@index([tenantId, financialPeriodId])
}

model FinancialPeriod {
  id             String   @id @default(cuid())
  tenantId       String?
  tenant         Tenant?  @relation(fields: [tenantId], references: [id])

  periodStart    DateTime
  periodEnd      DateTime
  incomeTotal    Decimal  @db.Decimal(10, 2)
  expenseTotal   Decimal  @db.Decimal(10, 2)
  netAmount      Decimal  @db.Decimal(10, 2)
  breakdown      Json     // snapshot congelado — no relación

  dailyCloses    DailyClose[]   // lado inverso de la FK en DailyClose

  createdAt      DateTime @default(now())

  @@unique([tenantId, periodStart, periodEnd])
  @@index([tenantId, periodStart])
}
```

`Tenant` gana las relaciones inversas `dailyCloses DailyClose[]` y `financialPeriods FinancialPeriod[]`, mismo patrón que `serviceCategories` (2.1) y `settlements` (2.2).

`DailyClose.staffBreakdown` y `FinancialPeriod.breakdown` usan `Json` — no una tabla relacional — porque, según la Etapa 4 ya aprobada, ese desglose nunca se consulta ni se modifica de forma aislada: nace congelado junto con el resto del hecho financiero.

---

## 2. Claves

**Primarias:** `id` en `DailyClose` y `FinancialPeriod`, `String @id @default(cuid())` — sin excepción, mismo patrón del resto del esquema. `Expense` y `Transaction` conservan sus claves ya existentes.

**Foráneas:**
- `DailyClose.tenantId → Tenant.id` (nullable, mismo patrón que el resto del esquema).
- `DailyClose.financialPeriodId → FinancialPeriod.id` (nullable — solo se asigna al generar el período que lo abarca).
- `FinancialPeriod.tenantId → Tenant.id` (nullable).
- `Transaction.appointmentId → Appointment.id` (ya existente desde Fase 1, opcional — sin cambios).

**Sin clave foránea nueva hacia `Commission`:** el desglose de `DailyClose` se calcula consultando `Commission` vía `CommissionReaderPort` en el momento de generarse — nunca se referencia por FK, mismo criterio de desacoplamiento entre contextos ya usado en 2.1 y 2.2.

---

## 3. Índices, restricciones, y la especialización de la invariante en `Transaction`

### `Transaction.appointmentId` — de unicidad global a unicidad condicionada por `origin`

**Esta no es una relajación de la restricción existente — es la expresión física correcta de una invariante que, según el análisis conceptual ya aprobado, siempre estuvo condicionada por el origen de la fila, aunque hasta ahora nunca coexistieran dos orígenes que lo hicieran visible.** `Transaction` sigue siendo una única entidad del dominio (el ingreso del negocio); `origin` determina qué subconjunto de invariantes aplica a cada fila, exactamente igual que `StaffAvailability.type` determina si el invariante de solapamiento de horario aplica (solo a `base_schedule`) o no (a las ausencias).

```sql
-- Antes (Fase 1): un único Transaction por cita, sin distinguir origen
-- UNIQUE (appointmentId)

-- Ahora: como máximo un Transaction por cita, por cada origen
CREATE UNIQUE INDEX "Transaction_appointmentId_origin_key"
  ON "Transaction" ("appointmentId", "origin")
  WHERE "appointmentId" IS NOT NULL;
```

Esto garantiza, simultáneamente:
- **Como máximo un Cobro automático por cita** (`origin = 'system_appointment_completed'`) — el invariante de negocio que protege la integridad del reconocimiento automático de ingreso.
- **Como máximo una venta de mostrador vinculada por cita** (`origin = 'manual_pos_sale'`) — preserva exactamente el comportamiento ya existente de Fase 1 (una cita, un ticket).
- **Ambas pueden coexistir** para la misma cita — un Cobro automático y una venta de mostrador adicional (p. ej. un producto comprado durante la visita) no compiten entre sí, porque protegen invariantes distintos dentro de la misma entidad.

### `DailyClose` — por qué basta un índice único simple, no parcial

A diferencia de `PriceRule`/`StaffCapability`/`Settlement` (que admiten anulación y por eso requieren índice único *parcial*, para proteger unicidad solo entre filas activas), `DailyClose` no tiene ningún estado de anulación en este entregable — nace y permanece. `@@unique([tenantId, date])` ya es la protección completa, combinada con `DuplicateDailyCloseError` en la aplicación. Doble protección real, en su forma más simple porque el dominio no exige más.

### `FinancialPeriod` — partición del tiempo sin `EXCLUDE USING gist`

**No se necesita la extensión `btree_gist`** que sí resultó necesaria (y diferida) para el solapamiento de horario base en 2.2. La diferencia de fondo: aquel invariante protegía un solapamiento entre *rangos continuos de tiempo*; este protege un solapamiento entre *filas discretas ya existentes* (`DailyClose`). Eso permite una solución más simple y, a la vez, más fuerte:

- `DailyClose.financialPeriodId` (nullable): un día ya asignado a un período no puede volver a asignarse.
- `GenerateFinancialPeriodUseCase` ejecuta, en una única transacción:
  1. Verifica que todos los `DailyClose` del rango existan (si falta uno, `IncompleteFinancialPeriodError`).
  2. Verifica que ninguno tenga ya `financialPeriodId` asignado (si alguno lo tiene, se rechaza — viola la partición del tiempo).
  3. Crea el `FinancialPeriod`.
  4. Ejecuta `updateMany` sobre los `DailyClose` del rango con `where: { financialPeriodId: null, ...rango }`, y verifica que el conteo de filas actualizadas coincida con el esperado — protege contra una condición de carrera entre dos generaciones concurrentes del mismo rango, sin necesitar una restricción de exclusión por rangos a nivel de Postgres.

`@@unique([tenantId, periodStart, periodEnd])` protege, adicionalmente, contra la generación exacta duplicada del mismo rango — un caso más simple que ya cubre el índice único estándar.

**Invariante explícita: `DailyClose.financialPeriodId`, una vez asignado, es inmutable y nunca se reasigna.** Esta propiedad es la que convierte a `financialPeriodId` en el mecanismo real de protección de la partición del tiempo — sin ella, el esquema solo garantizaría "un día no puede asignarse dos veces *en el mismo instante*", no "un día jamás cambia de período una vez asignado". Queda garantizada por diseño, no por una restricción adicional de base de datos:

- Ningún caso de uso de este entregable escribe sobre `financialPeriodId` salvo `GenerateFinancialPeriodUseCase`, y únicamente mediante el `updateMany` condicionado (`where: { financialPeriodId: null, ... }`) descrito arriba — que por construcción solo puede asignar un valor a un campo que todavía es `null`, nunca sobrescribir uno ya existente.
- No existe, en los 8 casos de uso congelados en la Etapa 2, ningún caso de uso de "reasignar", "mover" o "desasociar" un `DailyClose` de su `FinancialPeriod`. Introducir esa capacidad en el futuro requeriría un caso de uso nuevo y, dado que rompería una invariante de un hecho ya declarado oficial e inmutable, muy probablemente su propio ADR — no una operación implícita de mantenimiento.
- Esta garantía es, en efecto, lo que hace innecesaria una restricción de exclusión por rangos: la protección no depende de comparar continuamente los rangos de todos los períodos entre sí, sino de que cada día, una vez capturado por un período, queda fuera del universo de días disponibles para cualquier otro período — permanentemente.

**Índices de consulta:**
- `Transaction`: se conserva `@@index([tenantId, paidAt])` ya existente; el nuevo índice único ya cubre las búsquedas por `(appointmentId, origin)`.
- `DailyClose`: `(tenantId, financialPeriodId)` — soporta la verificación de completitud de `GenerateFinancialPeriodUseCase`.
- `FinancialPeriod`: `(tenantId, periodStart)` — soporta `Consultar Período Financiero` e Historial.

---

## 4. Plan de migración

1. **Backup** de `Expense` y `Transaction` antes de migrar — mismo protocolo ya usado en 2.1 y 2.2.
2. `ALTER TABLE "Expense" ADD COLUMN "responsible" TEXT`, `ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`, `ADD COLUMN "voidedAt" TIMESTAMP`, `ADD COLUMN "voidReason" TEXT` — aditivo, con default, sin backfill manual: todos los gastos ya existentes quedan `active`.
3. `ALTER TABLE "Transaction" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual_pos_sale'` — aditivo. El default reclasifica correctamente todas las filas existentes: ninguna `Transaction` de Fase 1 pudo haber nacido de un Cobro automático, porque ese origen no existía hasta este entregable.
4. `DROP INDEX` sobre la unicidad anterior de `appointmentId` (si existe como índice nombrado) y `CREATE UNIQUE INDEX "Transaction_appointmentId_origin_key" ... WHERE "appointmentId" IS NOT NULL` — reemplazo directo, sin pérdida de garantías (ver sección 3).
5. `CREATE TABLE "DailyClose"`, `CREATE TABLE "FinancialPeriod"` — vacías, sin backfill: no existe ningún cierre histórico previo que reconstruir.
6. Verificación post-migración: contar filas de `Expense`/`Transaction` antes y después (deben coincidir); confirmar que el 100% de las `Transaction` existentes quedaron con `origin = 'manual_pos_sale'`; confirmar que el nuevo índice único no rechaza ninguna fila ya existente (no debería haber colisiones, porque antes solo existía un origen).

---

## Adaptación progresiva de `daily-close.routes.js`

Resolviendo la Decisión Diferida #3 de la Etapa 3 (ritmo y alcance de la migración del legado): `GET /daily-close` se reescribió internamente para:
1. Si ya existe un `DailyClose` oficial para la fecha solicitada, devolverlo (vía `GetDailyCloseUseCase`), traduciendo su forma al contrato de respuesta ya existente hacia el frontend.
2. Si no existe, calcular la respuesta exactamente como lo hacía Fase 1 — leyendo `Commission` en vivo, sin recalcular sus reglas de negocio.

**Nota de implementación (registrada durante el cierre de la Fase 2):** el punto 2 se implementó preservando el cálculo legado exacto (Commission en vivo), en vez de reutilizar `financial-summary.rules.js` como se planteó originalmente aquí. Motivo: `financial-summary.rules.js` consolida `Transaction` (ambos orígenes) + `Expense` + `Commission`, un universo de datos distinto al que `totalRevenue`/`byStaff` siempre midieron en este endpoint (la suma de `Commission.resolvedPrice`). Usar la regla nueva habría cambiado el significado de esos campos para los consumidores existentes del endpoint — una violación real del requisito "el contrato de respuesta no cambia", aunque los nombres de los campos permanecieran iguales. Se prefirió la fidelidad exacta del valor devuelto sobre la reutilización literal de la regla.

El contrato de respuesta hacia el frontend no cambia. Ningún consumidor externo requiere modificación. Verificado con smoke test HTTP real (`supertest`) contra la base ya migrada: `200`, misma forma de respuesta, mismo camino de respaldo (sin `DailyClose` generado todavía).

---

## 5. Validación final

**Contra el modelo conceptual de persistencia:** las cuatro entidades (dos reutilizadas, dos nuevas), sus campos y relaciones corresponden uno a uno con lo aprobado y reconciliado en `finanzas-modelo-persistencia.md`.

**Contra los Principios Permanentes del modelo de persistencia:** ausencia de Aggregate Root compartido, ya justificada desde la Etapa 3 — ninguna entidad de este documento la contradice. Evolución por extensión: nuevos valores de `origin`, `category` o `status` no requieren alterar la forma de las tablas.

**Contra el Principio Permanente del Esquema Físico (doble protección):** se cumple completamente para `DailyClose` (unicidad simple, sin necesidad de índice parcial porque no hay anulación), `FinancialPeriod` (unicidad simple + mecanismo transaccional de partición) y `Transaction` (unicidad condicionada por origen). Ningún invariante de este entregable requirió una excepción documentada del tipo `btree_gist` — a diferencia de 2.2, el dominio de Finanzas no genera esa tensión porque `Período Financiero` opera sobre filas discretas, no sobre rangos continuos.

**Contra el Plan Maestro y el Modelo de Dominio (reconciliado por ADR 005):** las entidades corresponden a `domain-model-v1.md` sección 7, con `Transacción`/`Cobro` correctamente modelados como una entidad con especialización por origen, no como conceptos separados.

**Contra el criterio "una entidad, un concepto del dominio":** `Transaction` conserva su identidad conceptual única (el ingreso del negocio) a través de este documento — el campo `origin` particiona sus invariantes, no su identidad, siguiendo el mismo patrón ya validado en `StaffAvailability.type`, `PriceRule.targetType` y `Commission.priceSource`.

---

## Decisión Arquitectónica Diferida nueva (a incorporar en `sistema-operativo-finanzas.md`)

**Categorización interna de los ítems de una venta de mostrador (`TransactionItem`).** Hoy `TransactionItem` no distingue si un ítem corresponde a un servicio del catálogo (`Servicio`) o a un producto sin relación con él. Este entregable no lo resuelve: el desglose de `Cierre del Día` solo necesita el total de cada `Transaction`, no la composición de sus ítems. Se deja explícitamente diferida — candidata a resolverse si en el futuro el negocio necesita reportes de ingreso por tipo de producto/servicio vendido en mostrador, no solo por cita completada.

---

*Esquema Físico · Entregable 2.3 · Plataforma Operativa Inteligente · Mateos Pet*
