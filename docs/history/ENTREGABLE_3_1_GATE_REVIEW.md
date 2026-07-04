# Gate Review — Entregable 3.1: Comunicación

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Propósito:** verificar la coherencia entre las cinco etapas de diseño ya aprobadas antes de escribir una sola línea de código, y declarar formalmente congelado el diseño del Entregable 3.1 — mismo protocolo aplicado en los Gate Reviews de 2.1, 2.2, 2.3 y 3.0.

---

## 1. Documentos que este Gate Review verifica

| Etapa | Documento |
|---|---|
| 1 — Definición Funcional | `docs/architecture/use-cases/comunicacion.md` |
| 2 — Casos de Uso | `docs/architecture/use-cases/comunicacion.md` |
| 3 — Arquitectura Técnica | `docs/architecture/technical-design/comunicacion.md` |
| 4 — Modelo de Persistencia | `docs/architecture/technical-design/comunicacion-modelo-persistencia.md` |
| 5 — Esquema Físico | `docs/architecture/technical-design/comunicacion-esquema-fisico.md` |

Todas fueron aprobadas explícitamente por el responsable del proyecto, con ajustes incorporados en cada etapa antes de su congelamiento.

## 2. Verificación de coherencia entre etapas

**Auditoría del código real, primero.** A diferencia de una definición funcional construida sobre supuestos, la Etapa 1 partió de una verificación exhaustiva del código existente (`whatsapp.service.js`, `whatsapp-api.service.js`, `reminder.service.js`, `escalation.service.js`, `conversation-persistence.service.js`, y el esquema físico real de `Conversation`/`Message`) — mismo criterio que evitó sobre-diseño en 2.2 y evitó la Reconciliación Arquitectónica del ADR 005 si se hubiera aplicado a tiempo en 2.3.

**Entidades — consistentes de punta a punta.** `Canal` (nueva), `Conversation` y `Message` (evolucionadas, nunca duplicadas) aparecen sin variación desde la Etapa 1 hasta la Etapa 5: la Definición Funcional identifica el vacío, los Casos de Uso operan exclusivamente sobre ellas, la Arquitectura Técnica les asigna puertos, el Modelo de Persistencia las traduce y el Esquema Físico las materializa — ninguna entidad nueva aparece ni desaparece entre etapas.

**Decisiones de alcance congeladas en la Etapa 1 — respetadas en las cuatro etapas siguientes sin excepción:**
- Decisión 1 (convivencia, sin duplicar entidades) → Etapa 4 lo confirma explícitamente ("evoluciona, sin tabla nueva") para `Conversation` y `Message`.
- Decisión 2 (preparado para multi-canal/multi-tenant, migración de credenciales diferida) → Etapa 4 diseña `Channel.tenantId` opcional exactamente con ese propósito; Etapa 3 confirma que las credenciales siguen en el entorno.
- Decisión 3 (migración obligatoria de `reminder.service.js`, sin llamadas directas a `sendWhatsAppMessage` fuera de Comunicación) → Etapa 3 la traduce en un criterio de cierre verificable por grep, y enumera los 6 puntos de llamada exactos a migrar.
- Decisión 4 (`Plantilla de Mensaje` fuera de alcance) → registrada como Decisión Diferida en las Etapas 2, 4 y 5, sin ninguna entidad ni campo que la contradiga.

**Regla transversal del caso de uso 3 — trazable hasta su expresión física.** *"Todo mensaje saliente... deberá invocar exclusivamente el caso de uso Enviar Mensaje"* (Etapa 2) → se traduce en la Etapa 3 como el `ChannelProviderPort`, protegido explícitamente por la precisión *"la selección del proveedor concreto es responsabilidad exclusiva de la infraestructura"* → la Etapa 5 no expone ningún campo de proveedor en el esquema físico (`Channel.type` es dominio; el proveedor no tiene columna) — coherente de punta a punta.

**Invariantes — trazables desde su origen hasta su expresión física:**
- `channelId` en `Conversation`, no en `Message` (Etapa 4, justificado explícitamente) → Etapa 5 lo materializa exactamente así, sin que ninguna etapa posterior lo contradiga.
- `origin` aditivo en `Message`, sin tocar `role` (Etapa 4) → Etapa 5 confirma el backfill determinista sin ambigüedad (ningún registro histórico pudo ser `"sistema"`).
- `status` con tres valores pero solo dos transiciones con caso de uso (Etapa 4, nota de alcance) → Etapa 5 repite la misma nota sin contradicción, dejando `"cerrada"` reservado.

**Ajustes de aprobación — todos incorporados en el documento final, ninguno perdido:**
- La reformulación de "tipo de proveedor técnico" a "tipo de canal" en `Canal` (Etapa 4) se refleja en las Etapas 4 y 5 sin residuo del lenguaje anterior.
- La nota de implementación sobre la unicidad `[tenantId, type]` y el `NULL` (Etapa 5) queda registrada explícitamente como precondición de la Validación Técnica — no contradice ninguna decisión previa, la refuerza.

**Límites de contexto — verificados contra el mapa vigente.** Comunicación no conoce la lógica interna de Agenda, Finanzas, Staff, Servicios ni Eventos; no se superpone con Eventos (comunicación interna entre contextos vs. comunicación externa hacia canales, distinción ya establecida en el propio §12 del Modelo de Dominio). La Escalación de Empleados Digitales (§9) permanece fuera de este entregable — Comunicación solo gestiona el estado de la Conversación, no la entidad Escalación.

**Sin contradicciones con ADRs vigentes.** Ninguna decisión de este entregable modifica o tensiona los ADRs 005-009: no introduce hechos financieros, no toca `Commission`/`Transaction`, no reabre el dispatcher del Puente ni el mecanismo de certificación de Eventos (3.0) — los consume solo como precedente de patrón (índice parcial, seed idempotente), nunca como dependencia funcional obligatoria en este entregable.

## 3. Decisiones diferidas que salen de este Gate Review hacia la implementación

1. Migración de credenciales de canal desde variables de entorno a configuración por tenant.
2. Entidad `Plantilla de Mensaje`.
3. Migración del flujo de Recepción hacia el composition root de Comunicación.
4. Integración de los eventos de Comunicación con el contexto Eventos (3.0).
5. Seguimiento de estado de entrega por mensaje (pendiente/entregado/leído).

Ninguna de estas decisiones bloquea el inicio de la implementación: todas son de mecanismo o de alcance explícitamente pospuesto, no de dominio sin resolver.

## 4. Declaración de diseño congelado

Verificada la coherencia de las cinco etapas, la trazabilidad de las decisiones de alcance y de las invariantes hasta su expresión física, y la ausencia de contradicción con los ADRs vigentes y el mapa de contextos del proyecto, **el diseño del Entregable 3.1 — Comunicación queda oficialmente congelado.**

A partir de este punto, cualquier cambio de fondo sobre las entidades, invariantes o límites aquí verificados requiere una Reconciliación Arquitectónica formal — no una corrección silenciosa durante la implementación.

**Siguiente paso:** implementación (dominio → casos de uso → adaptadores de persistencia → composition root → migración de los 6 puntos de envío existentes → Validación Técnica y Funcional), en el mismo orden disciplinado usado en los Entregables 2.1, 2.2, 2.3, el Entregable Puente y el Entregable 3.0.
