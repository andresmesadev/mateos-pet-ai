# Entregable 3.4 — Recepcionista IA · Etapa 4: Modelo de Persistencia

**Estado:** Implementado y validado. Congelada.

---

## Sin agregados nuevos

Este es, por diseño (Etapa 1, Decisión 1), un entregable de orquestación pura: **no introduce ninguna entidad ni tabla nueva.** Reutiliza en su totalidad:
- `DigitalEmployee`, `AgentTask`, `AgentDecision`, `Escalation` (Empleados Digitales, 3.2).
- `Conversation`, `Message` (Comunicación, 3.1).

No hay agregados raíz propios de `receptionist` que resolver en esta etapa.

## Resolución de la pregunta abierta de la Etapa 3

**Pregunta 1 — Caché de la resolución del Empleado Digital Recepcionista por tenant.** Se resuelve **sin caché** en este entregable: cada mensaje entrante consulta `agents.getDigitalEmployees({ tenantId })` y filtra en memoria. Es una única consulta indexada (`AutomationRule`... perdón, `DigitalEmployee(tenantId, specialization)`, índice ya existente desde 3.2) por mensaje — coste despreciable al volumen actual del sistema (un tenant real, bajo tráfico, mismo criterio de aceptación de trade-off ya usado en Automatizaciones 3.3, Etapa 3 Decisión 5). Introducir caché sin necesidad real violaría el principio de no anticipar escala inexistente.

## Seed operativo

`scripts/seed-digital-employees.js` registra, de forma idempotente, un `DigitalEmployee` con `specialization: "recepcionista"` para cada `Tenant` activo existente (o uno global, `tenantId: null`, si no hay tenants creados aún) — mismo mecanismo y nivel de rigor que `scripts/seed-event-types.js` (3.0). No requiere migración de esquema: usa exclusivamente el caso de uso ya existente `agents.registerDigitalEmployee` (no inserta directamente por Prisma, a diferencia del seed de `EventType`, porque aquí sí existe un caso de uso de Administración ya expuesto que cumple exactamente la misma función y aplica sus propias validaciones).

## Invariantes que NO requieren esquema nuevo

- "Un Recepcionista activo por tenant" no se fuerza con un índice único (`DigitalEmployee` ya permite múltiples filas por `(tenantId, specialization)`, sin unicidad — decisión de 3.2, no reabierta aquí). El caso de uso de Recepcionista IA toma el primero encontrado; si el negocio crea más de uno por error, es una condición operativa, no una violación de invariante de dominio.
