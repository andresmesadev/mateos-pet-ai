# Esquema Físico — Sistema Operativo de Staff

**Entregable:** 2.2 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado. Migración `backend/scripts/migrations/2.2-staff-sistema-operativo.sql` aplicada y verificada contra la base real (backfill de `StaffAvailability` desde `Staff.availability`, ADR 003). Ver cierre en `docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`.
**Implementa:** el modelo conceptual de persistencia aprobado para el contexto `Staff`.

---

## 0. Respuestas de diseño (resumen de la verificación previa)

1. **Reutilizadas:** `Staff`, `Commission` — sin alterar su forma física más allá de lo descrito en el punto 3.
2. **Nuevas:** `StaffAvailability`, `StaffCapability`, `Settlement`.
3. **Cambio a entidad existente:** `Staff` gana `generatesCommission Boolean @default(true)`. `Commission` no cambia.
4. **Relaciones nuevas:** `Staff → StaffAvailability`, `Staff → StaffCapability`, `Staff → Settlement`, y la reflexiva `Settlement → Settlement` (reemplazo por anulación).
5. **Restricciones desde la base de datos:** índices únicos parciales para `StaffCapability` y `Settlement` (mismo patrón de `PriceRule` en 2.1); `CHECK` de coherencia de rangos en `StaffAvailability`; el solapamiento de horario base queda como **excepción documentada** (ver sección 3).
6. **Índices:** detallados en la sección 3.
7. **Migración:** aditiva y sin backfill de datos hacia las entidades nuevas — más simple que en 2.1.
8. **Compatibilidad con Fase 1:** total. Ningún archivo de Fase 1 requiere modificación.
9. **Fuera de alcance:** Decisiones Diferidas #5 (relación con `Staff.availability`), #3 (`Anular Liquidación`), y la nueva #6 (excepción de solapamiento de horario, ver abajo).

---

## 1. Modelos propuestos

```prisma
model Staff {
  // ...campos existentes sin cambios...
  generatesCommission Boolean @default(true)

  availabilities StaffAvailability[]
  capabilities   StaffCapability[]
  settlements    Settlement[]
}

model StaffAvailability {
  id        String   @id @default(cuid())
  staffId   String
  staff     Staff    @relation(fields: [staffId], references: [id])

  type      String   // "base_schedule" | "planned_absence" | "unplanned_absence"

  weekday   Int?      // 0-6 — solo type = "base_schedule"
  startTime String?   // "HH:mm" — solo type = "base_schedule"
  endTime   String?   // "HH:mm" — solo type = "base_schedule"

  startAt   DateTime? // solo ausencias (programada o imprevista)
  endAt     DateTime? // solo ausencias
  reason    String?   // solo ausencias

  createdAt DateTime @default(now())

  @@index([staffId, type])
  @@index([staffId, weekday])
  @@index([staffId, startAt, endAt])
}

model StaffCapability {
  id        String   @id @default(cuid())
  staffId   String
  staff     Staff    @relation(fields: [staffId], references: [id])

  serviceId String   // referencia a Service — deliberadamente sin clave foránea real

  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([staffId, active])
  @@index([serviceId, active])
}

model Settlement {
  id          String   @id @default(cuid())
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])

  staffId     String
  staff       Staff    @relation(fields: [staffId], references: [id])

  periodStart DateTime
  periodEnd   DateTime
  totalAmount Decimal  @db.Decimal(10, 2)

  status      String   @default("active") // "active" | "voided"
  voidedAt    DateTime?
  voidReason  String?

  replacesSettlementId String?
  replacesSettlement   Settlement?  @relation("SettlementReplacement", fields: [replacesSettlementId], references: [id])
  replacedBy           Settlement[] @relation("SettlementReplacement")

  createdAt   DateTime @default(now())

  @@index([staffId, status])
  @@index([tenantId, staffId, periodStart])
}
```

