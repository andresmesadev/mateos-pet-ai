# Entregable 3.3 — Automatizaciones

**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio:** `docs/architecture/domain-model-v1.md`, §8 — Automatizaciones.

---

## Etapa 1 — Definición Funcional

### Auditoría del código real (resumen ejecutivo)

- **No existe ningún componente de Automatizaciones hoy.** Grep exhaustivo de `automation|Automatizaci|Regla|Disparador` sobre `backend/src` no arroja ningún resultado relacionado con el dominio de este entregable.
- **Lo que 3.0 (Eventos) habilitó y queda disponible sin modificarse:**
  - El Catálogo de Tipos de Evento (`EventType`) y los Eventos de Dominio certificados (`DomainEvent`) — hoy solo existe **un** Tipo de Evento certificado: `"CitaCompletada"` (sembrado por `scripts/seed-event-types.js`).
  - El mecanismo de **Entrega de Evento** (`EventDelivery`, `registerEventDelivery`/`retryEventDelivery`) fue construido en 3.0 explícitamente **para un consumidor futuro** — verificado que **tiene cero invocadores en todo el repositorio** hasta hoy. Automatizaciones es ese consumidor.
- **Lo que 3.1 (Comunicación) habilita y se reutiliza sin modificarse:** `Enviar Mensaje` (`communication.sendMessage`), único punto de envío saliente del sistema. Su contrato exige `userId` y `phone` explícitos — no los resuelve por sí mismo a partir de otro identificador.
- **Lo que 3.2 (Empleados Digitales) habilita y se reutiliza sin modificarse:** `Iniciar Tarea` (`agents.startAgentTask`), que solo exige `digitalEmployeeId` y `origin` — no depende de datos del cliente.
- **Restricción real detectada:** el payload de `CitaCompletada` (frozen, ADR 007) contiene `tenantId, appointmentId, staffId?, serviceId?, serviceType?, resolvedPrice, priceSource, completedAt` — **no incluye `userId` ni `phone`**. Esto significa que, con el único disparador certificado hoy, una regla de acción `enviar_mensaje` no tiene los datos necesarios para ejecutarse; sí los tiene una regla de acción `asignar_tarea_empleado`. Esto no es una limitación del diseño de Automatizaciones — es una limitación de los disparadores certificados existentes, y se documenta como tal (ver Etapa 3, Decisión 3).
- **El bus de eventos del Puente** (`DomainEventDispatcher`, `contexts/index.js`) es síncrono y corre **dentro de la misma transacción** del comando `Completar Cita`. Ningún reactivo actual hace llamadas externas (HTTP); Automatizaciones sería el primero en potencialmente hacerlo (acción `enviar_mensaje` invoca un proveedor de canal externo). Ver Etapa 3, Decisión 4, para el tratamiento de este riesgo.

### Problema que resuelve

Hoy, cada reacción a un evento del negocio (comisión, cobro) está *programada a mano* en `contexts/index.js` por un desarrollador. El negocio no puede definir por sí mismo "cuando pase X, si se cumple Y, hazme Z" sin una nueva línea de código. Automatizaciones es la capa que traduce esa necesidad en configuración de datos, no en código.

### Decisiones de alcance (Etapa 1)

1. **Regla de Automatización es tenant-scoped** (`tenantId` opcional) — mismo patrón que `Channel` y `DigitalEmployee`: configuración propia del negocio, no vocabulario global.
2. **Plantilla de Automatización es un catálogo global** (sin `tenantId`) — mismo patrón que `EventType`: una combinación predefinida disparador+condición+acción que cualquier negocio puede activar. Activar una plantilla crea una Regla propia del tenant con esos valores por defecto, editable después; la Plantilla no se modifica ni se vincula de forma viva a la Regla creada (solo trazabilidad opcional).
3. **Condición como predicado plano, no motor de reglas genérico.** La Condición es `null` (siempre aplica) o un objeto JSON de igualdad plana contra el payload del evento (`{ "priceSource": "manual_override" }`). Se descarta deliberadamente cualquier lenguaje de expresiones o ejecución de código arbitrario — decisión de seguridad y de simplicidad, coherente con "permitir que el negocio configure sin programar".
4. **Acción como tipo cerrado, no plugin abierto.** En este entregable, `actionType` admite exactamente dos valores, ambos ya construidos por entregables previos: `"enviar_mensaje"` (Comunicación) y `"asignar_tarea_empleado"` (Empleados Digitales). `"Generar reporte"` (mencionado en el Modelo de Dominio) queda diferido — no existe hoy ningún caso de uso de generación de reportes bajo demanda que Automatizaciones pueda invocar.
5. **"Canal" no es un campo propio de la Regla.** El Modelo de Dominio describe un cuarto componente ("canal, por dónde se ejecuta la acción"), pero Comunicación ya resuelve el canal activo del tenant automáticamente (`findActiveDefault`, Decisión Diferida 2 de 3.1, aún no resuelta — sigue habiendo un único canal por tenant). Añadir un campo `channelId` redundante e inutilizado hoy se descarta; si 3.1 resuelve routing multi-canal, este campo se incorporará entonces (Reconciliación, no ahora).
6. **Automatizaciones es el consumidor real de `EventDelivery`.** Cada vez que evalúa las Reglas para un Evento de Dominio certificado, registra su propia Entrega de Evento (`consumer: "Automatizaciones"`) — resuelve la Decisión Diferida dejada abierta por 3.0.

