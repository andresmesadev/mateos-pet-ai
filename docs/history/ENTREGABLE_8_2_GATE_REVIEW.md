# Gate Review consolidado — Entregable 8.2 (Concurrencia y Durabilidad)

**Fase:** Fase 8 — Calidad del Motor Conversacional
**Estado:** 🚧 Macroetapa 1 (Diseño) — pendiente de aprobación del responsable del proyecto antes de implementar.
**Reconciliación Arquitectónica habilitante:** ADR 010 (misma autorización que 8.1 — sigue vigente para este bloque).

---

## 1. Diseño (Macroetapa 1)

### 1.1 Definición funcional

| ID | Carencia | Evidencia | Qué recupera |
|---|---|---|---|
| D-E3 | Sin exclusión mutua por conversación | `memory.service.js` — `sessions{}` es un objeto de módulo, sin lock | Dos mensajes rápidos del mismo cliente ("hola" + "quiero cita para Max") ya no corrompen la sesión ni duplican citas |
| D-F1 | Procesamiento inline sin cola durable | Todo el pipeline corre síncrono dentro del webhook, sin registro durable del trabajo pendiente | Un crash del proceso a mitad de un turno ya no pierde el mensaje del cliente para siempre |

**Hallazgo nuevo, descubierto al diseñar (no estaba en el informe externo):** el Entregable 8.1 introdujo un efecto colateral real. Antes de 8.1, un mensaje sin respuesta (crash a mitad del pipeline) podía recuperarse porque Meta reintenta el webhook y, sin deduplicación, se reprocesaba. Con D-E4 (8.1) ya en producción, un reintento de Meta cuyo `wamid` ya quedó persistido en `Message` **se descarta silenciosamente** — si el crash ocurrió después de `persistUserMessage` pero antes de responder, el cliente queda sin respuesta y sin ningún reintento futuro que lo recupere. Esto no es un defecto de 8.1 (deduplicar reintentos exitosos es correcto) — es la razón concreta por la que D-F1 deja de ser solo "deuda de escala" y pasa a cerrar una regresión real introducida por el propio 8.1.

### 1.2 Checkpoint de contradicción — realidad de despliegue vs. diseño de Sancho

**Verificado por inspección directa del VPS:** el backend corre en **un único contenedor** (`docker ps` → `mateos-pet-ai-backend-1`, una sola réplica). No hay balanceo de carga ni segunda instancia.

Esto cambia la solución correcta para D-E3. El patrón de Sancho (`pg_try_advisory_xact_lock`) resuelve la concurrencia **entre procesos/instancias distintas** — vale la pena cuando hay más de una réplica compitiendo por la misma fila. Aplicarlo aquí, hoy, exigiría además envolver todo `processSingleIncomingMessage` (que hoy hace ~15 llamadas Prisma independientes a través de varios `*.service.js`) en una única transacción Prisma, porque un lock `_xact_` se libera al hacer commit/rollback de la transacción que lo pidió — sin eso, el lock se liberaría de inmediato y no protegería nada. Envolver todo el pipeline en una transacción es el tipo de reescritura que el principio "no reescribir el motor conversacional" existe para evitar.

**Alternativa evaluada y recomendada — mutex en memoria por teléfono:** dado que hoy solo hay un proceso Node sirviendo el webhook, una cola en memoria (`Map<phone, Promise>`) que serializa el procesamiento de mensajes del mismo remitente resuelve exactamente la race condition descrita (dos mensajes rápidos del mismo cliente) sin tocar ni un servicio del motor conversacional — el lock vive enteramente en `whatsapp.service.js`, alrededor de la llamada a `processSingleIncomingMessage`. Se pierde protección si el proyecto pasa a múltiples réplicas — se documenta como Decisión Arquitectónica Diferida, no se resuelve por adelantado sin evidencia de que vaya a hacer falta.

### 1.3 Casos de uso / contrato funcional

