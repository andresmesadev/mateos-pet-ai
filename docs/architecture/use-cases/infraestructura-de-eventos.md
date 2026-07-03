# Entregable 3.0 — Infraestructura de Eventos

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio que cubre:** Eventos (nuevo — no existía en `domain-model-v1.md` antes de este entregable)

---

## Etapa 1 — Modelo de Dominio

### Objetivo del contexto y distinción crítica de límite

Dar identidad, inmutabilidad y trazabilidad de negocio al hecho de que "algo ocurrió en el dominio", de modo que cualquier contexto pueda reaccionar sin conocer la lógica interna de quien lo produjo — y de modo que esa reacción quede auditada como cualquier otro hecho oficial del Sistema Operativo (mismo estándar que `Commission` o `Transaction`).

**Dos confusiones que este Modelo de Dominio previene desde el inicio:**

1. **Eventos no es Comunicación (§10 de `domain-model-v1.md`).** Comunicación es la capa de abstracción entre el dominio y los canales externos (WhatsApp, email — hacia el cliente). Eventos es la capa de abstracción **entre los contextos del dominio entre sí** — comunicación interna, nunca hacia un canal externo.
2. **La `Entrega de Evento` de este contexto no es el "Historial de Ejecuciones" de Automatizaciones (§8).** Eventos certifica que el hecho llegó a quien debía escucharlo (responsabilidad de mensajería). Automatizaciones certifica que, dado el hecho, una Regla de negocio se activó y qué acción tomó (responsabilidad de negocio). La primera es condición necesaria de la segunda; nunca la sustituye.

### Entidades y Agregados

Ningún agregado comparte raíz artificialmente (principio ya establecido en Fase 2: *"los patrones arquitectónicos se aplican cuando el dominio los necesita"*). Tres raíces de tamaño uno, relacionadas por referencia de identidad.

**`Evento de Dominio`** (Aggregate Root) — el hecho mismo. Inmutable desde su creación.
- Identidad propia (no derivada de la entidad de negocio que lo originó).
- **Tipo de Evento** (objeto de valor, referencia al catálogo): qué clase de hecho es.
- **Payload**: los datos específicos del hecho — representación canónica del hecho *dentro del contexto Eventos*. Puede existir información equivalente en el contexto productor, pero Eventos nunca depende de ella ni la consulta para interpretar el evento.
- **Origen**: el contexto que lo produjo.
- **Tenant**: obligatorio, sin excepción (ver Invariante 4).
- **Momento de ocurrencia** (cuándo pasó el hecho de negocio, distinto de cuándo se certificó técnicamente).

**`Entrega de Evento`** (Aggregate Root propio) — certifica, para un Evento de Dominio y un consumidor determinados, si el hecho fue puesto a disposición de ese consumidor y con qué resultado. Referencia al Evento por identidad, sin exigir consistencia atómica con él.
- Identidad propia.
- Referencia al Evento de Dominio.
- **Consumidor**: quién debía procesarlo (un contexto de dominio).
- **Resultado**: éxito, fallo, pendiente (ver Invariante 3 y su nota de extensión futura).

**`Tipo de Evento Catalogado`** (Aggregate Root, dentro de un Catálogo de Eventos) — el vocabulario oficial de "cosas que le pueden pasar al negocio", necesario para que Automatizaciones (§8: *"Disparador — el evento del OS que activa la regla"*) ofrezca disparadores reales, no cadenas inventadas por cada contexto.
- Nombre canónico.
- Contrato de forma esperada del payload.
- Contexto de origen declarado.
- Estado: activo / desactivado (mismo patrón que `Service.active`).

### Objetos de Valor

- **Tipo de Evento** (referencia): nombre + versión de contrato.
- **Origen**: identificador del contexto productor.
- **Resultado de Entrega**: pendiente / entregado / fallido.

### Invariantes

1. **Un Evento de Dominio es inmutable desde su creación.** Ninguna corrección se hace editándolo; si un evento se emitió por error, el tratamiento es responsabilidad del contexto consumidor, nunca de Eventos.
2. **Un Evento de Dominio solo puede pertenecer a un Tipo de Evento activo en el Catálogo.**
3. **Un Registro de Entrega es inmutable una vez su resultado queda fijado.** Un reintento posterior a un fallo crea un nuevo Registro de Entrega, referenciando el mismo Evento — nunca reescribe el resultado anterior.
4. **Todo Evento de Dominio pertenece a un tenant, sin excepción.** Se descartó deliberadamente la posibilidad de eventos "de plataforma" sin dueño de negocio: ningún caso de uso de los entregables 3.2–3.5 lo necesita hoy; diseñar para ese caso hipotético habría violado el criterio ya aplicado en 2.2 al descartar `btree_gist` sin necesidad real.
5. **Este contexto no interpreta el contenido de ningún Payload.** Transporta y certifica entrega; no lee ni valida reglas de negocio del contenido.
6. **Un Evento de Dominio es válido por el solo hecho de haber ocurrido y nunca depende de la existencia de consumidores.** La ausencia de consumidores no invalida ni impide la creación del evento.