`Tenant` gana la relación inversa `settlements Settlement[]`, mismo patrón que `serviceCategories` en 2.1.

`StaffCapability.active` y `Settlement.status` usan, respectivamente, `Boolean` y `String` — no porque el modelo conceptual los trate distinto (ambos son enumerados de dos valores conceptualmente), sino por consistencia con la convención ya establecida en el esquema: las entidades que solo distinguen "vigente / no vigente" usan `Boolean active` (`Service.active`, `ServiceCategory.active`); las entidades cuyo segundo estado tiene metadatos propios (`voidedAt`, `voidReason`) usan `String status`, porque un booleano no podría cargar esos campos asociados con la misma claridad semantica.

---

## 2. Claves

**Primarias:** `id` en las cuatro entidades, `String @id @default(cuid())` — sin excepción.

**Foráneas:**
- `StaffAvailability.staffId → Staff.id` (no nullable).
- `StaffCapability.staffId → Staff.id` (no nullable).
- `Settlement.staffId → Staff.id` (no nullable), `Settlement.tenantId → Tenant.id` (nullable, mismo patrón que el resto del esquema), `Settlement.replacesSettlementId → Settlement.id` (nullable, autorreferencia).

**Sin clave foránea hacia `Service`:** `StaffCapability.serviceId` es un `String` plano, igual que `PriceRule.targetId` en 2.1 — Staff no se acopla estructuralmente a la tabla de otro contexto. La validación de existencia ocurre en `ManageStaffCapabilitiesUseCase`, vía `ServiceExistenceReaderPort`.

---

## 3. Índices, restricciones y la excepción documentada

**`StaffCapability`:** índice único parcial — `(staffId, serviceId) WHERE active = true`. Doble protección completa: la aplicación valida antes de persistir, la base de datos lo garantiza ante condiciones de carrera. Mismo patrón que `PriceRule` en 2.1.

**`Settlement`:** índice único parcial — `(staffId, periodStart, periodEnd) WHERE status = 'active'`. Doble protección completa, mismo patrón.

**`StaffAvailability` — coherencia de rangos:** `CHECK (startTime < endTime)` cuando `type = 'base_schedule'`, `CHECK (startAt < endAt)` cuando es una ausencia. Sin infraestructura adicional, expresable con `CHECK` estándar.

**`StaffAvailability` — solapamiento de horario base (excepción documentada al Principio Permanente del Esquema Físico):**

El invariante "no pueden superponerse dos franjas de horario base activas del mismo staff y mismo día de la semana" **no se protege con una restricción de base de datos en este entregable**. Protegerlo correctamente requeriría una restricción de exclusión por rangos (`EXCLUDE USING gist`), que depende de la extensión `btree_gist` de PostgreSQL — no presente hoy en el proyecto.

Esta es una **excepción razonada, no una reducción del estándar de calidad**: introducir una extensión de base de datos para resolver un único invariante de un único entregable no está justificado por el dominio en este momento de la evolución de la plataforma. La protección queda **únicamente en la capa de aplicación** (`UpdateAvailabilityUseCase` valida solapamiento antes de persistir).

Si en el futuro aparecen varios invariantes basados en rangos —Agenda, Reservas, Disponibilidad avanzada— esta decisión se reabre y se evalúa introducir `btree_gist` de forma consciente para toda la plataforma, no de forma incidental para resolver un caso aislado.

**Índices de consulta:**
- `StaffAvailability`: `(staffId, type)`, `(staffId, weekday)`, `(staffId, startAt, endAt)` — soportan `Resolver Disponibilidad del Staff`.
- `StaffCapability`: `(serviceId, active)` — soporta la búsqueda inversa "qué staff puede prestar este servicio".
- `Settlement`: `(staffId, status)`, `(tenantId, staffId, periodStart)` — soportan `Consultar Liquidaciones`.

---

## 4. Plan de migración