## Etapa 2 — Casos de Uso

| # | Caso de uso | Actor | Tipo |
|---|---|---|---|
| 1 | Registrar Regla de Automatización | Negocio (Administración) | Administración |
| 2 | Activar / Desactivar Regla de Automatización | Negocio (Administración) | Administración |
| 3 | Registrar Plantilla de Automatización | Sistema (seed/interno) | Administración |
| 4 | Activar Plantilla (crear Regla desde Plantilla) | Negocio (Administración) | Administración |
| 5 | Evaluar y Ejecutar Reglas ante un Evento de Dominio | Sistema (reactivo) | Operación (reactivo, sin invocador HTTP) |
| 6 | Consultar Reglas de Automatización | Negocio (Consulta) | Consulta |
| 7 | Consultar Catálogo de Plantillas | Negocio (Consulta) | Consulta |
| 8 | Consultar Historial de Ejecuciones de una Regla | Negocio (Consulta) | Consulta |

### Detalle de los casos no obvios

**Caso 5 — Evaluar y Ejecutar Reglas ante un Evento de Dominio.** Es el corazón del contexto. Se dispara como reactivo del `DomainEventDispatcher` del Puente (mismo mecanismo que usan Staff y Finanzas para `CitaCompletada`), recibe el Evento de Dominio ya certificado (Etapa 3, Decisión 2, describe cómo obtiene su id). Por cada Regla activa cuyo disparador coincide con el Tipo de Evento:
1. Evalúa la Condición contra el payload (igualdad plana). Si no aplica, no genera Ejecución.
2. Si aplica, ejecuta la Acción invocando exclusivamente el caso de uso correspondiente de Comunicación o Empleados Digitales.
3. Registra un Historial de Ejecución (`AutomationExecution`) con el resultado — éxito o fallo — sin excepción, incluso si la acción falla.
4. **Invariante crítica de aislamiento (Etapa 3, Decisión 4): ningún fallo de una Regla individual puede propagarse ni afectar a otras Reglas ni al comando que originó el Evento.** El fallo de una acción se captura, se registra como Ejecución fallida (`AcciónFallida`), y la evaluación continúa con la siguiente Regla.
5. Al terminar de evaluar todas las Reglas para ese Evento (con independencia de cuántas aplicaron o fallaron), registra exactamente una Entrega de Evento (`EventDelivery`) para el consumidor `"Automatizaciones"` — `"delivered"` si el propio motor de evaluación no colapsó, `"failed"` en el caso excepcional de que sí lo haya hecho (p. ej. fallo de la consulta de Reglas).

**Caso 2 — Activar/Desactivar.** Simétrico, sin transición inválida bloqueada (una Regla inactiva simplemente no se evalúa en el Caso 5) — no hay estados intermedios ni bloqueo de reactivación repetida (a diferencia de Empleado Digital, aquí no hay una razón de negocio para rechazar "activar una regla ya activa"; es idempotente por diseño, decisión explícita para simplificar la Administración).

**Caso 4 — Activar Plantilla.** Crea una `AutomationRule` nueva copiando `triggerEventTypeId`, `defaultCondition`, `defaultActionType`, `defaultActionConfig` de la Plantilla, con `templateId` como referencia de trazabilidad. La Regla creada es independiente desde su creación — editarla no modifica ni depende de la Plantilla.

## Mapa conceptual (dependencias con contextos existentes)

```
Eventos (3.0)                Automatizaciones (3.3)              Comunicación (3.1) / Empleados Digitales (3.2)
─────────────                ──────────────────────              ───────────────────────────────────────────
EventType (catálogo) ───────▶ AutomationRule.triggerEventTypeId
DomainEvent (certificado) ──▶ dispara Caso 5 (vía dispatcher)
                              AutomationRule (condición+acción) ─▶ invoca sendMessage / startAgentTask
                              AutomationExecution (auditoría)
EventDelivery ◀────────────── registra consumer="Automatizaciones"
```

## Decisiones diferidas hacia la implementación

1. **Ejecución de acciones fuera de la transacción de origen (colas/reintentos asíncronos).** Este entregable ejecuta las acciones de forma síncrona, dentro de la misma transacción del comando disparador (mismo patrón que Staff/Finanzas), con aislamiento estricto de fallos (Etapa 3, Decisión 4). Un modelo de ejecución asíncrono/desacoplado queda diferido — no hay volumen ni necesidad actual que lo justifique.
2. **Routing multi-canal por Regla.** Diferido a que 3.1 resuelva credenciales/canales múltiples por tenant.
3. **Acción "generar reporte".** Diferida — no existe hoy ningún caso de uso de reporte bajo demanda que invocar.
4. **Reintentos automáticos de Acciones fallidas.** El mecanismo `retryEventDelivery` de 3.0 existe y ahora tiene un consumidor real (Automatizaciones registra su propia entrega), pero el reintento de una *acción* fallida (no de la entrega del evento en sí) queda como operación manual futura, no automatizada en este entregable.

Ninguna decisión diferida bloquea la implementación.