### Eventos de dominio que produce este propio contexto

- **`EventoDeDominioRegistrado`** — cuando un hecho nuevo queda certificado como Evento de Dominio.
- **`EntregaFallida`** — cuando una Entrega de Evento resulta en fallo (espejo del patrón ya definido para Automatizaciones, `AcciónFallida`, aplicado aquí a la capa de mensajería).

Este contexto no consume eventos de otros contextos como reacción de negocio — los recibe únicamente para cumplir su responsabilidad de certificarlos.

### Responsabilidades (y lo que NO hace)

**Hace:** certificar todo hecho de negocio como Evento de Dominio (identidad, inmutabilidad, trazabilidad); mantener el Catálogo de Eventos; constatar, para cada consumidor legítimo, si el hecho fue puesto a su disposición.

**No hace:** no interpreta el contenido de ningún evento; no decide qué debe pasar cuando ocurre un evento (exclusivo de Automatizaciones); no modela la Suscripción como entidad de dominio — es una decisión de composición ya precedentada en el Entregable Puente (`contexts/index.js`), mantenida sin reabrir.

---

## Etapa 2 — Casos de Uso

### Resolución de las preguntas abiertas de la Etapa 1

1. **¿Eventos de plataforma sin tenant?** No en este entregable — Invariante 4 en su forma estricta.
2. **¿Quién desactiva un Tipo de Evento?** Un caso de uso de **Administración, actor humano** — nunca automático; desactivar un disparador público tiene consecuencias de negocio sobre reglas ya configuradas.
3. **¿Reintentar Entrega es un caso de uso propio?** Sí, separado de "Registrar Entrega de Evento" — un reintento es una nueva `Entrega de Evento` que referencia el mismo evento y consumidor, nunca una reescritura.

### Lista completa de casos de uso

| # | Caso de uso | Responsabilidad | Actor |
|---|---|---|---|
| 1 | Registrar Tipo de Evento en el Catálogo | Administración | Humano |
| 2 | Desactivar Tipo de Evento del Catálogo | Administración | Humano |
| 3 | Registrar Evento de Dominio | Operación (reactivo) | Sistema (contexto productor) |
| 4 | Registrar Entrega de Evento | Operación de infraestructura* | Sistema (mecanismo de entrega) |
| 5 | Reintentar Entrega de Evento | Operación de infraestructura* | Sistema (mecanismo de entrega) |
| 6 | Consultar Catálogo de Eventos | Consulta | Humano y Automatizaciones |
| 7 | Consultar Eventos de Dominio (por tipo/rango/tenant) | Consulta | Humano |
| 8 | Consultar Entregas de un Evento | Consulta | Humano |

*\* Ajuste congelado en la aprobación de la Etapa 2: "Registrar Entrega de Evento" y "Reintentar Entrega de Evento" no representan objetivos propios del negocio — son operaciones disparadas por el mecanismo de entrega de la infraestructura de eventos, no casos de uso invocables por un canal ni por un operador humano.*

### Detalle de los casos no autoexplicativos

**1 — Registrar Tipo de Evento en el Catálogo.** Precondición: nombre canónico único, contexto de origen declarado. Resultado: el tipo queda `activo`.

**2 — Desactivar Tipo de Evento del Catálogo.** No afecta a los Eventos de Dominio ya ocurridos de ese tipo (hechos históricos, inmutables — Invariante 1). Qué ocurre con las Reglas de Automatización que referenciaban ese tipo queda fuera del alcance de dominio de este entregable — se traslada como precondición de diseño al Entregable 3.3.

**3 — Registrar Evento de Dominio.** Precondición (Invariante 2): el Tipo de Evento debe existir y estar activo. Postcondición: el evento queda inmutable, listo para cero, uno o varios consumidores (Invariante 6).

**4 — Registrar Entrega de Evento.** Precondición: el evento referenciado debe existir. Postcondición: el resultado, fijado en el momento de la creación de la fila, es inmutable (Invariante 3).

**5 — Reintentar Entrega de Evento.** Precondición: existe al menos una Entrega de Evento fallida para ese evento y consumidor. Resultado: una nueva Entrega de Evento, independiente de la anterior.

### Mapa conceptual del flujo central

```
Contexto productor (Agenda, Finanzas, Staff...)
        │  ocurre el hecho
        ▼
[3] Registrar Evento de Dominio ── valida contra ──▶ Catálogo de Tipos de Evento [1]/[2]
        │
        │  (sin exigir consumidores — Invariante 6)
        ▼
[4] Registrar Entrega de Evento  ──(si falla)──▶ [5] Reintentar Entrega de Evento
        │
        ▼
Consultas [6][7][8] — humano y Automatizaciones (disparadores)
```

### Regla transversal heredada

Mismo criterio "todo o nada" de 2.3: cada caso de uso completa su efecto por entero o falla con error de dominio visible — ningún registro parcial, ningún silencio.