1. `ALTER TABLE "Staff" ADD COLUMN "generatesCommission" BOOLEAN NOT NULL DEFAULT true` — aditiva, sin backfill manual: el `DEFAULT true` resuelve automáticamente las filas existentes y mantiene operativo `seed-staff.js` y `staff.service.js` (Fase 1) sin modificarlos.
2. `CREATE TABLE "StaffAvailability"`, `"StaffCapability"`, `"Settlement"` — vacías, sin backfill: son conceptos nuevos sin datos previos que migrar.
3. Claves foráneas e índices de consulta.
4. Los dos índices únicos parciales (`StaffCapability`, `Settlement`), vía SQL manual en la migración — mismo mecanismo que `PriceRule_active_target_unique` en 2.1.

No se requiere ninguna verificación anti-huérfanos como en 2.1 (no hay columna que se elimine ni dato que reasignar).

---

## Resolución de la Decisión Diferida #2 — relación entre `commission-calculation.rules.js` y `commission.service.js` (Fase 1)

El documento de Arquitectura Técnica prometió resolver esto explícitamente en esta etapa. La resolución: **conviven, no se fusionan.**

`commission-calculation.rules.js` es la función de dominio del nuevo contexto `Staff`, usada exclusivamente por `RecordCommissionOnAppointmentCompletedUseCase`. Se escribe nueva, sin importar ni envolver `src/services/domain/commission.service.js` — ese archivo de Fase 1 sigue existiendo, sin modificarse, y lo siguen usando los callers actuales (p. ej. `recordGroomingCommission` en `appointments.routes.js`) hasta que una tarea de migración explícita —fuera de este entregable, igual que pasó con `service.service.js` legado en 2.1— los reemplace por el nuevo caso de uso. La tabla física `Commission` es la misma para ambos caminos, por lo que esta convivencia no produce inconsistencia de datos: solo dos puntos de entrada al mismo hecho, durante la transición.

---

## 5. Validación final

**Contra el modelo conceptual de persistencia:** las cuatro entidades, sus campos y relaciones corresponden uno a uno con lo aprobado en `staff-modelo-persistencia.md`.

**Contra los Principios Permanentes del modelo de persistencia:** `Aggregate Root` (`Staff`) como única vía de escritura de `StaffAvailability` y `StaffCapability` — ninguna clave foránea permite escribirlas sin un `staffId` válido. Evolución por extensión: nuevos `type` de disponibilidad o nuevos valores de `status` no requieren alterar la forma de las tablas.

**Contra el Principio Permanente del Esquema Físico (doble protección):** se cumple completamente para `StaffCapability` y `Settlement`. Para el solapamiento de horario base, se documenta una **excepción explícita y acotada**, no una excepción general — limitada a este invariante, con condición de reapertura ya definida.

**Contra el Plan Maestro y el Modelo de Dominio:** ninguna entidad nueva pertenece a `Agenda`, `Clientes`, `Mascotas` o `Finanzas`. La compatibilidad con Fase 1 es total — ningún archivo existente requiere modificación, a diferencia de 2.1.

---

## Decisión Arquitectónica Diferida #6 (a incorporar en `sistema-operativo-staff.md`)

**Protección del solapamiento de horario base — excepción acotada, no extendida.**
El invariante de no solapamiento en `StaffAvailability.type = 'base_schedule'` se protege únicamente en la capa de aplicación, sin restricción de base de datos, porque introducir `btree_gist` para un único invariante de un único entregable no está justificado por el dominio actual. Esta excepción es explícita y limitada — no constituye un precedente para relajar la doble protección en otros invariantes. Se reabre cuando aparezcan más invariantes basados en rangos de tiempo en la plataforma (candidatos plausibles: Disponibilidad de Agenda, Reservas), momento en el que se evaluará introducir la infraestructura de forma consciente y consolidada, no incidental.

---

Decisión Diferida #6 incorporada a `sistema-operativo-staff.md`. Etapa 5 (Esquema Físico) cerrada.
