# Entregable 3.1 — Comunicación

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 3 congelada.
**Contexto de dominio que cubre:** Comunicación (ver `docs/architecture/use-cases/comunicacion.md`, Etapas 1-2)

---

## Etapa 3 — Arquitectura Técnica

Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, ni endpoints, ni esquema de base de datos.

### 1. Estructura del contexto

Mismo patrón de capas: `domain / application / infrastructure`, composition root propio (`contexts/communication/`). A diferencia de Eventos (entidades enteramente nuevas), este contexto **adopta** `Conversation` y `Message` — ya físicas desde Fase 1 — como sus propias entidades de dominio (Decisión 1, congelada): los servicios sueltos que hoy operan esas tablas por fuera de cualquier contexto (`conversation-persistence.service.js`, `escalation.service.js`) pasan a vivir detrás de los puertos de Comunicación.

### 2. Puertos de aplicación (interfaces, sin implementación)

- **`ChannelRepositoryPort`** — registrar/desactivar un Canal; encontrar el Canal activo por defecto de un tenant (o global); listar canales activos.
- **`MessageRepositoryPort`** — crear un Mensaje; listar mensajes de una conversación o de un cliente (historial).
- **`ConversationRepositoryPort`** — encontrar-o-crear la conversación activa de un usuario; escalar; resolver escalación; listar escaladas pendientes.
- **`ChannelProviderPort`** — el mecanismo técnico real de envío (hoy: WhatsApp Cloud API). Es el puerto que la regla transversal protege: nadie fuera de la infraestructura de Comunicación lo implementa ni lo invoca directamente.
- **`DomainEventPublisherPort`** — mismo contrato ya usado por los demás contextos.

### 3. Decisión: cómo "Enviar Mensaje" resuelve el Canal y el proveedor

`Enviar Mensaje` recibe destinatario + contenido, sin que el productor sepa nada de canales ni proveedores. Internamente: `ChannelRepositoryPort.findActiveDefault(tenantId)` resuelve qué `Canal` usar (hoy: siempre el único Canal WhatsApp existente); el `Canal` resuelto determina qué implementación de `ChannelProviderPort` invocar. Las credenciales siguen leyéndose de variables de entorno dentro del adaptador del proveedor (Decisión 2, diferida, sin tocar).

**Precisión congelada:** la selección del proveedor concreto es responsabilidad exclusiva de la infraestructura de Comunicación. Ningún caso de uso ni productor conoce o selecciona proveedores específicos — el `Canal` expone únicamente su **tipo** (dominio: "whatsapp"), nunca el proveedor técnico que lo implementa.

Todo-o-nada: si `ChannelProviderPort` falla, `Enviar Mensaje` no persiste ningún `Message`.

### 4. Migración de los productores existentes

- **`reminder.service.js`** (5 puntos): cada `buildXMessage` se mantiene intacto; solo el último paso cambia de `sendWhatsAppMessage(phone, message)` a invocar `Enviar Mensaje`.
- **`conversations.routes.js` → `POST /conversations/:id/send`**: misma migración.
- **Respuesta del bot** (`whatsapp.service.js`/`conversation.service.js`): mismo cambio.
- **`audio.service.js` / `image.service.js`**: no se tocan — descarga de medios entrantes, fuera del alcance obligatorio.
- **Criterio de cierre verificable:** un grep de `sendWhatsAppMessage` en todo `backend/src` fuera de `contexts/communication/infrastructure/` debe devolver cero resultados.

### 5. Sin integración obligatoria con el contexto Eventos (3.0)

Comunicación publica `MensajeRecibido`, `MensajeEnviado`, `ConversaciónEscalada` a través de su propio `DomainEventPublisherPort` (log-only). No se certifican como Evento de Dominio del contexto Eventos en este entregable — decisión diferida de 3.0, no adelantada aquí.

### 6. Preguntas trasladadas a la Etapa 4 (resueltas allí)

1. ¿`Message.conversationId` sigue obligatorio para una Notificación sin hilo de wizard activo?
2. ¿El estado de `Conversation` se modela como campo `status` nuevo, o se deriva de `step`/`sessionData`?
3. ¿`Channel` necesita tabla propia ya en este entregable?

### 7. Sin tensión con contextos existentes

Comunicación no conoce la lógica interna de Agenda, Finanzas, Staff, Servicios ni Eventos — solo recibe contenido ya resuelto por quien la invoca.

---

## Nota de implementación (registrada durante el cierre, sin reabrir el diseño)

**`Enviar Mensaje` acepta un `conversationId` opcional en su contrato de entrada.** Detectado como contradicción real durante la implementación (Bloque 8): `POST /conversations/:id/send` responde a una conversación **específica** identificada en la URL, no necesariamente "la conversación activa del usuario" que el mecanismo original resolvía siempre a partir del `userId`. Resolución aprobada, sin modificar ninguna entidad ni invariante:

- Si el productor ya conoce el hilo exacto al que responde (este endpoint; también la respuesta del bot, que provee el `conversationId` ya resuelto por `processIncomingMessage`), lo pasa explícitamente y el caso de uso usa exactamente esa conversación.
- Si el productor no conoce un hilo específico (recordatorios, notificaciones, campañas), omite `conversationId` y el caso de uso reutiliza el mecanismo de conversación activa por `userId` ya aprobado en la Etapa 4.

**El inventario de puntos de envío se amplió de 6 a 8 durante la Validación Técnica.** Un grep exhaustivo del criterio de cierre (cero llamadas a `sendWhatsAppMessage` fuera de `contexts/communication/infrastructure/`) reveló dos puntos no detectados en la auditoría de la Etapa 1: la campaña de reactivación masiva (`routes/dashboard/clients.routes.js`) y los recordatorios de próxima acción (`services/next-action.service.js`). Ambos migrados con el mismo patrón que `reminder.service.js` (sin `conversationId` explícito, `origin: "sistema"`) — el criterio de cierre es objetivo y no admite excepciones por omisión del inventario inicial. Detalle completo en `docs/history/ENTREGABLE_3_1_COMPLETION_REPORT.md`.
