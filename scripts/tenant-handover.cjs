// Operational, read-only adapter. No HTTP route and no implicit database connection.
const { Prisma } = require('../node_modules/@prisma/client');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const fields = value => value.split(' ');
const INCLUDED = {
  Tenant: 'id name slug phone email plan active createdAt updatedAt subscriptionStatus planExpiresAt contactPhone description address logoUrl businessHours activeModules commissionSplitRate',
  Staff: 'id tenantId name role accessPermissions serviceScope phone email active availability generatesCommission contractType commissionRate createdAt updatedAt',
  StaffAvailability: 'id staffId type weekday startTime endTime startAt endAt reason voidedAt voidReason voidedBy replacesId createdAt',
  StaffCapability: 'id staffId serviceId active createdAt',
  Service: 'id tenantId name categoryId duration basePrice requiresAppointment appliesCommissionSplit active createdAt updatedAt',
  ServiceCategory: 'id tenantId name appliesCommissionSplit active createdAt',
  PriceRule: 'id serviceId targetType targetId price active createdAt',
  User: 'id phone phoneAlt tenantId name email address neighborhood notes lastReminderSentAt createdAt',
  Pet: 'id name type tenantId ownerId breed gender birthDate weight sterilized notes operationalAlerts defaultGroomingPrice defaultGroomingWithTransportPrice defaultGroomingTransportPrice defaultGroomingTransportMode groomingReminderSent createdAt',
  PetNextAction: 'id petId tenantId type notes dueAt status sourceRecordId sourceAppointmentId reminderSentAt createdAt updatedAt',
  MedicalRecord: 'id petId appointmentId staffId createdByStaffId updatedByStaffId type title detail date reason findings diagnosis treatment recommendations weight nextControlAt reminderSent version createdAt updatedAt',
  MedicalRecordRevision: 'id recordId version before after reason actorType actorStaffId actorName actorEmail createdAt',
  Conversation: 'id userId tenantId intent step status assignedActorId assignedActorName assignedActorRole assignedAt controlChangedAt controlVersion channelId abandonReminderSent createdAt updatedAt',
  Message: 'id conversationId role content origin senderKind senderActorId senderName senderRole externalId createdAt',
  Channel: 'id tenantId type active createdAt',
  KnowledgeChunk: 'id tenantId source content createdAt',
  Appointment: 'id userId tenantId petId petName petType serviceType availabilityBucket serviceId staffId finalPrice priceActorId priceActorName priceActorRole startedAt endedAt date status googleEventId address groomingBreed groomingSize groomingNotes groomingNotesVersion groomingNotesUpdatedAt groomingDeliveredAt transportMode transportPrice transportPriceSource transportZoneId transportZoneName transportAddress transportNeighborhood transportScope transportSharedWithId reminderSent followUpSent createdAt',
  AppointmentRemoval: 'id appointmentId tenantId actorId actorName actorRole reason previousStatus snapshot removedAt',
  GroomingTransportZone: 'id tenantId name roundTripPrice pickupPrice deliveryPrice active createdAt updatedAt',
  AgendaException: 'id tenantId scope mode startDate endDate open close reason createdAt updatedAt',
  InventoryProduct: 'id tenantId name category internalCode internalCodeKey barcode presentation uses referenceCost salePrice stockMinimum lotPolicy active removedAt metadataVersion priceVersion stockRevision createdAt updatedAt',
  InventoryLot: 'id tenantId productId groupKind commercialCode commercialKey expiresOn balancePhysical firstReceivedAt createdAt updatedAt',
  InventoryOperation: 'id tenantId kind actorId actorName actorRole confirmedAt resultKind resultProductId resultSaleId sourceOperationId',
  InventoryMovement: 'id tenantId operationId productId lotId ordinal kind quantity stockDelta balanceBefore balanceAfter occurredAt reason actorId actorName actorRole productNameSnapshot productCodeSnapshot presentationSnapshot lotCodeSnapshot expiresOnSnapshot entryUnitCost transactionId transactionItemId area appointmentId sourceMovementId returnLineId countedQuantity expectedStockRevision',
  InventoryReturnLine: 'id tenantId operationId transactionId transactionItemId productId quantity disposition reason recordedAt',
  Transaction: 'id tenantId userId petId appointmentId total paymentMethod cashAmount transferAmount recordedActorId recordedActorName recordedActorRole notes paidAt createdAt origin status voidedAt voidReason replacesTransactionId',
  TransactionItem: 'id transactionId description serviceId performedByStaffId appointmentComponent itemKind quantity unitPrice total tenantId productId productCodeSnapshot presentationSnapshot priceSourceSnapshot priceVersionSnapshot',
  Expense: 'id tenantId date category description amount paymentMethod notes createdAt responsible status voidedAt voidReason',
  DailyClose: 'id tenantId date incomeTotal expenseTotal netAmount openingCashAmount retainedCashAmount staffBreakdown financialPeriodId createdAt',
  CashOpening: 'id tenantId date amount sourceDailyCloseId actorId actorName createdAt updatedAt',
  FinancialPeriod: 'id tenantId periodStart periodEnd incomeTotal expenseTotal netAmount breakdown createdAt',
  Commission: 'id tenantId appointmentId transactionItemId serviceId staffId resolvedPrice priceSource splitRate staffShare businessShare serviceCategory completedAt status voidedAt voidReason replacesCommissionId createdAt',
  Settlement: 'id tenantId staffId periodStart periodEnd totalAmount status voidedAt voidReason replacesSettlementId createdAt',
  DigitalEmployee: 'id tenantId specialization status createdAt',
  AgentAutonomyLimit: 'id digitalEmployeeId action autoApproved',
  AgentTask: 'id digitalEmployeeId origin status result createdAt',
  AgentDecision: 'id agentTaskId input reasoning action createdAt',
  Escalation: 'id agentTaskId assignedStaffId context status createdAt resolvedAt',
  AutomationRule: 'id tenantId name triggerEventTypeId condition actionType actionConfig active templateId createdAt updatedAt',
  AiQuotaConfig: 'tenantId monthlyLimit updatedAt',
  AiQuotaPeriod: 'id tenantId monthKey quotaLimit usedUnits reservedUnits policyVersion createdAt updatedAt',
  AiUsageEntry: 'id tenantId periodId operation units state createdAt settledAt',
  AiQuotaChange: 'id tenantId previousLimit newLimit createdAt',
};
const OMITTED_FIELDS = {
  Tenant: 'operatorAccessEpoch stripeCustomerId stripeSubscriptionId',
  Conversation: 'sessionData', KnowledgeChunk: 'metadata',
  InventoryOperation: 'principalKey requestKey contractVersion payloadHash resultEvidence',
  AiUsageEntry: 'operationKey providerUsage', AiQuotaChange: 'actorHash',
};
const EXCLUDED = {
  authentication: fields('OperatorAuthority OperatorProof OperatorSubject OperatorChannelRoute OperatorLinkChallenge OperatorLink OperatorAuthorization OperatorParticipant OperatorThread OperatorSession OperatorInteraction StaffCredential WhatsAppConnection WhatsAppConnectionChallenge WhatsAppConnectionEvent ApiKey ClientVerificationCode ClientSession'),
  technicalProcessing: fields('OperatorMessage OperatorInboundWork OperatorReview OperatorDelivery OperatorAudit AppointmentBookingGuard DomainEvent EventDelivery InboundJob OperationalRequest OperationalAction ActionRevision ExecutionReceipt PublicationIntent AutomationExecution'),
  derivedOrSharedCatalogue: fields('MemoryEmbedding EventType AutomationTemplate'),
};
const INDIRECT = {
  StaffAvailability: t => ({ staff: { tenantId: t } }),
  StaffCapability: t => ({ staff: { tenantId: t } }),
  PriceRule: t => ({ service: { tenantId: t } }),
  MedicalRecord: t => ({ pet: { tenantId: t } }),
  MedicalRecordRevision: t => ({ record: { pet: { tenantId: t } } }),
  Message: t => ({ conversation: { tenantId: t } }),
  // Legacy service lines may have a null tenantId; their transaction owns them.
  TransactionItem: t => ({ transaction: { tenantId: t } }),
  AgentAutonomyLimit: t => ({ digitalEmployee: { tenantId: t } }),
  AgentTask: t => ({ digitalEmployee: { tenantId: t } }),
  AgentDecision: t => ({ agentTask: { digitalEmployee: { tenantId: t } } }),
  Escalation: t => ({ agentTask: { digitalEmployee: { tenantId: t } } }),
};
const digest = value => createHash('sha256').update(value).digest('hex');
function fail(code) { throw Object.assign(new Error(code), { code }); }
function validateSchema(models = Prisma.dmmf.datamodel.models) {
  const excluded = Object.values(EXCLUDED).flat();
  const reviewed = [...Object.keys(INCLUDED), ...excluded];
  if (new Set(reviewed).size !== reviewed.length || models.length !== reviewed.length || models.some(m => !reviewed.includes(m.name))) fail('HANDOVER_SCHEMA_REVIEW_REQUIRED');
  for (const [name, names] of Object.entries(INCLUDED)) {
    const model = models.find(m => m.name === name);
    const actual = model.fields.filter(f => f.kind !== 'object').map(f => f.name).sort();
    const expected = [...fields(names), ...fields(OMITTED_FIELDS[name] || '').filter(Boolean)].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('HANDOVER_FIELD_REVIEW_REQUIRED');
    if (fields(names).some(f => /^(passwordHash|encryptedToken|tokenHash|keyHash|sessionData|principalKey)$/.test(f))) fail('HANDOVER_SECRET_FIELD');
  }
}
const REFERENCES = {
  tenantId: 'Tenant', staffId: 'Staff', performedByStaffId: 'Staff', createdByStaffId: 'Staff', updatedByStaffId: 'Staff', assignedStaffId: 'Staff', actorStaffId: 'Staff',
  userId: 'User', ownerId: 'User', petId: 'Pet', serviceId: 'Service', categoryId: 'ServiceCategory',
  appointmentId: 'Appointment', sourceAppointmentId: 'Appointment', transportSharedWithId: 'Appointment', transportZoneId: 'GroomingTransportZone',
  recordId: 'MedicalRecord', sourceRecordId: 'MedicalRecord', conversationId: 'Conversation', channelId: 'Channel',
  productId: 'InventoryProduct', resultProductId: 'InventoryProduct', lotId: 'InventoryLot', operationId: 'InventoryOperation', sourceOperationId: 'InventoryOperation',
  transactionId: 'Transaction', resultSaleId: 'Transaction', transactionItemId: 'TransactionItem', sourceMovementId: 'InventoryMovement', returnLineId: 'InventoryReturnLine',
  financialPeriodId: 'FinancialPeriod', sourceDailyCloseId: 'DailyClose', periodId: 'AiQuotaPeriod', digitalEmployeeId: 'DigitalEmployee', agentTaskId: 'AgentTask',
  replacesTransactionId: 'Transaction', replacesCommissionId: 'Commission', replacesSettlementId: 'Settlement', replacesId: 'StaffAvailability',
};
function validateReferences(records) {
  // Prisma 7's runtime DMMF omits relationFromFields. Keep reviewed references
  // explicit rather than accidentally treating an empty metadata list as safe.
  const ids = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, new Set(rows.map(row => row.id))]));
  for (const [name, rows] of Object.entries(records)) {
    for (const row of rows) {
      for (const [field, target] of Object.entries(REFERENCES)) {
        if (row[field] == null || !ids[target]) continue;
        // This audit record deliberately survives deletion of the reservation.
        if (name === 'AppointmentRemoval' && field === 'appointmentId') continue;
        if (!ids[target].has(row[field])) fail('HANDOVER_FOREIGN_OR_MISSING_REFERENCE');
      }
      if (name === 'PriceRule' && row.targetType === 'pet' && !ids.Pet?.has(row.targetId)) fail('HANDOVER_FOREIGN_OR_MISSING_REFERENCE');
    }
  }
}
async function buildTenantHandover(prisma, { tenantId, caseId, operator, verifiedChannel }) {
  if (typeof tenantId !== 'string' || !tenantId.trim() || !/^HN-[A-Z0-9-]{4,70}$/.test(caseId || '') || typeof operator !== 'string' || !operator.trim() || operator.length > 160 || !['registered-email', 'previously-verified-channel'].includes(verifiedChannel)) fail('HANDOVER_VERIFIED_CASE_REQUIRED');
  validateSchema();
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY'); // Static SQL, no user input.
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) fail('HANDOVER_TENANT_NOT_FOUND');
    const records = {};
    for (const [name, columnList] of Object.entries(INCLUDED)) {
      const where = name === 'Tenant' ? { id: tenantId } : INDIRECT[name] ? INDIRECT[name](tenantId) : { tenantId };
      const delegate = name[0].toLowerCase() + name.slice(1);
      const rows = await tx[delegate].findMany({ where, select: Object.fromEntries(fields(columnList).map(f => [f, true])), take: 50001, orderBy: { [name === 'AiQuotaConfig' ? 'tenantId' : 'id']: 'asc' } });
      if (rows.length > 50000) fail('HANDOVER_VOLUME_REVIEW_REQUIRED');
      if (name !== 'Tenant' && rows.some(row => Object.hasOwn(row, 'tenantId') && row.tenantId !== tenantId && !(INDIRECT[name] && row.tenantId == null))) fail('HANDOVER_TENANT_MISMATCH');
      records[name] = rows;
    }
    validateReferences(records);
    const triggerIds = [...new Set(records.AutomationRule.map(row => row.triggerEventTypeId))];
    const referenceData = { eventTypes: triggerIds.length ? await tx.eventType.findMany({ where: { id: { in: triggerIds } }, select: { id: true, name: true, originContext: true, active: true }, orderBy: { id: 'asc' } }) : [] };
    if (referenceData.eventTypes.length !== triggerIds.length) fail('HANDOVER_FOREIGN_OR_MISSING_REFERENCE');
    // JSON format keeps exact Decimal values as strings and ISO dates.
    return JSON.parse(JSON.stringify({ format: 'huella-nex-operational-handover-v1', preparedAt: new Date().toISOString(),
      case: { caseId, operator, verifiedChannel, tenantId, identityVerification: 'Operator attestation; not independently verified by this script' },
      records, referenceData, counts: Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, rows.length])),
      excludedModels: EXCLUDED, omittedFields: OMITTED_FIELDS,
      limitations: ['Operational records only; not a restorable database backup.', 'Vectors, technical processing traces, authentication and provider credentials are excluded.', 'Shared event catalogue is not dumped; referenceData identifies only triggers referenced by the included rules.', 'External files and provider-hosted content are not downloaded; retained references are not copies of those files.', 'No suspension, deletion, provider disconnection or legal retention decision is executed.'],
    }));
  }, { isolationLevel: 'RepeatableRead', timeout: 60000, maxWait: 10000 });
}
function writeHandover(packet, directory) {
  // Refuse public/repository destinations. Data must remain in a private,
  // ignored workspace until an operator arranges an authorized delivery.
  const target = path.resolve(directory), privateRoot = path.resolve(__dirname, '../.cache/tenant-handovers');
  if (path.dirname(target) !== privateRoot || !/^[A-Za-z0-9_-]{4,100}$/.test(path.basename(target))) fail('HANDOVER_PRIVATE_DESTINATION_REQUIRED');
  if (fs.existsSync(target)) fail('HANDOVER_DESTINATION_EXISTS');
  fs.mkdirSync(privateRoot, { recursive: true });
  if (fs.realpathSync(privateRoot).toLowerCase() !== privateRoot.toLowerCase()) fail('HANDOVER_PRIVATE_DESTINATION_REQUIRED');
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const data = JSON.stringify(packet, null, 2) + '\n';
  const manifest = JSON.stringify({ format: packet.format, preparedAt: packet.preparedAt, case: packet.case, counts: packet.counts, excludedModels: packet.excludedModels, omittedFields: packet.omittedFields, limitations: packet.limitations,
    files: [{ name: 'data.json', bytes: Buffer.byteLength(data), sha256: digest(data) }] }, null, 2) + '\n';
  fs.writeFileSync(path.join(target, 'data.json'), data, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(target, 'manifest.json'), manifest, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(target, 'SHA256SUMS'), `${digest(data)}  data.json\n${digest(manifest)}  manifest.json\n`, { flag: 'wx', mode: 0o600 });
  return verifyHandover(target);
}
function verifyHandover(directory) {
  const target = path.resolve(directory);
  const sums = fs.readFileSync(path.join(target, 'SHA256SUMS'), 'utf8').trim().split('\n');
  if (sums.length !== 2) fail('HANDOVER_INVALID_MANIFEST');
  for (const [i, expectedName] of ['data.json', 'manifest.json'].entries()) {
    const match = /^([a-f0-9]{64})  (data\.json|manifest\.json)$/.exec(sums[i]);
    if (!match || match[2] !== expectedName || digest(fs.readFileSync(path.join(target, expectedName))) !== match[1]) fail('HANDOVER_INTEGRITY_FAILED');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(target, 'data.json'));
  if (manifest.files?.length !== 1 || manifest.files[0].name !== 'data.json' || manifest.files[0].sha256 !== digest(bytes) || manifest.files[0].bytes !== bytes.length) fail('HANDOVER_INTEGRITY_FAILED');
  return { files: 3, dataSha256: digest(bytes), manifestSha256: digest(fs.readFileSync(path.join(target, 'manifest.json'))), counts: manifest.counts };
}
module.exports = { buildTenantHandover, writeHandover, verifyHandover, validateSchema, validateReferences };
