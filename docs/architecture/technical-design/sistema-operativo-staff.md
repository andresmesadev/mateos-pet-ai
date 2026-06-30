# Diseño Técnico — Sistema Operativo de Staff

**Entregable:** 2.2 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Enmendado durante la Etapa 4 (Decisión Diferida #5) y la Etapa 6/Validación Funcional (corrección de fidelidad en `ManageStaffCapabilitiesUseCase` y `ResolveStaffAvailabilityUseCase`, ver ADR 004). Cierre en `docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`.
**Implementa:** `docs/architecture/use-cases/sistema-operativo-staff.md` (contrato funcional aprobado)
**Contexto de dominio:** `Staff`

Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, ni endpoints, ni esquema de base de datos. Sigue exactamente la misma disciplina y los mismos Principios Permanentes de la arquitectura de aplicación ya establecidos en el Entregable 2.1 (`docs/architecture/technical-design/sistema-operativo-servicios.md`) — no se redefinen aquí, se heredan.

---

## 1. Capa de aplicación

| Caso de uso (nombre oficial) | Servicio de aplicación | Responsabilidad |
|---|---|---|
| Registrar Staff | `RegisterStaffUseCase` | Administración |
| Actualizar Staff | `UpdateStaffUseCase` | Administración |
| Desactivar Staff | `DeactivateStaffUseCase` | Administración |
| Reactivar Staff | `ReactivateStaffUseCase` | Administración |
| Actualizar Disponibilidad | `UpdateAvailabilityUseCase` | Administración |
| Administrar Capacidades del Staff | `ManageStaffCapabilitiesUseCase` | Administración |
| Registrar Ausencia Imprevista | `RecordUnplannedAbsenceUseCase` | Operación |
| Registrar Comisión por Cita Completada | `RecordCommissionOnAppointmentCompletedUseCase` | Operación (reactivo) |
| Generar Liquidación de Período | `GenerateSettlementUseCase` | Operación |
| Resolver Disponibilidad del Staff | `ResolveStaffAvailabilityUseCase` | Resolución |
| Consultar Staff Activo | `ListActiveStaffUseCase` | Consulta |
| Consultar Liquidaciones | `ListSettlementsUseCase` | Consulta |

`Liquidación` se traduce técnicamente como `Settlement`, consistente con el inglés ya usado en el resto del código del proyecto. Ningún caso de uso invoca a otro del mismo contexto — mismo principio que en 2.1.

---

## 2. Contratos de entrada y salida

### RegisterStaffUseCase
- **Entrada:** `{ tenantId, name, role, phone?, email?, generatesCommission? }`
- **Salida:** `{ staff }`
- **Errores de dominio posibles:** `InvalidStaffAttributesError` (nombre vacío, rol no reconocido por el establecimiento).

### UpdateStaffUseCase
- **Entrada:** `{ tenantId, staffId, name?, role?, phone?, email?, generatesCommission? }`
- **Salida:** `{ staff }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `InvalidStaffAttributesError`.

### DeactivateStaffUseCase
- **Entrada:** `{ staffId }`
- **Salida:** `{ staff }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `StaffAlreadyInactiveError`.

### ReactivateStaffUseCase
- **Entrada:** `{ staffId }`
- **Salida:** `{ staff, restoredCapabilities }` — la lista de capacidades restauradas, para trazabilidad explícita de lo que el caso de uso hizo automáticamente.
- **Errores de dominio posibles:** `StaffNotFoundError`, `StaffAlreadyActiveError`.

### UpdateAvailabilityUseCase
- **Entrada:** `{ staffId, type: "base_schedule" | "planned_absence", schedule? , range? }` — `schedule` cuando `type = "base_schedule"`; `range` (inicio/fin) cuando `type = "planned_absence"`.
- **Salida:** `{ availability }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `InvalidAvailabilityRangeError`.

### ManageStaffCapabilitiesUseCase
- **Entrada:** `{ staffId, serviceIds: string[] }` — el conjunto completo deseado, no un delta.
- **Salida:** `{ capabilities, added: string[], removed: string[] }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `ReferencedServiceNotFoundError`, `DuplicateStaffCapabilityError`.
- **Corrección de fidelidad (detectada en Validación Técnica, Etapa 6):** esta lista de errores, escrita en la Etapa 3, no incluía originalmente `DuplicateStaffCapabilityError`. El Esquema Físico (Etapa 5, sección 3) ya había prometido para `StaffCapability` "doble protección completa... mismo patrón que `PriceRule` en 2.1", lo cual requiere este error. Se incorpora aquí para que ambos documentos queden consistentes — no es una funcionalidad nueva, es el cumplimiento de una promesa de diseño ya aprobada en una etapa posterior a la que originalmente listó los errores.

### RecordUnplannedAbsenceUseCase
- **Entrada:** `{ staffId, startAt, endAt, reason? }`
- **Salida:** `{ availability }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `InvalidAvailabilityRangeError`.

### RecordCommissionOnAppointmentCompletedUseCase
- **Entrada:** `{ tenantId, appointmentId, staffId, serviceId, resolvedPrice, priceSource, completedAt }` — recibido ya resuelto desde el evento `CitaCompletada`, vía el adaptador de eventos, nunca desde un canal humano. `tenantId`, `priceSource` y `completedAt` se incorporan en esta corrección (Validación Funcional, Etapa 6): `Commission` (Fase 1) ya los requiere para producir un registro completo; el contrato original los omitió por error de redacción, no por una decisión de excluirlos.
- **Salida:** `{ commission }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `ReferencedServiceNotFoundError`, `InvalidCommissionInputError` (precio nulo o negativo, datos incompletos del evento).

### GenerateSettlementUseCase
- **Entrada:** `{ staffId, periodStart, periodEnd }`
- **Salida:** `{ settlement }`
- **Errores de dominio posibles:** `StaffNotFoundError`, `NoCommissionsForPeriodError`, `SettlementAlreadyExistsError` (ya existe una liquidación activa, no anulada, para ese mismo miembro y período — la inmutabilidad de Settlement, definida en el contrato funcional, se protege aquí).

### ResolveStaffAvailabilityUseCase
- **Entrada:** `{ serviceId, rangeStart, rangeEnd }`
- **Salida:** `{ availableStaff: [...] }` — operación de lectura pura.
- **Errores de dominio posibles:** `ReferencedServiceNotFoundError`.
- **Dependencia hacia Servicios, formalizada por ADR:** consume `ServiceExistenceReaderPort.exists(serviceId)` para producir `ReferencedServiceNotFoundError` — ver `docs/decisions/004-resolver-disponibilidad-consulta-servicios.md`.

### ListActiveStaffUseCase
- **Entrada:** `{ tenantId, role?, serviceId?, includeInactive? }`
- **Salida:** `{ staff: [...] }`
- **Errores de dominio posibles:** ninguno.

### ListSettlementsUseCase
- **Entrada:** `{ tenantId?, staffId?, periodStart?, periodEnd? }`
- **Salida:** `{ settlements: [...] }`
- **Errores de dominio posibles:** ninguno.

---

## 3. Dependencias

**Servicios de dominio que consume el contexto `Staff`:**
- `availability-resolution.rules.js` — evalúa horario base + ausencias sobre un rango, para `ResolveStaffAvailabilityUseCase`.
- `commission-calculation.rules.js` — aplica la regla de split dado un precio resuelto y una tasa. Su relación con `src/services/domain/commission.service.js` (Fase 1) es una **decisión diferida** — ver sección final.
- `capability-diff.rules.js` — determina capacidades agregadas/retiradas, para `ManageStaffCapabilitiesUseCase`.

**Repositorios que necesita (puertos, sin implementación):**
- `StaffRepositoryPort` — CRUD del Miembro del Staff.
- `AvailabilityRepositoryPort` — separado del anterior; ciclo de vida y consultas distintas (horario base, ausencias programadas e imprevistas).
- `StaffCapabilityRepositoryPort` — persistencia de capacidades asignadas.
- `CommissionRepositoryPort` — registrar y consultar comisiones.
- `SettlementRepositoryPort` — registrar y consultar liquidaciones, con su invariante de inmutabilidad.
- `ServiceExistenceReaderPort` — puerto mínimo hacia `Servicios`: solo existencia de un `serviceId`.
- `ServiceCategoryReaderPort` — puerto propio de Staff hacia `Servicios`: solo la categoría de un servicio, para calcular comisión.
- `BusinessConfigReaderPort` — puerto hacia `Negocio`: módulos activos y regla de split configurada.

**Qué NO debe conocer esta capa:**
- El cliente de Prisma directamente.
- `req` / `res` de Express, ni ningún concepto de HTTP.
- Las entidades `Cita`, `Cliente`, `Mascota`, `Transacción`, `Cierre del Día` — `Staff` no conoce `Agenda`, `Clientes`, `Mascotas` ni `Finanzas`.
- Ningún Empleado Digital ni canal de comunicación.

**Criterio de puertos mínimos (reafirmado para este entregable y los siguientes):** si en el futuro otro contexto necesita conocer únicamente el estado operativo de un miembro del staff (por ejemplo, si está activo y qué capacidades tiene), la respuesta es un puerto de lectura mínimo expuesto por Staff — nunca el acceso al modelo completo del contexto. Este entregable no construye ese puerto de salida todavía (nadie lo necesita aún), pero el criterio queda establecido para cuando 2.3 u otro contexto lo requiera.

---

## 4. Eventos de dominio

| Caso de uso | Evento que produce | Contextos que podrían consumirlo a futuro |
|---|---|---|
| Registrar / Actualizar / Desactivar / Reactivar Staff | `StaffRegistrado`, `StaffActualizado`, `StaffDesactivado`, `StaffReactivado` | `Agenda` (saber a quién puede asignar citas) |
| Actualizar Disponibilidad | `DisponibilidadActualizada` | `Agenda` (recalcular disponibilidad al agendar) |
| Registrar Ausencia Imprevista | `DisponibilidadActualizada` (origen distinguido en el payload) | `Agenda` |
| Administrar Capacidades del Staff | `CapacidadAsignada`, `CapacidadRevocada` | `Agenda` (filtrar staff elegible por servicio) |
| Registrar Comisión por Cita Completada | `ComisiónRegistrada` | `Finanzas` (consolidar en el cierre del día, Entregable 2.3) |
| Generar Liquidación de Período | `LiquidaciónGenerada` | `Finanzas` (reportes históricos, Entregable 2.3) |
| Resolver Disponibilidad del Staff, Consultar Staff Activo, Consultar Liquidaciones | Ninguno (lectura) | — |

Los eventos se publican después de confirmar la persistencia, nunca antes — mismo principio de 2.1.

---

## 5. Estructura de carpetas propuesta

```
backend/src/contexts/staff/
  domain/
    rules/
      availability-resolution.rules.js
      commission-calculation.rules.js
      capability-diff.rules.js
    errors/
      (StaffNotFoundError, StaffAlreadyInactiveError, StaffAlreadyActiveError,
       InvalidStaffAttributesError, InvalidAvailabilityRangeError,
       ReferencedServiceNotFoundError, InvalidCommissionInputError,
       NoCommissionsForPeriodError, SettlementAlreadyExistsError)

  application/
    use-cases/
      (los 12 casos de uso de la sección 1)
    ports/
      staff-repository.port.js
      availability-repository.port.js
      staff-capability-repository.port.js
      commission-repository.port.js
      settlement-repository.port.js
      service-existence-reader.port.js
      service-category-reader.port.js
      business-config-reader.port.js
      domain-event-publisher.port.js

  infrastructure/
    persistence/
      (implementaciones Prisma de cada puerto)
    events/
      staff-domain-events.publisher.js
```

Misma forma que `contexts/services/`: `domain/` no importa nada de `application/` ni `infrastructure/`; `application/` solo conoce `infrastructure/` a través de los puertos.

---

## 6. Validación arquitectónica

**Contra el Plan Maestro y el Modelo de Dominio:** las entidades y eventos coinciden exactamente con `domain-model-v1.md` ampliado (incluyendo Capacidad del Staff). Ningún caso de uso conoce Agenda, Clientes, Mascotas o Finanzas directamente.

**Contra los Principios Permanentes ya establecidos:** se heredan sin modificación los cuatro de la arquitectura de aplicación y los tres del modelo de persistencia (Entregable 2.1). `RecordCommissionOnAppointmentCompletedUseCase` es la prueba de que "los casos de uso se comunican por eventos, nunca por llamadas directas" también rige para procesos reactivos, no solo para los iniciados por un operador.

**Contra el criterio de puertos mínimos:** cada puerto hacia otro contexto (`ServiceExistenceReaderPort`, `ServiceCategoryReaderPort`, `BusinessConfigReaderPort`) expone solo el método que el caso de uso necesita, nunca el modelo completo del contexto consultado.

---

## Decisiones arquitectónicas diferidas

Estas son preguntas que este entregable identificó deliberadamente pero no resuelve ahora. Quedan registradas para no perderse ni resolverse implícitamente durante la implementación.

**1. Pertenencia futura de `Commission` y `Settlement`.**
Ambas entidades representan hechos financieros (cuánto generó un miembro del staff, cuánto se le debe pagar). Durante la Fase 2 permanecen dentro del contexto `Staff` por razones de evolución del proyecto: nacieron como parte de la responsabilidad de Staff ("registrar automáticamente las comisiones", según el Modelo de Dominio), y separarlas prematuramente hacia `Finanzas` antes de que ese contexto exista como Sistema Operativo (Entregable 2.3) introduciría una dependencia inversa prematura. En una futura revisión del Modelo de Dominio, debería evaluarse explícitamente si `Commission` y `Settlement` pertenecen definitivamente a `Finanzas`, con `Staff` como su único productor de eventos en lugar de su dueño. No se decide ahora; se deja visible.

**2. Relación entre `commission-calculation.rules.js` (nuevo) y `src/services/domain/commission.service.js` (Fase 1). — RESUELTA en la Etapa 5.**
Conviven, no se fusionan: `commission-calculation.rules.js` es exclusivo del nuevo caso de uso `RecordCommissionOnAppointmentCompletedUseCase`; `commission.service.js` sigue siendo usado, sin modificarse, por sus callers actuales de Fase 1, hasta una migración explícita futura — fuera de este entregable. Ambos escriben sobre la misma tabla física `Commission`, sin inconsistencia de datos. Detalle completo en `staff-esquema-fisico.md`.

**3. Mecanismo de anulación de `Settlement`.**
El contrato funcional ya estableció que una Liquidación nunca se reemplaza, solo se anula y se genera una nueva. El caso de uso `Anular Liquidación` no forma parte de este entregable — se construye cuando el negocio lo necesite, no de forma especulativa. Su ausencia no bloquea `GenerateSettlementUseCase`, que sigue pudiendo rechazar duplicados sin necesitar todavía la capacidad de anular.

**4. Puerto de lectura mínimo de Staff hacia afuera.**
Este entregable no expone ningún puerto de lectura desde `Staff` hacia otros contextos (nadie lo necesita todavía). Cuando `Agenda` o `Finanzas` necesiten consultar el estado operativo de un miembro del staff, ese puerto se diseñará en ese momento, con su propio ADR si introduce una dependencia nueva — no se anticipa su forma ahora.

**5. Relación entre `Disponibilidad del Staff` (nueva) y `Staff.availability` (Fase 1). — RESUELTA por ADR 003, antes de iniciar la implementación.**
Detectada durante la Etapa 4 (Modelo de Persistencia). Verificado el código real antes de decidir: `Staff.availability` (JSON) se usa únicamente en `staff.routes.js` (no en `availability-db.service.js`, que no toca este campo) y representa solo un horario semanal base, sin ausencias. Conviven sin sincronización continua: el JSON sigue siendo la fuente de los dos endpoints legados que lo usan; `StaffAvailability` es la fuente exclusiva de los nuevos casos de uso. Se ejecuta un backfill de una sola vez desde el JSON hacia filas `base_schedule`, sin tocar ni eliminar el campo legado. Detalle completo en `docs/decisions/003-disponibilidad-staff-convivencia-fase1.md`.

**6. Protección del solapamiento de horario base — excepción acotada al Principio Permanente del Esquema Físico.**
Detectada durante la Etapa 5 (Esquema Físico). El invariante "no pueden superponerse dos franjas de horario base activas del mismo staff y mismo día de la semana" (`StaffAvailability.type = 'base_schedule'`) se protege únicamente en la capa de aplicación (`UpdateAvailabilityUseCase`), sin restricción de base de datos — protegerlo correctamente requeriría una restricción de exclusión por rangos (`EXCLUDE USING gist`), dependiente de la extensión `btree_gist`, no presente hoy en el proyecto. Es una **excepción explícita y acotada**, no una reducción del estándar de calidad del proyecto: introducir esa infraestructura para un único invariante de un único entregable no está justificado por el dominio en este momento de la evolución de la plataforma. No constituye precedente para relajar la doble protección en otros invariantes. Se reabre cuando aparezcan más invariantes basados en rangos de tiempo (candidatos plausibles: Disponibilidad de Agenda, Reservas), evaluando entonces introducir `btree_gist` de forma consciente y consolidada para toda la plataforma — no de forma incidental.

---

**Estado de aprobación:** Diseño congelado (Gate Review, `docs/history/ENTREGABLE_2_2_GATE_REVIEW.md`). Esta sección fue enmendada durante la Etapa 4 (punto 5) y la Etapa 5 (punto 6); el punto 5 quedó formalmente resuelto por ADR 003 antes de iniciar la implementación, sin reabrir el diseño congelado — el resto del documento permanece sin cambios respecto a su aprobación original.
