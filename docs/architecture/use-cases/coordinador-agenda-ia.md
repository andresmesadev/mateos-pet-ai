# Entregable 3.5 — Coordinador de Agenda IA

**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio:** `docs/architecture/domain-model-v1.md`, §9 (Empleados Digitales) — especialización `"coordinador_agenda"`, ya prevista en el catálogo `SPECIALIZATIONS` de 3.2.

---

## Etapa 1 — Modelo de Dominio

### Auditoría del código real

Se auditó exhaustivamente `appointment.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`, `routes/dashboard/appointments.routes.js`, la porción de `conversation.service.js` relacionada con agenda (wizard de grooming/veterinaria, operaciones de gestión), y — hallazgo central de esta auditoría — `jobs/reminder.job.js` + `services/reminder.service.js`.

**Clasificación resultante:**

| Componente | Clasificación | Destino en 3.5 |
|---|---|---|
| `appointment.service.js` (creación, cancelación, conflicto, consulta) | Dominio de Agenda (Fase 1/Puente) | Sin cambios — Coordinador de Agenda IA no lo reescribe ni lo duplica |
| `scheduling.service.js` (NLU fecha/hora, resolución de turnos vet/grooming) | Motor conversacional, ya envuelto por Recepcionista IA (3.4) | Sin cambios — permanece dentro del motor que 3.4 ya audita vía `ProcessIncomingMessageUseCase` |
| `availability.service.js` / `availability-db.service.js` | Motor de disponibilidad real (Agenda) | Sin cambios |
| `routes/dashboard/appointments.routes.js` | Superficie HTTP de Agenda para el operador humano (dashboard) | Sin cambios — no es responsabilidad de ningún Empleado Digital |
| `conversation.service.js` — wizard de agendamiento (grooming/veterinaria), `handleCancellation`/`handleReschedule`/`handleQueryAppointments` | Ya auditado como parte de las Tareas de **Recepcionista IA** (3.4, decisión congelada: una `AgentTask` por mensaje entrante, sin distinción de sub-flujo) | **No se reabre.** La coordinación conversacional de agenda permanece atribuida a Recepcionista IA |
| **`jobs/reminder.job.js` + `services/reminder.service.js`** | Job diario (cron) que decide y envía recordatorios de cita, vacuna, desparasitación, grooming y seguimiento post-consulta — **hoy sin ninguna atribución de agente** | **Es el hallazgo central: aquí es donde Coordinador de Agenda IA tiene un rol real, concreto y no solapado** |

**Hallazgo de auditoría:** `reminder.job.js` ya ejecuta, todos los días a las 9:00am (`node-cron`), exactamente el tipo de decisión que el Modelo de Dominio atribuye a este Empleado Digital ("recordatorios") — pero lo hace hoy como infraestructura pura, sin ningún `AgentTask`/`AgentDecision`. `reminder.service.js` ya fue migrado en 3.1 para enviar exclusivamente a través de `communication.sendMessage` — no hay ninguna llamada directa a `sendWhatsAppMessage` que corregir aquí.

### Objetivo del entregable

Dar auditoría real de Empleado Digital a la única responsabilidad de "coordinación de agenda" que hoy **no** tiene ningún actor de dominio detrás: el job diario de recordatorios. No se reescribe `reminder.service.js` (los mensajes y su envío permanecen intactos); se envuelve el bucle de orquestación (`reminder.job.js`) para que cada intento de recordatorio produzca una Tarea y una Decisión auditables.

### Decisiones de alcance (Etapa 1)

