# Entregable 3.4 — Recepcionista IA

**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio:** `docs/architecture/domain-model-v1.md`, §9 (Empleados Digitales) — especialización "recepcionista", ya prevista en el catálogo `SPECIALIZATIONS` de 3.2.

---

## Etapa 1 — Modelo de Dominio

### Auditoría del código real (mapeo del monolito conversacional)

Se auditó exhaustivamente `webhook.controller.js`, `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `services/domain/intent-detector.service.js`, `services/domain/medical-auto-capture.service.js`, `conversation-persistence.service.js`, `memory.service.js`, y sus dependencias directas (`appointment.service.js`, `user.service.js`, `pet.service.js`, `medical-record.service.js`, `tenant.service.js`, `availability.service.js`/`availability-db.service.js`, `openai.service.js`). `escalation.service.js` fue confirmado ausente — ya retirado en 3.1.

**Clasificación resultante (qué permanece, qué migra, qué ya fue absorbido):**

| Componente | Clasificación | Destino |
|---|---|---|
| `webhook.controller.js` | Adaptador HTTP del canal WhatsApp | Permanece; su invocación interna cambia (Etapa 3) |
| `whatsapp.service.js` | Motor conversacional (parsing de payload WhatsApp, orquestación del flujo) | Permanece como motor interno, ahora orquestado por Recepcionista IA (Etapa 3) |
| `conversation.service.js` | Motor de reglas + máquina de estados del wizard | Permanece como motor interno |
| `scheduling.service.js` | NLU de fecha/hora + resolución de turnos contra disponibilidad real | Permanece — compartido con el futuro Coordinador de Agenda IA (3.5); no se toca en este entregable |
| `services/domain/intent-detector.service.js` | Detección de intención, ya explícitamente channel-agnostic | Permanece — capacidad genuina de Recepcionista IA |
| `services/domain/medical-auto-capture.service.js` | Auto-captura de información médica desde texto libre | Permanece — capacidad genuina de Recepcionista IA |
| `memory.service.js` | Caché de sesión del wizard (RAM + `Conversation.sessionData/step/intent`) | Permanece sin cambios — es estado conversacional volátil, no el registro de auditoría del agente (que aporta `AgentTask`/`AgentDecision`, complementario, no sustituto) |
| `conversation-persistence.service.js` | Acceso directo a `Conversation`/`Message` para la recepción | **Ya absorbido parcialmente por Comunicación (3.1) solo para el envío saliente.** La persistencia de la recepción sigue siendo acceso directo — Decisión Diferida 3 de 3.1 ("Migración de Recepción"), **permanece diferida**; no se resuelve en este entregable (ver Decisiones de alcance, punto 4) |
| `appointment.service.js`, `availability(-db).service.js` | Creación/consulta de citas y disponibilidad real | Pertenecen a Agenda (dominio operativo) — sin cambios; Coordinador de Agenda IA (3.5) es quien eventualmente las envuelve |
| `user.service.js`, `pet.service.js`, `medical-record.service.js`, `tenant.service.js` | Clientes/Mascotas/Negocio (Fase 1) | Sin cambios |
| `openai.service.js` | Adaptador de IA (análisis + generación de respuesta) | Permanece — infraestructura del motor conversacional |

**Hallazgo de auditoría (confirmado, no anticipado en 3.1/3.2):** la detección de escalamiento humano en `whatsapp.service.js` (líneas 338-367, disparada por `scheduling.detectHumanEscalation` y por `detectHumanTakeoverIntent` dentro de `conversation.service.js`) hoy **solo** marca `session.requires_human_attention = true` en memoria/`sessionData` y sincroniza `intent`/`step` — **nunca invoca** `communication.escalateConversation`. Esto significa que, en producción, un cliente que pide hablar con un humano **no aparece** en `GET /escalations` del dashboard (que lee `Conversation.status`). Es precisamente la brecha que el Gate Review de 3.2 dejó anotada como Decisión Diferida 1: *"Integración entre esta Escalación y `Conversation.status` (Comunicación) — entregable del primer agente real (3.4)."* Resolverla es el hallazgo central de este entregable, no una regresión introducida ahora.

### Objetivo del entregable

Convertir al motor conversacional de WhatsApp — ya funcional y probado — en un **Empleado Digital real**: cada mensaje entrante procesado por "Lina" (la Recepcionista) debe producir una Tarea, una Decisión auditable, y — cuando corresponda — una Escalación real y visible en el dashboard. No se reescribe el motor; se le da un actor de dominio con auditoría.

### Decisiones de alcance (Etapa 1)

1. **Recepcionista IA es la especialización `"recepcionista"` del catálogo `SPECIALIZATIONS` ya definido en 3.2** — no se crea ninguna entidad de dominio nueva. Se reutiliza `DigitalEmployee`, `AgentTask`, `AgentDecision`, `Escalation` sin modificar su esquema ni sus casos de uso.
2. **Granularidad de la Tarea del Agente: una `AgentTask` por mensaje entrante procesado**, no una por conversación completa. Un diálogo de varios turnos es, por diseño, una secuencia de Tareas discretas — coherente con la definición del Modelo de Dominio ("lo que un empleado digital está ejecutando **en un momento dado**") y evita correlacionar estado de Tarea a través de múltiples invocaciones del webhook.
3. **El motor conversacional existente (`whatsapp.service.js` + todo lo que orquesta) no se reescribe ni se relocaliza físicamente.** Se envuelve mediante un adaptador de infraestructura del nuevo contexto (Etapa 3) — el "mapeo del monolito", exigido para este entregable, es esta clasificación de responsabilidades (Etapa 1), no una migración de archivos.
4. **La migración de la persistencia de recepción (Decisión Diferida 3 de 3.1) permanece diferida.** No es necesaria para dar auditoría real al agente — `AgentTask`/`AgentDecision` cubren la necesidad de auditoría de este entregable sin tocar `conversation-persistence.service.js`.
5. **Resolución de la brecha de escalamiento (Decisión Diferida 1 de 3.2):** cuando el motor conversacional señala escalamiento humano, el nuevo contexto invoca **ambos** mecanismos, que son complementarios y no redundantes (ya establecido en el diseño de 3.2): `agents.generateEscalation` (Escalación, entidad de auditoría a nivel de Tarea) y `communication.escalateConversation` (`Conversation.status`, estado del hilo visible en el dashboard). Si la conversación ya estaba escalada (`ConversationAlreadyEscalatedError`), se ignora sin fallar el procesamiento del mensaje — idempotencia deliberada.
6. **Pausar el Empleado Digital Recepcionista pausa el bot administrativamente.** Si `DigitalEmployee.status = "pausado"`, el nuevo caso de uso rechaza iniciar la Tarea (`DigitalEmployeeNotActiveError`, ya existente en 3.2) y responde con un mensaje de respaldo, sin invocar el motor conversacional — uso directo y ya previsto del estado del agente, no una funcionalidad nueva.
7. **Límite de Autonomía no se aplica todavía a ninguna acción concreta.** `AgentAutonomyLimit` ya existe (3.2) pero ninguna acción del flujo actual (cancelar, reagendar) lo consulta — queda como Decisión Diferida (candidata natural para 3.5, cuando el Coordinador de Agenda IA tenga acciones que ameriten aprobación).
8. **Certificación de `TareaCompletada`/`EscalaciónGenerada`/`DecisiónRegistrada` como Eventos de Dominio (Eventos, 3.0) no se resuelve en este entregable.** El publisher de `agents` sigue siendo log-only (decisión ya congelada en 3.2, Etapa 3, sección 3: "sin dependencia de Comunicación ni Eventos"). No fue una Decisión Diferida explícitamente asignada a 3.4 — se mantiene fuera de alcance.

## Etapa 2 — Casos de Uso

| # | Caso de uso | Actor | Tipo |
|---|---|---|---|
| 1 | Procesar Mensaje Entrante | Sistema (webhook de WhatsApp) | Operación — invocador HTTP real (a diferencia de los Casos 5-8 de Empleados Digitales, que no tenían invocador) |

**Un único caso de uso nuevo.** Es intencional: todo lo demás que este entregable necesita (registrar/pausar/reactivar el Empleado Digital, consultar Tareas/Decisiones/Escalaciones) **ya existe** en `contexts/agents` (3.2) y `contexts/communication` (3.1) — se reutiliza sin cambios, incluidas sus rutas de dashboard ya construidas.

### Detalle del Caso 1 — Procesar Mensaje Entrante

Orquestación atómica (un único flujo, sin transacción de base de datos compartida — a diferencia del Puente, no hay invariante que exija atomicidad transaccional entre estos pasos; cada uno es una operación independiente ya diseñada para tolerar fallos aislados):

1. Resuelve el Empleado Digital Recepcionista activo del tenant (filtra `agents.getDigitalEmployees({ tenantId })` por `specialization === "recepcionista"`; si no existe ninguno, falla de forma controlada — ver Etapa 3).
2. `agents.startAgentTask({ digitalEmployeeId, origin: "whatsapp" })`. Si el Empleado está pausado, propaga `DigitalEmployeeNotActiveError` — el llamador (adaptador HTTP) responde con un mensaje de respaldo sin ejecutar el resto.
3. Delega en el motor conversacional existente (`whatsapp.service.processIncomingMessage`) — sin cambios en su comportamiento.
4. Deriva una Decisión a partir del resultado del motor (intent detectado, step resultante, si hubo escalamiento) e invoca `agents.registerAgentDecision`.
5. Si el motor señaló escalamiento humano: `agents.generateEscalation` (deja la Tarea en `"escalada"`) + `communication.escalateConversation` (idempotente ante `ConversationAlreadyEscalatedError`). Si no: `agents.completeAgentTask({ result })`.
6. Devuelve exactamente la misma forma que hoy consume `webhook.controller.js` (`reply`, `user`, `conversation`) — su llamada posterior a `communication.sendMessage` no cambia.

## Mapa conceptual

```
webhook.controller.js
        │
        ▼
