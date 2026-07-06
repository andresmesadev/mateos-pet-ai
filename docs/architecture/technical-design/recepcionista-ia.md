# Entregable 3.4 — Recepcionista IA · Etapa 3: Arquitectura Técnica

**Estado:** Implementado y validado. Congelada.
**Referencia:** `docs/architecture/use-cases/recepcionista-ia.md` (Etapas 1-2)

---

## 1. Estructura del contexto

`backend/src/contexts/receptionist/` — layout mínimo, sin capa de dominio propia (no hay entidades ni errores nuevos; reutiliza los de `agents` y `communication`):

```
receptionist/
  application/ports/
  application/use-cases/
  infrastructure/engine/
  index.js
```

No hay `domain/` en este contexto — es, por diseño, una capa de orquestación pura sin reglas de negocio propias (Etapa 1, Decisión 1: cero entidades nuevas).

## 2. Puertos

- `ConversationalEngineAdapterPort` — un único método, `processIncomingMessage(body)`, que envuelve exactamente el contrato ya existente de `whatsapp.service.processIncomingMessage`. Es una frontera deliberada: si en el futuro el motor conversacional se reescribe o se relocaliza (Decisión Diferida 4 de la Etapa 1), solo cambia su implementación, nunca el caso de uso que lo consume.
- **Reutilizados por composición, no redefinidos:** `agents.getDigitalEmployees`, `agents.startAgentTask`, `agents.registerAgentDecision`, `agents.completeAgentTask`, `agents.generateEscalation`, `communication.escalateConversation` — igual que Automatizaciones (3.3), Recepcionista IA invoca estos casos de uso ya expuestos por sus propios composition roots, sin puertos propios que los envuelvan artificialmente.

## 3. Dependencia de otros contextos

Recepcionista IA depende, por diseño, de:
- **Empleados Digitales (3.2):** consulta el catálogo de agentes (filtrado en memoria por `specialization === "recepcionista"`, sin tocar el esquema ni los casos de uso de `agents`) e invoca el ciclo completo Tarea → Decisión → (Completar | Escalar).
- **Comunicación (3.1):** invoca `escalateConversation` para resolver la Decisión Diferida 1 de 3.2.
- **El motor conversacional legado** (`whatsapp.service.js` y todo lo que orquesta) — no es un contexto, es infraestructura interna del propio Recepcionista IA (Etapa 1, Decisión 3), envuelta por `ConversationalEngineAdapterPort`.

No depende de Eventos (3.0) ni de Automatizaciones (3.3) — ninguna decisión de Etapa 1 lo requiere. Automatizaciones ya puede, sin ningún cambio en este entregable, generar tareas para Recepcionista vía su acción existente `asignar_tarea_empleado` — no hace falta ninguna integración inversa.

## 4. Resolución del Empleado Digital Recepcionista

**Decisión 1 — Filtrado en memoria, no un nuevo método de repositorio.** `AutomationRuleRepositoryPort`/`DigitalEmployeeRepositoryPort` (3.2) no exponen `findBySpecialization`; añadirlo reabriría el contrato congelado de 3.2 sin necesidad real. El composition root de `receptionist` llama a `agents.getDigitalEmployees({ tenantId })` y filtra el array resultante por `specialization === "recepcionista"`, tomando el primero activo (o el primero, si ninguno está activo, dejando que `startAgentTask` sea quien rechace por estado). Si no existe ninguno, el caso de uso falla con un error propio (`ReceptionistNotConfiguredError`) — condición operativa (falta de seed), no un caso de negocio.

**Decisión 2 — Seeding del Empleado Digital, mismo mecanismo que `EventType`.** Se añade `scripts/seed-digital-employees.js`, análogo a `scripts/seed-event-types.js` (3.0): idempotente, registra un `DigitalEmployee` con `specialization: "recepcionista"` por tenant activo (o global, `tenantId: null`, si no hay tenants — mismo criterio que Comunicación resuelve su canal por defecto). No se resuelve "al vuelo" en cada request para evitar condiciones de carrera y mantener consistencia con el precedente ya establecido.

## 5. Manejo de Empleado pausado

Si `startAgentTask` lanza `DigitalEmployeeNotActiveError`, el caso de uso **no invoca el motor conversacional** y devuelve una respuesta de respaldo fija ("Estamos ausentes en este momento, te responderemos pronto 🐾"). Esto delega en el estado ya existente de `DigitalEmployee` un control administrativo real (pausar el bot completo) sin introducir un nuevo mecanismo de "modo mantenimiento".

## 6. Resolución de la brecha de escalamiento (Decisión Diferida 1 de 3.2)

El motor conversacional (`whatsapp.service.processIncomingMessage`) ya devuelve, en su resultado, la información suficiente para detectar escalamiento: la sesión resultante trae `requires_human_attention: true` cuando corresponde (comportamiento existente, sin cambios). El caso de uso de Recepcionista IA lee esa señal del resultado del motor (sin modificar el motor) y, si está presente:

```js
try {
  await communication.escalateConversation({ conversationId: conversation.id });
} catch (error) {
  if (!(error instanceof ConversationAlreadyEscalatedError)) throw error;
  // idempotente: ya estaba escalada, no es un fallo del procesamiento del mensaje
}
await agents.generateEscalation({
  agentTaskId: task.id,
  context: { userMessage, conversationId: conversation?.id ?? null },
});
```

`generateEscalation` deja la Tarea en `"escalada"` — no se llama a `completeAgentTask` en este camino (invariante ya definida en 3.2: una Tarea solo admite un cierre).

## 7. Verificación de compatibilidad y ADRs

- Sin contradicción con ADRs 005-009: ninguna decisión toca `Commission`/`Transaction`/`CitaCompletada`.
- Sin contradicción con el Modelo de Dominio (§9): Recepcionista IA es exactamente una instancia de Empleado Digital con especialización ya prevista; no se introduce ninguna entidad nueva.
- Sin cambio de comportamiento observable en el motor conversacional: `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js` no se modifican. El único cambio de comportamiento real y deliberado es la resolución de la brecha de escalamiento (sección 6) — una corrección, no una regresión.
- `webhook.controller.js` cambia su import de `processIncomingMessage` (de `whatsapp.service` a `contexts/receptionist`) — su contrato de respuesta hacia `communication.sendMessage` permanece idéntico.

## 8. Preguntas abiertas para la Etapa 4

1. ¿La resolución del Empleado Digital Recepcionista por tenant se cachea en el composition root o se consulta en cada mensaje? → Se resuelve en Etapa 4 (no es una decisión de persistencia real, pero se documenta ahí por conveniencia de mantener juntas las decisiones operativas del entregable).
