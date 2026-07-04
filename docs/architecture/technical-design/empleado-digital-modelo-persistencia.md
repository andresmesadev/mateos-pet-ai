# Entregable 3.2 — Empleado Digital

**Fecha:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 4 congelada.
**Contexto de dominio que cubre:** Empleados Digitales

---

## Etapa 4 — Modelo de Persistencia

### Entidades (cuatro raíces de agregado, tamaño uno — mismo criterio que Finanzas 2.3: sin Aggregate Root compartido porque el dominio no lo exige)

**`Empleado Digital`**: identidad, `tenantId` opcional (Decisión de Etapa 1), especialización (`"recepcionista" | "coordinador_agenda" | "asistente_grooming" | "asistente_recuperacion" | "asistente_financiero" | "asistente_administrativo" | "asistente_clinico"` — mismo catálogo del roadmap de la Fase 3), estado (`"activo" | "pausado"`), y sus Límites de Autonomía (colección de pares acción/autoAprobado, ver abajo).

**`Límite de Autonomía`**: no es una raíz propia — es una colección de valor sobre el Empleado Digital (acción + autoAprobado). Vive físicamente como su propia tabla (Etapa 5) por cardinalidad N, pero conceptualmente pertenece al Empleado Digital, no es referenciada desde ningún otro lado.

**`Tarea del Agente`**: identidad, referencia al Empleado Digital, origen (canal/evento que la generó — texto libre, mismo patrón que `DomainEvent.origin`), estado (`"en_proceso" | "completada" | "escalada"`), resultado — **`Json`, resuelto en Etapa 3**: es el dato propio de la tarea (no un snapshot de otra entidad), su forma varía según qué hizo el agente, análogo a `DomainEvent.payload`.

**`Decisión del Agente`**: identidad, referencia obligatoria a la Tarea (Decisión de Etapa 1), input recibido, razonamiento, acción tomada — los tres como texto/Json libre, nunca interpretados por este contexto (mismo principio que Eventos con su Payload).

**`Escalación`**: identidad, referencia a la Tarea, referencia opcional a `Staff` (**resuelto en Etapa 3**: opcional al crear, asignable después vía el caso de uso 9 — Decisión Diferida 2 de la Etapa 2), contexto completo (Json — snapshot de lo que el humano necesita ver), estado (`"pendiente" | "atendida"`).

### Invariantes traducidas

- Una Tarea solo puede iniciarse si el Empleado Digital está `"activo"` — validación de aplicación.
- Toda Decisión exige una Tarea no completada — validación de aplicación.
- Una Escalación siempre referencia una Tarea válida; el Staff asignado, si existe, debe pertenecer al mismo tenant que el Empleado Digital (validación de aplicación, no restricción física — mismo criterio ya usado en el proyecto para relaciones cross-referencia dentro del Dominio Operativo).

### Decisiones diferidas confirmadas, sin cambios

Las tres de la Etapa 2 (integración con Comunicación, asignación automática de Escalación, mapeo del monolito a 3.4).

## Sin preguntas abiertas para la Etapa 5

Solo resta expresar físicamente las cuatro tablas y sus índices de consulta (casos 10-13).