contexts/receptionist  (Recepcionista IA, 3.4 — nuevo, orquestación pura)
  Procesar Mensaje Entrante
        │           │                              │
        ▼           ▼                              ▼
contexts/agents   whatsapp.service.js         contexts/communication
(3.2, reutilizado) (motor conversacional,      (3.1, reutilizado —
 Tarea/Decisión/    sin cambios)                 escalateConversation)
 Escalación)
```

## Decisiones diferidas hacia la implementación

1. Migración de la persistencia de recepción a los puertos de Comunicación (Decisión Diferida 3 de 3.1) — sigue sin resolverse.
2. Aplicación de Límite de Autonomía a acciones concretas (cancelar/reagendar) — candidata natural para 3.5.
3. Certificación de los eventos propios de Empleados Digitales (`TareaCompletada`, etc.) en el contexto Eventos — fuera de alcance, no asignada a ningún entregable todavía.
4. Reubicación física del motor conversacional dentro de `contexts/receptionist/infrastructure/` — posible refactor futuro sin impacto funcional, no necesario ahora.
5. Mapeo del monolito hacia el Coordinador de Agenda IA (3.5) — la separación de responsabilidades entre "primer contacto/enrutamiento" (Recepcionista) y "disponibilidad/agendamiento/confirmaciones" (Coordinador) se declara aquí (Etapa 1) pero su implementación pertenece a 3.5.

Ninguna decisión diferida bloquea la implementación.