1. **Mutex por teléfono (D-E3):** antes de invocar `processSingleIncomingMessage(parsed)`, encolar la ejecución detrás de la promesa pendiente (si la hay) para el mismo `parsed.from`. Segundo mensaje del mismo remitente espera a que el primero termine (persistencia + sesión actualizada) antes de empezar — nunca lee sesión "vieja" en paralelo. Mensajes de remitentes distintos siguen procesándose concurrentemente entre sí, sin cambio.
2. **Cola durable (D-F1):** tabla `InboundJob` — encolado idempotente por `(provider, providerEventId)` (mismo `wamid` de D-E4) dentro del propio handler del webhook, antes de devolver 200 a Meta. Un worker (mismo patrón `node-cron` ya usado por `event-delivery-retry.job.js`, 5.1) reclama jobs `received` con `FOR UPDATE SKIP LOCKED` y los procesa invocando el pipeline existente sin duplicarlo.

### 1.4 Arquitectura técnica

**D-E3 — mutex en memoria (wrapper mínimo, sin tocar el motor):**
- Nuevo módulo `backend/src/services/phone-lock.service.js`: `runExclusive(phone, fn)` — mantiene un `Map<phone, Promise>` de "cola actual" por teléfono; encadena `fn` detrás de la promesa existente; limpia la entrada del mapa cuando la cadena queda vacía (evita fuga de memoria — mismo defecto que D-M4 señalaba sobre `sessions{}`, corregido desde el diseño).
- `whatsapp.service.js` — el único punto de edición: el loop de `processIncomingMessage(body)` llama `runExclusive(parsed.from, () => processSingleIncomingMessage(parsed))` en vez de invocar directo.

**D-F1 — cola durable (nueva infraestructura, sin tocar el motor):**
- Modelo `InboundJob` (nuevo): `id`, `provider` ("whatsapp"), `providerEventId` (wamid), `payload` (Json — el `body` completo del webhook), `status` ("received"|"claimed"|"done"|"failed"), `attempts`, `lastError`, `claimedAt`, `finishedAt`, `createdAt`. Único índice compuesto `(provider, providerEventId)`.
- `webhook.controller.js` — cambia de "procesar inline y responder 200" a "encolar (transacción corta) y responder 200 inmediato". Este si es un cambio fuera de `whatsapp.service.js`, pero `webhook.controller.js` no es uno de los 5 archivos protegidos — es el controlador HTTP, ya editado sin Reconciliación en entregables previos.
- Nuevo `jobs/inbound-message.job.js` (mismo patrón que `jobs/event-delivery-retry.job.js`, 5.1): cron corto (cada 10-15s) que reclama y procesa jobs pendientes, invocando `processIncomingMessage(job.payload)` sin cambios.
- **Decisión Arquitectónica Diferida:** ¿el envío de la respuesta (`sendMessage`, hoy disparado por `webhook.controller.js` tras `processIncomingMessage`) se mueve también dentro del worker, o el worker solo hace el análisis y el envío queda en un segundo paso? Se resuelve en Etapa 3 con el detalle real del flujo, no aquí.

### 1.5 Modelo de persistencia / 1.6 Esquema físico

- `InboundJob` nueva tabla — sin relación con `Message`/`Conversation` (referencia el wamid como string suelto, igual que `Message.externalId`, para no acoplar la cola a que el mensaje haya llegado a persistirse).
- Sin cambios a ningún modelo existente.

---

## 2. Fuera de alcance de 8.2 (confirmado, sin cambios respecto al Gate Review de 8.1)

FSM de estado (D-E1/D-E2, → 8.3), gobierno de memoria semántica (D-M3), TTL de sesión (D-M4), compactación (D-M2).

## 3. Decisión del Gate

**Pendiente — requiere dos confirmaciones explícitas del responsable del proyecto antes de implementar:**
1. Aceptar el mutex en memoria (no Postgres advisory lock) como solución de D-E3, dado que hoy hay una sola instancia — con el lock de Postgres quedando como Decisión Diferida explícita para si el proyecto escala horizontalmente.
2. Aceptar D-F1 (cola durable) en este entregable, dado que ya no es solo deuda de escala sino la corrección de una regresión real introducida por 8.1 (mensajes silenciosamente perdidos si el proceso crashea después de persistir y antes de responder).
