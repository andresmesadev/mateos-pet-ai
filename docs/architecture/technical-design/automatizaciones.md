# Entregable 3.3 — Automatizaciones · Etapa 3: Arquitectura Técnica

**Estado:** Implementado y validado. Congelada.
**Referencia:** `docs/architecture/use-cases/automatizaciones.md` (Etapas 1-2)

---

## 1. Estructura del contexto

`backend/src/contexts/automation/` — mismo layout que `agents`, `communication`, `events`:

```
automation/
  domain/errors/
  application/ports/
  application/use-cases/
  infrastructure/persistence/
  infrastructure/events/
  index.js
```

## 2. Puertos

- `AutomationRuleRepositoryPort` — `create`, `findById`, `activate`, `deactivate`, `list`, `listActiveByTrigger(eventTypeId)`.
- `AutomationTemplateRepositoryPort` — `create`, `findById`, `list`.
- `AutomationExecutionRepositoryPort` — `create`, `listByRule`.
- `DomainEventPublisherPort` — mismo contrato ya establecido (log-only).
- **Reutilizados por composición, no redefinidos:** `communication.sendMessage`, `agents.startAgentTask`, `events.registerEventDelivery` — Automatizaciones los consume como funciones ya ensambladas por sus propios composition roots (mismo patrón por el que `contexts/index.js` invoca `staff.recordCommissionOnAppointmentCompleted` y `finance.recordChargeOnAppointmentCompleted`). Automatizaciones **no define puertos propios** hacia estos contextos — sería duplicar una abstracción que ya existe en el nivel de integración.

## 3. Dependencia de otros contextos

**Sección explícitamente distinta de 3.0/3.1/3.2:** este es el primer entregable de Fase 3 que **sí** depende, por diseño, de otros contextos ya construidos — es precisamente su responsabilidad (Modelo de Dominio, §8: "Contextos que conoce: Todos"). La dependencia es:
- Hacia **Eventos**: lee `EventType` (para resolver `triggerEventTypeId` al registrar una Regla) y escribe `EventDelivery` (Caso 5, paso 5).
- Hacia **Comunicación** y **Empleados Digitales**: invoca sus casos de uso ya expuestos por sus composition roots, nunca su lógica interna ni sus repositorios.

Automatizaciones no expone nada que estos contextos deban conocer de vuelta — la dependencia es unidireccional, consistente con "Contextos que NO debe conocer: la lógica interna de ningún contexto. Escucha eventos y ejecuta acciones."

## 4. Integración con el dispatcher del Puente (`contexts/index.js`)

**Decisión 1 — Punto de suscripción.** Automatizaciones se suscribe al mismo `dispatcher` (in-transaction) que Staff y Finanzas, para el único disparador certificado hoy (`CitaCompletada`). Añadir un nuevo Tipo de Evento certificado en el futuro (3.4/3.5) solo exige una nueva línea de suscripción en `contexts/index.js` — el motor de evaluación de Reglas (Caso 5) es genérico respecto al nombre del evento, no está acoplado a `CitaCompletada`.

**Decisión 2 — Cómo Automatizaciones obtiene el `domainEventId` certificado.** El wrapper `dispatcherWithCertification` (3.0) certifica el Evento de Dominio *antes* de invocar `dispatcher.publish(eventName, payload, ctx)` — pero hoy no propaga el `id` resultante a los suscriptores. Se extiende **únicamente el objeto `ctx`** (ya descrito como "opaco para el dominio, solo se propaga") con el Evento certificado:

```js
async publish(eventName, payload, ctx) {
  const { domainEvent } = await events.registerDomainEvent({ ...payload... }, ctx);
  await dispatcher.publish(eventName, payload, { ...ctx, domainEvent });
}
```

Esto **no modifica la clase `DomainEventDispatcher`** (permanece intacta, tal como estableció 3.0) ni el contrato de los suscriptores existentes de Staff/Finanzas — ambos ignoran el campo nuevo de `ctx`, que nunca leen. Es un cambio aditivo, exclusivo del root de integración, sin riesgo de regresión: verificado que ni `record-commission-on-appointment-completed.usecase.js` ni `record-charge-on-appointment-completed.usecase.js` inspeccionan más contenido de `ctx` que `ctx.tx`.

**Decisión 3 — Alcance real del disparador único.** Con `CitaCompletada` como único Tipo de Evento certificado, y dado que su payload (frozen, ADR 007) no incluye `userId`/`phone`, una Regla con `actionType: "enviar_mensaje"` configurada contra este disparador fallará en tiempo de ejecución con un error de validación de la acción — capturado y registrado como Ejecución fallida (Decisión 4), nunca como error no manejado. No es un defecto del diseño de Automatizaciones: es la consecuencia documentada de un disparador cuyo contrato no incluye esos datos. `actionType: "asignar_tarea_empleado"` sí es completamente funcional contra `CitaCompletada` hoy.

**Decisión 4 — Aislamiento estricto de fallos (extiende, no contradice, la decisión de la Etapa 2 del Puente).** La decisión "si un reactivo falla, la cita no queda completada" sigue rigiendo para Staff y Finanzas (reacciones de negocio críticas). Automatizaciones es deliberadamente distinta: es una capa de efectos secundarios configurables por el negocio, no una regla de negocio central — su suscriptor al dispatcher **nunca relanza una excepción**. Cada Regla se evalúa y ejecuta dentro de su propio `try/catch`; un fallo de acción (p. ej. el proveedor de WhatsApp no confirma el envío) se traduce en una fila `AutomationExecution` con `status: "failed"`, y la evaluación continúa. El handler como un todo solo podría fallar por un error de infraestructura al leer las Reglas mismas — caso excepcional cubierto por la Decisión 5.

**Decisión 5 — Aceptación explícita de un trade-off de transacción.** El suscriptor de Automatizaciones corre, como Staff y Finanzas, dentro de la transacción de base de datos del comando `Completar Cita` (`PrismaUnitOfWork`). A diferencia de aquellos, su acción `enviar_mensaje` puede implicar una llamada HTTP externa (proveedor de WhatsApp, vía Comunicación), lo que mantiene la transacción abierta durante esa latencia. Se acepta este trade-off para este entregable por dos razones: (a) mantiene el modelo de ejecución uniforme con el resto de reactivos del Puente, sin introducir una segunda vía de disparo; (b) el volumen actual del sistema (un tenant real, bajo tráfico) hace el riesgo de contención de locks despreciable. Un modelo de ejecución desacoplado de la transacción de origen queda como Decisión Diferida 1 (Etapa 1) para cuando el volumen lo justifique.

## 5. Verificación de compatibilidad y ADRs

- Sin contradicción con ADRs 005-009: ninguno de sus componentes toca `Commission`/`Transaction`/el contrato de `CitaCompletada`.
- Sin contradicción con el Modelo de Dominio (§8): entidades, responsabilidades y eventos producidos (`AcciónEjecutada`, `AcciónFallida`) coinciden con la definición vigente.
- Sin cambio de comportamiento observable para Staff/Finanzas: sus suscriptores no cambian; el único cambio es la extensión aditiva de `ctx` en el wrapper de integración.

## 6. Preguntas abiertas para la Etapa 4

1. ¿`AutomationExecution.actionResult` se modela como `Json?` (análogo a `AgentTask.result`/`DomainEvent.payload`) o se tipa por acción? → Se resuelve en Etapa 4.
2. ¿`AutomationRule.templateId` es una FK real o una referencia débil (como `Commission.staffId` vs. `StaffCapability.serviceId`)? → Se resuelve en Etapa 4.
