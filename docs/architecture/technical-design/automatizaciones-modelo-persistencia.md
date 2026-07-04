# Entregable 3.3 — Automatizaciones · Etapa 4: Modelo de Persistencia

**Estado:** Implementado y validado. Congelada.

---

## Agregados raíz

1. **AutomationRule** — raíz propia. Contiene la Condición y la configuración de Acción como atributos propios (no como colecciones separadas) — a diferencia de `AgentAutonomyLimit` (colección propia de `DigitalEmployee`), aquí una Regla tiene exactamente una condición y una acción, por lo que no se justifica una tabla separada (misma lógica que decidió no separar `Escalation.context`).
2. **AutomationTemplate** — raíz propia, catálogo global (mismo estatus que `EventType`).
3. **AutomationExecution** — raíz propia, registro de auditoría inmutable (mismo estatus que `Commission`/`DomainEvent`: nace completo, nunca se edita; no requiere patrón de anulación porque no es un hecho contable, es un registro de ejecución técnica — igual que `EventDelivery`, cuya corrección es "una nueva fila", no una edición).

## Resolución de las preguntas abiertas de la Etapa 3

**Pregunta 1 — `AutomationExecution.actionResult`.** Se modela como `Json?`, análogo a `AgentTask.result` y `DomainEvent.payload`: el resultado de una acción varía según su tipo (`enviar_mensaje` devuelve un `Message`; `asignar_tarea_empleado` devuelve un `AgentTask`) y no beneficia tipar columnas separadas por acción — mismo razonamiento que ya se aplicó dos veces en este proyecto para forma de dato heterogénea propia de un solo contexto.

**Pregunta 2 — `AutomationRule.templateId`.** Se modela como FK real opcional (`String?`, `onDelete: SetNull`) — a diferencia de `StaffCapability.serviceId` (referencia deliberadamente débil porque cruza el límite Operativo/Catálogo con otro ciclo de vida), aquí ambas entidades (`AutomationRule`, `AutomationTemplate`) viven en el mismo contexto y bajo el mismo control transaccional — no hay razón para renunciar a la integridad referencial dentro del propio contexto. Si la Plantilla se elimina, la Regla activada a partir de ella simplemente pierde la trazabilidad de origen (`templateId = null`), pero sigue funcionando con su configuración propia — consistente con la Decisión de Etapa 2 de que la Regla es independiente desde su creación.

## Relación con EventType (Eventos, 3.0)

`AutomationRule.triggerEventTypeId` es una FK real hacia `EventType.id` (`onDelete: Restrict`, mismo patrón que `DomainEvent.eventTypeId`) — impide borrar un Tipo de Evento que tenga Reglas configuradas contra él, evitando reglas huérfanas.

## Relación con DomainEvent (Eventos, 3.0)

`AutomationExecution.domainEventId` es una FK real hacia `DomainEvent.id` (`onDelete: Restrict`) — cada Ejecución queda ligada al Evento de Dominio concreto que la disparó, permitiendo auditoría completa: "qué Regla se ejecutó, para qué Evento exacto, con qué resultado".

## Relación con Staff (vía Escalación, indirecta) y Empleados Digitales

`AutomationRule` no referencia directamente a `DigitalEmployee`; el `digitalEmployeeId` objetivo de una Regla con `actionType: "asignar_tarea_empleado"` vive dentro de `actionConfig` (Json), no como columna ni FK — coherente con que la Acción es configuración de negocio, no una relación estructural del esquema (mismo criterio que `Escalation.context: Json`).

## Invariantes que NO se expresan en el esquema físico (validación en la capa de aplicación)

- `actionType` debe ser exactamente `"enviar_mensaje"` o `"asignar_tarea_empleado"` — enum de aplicación, igual que `SPECIALIZATIONS` en Empleados Digitales.
- La forma de `actionConfig` depende de `actionType` (validación cruzada de aplicación, no de esquema — mismo criterio ya usado para `AgentTask.result`/`Escalation.context`).
- `condition`, si no es `null`, debe ser un objeto plano de profundidad 1 (sin anidamiento, sin operadores) — Decisión 3 de Etapa 1, validada en el caso de uso `Registrar Regla de Automatización`.

## Índices

- `AutomationRule`: `(tenantId, active)` — listado de Reglas del negocio; `(triggerEventTypeId, active)` — resolución rápida en el Caso 5 (evaluar solo Reglas activas para el disparador que ocurrió).
- `AutomationExecution`: `(automationRuleId, createdAt)` — Consultar Historial de una Regla; `(domainEventId)` — trazabilidad inversa (qué Reglas reaccionaron a un Evento dado).
