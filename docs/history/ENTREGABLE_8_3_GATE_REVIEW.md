# Gate Review consolidado — Entregable 8.3 (Modelado de Estado)

**Fase:** Fase 8 — Calidad del Motor Conversacional
**Estado:** 🚧 Macroetapa 1 (Diseño) — pendiente de aprobación del responsable del proyecto antes de implementar.
**Reconciliación Arquitectónica habilitante:** ADR 010 (misma autorización de 8.1/8.2).

---

## 1. Diseño (Macroetapa 1)

### 1.1 Auditoría — inventario real antes de diseñar

Grep exhaustivo de todo valor asignado a `session.step` en `conversation.service.js`, `whatsapp.service.js` y `scheduling.service.js`:

```
null, STEPS.AWAITING_PET_NAME, STEPS.AWAITING_PET_TYPE,
STEPS.AWAITING_GROOMING_SLOT_CONFIRM, STEPS.AWAITING_DOMICILIO,
STEPS.AWAITING_DOMICILIO_ADDRESS, STEPS.AWAITING_DATE_TIME,
STEPS.AWAITING_CONFIRMATION, STEPS.COMPLETED, "human_takeover"
```

**Hallazgo confirmado (D-E1):** `"human_takeover"` (`conversation.service.js:305`) es un string literal fuera del enum `STEPS` — exactamente el bug que el informe describe: nada impide escribir un valor que no pertenece al vocabulario cerrado.

**Hallazgo que reduce el alcance real de D-E2:** el informe externo describe "tres fuentes de verdad para escalamiento humano" como sin resolver. Verificado que **dos de las tres ya tienen una FSM real, construida en el Entregable 3.1** (`contexts/communication/`): `escalate-conversation.usecase.js` guarda `Conversation.status` con una transición validada (`ConversationAlreadyEscalatedError` si ya estaba escalada) y `resolve-conversation-escalation.usecase.js` la revierte con su propio guard (`ConversationNotEscalatedError` si no lo estaba). Esto ya es una FSM de dos estados con transiciones validadas — el informe la pasó por alto porque vive fuera del motor conversacional legado, en el contexto Comunicación. Lo que sigue sin resolver es más angosto de lo que D-E2 sugiere: la señal que *dispara* esa transición (`process-incoming-message.usecase.js:53`, `result.session.requires_human_attention === true`) sigue leyendo el flag legado de sesión en vez de una fuente ya validada.

**Hallazgo que cambia el diseño de D-E1:** el wizard de reserva no es una máquina de estados lineal como la de Sancho (sesión: `active`/`paused`/`closed`/`handoff`). Es intencionalmente interrumpible desde cualquier paso — un cliente puede escribir "cancelar" o "hablar con alguien" a mitad del flujo de agendamiento y el wizard debe resetear a `null` o saltar a `human_takeover` sin importar en qué paso estaba. Una tabla estricta de transiciones `from → to` (patrón de `session_transitions.py`) prohibiría ese reset legítimo salvo que se enumeren explícitamente docenas de aristas "cualquier paso → reset", lo cual no es una tabla de transiciones — es, en la práctica, una lista blanca de valores. **El diseño correcto para este wizard es un vocabulario cerrado con validación de pertenencia, no una tabla de transiciones desde/hacia.**

### 1.2 Definición funcional (alcance reconciliado)

| Ítem | Alcance |
|---|---|
| D-E1 | Vocabulario cerrado: `session.step` solo puede ser `null` o un valor de `STEPS` (ampliado para incluir `HUMAN_TAKEOVER`). Una escritura fuera de ese conjunto se registra como error explícito, en vez de fallar en silencio en un `else` genérico. |
| D-E2 (parcial) | La señal de escalamiento en `process-incoming-message.usecase.js` deja de depender solo de `session.requires_human_attention` — se refuerza para considerar también `step === STEPS.HUMAN_TAKEOVER`, ambos ya derivados del mismo evento hoy, sin introducir una tercera fuente. Unificar del todo (eliminar `requires_human_attention`) queda fuera de alcance — toca `dashboard-conversation.service.js` y el payload que consume el dashboard, no solo el motor. |

**Fuera de alcance, diferido:** tabla estricta de transiciones (no aplica a este wizard, ver 1.1); eliminación completa de `requires_human_attention` (impacto en dashboard, entregable propio si se decide).

### 1.3 Arquitectura técnica

- `backend/src/services/session-steps.service.js` (nuevo) — función pura `isValidStep(step)` (pertenece a `Object.values(STEPS)` o es `null`) y `assertValidStep(step, context)` (loguea `console.error` con contexto si no — **no lanza**: dado que no existe cobertura exhaustiva de cada camino del wizard, bloquear en duro arriesga romper un flujo legítimo no identificado en esta auditoría; el objetivo de D-E1 es visibilidad de diagnóstico, que es el daño concreto que describe el informe — "difíciles de diagnosticar" — no rechazo).
- `conversation.service.js` — `STEPS` gana `HUMAN_TAKEOVER: "human_takeover"`; la línea 305 pasa a usar `STEPS.HUMAN_TAKEOVER` en vez del string literal.
- `memory.service.js` — único choke point de escritura de sesión (`updateSession`): invoca `assertValidStep(data.step, { phone })` antes de fusionar, sin cambiar su comportamiento de fusión.
- `process-incoming-message.usecase.js` (`contexts/receptionist`, no motor legado) — `buildDecisionFields` amplía `escalated` a `result?.session?.requires_human_attention === true || result?.session?.step === STEPS.HUMAN_TAKEOVER`. Requiere exportar `STEPS` desde `conversation.service.js` hasta este caso de uso (ya se importa `generateReply`/`getConfirmationReply`/etc. desde ahí en otros puntos del wiring — mismo patrón).

### 1.4 Modelo de persistencia / 1.5 Esquema físico

Ninguno — sin cambios de schema.

## 2. Decisión del Gate

**Pendiente.** El alcance de D-E1 y D-E2 se redujo respecto a lo que describía el informe externo, con evidencia concreta (auditoría 1.1) de por qué una tabla estricta de transiciones no encaja con el diseño intencional del wizard y de que D-E2 ya estaba parcialmente resuelto desde 3.1. Requiere confirmación de que este alcance reconciliado es el correcto antes de implementar.
