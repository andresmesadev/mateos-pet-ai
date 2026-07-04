# Entregable 3.2 — Empleado Digital

**Fecha:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio que cubre:** Empleados Digitales (`domain-model-v1.md`, §9)

---

## Etapa 1 — Definición Funcional

### Auditoría (resumen — detalle completo en el reporte de cierre de esta macroetapa)

Ninguna entidad de §9 existe en código. El "agente" real es el monolito conversacional, cuyo mapeo a especializaciones queda diferido a la Etapa 1 del Entregable 3.4 (decisión ya congelada en el mapa conceptual de la Fase 3 — no se reabre). Este entregable construye el **andamiaje auditable** sin agentes nuevos, mismo patrón que 3.0 construyó Eventos antes de que existiera un consumidor real.

### Qué problema resuelve

Da identidad, estado y auditoría a "un agente de IA" como entidad del Sistema Operativo — para que, cuando 3.4 (Recepcionista IA) exista, cada tarea, decisión y escalación que genere sea una entidad real, no una inferencia de logs dispersos.

### Decisiones de alcance

1. **`Empleado Digital` es tenant-scoped** (`tenantId` opcional, mismo patrón que `Staff`/`Service`/`Channel` — no el patrón estricto de `Eventos`, porque un agente es configuración de negocio, no un hecho auditado).
2. **`Límite de Autonomía` vive en el propio `Empleado Digital`**, no en una configuración de Negocio separada — resuelve la pregunta abierta del mapa conceptual de la Fase 3 (§6.4). No se introduce una entidad de configuración nueva sin necesidad concreta (YAGNI, mismo criterio que todo el proyecto).
3. **`Decisión del Agente` referencia una `Tarea del Agente`** (obligatorio) — toda decisión ocurre dentro de una tarea; el modo proactivo sin tarea previa es explícitamente Fase 4 (§9, "Eventos que consume... modo proactivo, Fase 4"), fuera de alcance.
4. **La Escalación de este contexto es distinta e independiente de `Conversation.status`** (Comunicación, 3.1): esta es una entidad propia — tarea asignada a un humano (`Staff`) con contexto completo — no reemplaza ni se integra automáticamente con el estado de la conversación en este entregable (esa integración es del futuro entregable que traiga un agente real, 3.4).
5. **Prompt Registry no entra al Modelo de Dominio** (ya clasificado como infraestructura — no se reabre).

---

## Etapa 2 — Casos de Uso

| # | Caso de uso | Responsabilidad | Actor |
|---|---|---|---|
| 1 | Registrar Empleado Digital | Administración | Humano |
| 2 | Pausar Empleado Digital | Administración | Humano |
| 3 | Reactivar Empleado Digital | Administración | Humano |
| 4 | Configurar Límite de Autonomía | Administración | Humano |
| 5 | Iniciar Tarea del Agente | Operación (reactivo) | Sistema (futuro agente) |
| 6 | Registrar Decisión del Agente | Operación (reactivo) | Sistema (futuro agente) |
| 7 | Completar Tarea del Agente | Operación (reactivo) | Sistema (futuro agente) |
| 8 | Generar Escalación | Operación (reactivo) | Sistema (futuro agente) |
| 9 | Atender Escalación | Administración | Humano |
| 10 | Consultar Empleados Digitales | Consulta | Humano |
| 11 | Consultar Tareas de un Empleado Digital | Consulta | Humano |
| 12 | Consultar Decisiones de una Tarea | Consulta | Humano |
| 13 | Consultar Escalaciones Pendientes | Consulta | Humano |

### Detalle no autoexplicativo

**5 — Iniciar Tarea.** Precondición: el Empleado Digital debe estar `activo` (no `pausado`). Sin invocador real en este entregable — mismo estatus que "Registrar Entrega de Evento" en 3.0: mecanismo listo, sin productor todavía.

**6 — Registrar Decisión.** Exige una Tarea existente y no completada. Invariante: `DecisiónRegistrada` se produce siempre (§9), sin excepción — ninguna decisión se descarta silenciosamente.

**7 — Completar Tarea.** Postcondición: `status = "completada"`; produce `TareaCompletada`.

**8 — Generar Escalación.** Se dispara cuando una acción excede el Límite de Autonomía del agente o el agente lo decide explícitamente. Postcondición: Tarea pasa a `"escalada"`; produce `EscalaciónGenerada`. Requiere asignar un `Staff` específico (o queda sin asignar, a definir por el operador en el caso 9 si no se resuelve automáticamente — ver Decisión Diferida).

**9 — Atender Escalación.** Actor humano. Postcondición: `status = "atendida"`.

### Mapa conceptual

```
Futuro Empleado Digital (3.4+)
        │
[5] Iniciar Tarea ──▶ [6] Registrar Decisión (N veces) ──▶ [7] Completar Tarea
        │                                                         │
        └──(excede autonomía)──▶ [8] Generar Escalación ──▶ [9] Atender Escalación (humano)

Administración: [1][2][3][4] sobre el Empleado Digital
Consulta: [10][11][12][13] — auditoría completa
```

### Decisiones Diferidas

1. Integración entre la Escalación de este contexto y `Conversation.status` (Comunicación) — pertenece al entregable que traiga el primer agente real (3.4).
2. Asignación automática del Staff responsable de una Escalación (hoy: se asigna explícitamente o queda `null`, resuelto manualmente en el caso 9).
3. Mapeo del monolito conversacional a especializaciones — Etapa 1 del Entregable 3.4 (ya diferido, no nuevo).
