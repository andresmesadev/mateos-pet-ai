# Entregable 3.5 — Coordinador de Agenda IA · Etapa 3: Arquitectura Técnica

**Estado:** Implementado y validado. Congelada.
**Referencia:** `docs/architecture/use-cases/coordinador-agenda-ia.md` (Etapas 1-2)

---

## 1. Estructura del contexto

`backend/src/contexts/schedule-coordinator/` — mismo layout mínimo que `receptionist` (3.4): sin capa de dominio propia (cero entidades nuevas, Etapa 1 Decisión 1).

```
schedule-coordinator/
  application/errors/
  application/ports/
  application/use-cases/
  infrastructure/engine/
  index.js
```

## 2. Puertos

- `ReminderEngineAdapterPort` — cinco métodos, uno por categoría de recordatorio ya existente en `reminder.service.js` (`sendAndMarkAppointmentReminder`, `sendAndMarkVaccineReminder`, `sendAndMarkDewormingReminder`, `sendAndMarkGroomingReminder`, `sendAndMarkFollowUp`). No se diseña un método único genérico: los cinco pares `sendX`/`markXSent` existentes tienen firmas distintas (algunos reciben `(record, user)`, otros `(appointment)`) — forzar una interfaz genérica añadiría una abstracción prematura sin beneficio real (mismo criterio de simplicidad ya aplicado en otros entregables: "tres líneas similares son mejores que una abstracción prematura").
- **Reutilizados por composición, no redefinidos:** `agents.getDigitalEmployees`, `agents.startAgentTask`, `agents.registerAgentDecision`, `agents.completeAgentTask` — mismo patrón que Recepcionista IA (3.4) y Automatizaciones (3.3).

## 3. Dependencia de otros contextos

Coordinador de Agenda IA depende, por diseño, únicamente de:
- **Empleados Digitales (3.2):** ciclo Tarea → Decisión → Completar (sin escalamiento, Etapa 1 Decisión 5).
- **El motor de recordatorios existente** (`reminder.service.js`) — no es un contexto, es infraestructura ya migrada (3.1) que se envuelve, sin modificarse, mediante `ReminderEngineAdapterPort`.

No depende de Comunicación (3.1) directamente — `reminder.service.js` ya la invoca internamente (`communication.sendMessage`), y ese contrato no cambia. No depende de Automatizaciones (3.3) ni de Eventos (3.0) — ninguna decisión de la Etapa 1 lo requiere (Decisiones Diferidas 1 y 2).

## 4. Resolución del Coordinador de Agenda IA activo

Mismo patrón exacto que `receptionist` (3.4, Etapa 3, sección 4, Decisión 1): filtrado en memoria de `agents.getDigitalEmployees({ tenantId })` por `specialization === "coordinador_agenda"`, tomando el primero activo. Si no existe ninguno, el caso de uso falla con un error propio (`ScheduleCoordinatorNotConfiguredError`) — condición operativa (falta de seed), no de negocio. Esta duplicación deliberada de una función pequeña (~5 líneas) entre `receptionist` y `schedule-coordinator` es una decisión consciente: cada contexto resuelve su propio Empleado Digital sin depender de una abstracción compartida prematura entre bounded contexts (que introduciría acoplamiento donde hoy no existe).

## 5. Integración con `reminder.job.js`

**Decisión 1 — El bucle de orquestación del job, no `reminder.service.js`, es lo que se envuelve.** `reminder.job.js` pasa de invocar directamente `sendX`/`markXSent` a invocar, por cada recordatorio candidato, el caso de uso `Procesar Recordatorio` del nuevo contexto — exactamente el mismo tipo de cambio que 3.4 aplicó a `webhook.controller.js` (cambiar el punto de invocación, no el motor).

**Decisión 2 — Sin transacción compartida.** A diferencia del Puente, no hay ninguna invariante que exija atomicidad entre "enviar recordatorio" y "registrar Decisión" — cada recordatorio es una operación independiente ya tolerante a fallos aislados (el propio `reminder.job.js` ya captura errores por ítem en un `try/catch` individual, sin abortar el resto del lote). El nuevo caso de uso preserva ese mismo aislamiento de fallos, ítem por ítem.

**Decisión 3 — Manejo de errores del propio caso de uso.** Si `startAgentTask` falla (Coordinador pausado o no configurado), el recordatorio individual se omite (no se invoca `reminder.service.js` para ese ítem) y se registra en logs — mismo criterio que el Hallazgo 3 de 3.4 (limitación aceptada, documentada, no forzada). El resto de recordatorios del lote continúa procesándose con normalidad (el fallo de resolución del Coordinador es, en la práctica, uniforme para todo el lote de una ejecución, ya que el Coordinador no cambia entre ítems de la misma corrida — se resuelve una sola vez por ejecución del job, no por ítem, para evitar N consultas idénticas).

## 6. Verificación de compatibilidad y ADRs

- Sin contradicción con ADRs 005-009.
- Sin contradicción con el Modelo de Dominio (§9): Coordinador de Agenda IA es una instancia legítima de Empleado Digital, especialización ya prevista.
- Sin cambio de comportamiento observable en `reminder.service.js`: sus funciones de construcción y envío de mensajes permanecen intactas.
- `reminder.job.js` cambia su forma de invocar el envío/marcado de cada recordatorio; su contrato externo (`startReminderJob`, `processReminders`, y el objeto de conteo que retorna) permanece idéntico — `app.js` no requiere ningún cambio.
- Sin solapamiento con Recepcionista IA (3.4): ninguna Tarea de Coordinador de Agenda IA se crea a partir de un mensaje entrante de WhatsApp; ninguna Tarea de Recepcionista IA se crea a partir del job de recordatorios.

## 7. Preguntas abiertas para la Etapa 4

Ninguna — el diseño reutiliza en su totalidad el esquema de Empleados Digitales (3.2) sin variaciones que requieran decisión adicional.
