# Entregable 3.1 — Comunicación

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 4 congelada.
**Contexto de dominio que cubre:** Comunicación

---

## Etapa 4 — Modelo de Persistencia

Conceptual: qué entidades, qué relaciones, qué se persiste como dato propio vs. referencia. Sin tipos de columna, sin índices, sin SQL — eso es la Etapa 5.

### 1. Las tres entidades y su representación

**`Canal`** (raíz de agregado nueva, tamaño uno):
- Identidad propia; **tipo de canal** (dominio: "whatsapp", "email", "sms"...) — la resolución del proveedor concreto que implementa ese tipo pertenece exclusivamente a la infraestructura y no forma parte del modelo de dominio (precisión congelada en esta etapa).
- **Tenant:** a diferencia de `EventType` (catálogo global), un Canal es legítimamente propio de un tenant. `tenantId` opcional: `null` representa el canal global/compartido (estado actual); un valor concreto representará, en el futuro, un canal propio de un tenant (Decisión 2, diferida). No repite el hallazgo M1: `Canal` es configuración operativa, mismo tipo de entidad que `Service`/`Staff`, donde `tenantId` opcional ya es el patrón establecido.
- Estado activo/desactivado.

**`Conversation`** (evoluciona, Decisión 1 — sin tabla nueva):
- Gana **`status`**: `"activa" | "esperando_humano" | "cerrada"` — reemplaza exactamente el booleano `sessionData.requires_human_attention`. `step` y `sessionData` no se tocan.
- Gana **`channelId`** (referencia a `Canal`) — el canal es propiedad del hilo, no de cada mensaje individual (el Modelo de Dominio dice "el hilo de mensajes... a través de un canal").

**`Message`** (evoluciona, Decisión 1 — sin tabla nueva):
- Gana **`origin`**: `"cliente" | "agente" | "sistema"` — mapea el `role` actual (`"user"` → cliente, `"assistant"` → agente) y añade el tercer origen que hoy no existe: `"sistema"`, para las Notificaciones. `role` no se elimina ni se renombra — sigue siendo lo que la lógica del wizard ya lee; `origin` es aditivo.
- No gana un campo de "estado de entrega": un `Message` persistido siempre significa "enviado/recibido con éxito" (criterio todo-o-nada). Seguimiento más fino queda como Decisión Diferida.

### 2. Invariantes traducidas a este modelo

- **Regla transversal del caso de uso `Enviar Mensaje`:** garantía de diseño — ningún otro punto de la aplicación escribe directamente en `Message` con `origin` "agente" o "sistema"; solo el caso de uso lo hace.
- **Canal activo requerido para enviar:** validación de aplicación, no restricción física.
- **Notificación reutiliza el mecanismo de conversación activa:** un mensaje de origen "sistema" sigue exigiendo un `conversationId` — se resuelve con el mismo mecanismo de "encontrar-o-crear la conversación activa del usuario" ya existente.

### 3. `channelId` en `Conversation`, no en `Message` — por qué

Si el canal viviera en `Message`, cada mensaje de una misma conversación podría (incorrectamente) declarar un canal distinto, contradiciendo que la conversación *es* el hilo "a través de un canal". Ponerlo en `Conversation` una sola vez expresa correctamente esa relación.

### 4. Decisiones diferidas confirmadas, sin cambios

1. Migración de credenciales de canal desde variables de entorno a configuración por tenant.
2. Entidad `Plantilla de Mensaje`.
3. Migración del flujo de Recepción hacia el composition root de Comunicación.
4. Integración de los eventos de Comunicación con el contexto Eventos (3.0).
5. Seguimiento de estado de entrega por mensaje (pendiente/entregado/leído).

### 5. Sin preguntas abiertas para la Etapa 5

La Etapa 5 solo debe expresar físicamente: la tabla `Channel` nueva, los dos campos aditivos en `Conversation` (`status`, `channelId`) y el campo aditivo en `Message` (`origin`), más los índices que las consultas de la Etapa 2 (6, 7, 8) requieran.
