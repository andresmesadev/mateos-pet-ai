-- Índices de performance (B3 de la auditoría)
-- Prisma no crea índices automáticos para foreign keys ni para tenantId,
-- así que toda query por tenantId/date/status/userId hacía sequential scan.
-- Estos índices están mapeados a las queries reales de los subrouters del dashboard.

-- User: listClients (orderBy createdAt) y recovery (filtro lastReminderSentAt)
CREATE INDEX "User_tenantId_createdAt_idx" ON "User"("tenantId", "createdAt");
CREATE INDEX "User_tenantId_lastReminderSentAt_idx" ON "User"("tenantId", "lastReminderSentAt");

-- Pet: listPets (tenantId + orderBy createdAt) y joins por dueño
CREATE INDEX "Pet_tenantId_createdAt_idx" ON "Pet"("tenantId", "createdAt");
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- PetNextAction: opportunities/summary (tenantId + status + dueAt) y listNextActions por pet
CREATE INDEX "PetNextAction_tenantId_status_dueAt_idx" ON "PetNextAction"("tenantId", "status", "dueAt");
CREATE INDEX "PetNextAction_petId_status_idx" ON "PetNextAction"("petId", "status");

-- MedicalRecord: timeline/records por mascota
CREATE INDEX "MedicalRecord_petId_idx" ON "MedicalRecord"("petId");

-- Conversation: listConversations (tenantId + orderBy updatedAt) y lookup por usuario
CREATE INDEX "Conversation_tenantId_updatedAt_idx" ON "Conversation"("tenantId", "updatedAt");
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- Message: getConversationMessages (where conversationId)
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- Appointment (el más consultado): today/upcoming/week, métricas por status,
-- recovery/churn (userId + date), timeline por mascota
CREATE INDEX "Appointment_tenantId_date_idx" ON "Appointment"("tenantId", "date");
CREATE INDEX "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");
CREATE INDEX "Appointment_userId_date_idx" ON "Appointment"("userId", "date");
CREATE INDEX "Appointment_petId_idx" ON "Appointment"("petId");

-- Transaction: listTransactions y /metrics/revenue (tenantId + rango de paidAt)
CREATE INDEX "Transaction_tenantId_paidAt_idx" ON "Transaction"("tenantId", "paidAt");

-- TransactionItem: mapeo de items por transacción (revenue byItem)
CREATE INDEX "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");
