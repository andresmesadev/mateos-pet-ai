# Entregable 3.1 — Comunicación

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 5 congelada.
**Contexto de dominio que cubre:** Comunicación

---

## Etapa 5 — Esquema Físico

### 1. Tabla nueva

**`Channel`**:
```
id       String   @id @default(cuid())
tenantId String?                                  // null = canal global/compartido (estado actual)
tenant   Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)
type     String                                   // "whatsapp" | "email" | "sms" — tipo de canal, no proveedor
active   Boolean  @default(true)
createdAt DateTime @default(now())

conversations Conversation[]

@@unique([tenantId, type])
```

**Nota de implementación (congelada en la aprobación de esta etapa):** el índice `@@unique([tenantId, type])` **no protege el caso `tenantId = NULL`** — en PostgreSQL, los `NULL` no colisionan entre sí en un índice único, por lo que dos filas con `tenantId: null` y el mismo `type` podrían coexistir sin que esta restricción lo impida. La implementación deberá añadir la restricción física necesaria (índice único parcial, `WHERE "tenantId" IS NULL`) para garantizar que exista un único canal global por tipo cuando `tenantId` sea nulo — mismo patrón ya usado en el proyecto para las invariantes de `Commission`/`Transaction` activas (Entregable Puente, ADR 009).

### 2. Cambios en tablas existentes (evolución, Decisión 1 — sin tablas nuevas para estos conceptos)

**`Conversation`** gana:
```
status    String   @default("activa")   // "activa" | "esperando_humano" | "cerrada"
channelId String?
channel   Channel? @relation(fields: [channelId], references: [id], onDelete: SetNull)
```

**`Message`** gana:
```
origin String @default("cliente")   // "cliente" | "agente" | "sistema"
```

### 3. Nota de alcance sobre `status`

`status` admite tres valores porque así lo define el Modelo de Dominio, pero este entregable solo tiene casos de uso para dos transiciones: `activa → esperando_humano` (caso 4) y `esperando_humano → activa` (caso 5). No existe caso de uso que transicione a `"cerrada"` — el mecanismo actual de cierre implícito (`step === "completed"`) sigue operando sin tocarse. `"cerrada"` queda reservado para un futuro caso de uso.

### 4. Plan de migración

- **`Channel`**: `CREATE TABLE` nueva, vacía — sin backfill. Incluye el índice único parcial de la Nota de implementación.
- **`Message.origin`**: se añade con backfill determinista desde `role` (`"user"` → `"cliente"`, `"assistant"` → `"agente"`; ninguna fila histórica pudo ser `"sistema"`, porque las notificaciones nunca se persistieron). Secuencia: columna nullable → backfill → `SET NOT NULL DEFAULT 'cliente'`.
- **`Conversation.status`**: se añade con `DEFAULT 'activa'` (sin backfill manual necesario para el default); backfill dirigido adicional: toda fila con `sessionData.requires_human_attention = true` pasa explícitamente a `"esperando_humano"`. `sessionData` no se modifica ni se elimina.
- **`Conversation.channelId`**: se añade nullable; se siembra el único `Channel` (`type: "whatsapp"`, `tenantId: null`, `active: true`) mediante script idempotente (mismo patrón que `seed-event-types.js`); backfill asigna ese `Channel.id` a toda `Conversation` existente. El volumen real se confirma en la Validación Técnica.

### 5. Índices — mapeados contra los casos de uso de la Etapa 2

| Índice | Caso de uso que resuelve |
|---|---|
| `Channel`: `[tenantId, type] @unique` + parcial `WHERE tenantId IS NULL` (ver Nota de implementación) | 1/2 — invariante "un canal por tipo por tenant" (y global); 6 — Consultar Canales |
| Índices ya existentes en `Conversation`/`Message` (`[tenantId, updatedAt]`, `[userId]`, `[conversationId]`) | 7/8 — el historial "por cliente" ya resuelve vía `Conversation.userId` |

Sin índices nuevos especulativos.

### 6. Sin preguntas abiertas adicionales

Las Decisiones Diferidas no requieren cambios de tabla para resolverse después.
