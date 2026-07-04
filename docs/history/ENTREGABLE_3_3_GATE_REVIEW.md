# Gate Review — Entregable 3.3: Automatizaciones

**Fecha:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados
**Propósito:** verificar coherencia entre las cinco etapas y declarar el diseño oficialmente congelado — mismo protocolo de 2.1-2.3, Puente, 3.0, 3.1 y 3.2.

---

## Documentos verificados

`docs/architecture/use-cases/automatizaciones.md` (Etapas 1-2), `docs/architecture/technical-design/automatizaciones.md` (Etapa 3), `automatizaciones-modelo-persistencia.md` (Etapa 4), `automatizaciones-esquema-fisico.md` (Etapa 5).

## Verificación de coherencia

- **Entidades consistentes de punta a punta:** `Regla de Automatización`, `Disparador` (referenciado, no entidad propia — resuelto vía FK a `EventType`), `Plantilla de Automatización`, `Historial de Ejecuciones` — sin variación entre etapas.
- **Las 6 decisiones de la Etapa 1 se respetan hasta el Esquema Físico sin excepción:** tenant-scoping de `AutomationRule` (Etapa 5, `tenantId String?`), catálogo global de `AutomationTemplate` (sin `tenantId`), Condición como predicado plano (`Json?`, sin motor de expresiones), Acción como tipo cerrado (`actionType` validado en aplicación, no en esquema), ausencia deliberada de un campo `channelId`, y el rol de Automatizaciones como consumidor real de `EventDelivery` (Caso 5, paso 5).
- **Las dos preguntas de la Etapa 3 quedaron resueltas y trazables:** `AutomationExecution.actionResult` → `Json` (Etapa 4, análogo a `AgentTask.result`/`DomainEvent.payload`); `AutomationRule.templateId` → FK real opcional (Etapa 4/5, ambas entidades viven en el mismo contexto).
- **Integración con el dispatcher del Puente verificada como aditiva y no invasiva:** la propagación del `domainEvent` certificado ocurre extendiendo `ctx` (ya descrito como opaco) dentro de `dispatcherWithCertification`, sin modificar `DomainEventDispatcher` ni los suscriptores existentes de Staff/Finanzas (Etapa 3, Decisión 2) — mismo patrón de extensión no invasiva que usó 3.0 para envolver la certificación sin abrir el dispatcher.
- **Aislamiento de fallos verificado como una extensión explícita, no una contradicción, de la decisión del Puente:** "si un reactivo falla, la cita no queda completada" sigue rigiendo para Staff/Finanzas; Automatizaciones captura sus propios fallos de acción sin relanzarlos (Etapa 3, Decisión 4) — documentado como una distinción de responsabilidad (efectos secundarios configurables vs. reglas de negocio críticas), no como una reapertura de esa decisión.
- **Trade-off de ejecución dentro de la transacción de origen, aceptado y documentado explícitamente** (Etapa 3, Decisión 5) — no bloquea el cierre; queda registrado como aceptado para el volumen actual del sistema.
- **Sin contradicción con ADRs vigentes** (005-009): ninguna decisión toca `Commission`/`Transaction`/el contrato frozen de `CitaCompletada`.
- **Sin contradicción con el Modelo de Dominio (§8):** las 3 entidades persistidas, sus responsabilidades y sus eventos (`AcciónEjecutada`, `AcciónFallida`) coinciden con la definición vigente; el "Disparador" y el "Canal" descritos en el Modelo de Dominio quedan resueltos como referencia (FK a `EventType`) y como mecanismo ya existente en Comunicación, respectivamente — sin necesidad de columnas propias.
- **Límites de contexto verificados:** Automatizaciones invoca `communication.sendMessage` y `agents.startAgentTask` exclusivamente a través de sus composition roots (mismo patrón que `contexts/index.js` ya usa para Staff/Finanzas) — sin conocer su lógica interna ni sus repositorios, consistente con "Contextos que NO debe conocer: la lógica interna de ningún contexto."

## Decisiones diferidas hacia la implementación

1. Ejecución de acciones desacoplada de la transacción de origen (colas/reintentos asíncronos) — cuando el volumen lo justifique.
2. Routing multi-canal por Regla — depende de que 3.1 resuelva credenciales/canales múltiples por tenant.
3. Acción "generar reporte" — no existe hoy un caso de uso de reporte bajo demanda que invocar.
4. Reintentos automáticos de Acciones fallidas (distinto del reintento de Entrega de Evento, ya cubierto por el mecanismo existente de 3.0).

Ninguna bloquea la implementación.

## Declaración de diseño congelado

**El diseño del Entregable 3.3 — Automatizaciones queda oficialmente congelado.** Cualquier cambio de fondo requiere Reconciliación Arquitectónica formal.

**Siguiente paso:** implementación completa (dominio → aplicación → infraestructura → composition root → integración con el dispatcher del Puente → migración) → Validación Técnica → Validación Funcional → cierre documental, en un solo flujo continuo conforme al proceso institucionalizado de la Fase 3.
