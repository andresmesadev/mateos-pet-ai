# Entregable 3.1 — Comunicación

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapas 1 y 2 congeladas.
**Contexto de dominio que cubre:** Comunicación (`domain-model-v1.md`, §10)

---

## Etapa 1 — Definición Funcional

### Auditoría del código real antes de diseñar

| Concepto del Modelo de Dominio (§10) | Estado real en el código, verificado antes de diseñar |
|---|---|
| **Canal** | No existe como entidad. Un solo canal físico (WhatsApp), con credenciales globales por variable de entorno (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`) en `whatsapp-api.service.js`, `audio.service.js`, `image.service.js`. |
| **Mensaje** | Existe físicamente (`Message`: `conversationId`, `role`, `content`, `createdAt`), pero solo se persiste para el hilo conversacional (webhook entrante, respuesta del bot, envío manual humano desde `POST /conversations/:id/send`). |
| **Conversación** | Existe físicamente (`Conversation`: `userId`, `intent`, `step`, `sessionData` Json), sin campo de canal — asume implícitamente WhatsApp. |
| **Notificación** | No existe en ningún nivel. `reminder.service.js` (893 líneas) llama `sendWhatsAppMessage` directamente en 5 puntos (cita, vacuna, grooming, seguimiento post-consulta, desparasitación) y nunca crea un `Message` — solo marca un booleano en la entidad origen. Un mensaje proactivo no deja rastro histórico. |
| **Plantilla de Mensaje** | No existe. Textos hardcodeados como *template literals*, dispersos entre `reminder.service.js` y `conversation.service.js`. |
| **Escalación** | Booleano (`sessionData.requires_human_attention`) sobre `Conversation`, gestionado por `escalation.service.js`. `ConversaciónEscalada` (evento que produce Comunicación según §10) corresponde exactamente a este mecanismo — es el estado de la Conversación, no la entidad `Escalación` de Empleados Digitales (§9), que es un concepto distinto fuera de este alcance. |

**Hallazgo estructural:** el sistema identifica el tenant correctamente al **recibir** (`whatsapp.service.js` resuelve el tenant por `Tenant.phone`), pero todo **envío saliente** usa las mismas credenciales globales de un único número de WhatsApp Business — asimetría real entre recepción multi-tenant y envío mono-tenant.

### Qué problema del negocio resuelve

Hoy, "enviar un mensaje" es una operación dispersa: cada servicio que necesita comunicarse con un cliente llama directamente a `sendWhatsAppMessage`, construye su propio texto inline, y solo una fracción de esos envíos queda registrada. Este entregable aísla la lógica de canal detrás de un contrato único y convierte todo mensaje saliente —de conversación o proactivo— en un hecho registrado y consultable.

### Qué cambia conceptualmente en el negocio

- **Enviar un mensaje deja de ser "llamar a la API de WhatsApp"** y pasa a ser una operación de dominio con historial garantizado, sin importar si el origen es el bot, un recordatorio automático o una respuesta manual del operador.
- **Un recordatorio deja de ser "un booleano marcado"** y pasa a ser un mensaje real, con contenido consultable.
- **Los textos siguen dispersos en el código en este entregable** (Plantilla de Mensaje queda diferida) — el cambio de este entregable es de trazabilidad y desacoplamiento de canal, no de gestión de contenido.

### Decisiones de alcance congeladas (aprobadas antes de continuar)

1. **Comunicación convive con `Conversation`/`Message`.** No se crean entidades duplicadas; las existentes evolucionan para representar el modelo del dominio.
2. **El dominio se diseña preparado para múltiples canales y credenciales por tenant; la migración desde variables de entorno queda diferida.** El proyecto sigue operando single-tenant en este entregable.
3. **La migración de `reminder.service.js` forma parte del alcance.** Todo envío de mensajes, conversacional o proactivo, pasa por el mismo contrato de Comunicación. Al finalizar, no deben quedar llamadas directas a `sendWhatsAppMessage` fuera de la infraestructura del contexto Comunicación.
4. **`Plantilla de Mensaje` no forma parte de este entregable.** La extracción de los textos hardcodeados queda registrada como Decisión Diferida.

---

## Etapa 2 — Casos de Uso

### Lista completa de casos de uso

| # | Caso de uso | Responsabilidad | Actor |
|---|---|---|---|
| 1 | Registrar Canal | Administración | Humano |
| 2 | Desactivar Canal | Administración | Humano |
| 3 | Enviar Mensaje | Operación | Sistema (bot, recordatorio) u Operador (respuesta manual) |
| 4 | Escalar Conversación | Operación (reactivo) | Sistema |
| 5 | Resolver Escalación de Conversación | Administración | Humano |
| 6 | Consultar Canales | Consulta | Humano |
| 7 | Consultar Historial de Comunicaciones de un Cliente | Consulta | Humano |
| 8 | Consultar Conversaciones Escaladas Pendientes | Consulta | Humano |

### Regla transversal del caso de uso 3 (Enviar Mensaje) — congelada

**"Todo mensaje saliente del sistema deberá invocar exclusivamente el caso de uso Enviar Mensaje. Ningún adaptador, servicio, job o productor podrá comunicarse directamente con un proveedor de canal."**

### Detalle de los casos no autoexplicativos

**1 — Registrar Canal.** Da de alta un Canal con sus capacidades declaradas. No implica migrar las credenciales reales del entorno (Decisión 2, diferida).

**2 — Desactivar Canal.** No borra, desactiva — mismo patrón que `EventType`/`ServiceCategory`.

**3 — Enviar Mensaje.** Contrato único, invocado tanto por triggers de sistema (bot, `reminder.job`) como por un operador humano. Reemplaza las 6 llamadas directas a `sendWhatsAppMessage` hoy dispersas.

**4 — Escalar Conversación.** Reemplaza el flag `requires_human_attention`. Se dispara cuando el flujo conversacional detecta que no debe continuar automáticamente. Postcondición: la Conversación pasa a "esperando humano"; produce `ConversaciónEscalada`.

**5 — Resolver Escalación de Conversación.** Reemplaza `resolveEscalation`. Actor humano. Postcondición: la conversación vuelve a "activa".

**7 — Consultar Historial de Comunicaciones de un Cliente.** Por primera vez incluye recordatorios y notificaciones.

### Mapa conceptual del flujo central

```
                    ACTOR SISTEMA                          ACTOR HUMANO
        (bot, reminder.job, futuros productores)        (operador del dashboard)
                          │                                      │
                          └──────────────┬───────────────────────┘
                                         ▼
                          [3] Enviar Mensaje (contrato único)
                                         │
                            certifica Canal activo, persiste
                                         │
                                         ▼
                    Consultas [6][7][8] — historial completo, por primera vez

  Aparte (disparador propio del flujo conversacional):
  Conversación en curso ──(detección de no-continuar)──▶ [4] Escalar Conversación
                                                                  │
                                                     [5] Resolver Escalación (humano)
```

### Decisiones Diferidas registradas

1. Migración de credenciales de canal desde variables de entorno a configuración por tenant.
2. Entidad `Plantilla de Mensaje`.
3. Migración del flujo de Recepción hacia el composition root de Comunicación — el flujo entrante actual (`whatsapp.service.js` → `conversation-persistence.service.js`) se mantiene sin cambios funcionales; solo el envío tiene migración obligatoria en este entregable.
4. Integración de los eventos que produce Comunicación (`MensajeRecibido`, `MensajeEnviado`, `ConversaciónEscalada`) con el contexto Eventos (3.0).

### Nota sobre `audio.service.js` / `image.service.js`

No requieren migración: son descarga de medios **entrantes** (recepción, no envío) — fuera del alcance obligatorio (Decisión Diferida 3).

### Nota posterior a la implementación (registrada en el cierre)

El inventario de la auditoría anterior identificó 6 puntos de envío directo. La Validación Técnica, mediante un grep exhaustivo del criterio de cierre, encontró dos adicionales no detectados aquí: la campaña de reactivación masiva (`routes/dashboard/clients.routes.js`) y los recordatorios de próxima acción (`services/next-action.service.js`) — ambos migrados con el mismo tratamiento que `reminder.service.js`. Detalle en `docs/architecture/technical-design/comunicacion.md` (sección "Nota de implementación") y en `docs/history/ENTREGABLE_3_1_COMPLETION_REPORT.md`.

`escalation.service.js`, mencionado en la auditoría como el mecanismo legacy de escalación, fue retirado durante la implementación (sin consumidores tras la migración de `conversations.routes.js` a los casos de uso 4/5/8).
