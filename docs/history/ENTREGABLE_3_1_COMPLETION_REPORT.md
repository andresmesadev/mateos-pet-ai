# Cierre del Entregable 3.1 — Comunicación

**Fecha de cierre:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados (en curso)
**Estado:** ✅ Completado
**Proceso aplicado:** Regla de Ejecución (Etapa 1 = Modelo de Dominio → Casos de Uso → Arquitectura Técnica → Modelo de Persistencia → Esquema Físico → Gate Review → Implementación → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_3_1_GATE_REVIEW.md`
**Diseño de referencia (congelado, sin cambios de fondo durante la implementación):** `docs/architecture/use-cases/comunicacion.md`, `docs/architecture/technical-design/comunicacion*.md`

---

## Objetivo del entregable

Introducir el contexto **Comunicación**: aislar la lógica de canal detrás de un contrato único (`Enviar Mensaje`) y convertir todo mensaje saliente —de conversación o proactivo— en un hecho registrado y consultable. Antes de este entregable, "enviar un mensaje" era una operación dispersa en al menos ocho puntos del código, cada uno llamando directamente a la API de WhatsApp; los recordatorios y notificaciones proactivas no dejaban ningún rastro histórico.

## Resumen de implementación

Se implementó el contexto `communication` completo (dominio, casos de uso, adaptadores de persistencia, adaptador de proveedor de canal, composition root), adoptando `Conversation` y `Message` —ya físicas desde Fase 1— como sus propias entidades (sin duplicarlas), y se migraron **ocho** puntos reales de envío directo a `sendWhatsAppMessage` para que pasen exclusivamente por el caso de uso `Enviar Mensaje`.

## Cambios realizados

**Esquema y migración:**
- Tabla nueva `Channel` (tenant-scoped, `tenantId` opcional; `null` = canal global) con índice único parcial `WHERE tenantId IS NULL` (nota de implementación de la Etapa 5, ya prevista en el diseño congelado).
- `Conversation` gana `status` (`"activa" | "esperando_humano" | "cerrada"`, reemplaza `sessionData.requires_human_attention`) y `channelId`.
- `Message` gana `origin` (`"cliente" | "agente" | "sistema"`, aditivo, `role` intacto).
- Migración `prisma/migrations/20260704090000_comunicacion/` con backfill determinista (`origin` desde `role`; `status` desde el flag de escalación existente — 0 filas afectadas, la base real no tenía `Conversation`/`Message` previos).

**Contexto `backend/src/contexts/communication/`:**
- `domain/errors/` — 10 errores.
- `application/ports/` — 5 puertos (`ChannelRepositoryPort`, `ConversationRepositoryPort`, `MessageRepositoryPort`, `ChannelProviderPort`, `DomainEventPublisherPort`).
- `application/use-cases/` — 8 casos de uso de la Etapa 2.
- `infrastructure/persistence/` — 3 adaptadores Prisma, independientes del legacy (`conversation-persistence.service.js`, `escalation.service.js`).
- `infrastructure/providers/` — `WhatsAppChannelProvider` (único punto del proyecto que invoca `sendWhatsAppMessage`) + `ChannelProviderRegistry` (selección del proveedor por tipo de canal, exclusiva de la infraestructura).
- `infrastructure/events/` — publisher del contexto.
- `index.js` — composition root.

**Migración de los 8 puntos de envío directo** (2 más de los previstos originalmente — ver Hallazgos):
- `reminder.service.js` — 5 funciones (`sendReminder`, `sendVaccineReminder`, `sendDewormingReminder`, `sendGroomingReminder`, `sendFollowUp`).
- `routes/dashboard/conversations.routes.js` — `POST /conversations/:id/send` (respuesta manual del operador).
- `controllers/webhook.controller.js` / `services/whatsapp.service.js` — respuesta del bot.
- `routes/dashboard/clients.routes.js` — campaña de reactivación masiva (no listado en el inventario original de la Etapa 1).
- `services/next-action.service.js` — recordatorios de próxima acción (no listado en el inventario original de la Etapa 1).

**Retiro de legacy:** `escalation.service.js` eliminado (sin consumidores tras la migración). `conversation-persistence.service.js` **no se toca** — sigue siendo el mecanismo legítimo de persistencia de la recepción (Decisión Diferida 3).

## Validación Técnica

- `prisma validate` → válido. `prisma migrate status` → 29 migraciones, al día. `prisma migrate diff` post-aplicación → sin diferencias.
- Suite completa: **49/49 suites · 316/316 tests** en verde (13 tests nuevos: 6 unitarios de `Enviar Mensaje` en memoria, 7 de integración HTTP → caso de uso → Prisma mockeado).
- Smoke de solo lectura contra la base real (`GET /escalations`, `GET /conversations`) → 200.
- Composition root y todas las rutas tocadas verificadas por carga real del módulo, sin errores de resolución.

## Validación Funcional

- Ciclo de vida completo del Catálogo de Canales verificado en memoria: registrar → duplicado rechazado (`DuplicateChannelError`) → desactivar → desactivación repetida rechazada (`ChannelAlreadyInactiveError`).
- **Criterio de cierre verificado de forma exhaustiva y objetiva:** grep de `sendWhatsAppMessage(` sobre todo `backend/src` (excluyendo tests) fuera de `contexts/communication/infrastructure/` → **cero resultados**.
- Las 6 rutas HTTP de `conversations.routes.js` conservan su firma externa; los contratos de respuesta de `/escalations` y `/conversations/:id/send` son idénticos a los del legacy retirado.

## Hallazgos encontrados durante la implementación y su resolución

**Hallazgo 1 — Contradicción real entre el diseño congelado y el contrato existente (reportada y resuelta contigo antes de continuar).** El caso de uso `Enviar Mensaje`, tal como quedó diseñado (Etapas 2-4), resolvía la conversación exclusivamente a partir del `userId` (mecanismo de "conversación activa", pensado para notificaciones sin hilo específico). Pero `POST /conversations/:id/send` responde a una conversación **concreta** identificada por su `id` en la URL — no necesariamente la más reciente/activa del cliente. Aplicar el mecanismo de conversación activa sin más habría podido adjuntar silenciosamente la respuesta del operador a un hilo distinto del que ve en pantalla.

**Resolución (aprobada explícitamente, sin reabrir el diseño):** `Enviar Mensaje` gana `conversationId` **opcional** en su contrato de entrada. Si el productor ya conoce el hilo específico (este endpoint, y la respuesta del bot, que también pasó a proveerlo explícitamente), lo provee y el caso de uso usa exactamente esa conversación. Si no lo conoce (recordatorios, notificaciones, campañas), se omite y se reutiliza el mecanismo de conversación activa ya aprobado. No modifica ninguna entidad, invariante, responsabilidad ni decisión arquitectónica — completa el contrato de entrada para cubrir ambos escenarios que ya coexistían en el código real.

**Hallazgo 2 — Dos puntos de envío directo no detectados en el inventario original de la Etapa 1.** La auditoría inicial (Etapa 1) identificó 6 puntos de envío. Durante la Validación Técnica, un grep exhaustivo del criterio de cierre reveló dos adicionales: la campaña de reactivación masiva (`clients.routes.js`) y los recordatorios de próxima acción (`next-action.service.js`). **Resolución:** migrados con el mismo patrón (`origin: "sistema"`, sin `conversationId` explícito — mecanismo de conversación activa), sin requerir ninguna decisión de diseño nueva: el criterio de cierre ("cero referencias fuera de Comunicación") es objetivo y no admite excepciones por omisión del inventario inicial.

**Hallazgo 3 — Reordenamiento interno en `whatsapp.service.js` (implementación, no diseño).** La rama de "documento no soportado" retornaba antes de que se resolvieran `tenantId`/`user`/`conversation`, dejando esa respuesta sin la información que `Enviar Mensaje` necesita. Se reordenó la resolución para que ocurra inmediatamente después de la transcripción de audio (preservando que el texto transcrito se persista correctamente) y antes de cualquier rama con respuesta — verificado que no cambia el comportamiento de recepción de ningún tipo de mensaje.

**Hallazgo 4 — Comportamiento de borde documentado, no bloqueante.** Si `findOrCreateUser` falla transitoriamente durante la recepción, el bot ya no envía una respuesta sin registro asociado (antes: se enviaba igual, sin persistir). Es una consecuencia directa y ya aceptada de la regla transversal (`Enviar Mensaje` exige `userId`) — el sistema falla seguro (no envía un mensaje no atribuible) en vez de degradarse silenciosamente. Caso extremadamente infrecuente (requiere fallo de base de datos en la resolución del usuario).

Ninguno de los cuatro hallazgos generó una Reconciliación Arquitectónica ni un ADR nuevo.

## Estado final

El contexto Comunicación está implementado, integrado y validado. Los ocho puntos reales de envío directo del proyecto pasan exclusivamente por `Enviar Mensaje`. `escalation.service.js` fue retirado; `conversation-persistence.service.js` permanece intacto (recepción, sin cambios funcionales). Las cinco Decisiones Diferidas del diseño (credenciales por tenant, `Plantilla de Mensaje`, migración de Recepción, integración con Eventos, estado de entrega por mensaje) permanecen registradas y sin resolver — no bloquean este cierre.

## Criterio de cierre cumplido

- ✅ Todo mensaje saliente pasa exclusivamente por `Enviar Mensaje`.
- ✅ Cero referencias a `sendWhatsAppMessage` fuera de `contexts/communication/infrastructure/` (verificado por grep exhaustivo sobre todo el repositorio).
- ✅ Todos los contratos existentes preservados (rutas, formas de respuesta, comportamiento de recepción).
- ✅ Suite completa en verde (49/49 · 316/316).
