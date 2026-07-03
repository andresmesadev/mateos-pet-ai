# Cierre del Entregable 3.0 — Infraestructura de Eventos

**Fecha de cierre:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados (en curso)
**Estado:** ✅ Completado
**Proceso aplicado:** misma disciplina de la Regla de Ejecución de la Fase 2 (Gate Review previo a implementación, orden disciplinado de bloques), con Etapa 1 = Modelo de Dominio en vez de Definición Funcional — este es un contexto de infraestructura, sin equivalente funcional directo hacia el cliente.
**Gate Review previo:** `docs/history/ENTREGABLE_3_0_GATE_REVIEW.md`
**Diseño de referencia (congelado, sin cambios durante la implementación):** `docs/architecture/use-cases/infraestructura-de-eventos.md`, `docs/architecture/technical-design/infraestructura-de-eventos*.md`

---

## Objetivo del entregable

Introducir el contexto **Eventos**: dar identidad, inmutabilidad y trazabilidad de negocio al hecho de que "algo ocurrió en el dominio", de modo que cualquier contexto pueda reaccionar sin conocer la lógica interna de quien lo produjo, y de modo que esa reacción quede auditada como cualquier otro hecho oficial del Sistema Operativo. Es el primer entregable de la Fase 3 y precondición de todos los demás: sin una capa que certifique hechos con identidad y catálogo, ni Automatizaciones (3.3) ni ningún Empleado Digital tiene sobre qué reaccionar de forma auditable.

## Resumen de implementación

Se implementó el contexto `events` completo (dominio, casos de uso, adaptadores de persistencia, composition root), se integró de forma aditiva con el `DomainEventDispatcher` ya existente del Entregable Puente (sin modificarlo), y se certificó por primera vez un hecho real del sistema: `CitaCompletada`, dentro de la misma transacción en que ya se registran su comisión y su cobro de sistema. Se expusieron por HTTP los 5 casos de uso de negocio (Administración y Consulta); las 2 operaciones de infraestructura ("Registrar/Reintentar Entrega") permanecen sin adaptador HTTP, conforme al diseño congelado.

## Cambios realizados

**Esquema y migración:**
- 3 tablas nuevas: `EventType` (catálogo global, sin `tenantId`), `DomainEvent`, `EventDelivery`.
- Migración `prisma/migrations/20260703090000_infraestructura_de_eventos/` (generada con `migrate diff`, aplicada con `migrate deploy`).
- `Tenant` gana la relación `domainEvents`.

**Contexto `backend/src/contexts/events/`:**
- `domain/errors/` — 7 errores (`InvalidEventTypeAttributesError`, `DuplicateEventTypeNameError`, `EventTypeNotFoundError`, `EventTypeAlreadyInactiveError`, `EventTypeNotActiveError`, `InvalidDomainEventAttributesError`, `DomainEventNotFoundError`).
- `application/ports/` — 4 puertos (`EventTypeRepositoryPort`, `DomainEventRepositoryPort`, `EventDeliveryRepositoryPort`, `DomainEventPublisherPort`).
- `application/use-cases/` — 6 casos de uso de negocio (`RegisterEventType`, `DeactivateEventType`, `RegisterDomainEvent`, `GetEventCatalog`, `ListDomainEvents`, `ListEventDeliveries`) + 2 operaciones de infraestructura con sufijo `.mechanism.js` (`registerEventDelivery`, `retryEventDelivery`) para distinguirlas en el propio nombre del archivo.
- `infrastructure/persistence/` — 3 adaptadores Prisma.
- `infrastructure/events/` — publisher del contexto (mismo patrón log-only que Finanzas/Staff/Servicios).
- `index.js` — composition root.

**Integración (`backend/src/contexts/index.js`):** envoltorio `dispatcherWithCertification` que certifica el Evento de Dominio como parte de la operación de publicación misma (no como un tercer `subscribe`), antes de delegar en el `DomainEventDispatcher` original — que permanece sin modificar.

**Adaptador HTTP:** `backend/src/routes/dashboard/events.routes.js` — 5 rutas (`POST /event-types`, `POST /event-types/:name/deactivate`, `GET /event-types`, `GET /domain-events`, `GET /domain-events/:id/deliveries`), montadas en `dashboard.routes.js`.

**Operativo:** `backend/src/scripts/seed-event-types.js` — script idempotente que registra `CitaCompletada` en el Catálogo (precondición para que el comando Completar Cita no falle por la Invariante 2).

**Tests:** actualización de los mocks de Prisma en `appointmentPatch.test.js` (`eventType.findUnique`, `domainEvent.create`) para reflejar la nueva integración.

**Documentación:** `domain-model-v1.md` (§12 — Contexto Eventos, nuevo, sin renumerar secciones existentes); `PLAN_MAESTRO.md` y `CLAUDE.md` (Fase 3 en curso, roadmap interno, 3.0 completado).

## Validación Técnica

