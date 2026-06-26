-- Índices de performance (B3 de la auditoría)
-- Prisma no crea índices automáticos para foreign keys ni para tenantId,
-- así que toda query por tenantId/date/status/userId hacía sequential scan.
-- Estos índices están mapeados a las queries reales de los subrouters del dashboard.

-- User: listClients (orderBy createdAt) y recovery (filtro lastReminderSentAt)
CREATE INDEX IF NOT EXISTS "User_tenantId_createdAt_idx" ON "User"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "User_tenantId_lastReminderSentAt_idx" ON "User"("tenantId", "lastReminderSentAt");

-- Pet: listPets (tenantId + orderBy createdAt) y joins por dueño
CREATE INDEX IF NOT EXISTS "Pet_tenantId_createdAt_idx" ON "Pet"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Pet_ownerId_idx" ON "Pet"("ownerId");

-- PetNextAction: opportunities/summary (tenantId + status + dueAt) y listNextActions por pet
CREATE INDEX IF NOT EXISTS "PetNextAction_tenantId_status_dueAt_idx" ON "PetNextAction"("tenantId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "PetNextAction_petId_status_idx" ON "PetNextAction"("petId", "status");

-- MedicalRecord: timeline/records por mascota
CREATE INDEX IF NOT EXISTS "MedicalRecord_petId_idx" ON "MedicalRecord"("petId");

-- Conversation: listConversations (tenantId + orderBy updatedAt) y lookup por usuario
CREATE INDEX IF NOT EXISTS "Conversation_tenantId_updatedAt_idx" ON "Conversation"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_userId_idx" ON "Conversation"("userId");

-- Message: getConversationMessages (where conversationId)
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

-- Appointment (el más consultado): today/upcoming/week, métricas por status,
-- recovery/churn (userId + date), timeline por mascota
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_date_idx" ON "Appointment"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Appointment_userId_date_idx" ON "Appointment"("userId", "date");
CREATE INDEX IF NOT EXISTS "Appointment_petId_idx" ON "Appointment"("petId");

-- Transaction: listTransactions y /metrics/revenue (tenantId + rango de paidAt)
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_paidAt_idx" ON "Transaction"("tenantId", "paidAt");

-- TransactionItem: mapeo de items por transacción (revenue byItem)
CREATE INDEX IF NOT EXISTS "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");
