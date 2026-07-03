# Entregable 3.0 — Infraestructura de Eventos

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 5 congelada.
**Contexto de dominio que cubre:** Eventos

---

## Etapa 5 — Esquema Físico

### 1. Tablas nuevas (ninguna modificación a esquema existente)

**`DomainEvent`** (Evento de Dominio):
```
id            String   @id @default(cuid())
tenantId      String                              // obligatorio — Invariante 4, sin excepción
tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
eventTypeId   String
eventType     EventType @relation(fields: [eventTypeId], references: [id], onDelete: Restrict)
payload       Json                                // representación canónica del hecho dentro de Eventos — nunca interpretado aquí
origin        String                              // etiqueta del contexto productor, no FK
occurredAt    DateTime                            // momento del hecho de negocio
createdAt     DateTime @default(now())             // momento de certificación

@@index([tenantId, eventTypeId, occurredAt])       // caso de uso 7
```

**`EventDelivery`** (Entrega de Evento):
```
id            String   @id @default(cuid())
domainEventId String
domainEvent   DomainEvent @relation(fields: [domainEventId], references: [id], onDelete: Restrict)
consumer      String                              // etiqueta del contexto destinatario, no FK
status        String                              // "pending" | "delivered" | "failed"
failureReason String?
createdAt     DateTime @default(now())

@@index([domainEventId])                          // caso de uso 8
@@index([domainEventId, consumer])                 // localizar el último intento por consumidor (soporte de reintento)
```

**Nota sobre el estado `"pending"` (ajuste congelado en la aprobación de esta etapa):** el modelo conserva `"pending"` como valor válido de `status`, preparado para futuras estrategias de entrega. **En este entregable, ningún caso de uso lo persiste**: cada fila de `EventDelivery` nace ya en su estado terminal (`delivered` o `failed`), certificando un intento ya ocurrido. La ausencia de una fila sigue representando "sin intento" — no se escribe `"pending"` como sustituto de esa ausencia. Esto es consistente con que ningún repositorio de esta entidad expone una operación de actualización — mismo criterio de inmutabilidad ya aplicado a `Commission`/`Transaction`, sin necesitar aquí ningún mecanismo de anulación.

**`EventType`** (Tipo de Evento Catalogado):
```
id                         String   @id @default(cuid())
name                       String   @unique            // catálogo global — ver sección 2
originContext              String
payloadContractDescription String?                     // descriptivo, sin validación automática (decisión diferida, Etapa 4)
active                     Boolean  @default(true)
createdAt                  DateTime @default(now())
```

**`EventType` es un catálogo global del sistema y no pertenece a ningún tenant** (ajuste congelado en la aprobación de esta etapa, explicitado aquí). A diferencia de `ServiceCategory` (donde cada negocio configura sus propias categorías), un Tipo de Evento como `CitaCompletada` describe un hecho estructural del propio Sistema Operativo: significa lo mismo para todos los tenants y no es algo que cada negocio defina de forma independiente. El vocabulario de disparadores es compartido por la plataforma; lo que cada tenant configurará más adelante (Entregable 3.3) son sus propias Reglas de Automatización sobre ese vocabulario común, no el vocabulario en sí. Por eso `EventType` no tiene `tenantId` y su `name` es único globalmente.

### 2. Índices — mapeados uno a uno contra los casos de uso de la Etapa 2

| Índice | Caso de uso que resuelve |
|---|---|
| `DomainEvent`: `[tenantId, eventTypeId, occurredAt]` | 7 — Consultar Eventos de Dominio por tipo/rango/tenant |
| `EventDelivery`: `[domainEventId]` | 8 — Consultar Entregas de un Evento |
| `EventDelivery`: `[domainEventId, consumer]` | soporte físico del reintento (localizar el último intento fallido por consumidor) |
| `EventType`: `name @unique` | 6 — Consultar Catálogo; y la Invariante 2 (solo tipos activos referenciables) |

Sin índices especulativos: cada uno corresponde a una consulta ya definida en la Etapa 2.

### 3. Plan de migración

Sin backup previo necesario (tres tablas nuevas, vacías). Misma disciplina establecida desde la reconciliación del hallazgo C3: `prisma migrate dev --create-only` → revisión manual → `prisma migrate deploy` — nunca `db push`. Sin impacto sobre ninguna tabla existente; `Tenant` gana una relación nueva (`domainEvents`); `EventType` no tiene relación inversa hacia `Tenant` por ser global.

### 4. Sin preguntas abiertas adicionales

Las decisiones diferidas restantes (validación estructural del contrato de payload, mecanismo exacto de entrega asíncrona) permanecen fuera del alcance de este esquema — no requieren cambios de tabla para resolverse después.
