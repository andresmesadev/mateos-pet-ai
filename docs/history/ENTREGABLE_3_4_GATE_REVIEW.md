# Gate Review — Entregable 3.4: Recepcionista IA

**Fecha:** 2026-07-06
**Fase:** Fase 3 — Empleados Digitales Especializados
**Propósito:** verificar coherencia entre las cinco etapas y declarar el diseño oficialmente congelado — mismo protocolo de 2.1-2.3, Puente, 3.0, 3.1, 3.2 y 3.3.

---

## Documentos verificados

`docs/architecture/use-cases/recepcionista-ia.md` (Etapas 1-2), `docs/architecture/technical-design/recepcionista-ia.md` (Etapa 3), `recepcionista-ia-modelo-persistencia.md` (Etapa 4), `recepcionista-ia-esquema-fisico.md` (Etapa 5).

## Verificación de coherencia

- **Mapeo del monolito conversacional completado en la Etapa 1**, tal como exige el roadmap aprobado: cada componente auditado (`webhook.controller.js`, `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `services/domain/intent-detector.service.js`, `services/domain/medical-auto-capture.service.js`, `conversation-persistence.service.js`, `memory.service.js`) quedó clasificado explícitamente: qué permanece como motor interno, qué ya fue absorbido por Comunicación (solo el envío saliente), qué pertenece a Agenda/Clientes/Negocio sin cambios, y qué migra — nada migra físicamente; se envuelve.
- **Cero entidades nuevas, verificado de punta a punta:** Etapa 1 declara la decisión, Etapa 4 la confirma ("sin agregados nuevos"), Etapa 5 la confirma ("sin cambios al esquema físico") — sin desviación entre etapas.
- **Las 8 decisiones de la Etapa 1 se respetan hasta la Etapa 5 sin excepción:** especialización ya prevista en `SPECIALIZATIONS` (3.2), granularidad de Tarea por mensaje, motor conversacional envuelto sin reescribirse, Decisión Diferida 3 de 3.1 (migración de recepción) explícitamente no resuelta aquí, resolución de la Decisión Diferida 1 de 3.2 (Escalación ↔ `Conversation.status`) mediante invocación de ambos mecanismos complementarios, semántica de `DigitalEmployee.status = "pausado"` reutilizada sin cambios, Límite de Autonomía diferido, certificación de eventos propios de Empleados Digitales fuera de alcance.
- **La brecha de escalamiento (hallazgo de auditoría) tiene resolución técnica concreta y verificable en la Etapa 3** (sección 6): invocación de `communication.escalateConversation` con manejo idempotente de `ConversationAlreadyEscalatedError`, seguida de `agents.generateEscalation` — sin relanzar `completeAgentTask` en ese camino (invariante de cierre único de Tarea, ya congelada en 3.2, no reabierta).
- **Límites de contexto verificados:** `receptionist` no define entidades ni puertos hacia la lógica interna de `agents`/`communication` — invoca exclusivamente sus casos de uso ya expuestos (mismo patrón que Automatizaciones, 3.3); el motor conversacional legado es tratado como infraestructura propia de `receptionist`, no como un contexto ajeno.
- **Sin contradicción con ADRs vigentes** (005-009): ninguna decisión toca `Commission`/`Transaction`/el contrato frozen de `CitaCompletada`.
- **Sin contradicción con el Modelo de Dominio (§9):** Recepcionista IA es una instancia legítima de Empleado Digital, sin extender ni modificar la definición vigente de la entidad.
- **Sin conflicto con el roadmap de Fase 3:** la separación de responsabilidades entre Recepcionista (primer contacto/enrutamiento) y Coordinador de Agenda IA (disponibilidad/agendamiento, 3.5) queda explícitamente declarada en la Etapa 1 sin adelantar ninguna decisión de implementación de 3.5.

## Decisiones diferidas hacia la implementación

1. Migración de la persistencia de recepción a los puertos de Comunicación (Decisión Diferida 3 de 3.1) — sigue sin resolverse.
2. Aplicación de Límite de Autonomía a acciones concretas — candidata natural para 3.5.
3. Certificación de los eventos propios de Empleados Digitales en el contexto Eventos — fuera de alcance.
4. Reubicación física del motor conversacional dentro de `contexts/receptionist/infrastructure/` — refactor futuro sin impacto funcional.
5. Mapeo detallado hacia el Coordinador de Agenda IA (3.5) — pertenece a la Etapa 1 de ese entregable.

Ninguna bloquea la implementación.

## Declaración de diseño congelado

**El diseño del Entregable 3.4 — Recepcionista IA queda oficialmente congelado.** Cualquier cambio de fondo requiere Reconciliación Arquitectónica formal.

**Siguiente paso:** implementación completa (caso de uso único → adaptador del motor conversacional → composition root → wiring en `webhook.controller.js` → seed operativo) → Validación Técnica → Validación Funcional → cierre documental, en un solo flujo continuo conforme al proceso institucionalizado de la Fase 3.
