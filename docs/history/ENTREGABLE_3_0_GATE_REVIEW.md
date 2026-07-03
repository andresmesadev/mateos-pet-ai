# Gate Review — Entregable 3.0: Infraestructura de Eventos

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Propósito:** verificar la coherencia entre las cinco etapas de diseño ya aprobadas antes de escribir una sola línea de código, y declarar formalmente congelado el diseño del Entregable 3.0 — mismo protocolo aplicado en los Gate Reviews de 2.1, 2.2 y 2.3.

---

## 1. Documentos que este Gate Review verifica

| Etapa | Documento |
|---|---|
| 1 — Modelo de Dominio | `docs/architecture/use-cases/infraestructura-de-eventos.md` |
| 2 — Casos de Uso | `docs/architecture/use-cases/infraestructura-de-eventos.md` |
| 3 — Arquitectura Técnica | `docs/architecture/technical-design/infraestructura-de-eventos.md` |
| 4 — Modelo de Persistencia | `docs/architecture/technical-design/infraestructura-de-eventos-modelo-persistencia.md` |
| 5 — Esquema Físico | `docs/architecture/technical-design/infraestructura-de-eventos-esquema-fisico.md` |

Todas fueron aprobadas explícitamente por el responsable del proyecto, con ajustes incorporados en cada etapa antes de su congelamiento.

## 2. Verificación de coherencia entre etapas

**Entidades — consistentes de punta a punta.** Las tres raíces de agregado (`Evento de Dominio`, `Entrega de Evento`, `Tipo de Evento Catalogado`) aparecen sin variación de nombre ni de responsabilidad desde la Etapa 1 hasta la Etapa 5: el Modelo de Dominio las define, los Casos de Uso operan exclusivamente sobre ellas, la Arquitectura Técnica les asigna puertos uno a uno, el Modelo de Persistencia las traduce a entidades persistidas y el Esquema Físico las materializa en tres tablas — ninguna entidad nueva aparece ni desaparece entre etapas.

**Invariantes — trazables desde su origen hasta su expresión física.** Las seis invariantes de la Etapa 1 se verifican explícitamente en las etapas siguientes:
- Invariante 1 (inmutabilidad del Evento) y 3 (inmutabilidad de la Entrega, con reintento como fila nueva) → Etapa 4 las traduce en "ningún repositorio expone actualización" → Etapa 5 lo confirma: ningún campo de `DomainEvent` ni `EventDelivery` está pensado para ser modificado tras su creación.
- Invariante 2 (solo tipos activos referenciables) → Etapa 4 la asigna a validación de aplicación → Etapa 5 no la contradice (no se propuso ninguna restricción de base de datos que la reemplace, decisión consciente y consistente).
- Invariante 4 (tenant obligatorio) → Etapa 4 la señala como ruptura deliberada del patrón legacy → Etapa 5 la materializa: `DomainEvent.tenantId String` (no `String?`).
- Invariante 5 (no interpretación del payload) → Etapa 4 fundamenta por qué el Payload no es snapshot → Etapa 5 lo persiste como `Json` sin ninguna columna relacional que lo sustituya.
- Invariante 6 (validez sin consumidores) → Etapa 4 la traduce en cardinalidad 0..N sin mínimo → Etapa 5 no impone ninguna restricción de existencia de `EventDelivery` sobre `DomainEvent`.

**Ajustes de aprobación — todos incorporados en el documento final, ninguno perdido:**
- El renombre "Registro de Entrega" → "Entrega de Evento" (Etapa 1) se refleja en el nombre de la entidad en las cinco etapas.
- La reclasificación de "Registrar Entrega" y "Reintentar Entrega" como operaciones de infraestructura, no casos de uso de negocio (Etapa 2), se refleja explícitamente en la Arquitectura Técnica (Etapa 3, sección 5): sin adaptador HTTP ni actor humano.
- La eliminación de la palabra "Outbox" como decisión declarada, y la reformulación de la integración con el dispatcher del Puente como parte del cierre transaccional (Etapa 3), se mantiene sin contradicción en las Etapas 4 y 5 — ninguna de ellas nombra ni compromete un mecanismo de entrega asíncrona específico.
- La reformulación del Payload como "representación canónica dentro de Eventos" (Etapa 4) es la formulación que efectivamente aparece en la Etapa 5.
- El estado `"pending"` de `EventDelivery`, incorporado en la aprobación de la Etapa 5, no contradice ninguna invariante de la Etapa 1: la Invariante 3 exige inmutabilidad *una vez fijado* el resultado, no prohíbe que el modelo prevea un estado transitorio para uso futuro.
- La naturaleza global (no tenant-scoped) de `EventType`, resuelta en la Etapa 5, no fue contradicha por ninguna etapa anterior: la Etapa 1 nunca afirmó que el Catálogo fuera por tenant, dejándolo abierto hasta que el Esquema Físico obligó a decidirlo.

**Límites de contexto — verificados contra el mapa vigente.** Eventos no conoce la lógica interna de ningún contexto productor (solo el contrato tipo+payload); no se superpone con Comunicación (§10, canales externos); no gestiona Automatizaciones ni decide acciones de negocio; no modela la Suscripción como entidad (decisión de composición ya precedentada en el Puente, no reabierta en ningún momento de este diseño).

**Sin contradicciones con ADRs vigentes.** Ninguna decisión de este entregable modifica o tensiona los ADRs 005–009: Eventos es aditivo sobre el dispatcher del Puente (ADR 007, Decisión 2), no lo reemplaza; no introduce ninguna regla de anulación (no la necesita, por diseño); no toca la definición del día financiero (ADR 008) ni la fuente oficial del ingreso (ADR 007, Decisión 1).

## 3. Decisiones diferidas que salen de este Gate Review hacia la implementación

1. Mecanismo exacto de entrega asíncrona (Outbox u otro) y política de reintentos/backoff.
2. Migración de los publishers existentes (Finanzas, Staff, Servicios) para certificar también sus eventos como `DomainEvent`.
3. Validación estructural del contrato de payload contra `EventType`.
4. Versionado del contrato de payload por Tipo de Evento.
5. Retención/purga histórica de `DomainEvent` y `EventDelivery`.
6. Tratamiento de Reglas de Automatización que referencien un `EventType` desactivado — traspasado como precondición de diseño al Entregable 3.3.

Ninguna de estas decisiones bloquea el inicio de la implementación: todas son de mecanismo, no de dominio, y el diseño ya construyó los puntos de extensión necesarios (el estado `"pending"` previsto, el puerto de entrega sin mecanismo comprometido).

## 4. Declaración de diseño congelado

Verificada la coherencia de las cinco etapas, la trazabilidad de las seis invariantes hasta su expresión física, y la ausencia de contradicción con los ADRs vigentes y el mapa de contextos del proyecto, **el diseño del Entregable 3.0 — Infraestructura de Eventos queda oficialmente congelado.**

A partir de este punto, cualquier cambio de fondo sobre las entidades, invariantes o límites aquí verificados requiere una Reconciliación Arquitectónica formal — no una corrección silenciosa durante la implementación.

**Siguiente paso:** implementación (dominio → casos de uso → adaptadores de persistencia → integración con el composition root del Puente → Validación Técnica y Funcional), en el mismo orden disciplinado usado en los Entregables 2.1, 2.2, 2.3 y el Entregable Puente.
