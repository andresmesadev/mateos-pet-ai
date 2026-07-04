# Entregable 3.2 — Empleado Digital

**Fecha:** 2026-07-04
**Fase:** Fase 3 — Empleados Digitales Especializados
**Estado de este documento:** Implementado y validado. Etapa 5 congelada.
**Contexto de dominio que cubre:** Empleados Digitales

---

## Etapa 5 — Esquema Físico

### Tablas nuevas

```
model DigitalEmployee {
  id             String   @id @default(cuid())
  tenantId       String?
  tenant         Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  specialization String   // "recepcionista" | "coordinador_agenda" | "asistente_grooming" |
                          // "asistente_recuperacion" | "asistente_financiero" |
                          // "asistente_administrativo" | "asistente_clinico"
  status         String   @default("activo") // "activo" | "pausado"
  createdAt      DateTime @default(now())

  autonomyLimits AgentAutonomyLimit[]
  tasks          AgentTask[]

  @@index([tenantId, specialization])
}

model AgentAutonomyLimit {
  id                String          @id @default(cuid())
  digitalEmployeeId String
  digitalEmployee   DigitalEmployee @relation(fields: [digitalEmployeeId], references: [id], onDelete: Cascade)
  action            String          // p.ej. "agendar_cita", "cancelar_cita"
  autoApproved      Boolean         @default(false)

  @@unique([digitalEmployeeId, action])
}

model AgentTask {
  id                String          @id @default(cuid())
  digitalEmployeeId String
  digitalEmployee   DigitalEmployee @relation(fields: [digitalEmployeeId], references: [id], onDelete: Restrict)
  origin            String
  status            String          @default("en_proceso") // "en_proceso" | "completada" | "escalada"
  result            Json?
  createdAt         DateTime        @default(now())

  decisions   AgentDecision[]
  escalations Escalation[]

  @@index([digitalEmployeeId, status])
}

model AgentDecision {
  id          String    @id @default(cuid())
  agentTaskId String
  agentTask   AgentTask @relation(fields: [agentTaskId], references: [id], onDelete: Restrict)
  input       Json
  reasoning   String
  action      String
  createdAt   DateTime  @default(now())

  @@index([agentTaskId])
}

model Escalation {
  id              String    @id @default(cuid())
  agentTaskId     String
  agentTask       AgentTask @relation(fields: [agentTaskId], references: [id], onDelete: Restrict)
  assignedStaffId String?
  assignedStaff   Staff?    @relation(fields: [assignedStaffId], references: [id], onDelete: SetNull)
  context         Json
  status          String    @default("pendiente") // "pendiente" | "atendida"
  createdAt       DateTime  @default(now())
  resolvedAt      DateTime?

  @@index([status])
  @@index([assignedStaffId, status])
}
```

`Tenant` gana `digitalEmployees DigitalEmployee[]`; `Staff` gana `escalations Escalation[]`.

### Índices — mapeados contra los casos de uso

| Índice | Caso de uso |
|---|---|
| `DigitalEmployee[tenantId, specialization]` | 10 |
| `AgentTask[digitalEmployeeId, status]` | 11 |
| `AgentDecision[agentTaskId]` | 12 |
| `Escalation[status]`, `[assignedStaffId, status]` | 13 |

Sin índices especulativos.

### Plan de migración

4 tablas nuevas, vacías — sin backfill. `prisma migrate dev --create-only` → revisión → `prisma migrate deploy` (disciplina C3, sin excepción).

### Sin preguntas abiertas