1. **Coordinador de Agenda IA es la especialización `"coordinador_agenda"` del catálogo `SPECIALIZATIONS`** (3.2) — cero entidades nuevas, mismo criterio que 3.4.
2. **División de responsabilidad entre Recepcionista IA (3.4) y Coordinador de Agenda IA (3.5), declarada explícitamente para no solaparse:** la coordinación de agenda que ocurre **dentro de una conversación** (ofrecer turno, confirmar, crear la cita) permanece atribuida a las Tareas de Recepcionista IA — decisión ya congelada en 3.4, **no se reabre**. Coordinador de Agenda IA, en este entregable, es responsable exclusivamente de la ejecución auditada del job de recordatorios — una responsabilidad real, distinta, y hoy sin ningún agente detrás.
3. **Granularidad de la Tarea del Agente: una `AgentTask` por intento de recordatorio individual** (no una por ejecución completa del job) — mismo criterio de granularidad que 3.4 ("una Tarea por interacción significativa con un cliente o intento de ella"), aplicado consistentemente.
4. **`reminder.service.js` no se modifica.** Se envuelve exclusivamente `reminder.job.js` (el bucle de orquestación, análogo a como 3.4 envolvió `webhook.controller.js`, no `whatsapp.service.js`).
5. **Sin escalamiento humano en este flujo.** A diferencia de Recepcionista IA, un recordatorio fallido (p. ej., sin teléfono) no requiere intervención humana — ya hoy `reminder.service.js` simplemente devuelve `false` sin lanzar error. La Tarea se completa siempre (éxito o fallo), nunca se escala.
6. **Extensión aditiva del script de seed de 3.4** (`scripts/seed-digital-employees.js`): se añade `"coordinador_agenda"` a las especializaciones aseguradas por tenant — mismo patrón ya usado por `seed-event-types.js` (lista extensible entregable a entregable), no una reapertura del diseño de 3.4.
7. **Sin integración con Automatizaciones (3.3) en este entregable.** El job de recordatorios es determinístico y programado por cron, no reactivo a un Evento de Dominio certificado — no hay ningún `EventType` hoy que lo dispare. Automatizaciones ya puede, sin cambio alguno, asignar tareas a este Coordinador vía su acción existente `asignar_tarea_empleado` — no se requiere ninguna integración inversa nueva.
8. **Sin integración con Eventos (3.0).** Mismo criterio que 3.2/3.4: el publisher de `agents` permanece log-only; certificar `TareaCompletada` como Evento de Dominio sigue fuera de alcance (no asignado a ningún entregable todavía).

## Etapa 2 — Casos de Uso

| # | Caso de uso | Actor | Tipo |
|---|---|---|---|
| 1 | Procesar Recordatorio | Sistema (job diario, cron) | Operación — invocador real (el cron job), sin adaptador HTTP |

**Un único caso de uso nuevo**, mismo criterio que 3.4: todo lo demás (registrar/pausar/reactivar el Empleado Digital, consultar sus Tareas/Decisiones) ya existe en `contexts/agents` (3.2) y se reutiliza sin cambios, incluidas sus rutas de dashboard.

### Detalle del Caso 1 — Procesar Recordatorio

Por cada recordatorio individual que `reminder.job.js` intenta enviar (de cualquiera de las 5 categorías: cita, vacuna, desparasitación, grooming, seguimiento post-consulta):

1. Resuelve el Coordinador de Agenda IA activo del tenant (mismo patrón de filtrado en memoria que Recepcionista IA, 3.4 — sin nuevo método de repositorio).
2. `agents.startAgentTask({ digitalEmployeeId, origin: "cron_reminder_job" })`.
3. Delega en el motor de recordatorios existente (`reminder.service.js`, sin cambios) a través de un adaptador que envuelve exactamente el par `sendX` + `markXSent` ya existente para esa categoría.
4. Registra una Decisión (`agents.registerAgentDecision`) con el resultado (enviado / omitido, y por qué).
5. Completa la Tarea (`agents.completeAgentTask`) con el resultado — siempre, sin rama de escalamiento (Decisión 5 de la Etapa 1).

## Mapa conceptual

```
jobs/reminder.job.js
        │
        ▼
contexts/coordinador-agenda  (Coordinador de Agenda IA, 3.5 — nuevo, orquestación pura)
  Procesar Recordatorio
        │                                   │
        ▼                                   ▼
contexts/agents                    services/reminder.service.js
(3.2, reutilizado —                 (motor de recordatorios,
 Tarea/Decisión)                     sin cambios — ya usa
                                      communication.sendMessage, 3.1)
```

## Decisiones diferidas hacia la implementación

1. Integración con Automatizaciones (3.3) para disparar recordatorios reactivamente ante Eventos de Dominio certificados — no hay hoy ningún `EventType` que lo justifique.
2. Certificación de `TareaCompletada` en el contexto Eventos — fuera de alcance, no asignada a ningún entregable todavía.
3. Auditoría de la coordinación conversacional de agenda (dentro de Recepcionista IA) — permanece fuera de alcance de este entregable; solo se tocaría vía Reconciliación Arquitectónica si se decidiera reatribuir esas Tareas en el futuro.
4. Aplicación de Límite de Autonomía a la decisión de enviar o no un recordatorio — candidata natural futura, no requerida hoy.

Ninguna decisión diferida bloquea la implementación.
