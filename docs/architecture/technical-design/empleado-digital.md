# Entregable 3.2 — Empleado Digital

**Fecha:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 3 congelada.
**Contexto de dominio que cubre:** Empleados Digitales (ver `docs/architecture/use-cases/empleado-digital.md`, Etapas 1-2)

---

## Etapa 3 — Arquitectura Técnica

### 1. Estructura del contexto

Mismo patrón de capas: `domain / application / infrastructure`, composition root propio (`contexts/agents/`). Contexto enteramente nuevo (como Eventos), sin adopción de entidades legacy.

### 2. Puertos de aplicación

- **`DigitalEmployeeRepositoryPort`** — registrar/pausar/reactivar; configurar límites de autonomía; encontrar por id; listar.
- **`AgentTaskRepositoryPort`** — iniciar; completar; escalar; encontrar por id; listar por empleado.
- **`AgentDecisionRepositoryPort`** — registrar; listar por tarea.
- **`EscalationRepositoryPort`** — crear; atender; listar pendientes.
- **`DomainEventPublisherPort`** — mismo contrato ya usado por los demás contextos.

### 3. Sin dependencia de Comunicación ni Eventos en este entregable

Ningún caso de uso invoca `Enviar Mensaje` (Comunicación) ni certifica contra el contexto Eventos (3.0) — no hay agente real que necesite notificar todavía. Ambas integraciones quedan para el entregable que traiga el primer agente (3.4), mismo criterio que Comunicación aplicó para no integrarse obligatoriamente con Eventos.

### 4. Límite de Autonomía — mecanismo de verificación

`Configurar Límite de Autonomía` persiste pares `(acción, autoAprobado)` sobre el Empleado Digital. `Generar Escalación` (caso 8) es, en este entregable, siempre invocado explícitamente por quien inicia la tarea (no hay lógica de negocio real que "decida" excederse — eso pertenece a la lógica del agente en 3.4+). El puerto expone la consulta del límite (`DigitalEmployeeRepositoryPort.getAutonomyLimit`) para que un futuro agente la consulte antes de actuar.

### 5. Sin tensión con contextos existentes

No conoce la lógica interna de Agenda/Finanzas/Staff/Servicios/Eventos/Comunicación. `Staff` se referencia únicamente por id (asignación de Escalación), sin acoplarse a su lógica interna — mismo patrón que `StaffCapability.serviceId` (referencia sin FK forzada entre bounded contexts, aquí sí con FK real porque Staff y Empleados Digitales conviven en el mismo Dominio Operativo, precedente: `Commission.staffId`).

## Preguntas trasladadas a la Etapa 4

1. ¿`AgentTask.result` se persiste como texto libre o `Json`?
2. ¿`Escalation.assignedStaffId` es obligatorio u opcional al crearse?
