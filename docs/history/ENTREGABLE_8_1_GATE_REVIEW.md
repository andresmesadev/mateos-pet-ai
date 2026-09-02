# Gate Review consolidado — Entregable 8.1 (Contención y Memoria Conversacional)

**Fase:** Fase 8 — Calidad del Motor Conversacional
**Estado:** 🚧 Macroetapa 1 (Diseño) — pendiente de aprobación del responsable del proyecto antes de implementar.
**Reconciliación Arquitectónica habilitante:** ADR 010 (`docs/decisions/010-reconciliacion-motor-conversacional-memoria.md`), aceptado 2026-09-02.

---

## 1. Diseño (Macroetapa 1)

### 1.1 Definición funcional

Cinco carencias reales del motor conversacional, verificadas línea por línea contra el código (no contra el informe externo):

| ID | Carencia | Evidencia | Qué trabajo humano/calidad recupera |
|---|---|---|---|
| D-E5 | Solo se procesa `messages[0]` del payload de Meta | `whatsapp.service.js:104` — tres `[0]` encadenados | Mensajes agrupados por Meta (envío rápido del cliente) dejan de perderse en silencio |
| D-E4 | Sin deduplicación de webhook | Ausencia total de `wamid`/`providerEventId` en el backend | Un reintento de Meta por timeout deja de generar citas o respuestas duplicadas |
| D-F4 | `generateReply` no genera nada sin RAG | `openai.service.js:232`, `if (!contextText) return null;` | Un cliente nuevo sin historial embebido deja de recibir solo plantillas |
| D-F2 | Sin reintentos ante error transitorio de OpenAI | `openai.service.js:139-142`, captura y retorna `null` | Un 429/503 transitorio deja de perder el turno completo del cliente |
| D-M1 | El historial de `Message` nunca se envía al LLM | `openai.service.js:117-124` y `:237-251`, solo `system`+`user` | El modelo puede resolver referencias anafóricas ("ese mismo, pero el sábado") — techo de calidad conversacional actual |

**Fuera de alcance de 8.1, explícitamente:** locks de concurrencia (D-E3), cola durable (D-F1), FSM de estado (D-E1/D-E2), gobierno de memoria semántica (D-M3), sesión sin TTL (D-M4) — quedan para 8.2/8.3, porque exigen decisiones de infraestructura propias (Postgres advisory locks, tabla de jobs) que merecen su propia Macroetapa 1.

### 1.2 Casos de uso / contrato funcional

No hay actores nuevos ni flujo de negocio nuevo — los cinco cambios son correcciones internas del pipeline existente:

1. **Procesar todos los mensajes del batch:** `parseIncomingMessage` deja de devolver un único mensaje; el llamador itera `entry[]` → `changes[]` → `messages[]` y procesa cada uno con el pipeline actual, en orden.
2. **Deduplicar por `wamid`:** antes de procesar, verificar si `message.id` ya fue registrado; si sí, responder 200 sin reprocesar (mismo criterio que Meta espera).
3. **Responder sin RAG:** `generateReply` deja de retornar `null` temprano; genera con LLM usando lo que haya (contexto semántico vacío es un caso válido, no un error).
4. **Reintentos en OpenAI:** usar `maxRetries` nativo del SDK (`openai.service.js` ya instancia el cliente centralizadamente).
5. **Historial en el prompt:** un `context-builder.service.js` nuevo lee los últimos N mensajes de `Message` (ya persistidos), aplica presupuesto de caracteres determinista, y los antepone al mensaje actual en las dos llamadas a OpenAI (`analyzeMessage`, `generateReply`).

**Regla de negocio explícita para D-M1 (evita ambigüedad al implementar):** el orden de los mensajes en el array enviado al LLM es `[...historial antiguo→reciente, mensaje actual]`; el `system` prompt se mantiene como primer elemento, sin cambios. Presupuesto: `MAX_CONTEXT_CHARS` configurable, con default conservador (a fijar en Etapa 3) para no inflar costo de tokens de golpe.

### 1.3 Arquitectura técnica

**Wrapper, no reescritura (Opción B del ADR 010):**

- `backend/src/services/context-builder.service.js` (nuevo) — función pura, sin acceso a BD: recibe `history: Message[]`, `currentMessage: string`, retorna `{ role, content }[]` listo para pasar al SDK de OpenAI. Sin dependencias de Express/Prisma dentro de la función — la lectura de `Message` ocurre en el llamador, igual que ya ocurre con `semanticContext` hoy.
- `openai.service.js` — el punto mínimo de edición: `analyzeMessage`/`generateReply` reciben un parámetro nuevo opcional `history` (array ya construido por `context-builder.service.js`), lo insertan en el array `messages:` entre el `system` prompt y el mensaje actual. Si `history` no se pasa (nadie lo llama todavía), el comportamiento es exactamente el actual — evita romper cualquier llamador no migrado en el mismo commit.
- `whatsapp.service.js` — dos puntos de edición: (a) `parseIncomingMessage` reescrita para iterar todos los mensajes (D-E5), (b) el punto donde se invoca `analyzeMessage`/`generateReply` pasa a construir `history` antes de llamar, y a verificar `wamid` antes de procesar (D-E4).

**Decisiones Arquitectónicas Diferidas (obligatorio dejarlas explícitas):**
- Mecanismo de deduplicación de webhook: ¿tabla nueva (`WebhookEvent`) o reutilizar `Message.externalId` si ya existe una columna equivalente? — a resolver en Etapa 4/5 (Modelo de Persistencia / Esquema Físico), pendiente de inspeccionar el schema actual.
- Valor exacto de `MAX_CONTEXT_CHARS` y N de mensajes — a fijar con evidencia de volumen real de conversaciones (`Message` promedio por `Conversation`), no arbitrariamente.
- Si la compactación/resumen (D-M2 del informe externo) se necesita ya en 8.1 o se difiere a 8.2 — depende del volumen real encontrado en la etapa anterior.

### 1.4 Modelo de persistencia / 1.5 Esquema físico

Pendientes de Etapa 4/5 — dependen de la decisión diferida de deduplicación (¿tabla nueva o columna existente?). Ninguna otra migración anticipada: `context-builder.service.js` no persiste nada, solo lee `Message` (ya existe).

---

## 2. Checkpoint de contradicción

Ninguno todavía — el diseño no se ha empezado a implementar. Este documento es el punto de aprobación previo, no un cierre.

## 3. Próximo paso

Con la aprobación de este diseño, la Macroetapa 2 (Implementación) arranca en el orden de menor a mayor riesgo:
1. D-E5 (iterar mensajes) — aislado, sin dependencias.
2. D-F4 (quitar `return null` sin RAG) — aislado.
3. D-F2 (reintentos OpenAI) — aislado, un parámetro del SDK.
4. D-E4 (deduplicación) — depende de la Decisión Diferida de esquema.
5. D-M1 (historial al LLM) — el de mayor impacto y mayor superficie tocada; último, con cobertura de regresión escrita antes del cambio (mismo patrón que 6.2).

## 4. Decisión del Gate

**Pendiente.** Requiere aprobación explícita del responsable del proyecto sobre este diseño antes de escribir código, incluyendo las tres Decisiones Arquitectónicas Diferidas señaladas en 1.3.
