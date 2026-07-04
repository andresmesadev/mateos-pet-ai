# Entregable 3.3 — Automatizaciones · Etapa 5: Esquema Físico

**Estado:** Implementado y validado. Congelada.

---

## Modelos Prisma (a aplicar verbatim)

```prisma
model AutomationTemplate {
  id                  String   @id @default(cuid())
  name                String   @unique
  description         String?
  triggerEventTypeId  String
  triggerEventType    EventType @relation(fields: [triggerEventTypeId], references: [id], onDelete: Restrict)
  defaultCondition    Json?
  defaultActionType   String
  defaultActionConfig Json
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())

  rules AutomationRule[]

  @@index([triggerEventTypeId])
}

model AutomationRule {
  id                 String   @id @default(cuid())
  tenantId           String?
  tenant             Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  name               String
  triggerEventTypeId String
  triggerEventType   EventType @relation(fields: [triggerEventTypeId], references: [id], onDelete: Restrict)

  condition    Json?
  actionType   String
  actionConfig Json

  active    Boolean  @default(true)

  templateId String?
  template   AutomationTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  executions AutomationExecution[]

  @@index([tenantId, active])
  @@index([triggerEventTypeId, active])
}

model AutomationExecution {
  id               String   @id @default(cuid())
  automationRuleId String
  automationRule   AutomationRule @relation(fields: [automationRuleId], references: [id], onDelete: Restrict)

  domainEventId String
  domainEvent   DomainEvent @relation(fields: [domainEventId], references: [id], onDelete: Restrict)

  status        String   // "success" | "failed"
  actionResult  Json?
  failureReason String?

  createdAt DateTime @default(now())

  @@index([automationRuleId, createdAt])
  @@index([domainEventId])
}
```

**Back-relations necesarias en modelos existentes:**
- `Tenant.automationRules AutomationRule[]`
- `EventType.automationTemplates AutomationTemplate[]` y `EventType.automationRules AutomationRule[]`
- `DomainEvent.automationExecutions AutomationExecution[]`

## Mapeo índice → caso de uso

| Índice | Caso de uso servido |
|---|---|
| `AutomationRule(tenantId, active)` | Consultar Reglas de Automatización (Caso 6) |
| `AutomationRule(triggerEventTypeId, active)` | Evaluar y Ejecutar Reglas ante un Evento de Dominio (Caso 5) |
| `AutomationExecution(automationRuleId, createdAt)` | Consultar Historial de Ejecuciones de una Regla (Caso 8) |
| `AutomationExecution(domainEventId)` | Trazabilidad inversa evento → ejecuciones (auditoría) |
| `AutomationTemplate(triggerEventTypeId)` | Consultar Catálogo de Plantillas filtrado por disparador (Caso 7) |

## Plan de migración

- 3 tablas nuevas (`AutomationTemplate`, `AutomationRule`, `AutomationExecution`), todas vacías al nacer — sin backfill.
- Ninguna columna nueva en modelos existentes; solo back-relations (no requieren cambios de esquema en la base, son metadatos del cliente Prisma).
- Generar con `prisma migrate diff --from-config-datasource --to-schema` (mismo mecanismo operativo usado en 3.2, dado el drift preexistente y no relacionado ya documentado) y aplicar con `prisma migrate deploy`.

## Seed operativo (no bloqueante para el cierre del diseño)

Igual que `CitaCompletada` requirió `scripts/seed-event-types.js` en 3.0, la Plantilla de Automatización no requiere seed obligatorio para este entregable — el catálogo de Plantillas puede nacer vacío; el negocio puede registrar Reglas directamente (Caso 1) sin pasar por una Plantilla (Caso 4 es una comodidad, no un requisito).
