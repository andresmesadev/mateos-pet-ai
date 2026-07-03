# Entregable 3.0 — Infraestructura de Eventos

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 4 congelada.
**Contexto de dominio que cubre:** Eventos

---

## Etapa 4 — Modelo de Persistencia

Conceptual: qué entidades, qué relaciones, qué se persiste como dato propio vs. como referencia. Sin tipos de columna, sin índices, sin SQL — eso es la Etapa 5.

### 1. Las tres entidades y su representación

**`Evento de Dominio`** (raíz de agregado, tamaño uno):
- Identidad propia.
- **Tipo** — referencia al `Tipo de Evento Catalogado` (mismo contexto; a diferencia de `StaffCapability.serviceId`, que cruza contextos deliberadamente sin integridad referencial real, aquí sí puede expresarse con integridad real).
- **Payload** — dato propio, no relación (ver sección 3).
- **Origen** — etiqueta simple del contexto productor, no una relación a nada.
- **Tenant** — obligatorio, sin excepción (Invariante 4).
- **Momento de ocurrencia** (el hecho de negocio) y **momento de certificación** (cuándo Eventos lo registró) — dos campos distintos, mismo criterio que `Commission.completedAt` vs `createdAt`.

**`Entrega de Evento`** (raíz de agregado propia, tamaño uno):
- Identidad propia.
- Referencia al `Evento de Dominio` — relación de referencia, no de composición: el Evento no exige tener entregas para ser válido (Invariante 6).
- **Consumidor** — etiqueta del contexto destinatario.
- **Resultado** — pendiente/entregado/fallido.
- Un reintento (Invariante 3) es una fila nueva, no una actualización.

**`Tipo de Evento Catalogado`** (raíz de agregado, tamaño uno — mismo patrón que `ServiceCategory`):
- Nombre canónico único.
- Contexto de origen declarado.
- Descripción del contrato de payload esperado — decisión diferida: si esto se valida estructuralmente contra cada Evento de Dominio registrado, o queda como documentación de referencia sin validación automática en este entregable.
- Estado activo/desactivado.

### 2. Invariantes traducidas a este modelo (sin mecanismo físico todavía)

- **Invariante 2** (solo tipos activos): validación de aplicación al certificar un Evento de Dominio — mismo tratamiento que `ServiceCategoryNotEnabledError` en 2.1, no necesariamente una restricción de base de datos.
- **Invariantes 1 y 3** (inmutabilidad): garantía de diseño — ningún caso de uso de este entregable actualiza un `Evento de Dominio` ni una `Entrega de Evento` ya creados. A diferencia de `Commission`/`Transaction` (que necesitaron un mecanismo de anulación, ADR 009), aquí no hace falta ninguno: un Evento de Dominio nunca se corrige a sí mismo — si el hecho de negocio fue erróneo, la corrección vive en el contexto productor.
- **Invariante 6** (validez independiente de consumidores): la relación `Evento → Entregas` es de cardinalidad 0..N sin restricción mínima.

### 3. El Payload no es un snapshot — es la representación canónica dentro de Eventos

Distinción explícita para no repetir la confusión que originó el ADR 005: el Payload **no resume datos que ya existen relacionalmente en otro lugar** (a diferencia de `DailyClose.staffBreakdown`, que sí es un resumen congelado de hechos ya persistidos en otras tablas). El Payload es la **representación canónica del hecho dentro del contexto Eventos**. Puede existir información equivalente en el contexto productor, pero Eventos nunca depende de ella ni la consulta para interpretar el evento. Se persiste como dato semiestructurado, precisamente porque su forma varía por Tipo de Evento y este contexto nunca la interpreta (Invariante 5).

### 4. Nota de consistencia (no es una decisión nueva)

`tenantId` obligatorio en `Evento de Dominio` rompe deliberadamente con el patrón heredado de `tenantId` opcional presente en buena parte del esquema legacy (el que originó el hallazgo M1 de la auditoría). Aquí no hay excepción: es la Invariante 4, ya congelada en la Etapa 1.

### 5. Decisiones diferidas (Etapa 5, no se resuelven aquí)

1. Validación estructural del contrato de payload contra el Tipo de Evento — o se deja sin validar en este entregable.
2. Mecanismo físico para que el proceso de entrega asíncrona identifique "eventos aún no entregados a tal consumidor" (mecanismo aún sin nombrar, conforme al ajuste de la Etapa 3).
3. Índices de consulta por tenant/tipo/fecha (casos 6-8 de la Etapa 2).