- Migración aplicada y verificada: `prisma migrate deploy` seguido de `prisma migrate diff --from-config-datasource --to-schema` → *"No difference detected"* (BD ≡ schema).
- Seed `CitaCompletada` corrido contra la base de datos real.
- Suite completa: **47/47 suites · 303/303 tests** en verde.
- Smoke test de solo lectura contra la base real en 3 endpoints (`GET /event-types`, `GET /domain-events`, `GET /domain-events/:id/deliveries`) — sin escritura de datos sintéticos permanentes (ver justificación en Validación Funcional).
- Composition root (`contexts/index.js`) y rutas del dashboard verificados por carga real del módulo, sin errores de resolución.

## Validación Funcional

Verificación directa de las 6 invariantes del Modelo de Dominio congelado contra su implementación:

| Invariante | Verificación | Resultado |
|---|---|---|
| 1 — Evento inmutable | Ningún repositorio expone actualización sobre `DomainEvent` | Confirmado por diseño del código |
| 2 — Solo tipos activos | `RegisterDomainEvent` rechaza tipo inexistente (`EventTypeNotFoundError`) y tipo inactivo (`EventTypeNotActiveError`) | Verificado con repositorios en memoria |
| 3 — Entrega inmutable, reintento = fila nueva | `registerEventDelivery` rechaza `"pending"`; `retryEventDelivery` exige una entrega fallida previa y crea una fila nueva sin reescribir | Verificado con repositorios en memoria |
| 4 — Tenant obligatorio | `RegisterDomainEvent` rechaza `tenantId` nulo (`InvalidDomainEventAttributesError`) | Verificado con repositorios en memoria |
| 5 — Payload no interpretado | Ningún caso de uso ni adaptador lee el contenido del payload | Confirmado por diseño del código |
| 6 — Validez sin consumidores | Un Evento de Dominio se crea y persiste con éxito sin ninguna Entrega asociada | Verificado con repositorios en memoria |

Ciclo de vida completo del Catálogo verificado contra la base real con un tipo desechable: registrar → rechazo de duplicado (409) → desactivar → rechazo de desactivación repetida (409) → ausencia en el catálogo activo.

**Nota de método:** `Evento de Dominio` y `Entrega de Evento` no tienen mecanismo de corrección por diseño (a diferencia de `Commission`/`Expense`), por lo que su validación funcional se hizo con repositorios en memoria en vez de escribir datos de prueba permanentes contra la base real — decisión deliberada para no contaminar el historial de hechos auditables con datos sintéticos.

## Hallazgos encontrados durante la implementación y su resolución

**Hallazgo 1 — Dependencia operativa silenciosa sobre el Catálogo.** Al integrar la certificación de `CitaCompletada` (Bloque 5), se detectó que, sin un `EventType` "CitaCompletada" ya sembrado en el Catálogo, el comando Completar Cita empezaría a fallar por la Invariante 2 — un riesgo no anticipado en el diseño (que no especifica mecanismos de bootstrap). **Resolución:** se creó `seed-event-types.js`, idempotente, corrido contra la base real antes de dar por buena la integración. No requirió ningún cambio de diseño ni ADR — es una necesidad operativa de implementación, no una contradicción con el diseño congelado.

**Hallazgo 2 — Filtro de tenant incorrecto en consulta.** El primer smoke test contra la base real reveló que `PrismaDomainEventRepository.listByFilters` pasaba `tenantId` de forma incondicional al filtro de Prisma, mientras que el modo superadmin lo recibe como `null` — y la columna `tenantId` no admite `null` en el filtro. **Resolución:** se corrigió el filtro a condicional (`...(tenantId ? { tenantId } : {})`), mismo patrón ya usado en el resto de consultas del proyecto para el modo superadmin. Es un defecto de implementación (no de diseño): la Invariante 4 rige la escritura (todo Evento de Dominio pertenece a un tenant), no la lectura (un superadmin puede consultar across tenants).

Ninguno de los dos hallazgos requirió reabrir el diseño congelado ni generó una Reconciliación Arquitectónica.

## Estado final

El contexto Eventos está implementado, integrado, documentado y validado. El `DomainEventDispatcher` del Entregable Puente permanece intacto. `CitaCompletada` es, desde este cierre, el primer hecho del sistema certificado como Evento de Dominio en producción. Las decisiones diferidas del diseño (mecanismo concreto de entrega asíncrona, migración de los demás publishers al nuevo contexto, validación estructural del contrato de payload, retención/purga histórica) permanecen registradas y sin resolver — no bloquean este cierre, tal como estableció el Gate Review.

## Criterio de cierre cumplido

El criterio de cierre del entregable —certificar hechos de negocio como Eventos de Dominio auditables, mantener un Catálogo de disparadores, e integrar la certificación con el mecanismo reactivo ya existente sin modificarlo— queda cumplido: `CitaCompletada` se certifica en producción, el Catálogo está operativo y consultable, y el `DomainEventDispatcher` del Puente no sufrió ningún cambio. El entregable habilita directamente el diseño de 3.1 (Comunicación) y 3.2 (Empleado Digital), y provee a 3.3 (Automatizaciones) el Catálogo del que leerá sus disparadores configurables.
