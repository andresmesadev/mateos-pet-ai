BEGIN;
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "operatorAccessEpoch" BIGINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InboundJob" ADD COLUMN     "channelClaimGeneration" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "channelClaimOwner" UUID,
ADD COLUMN     "channelInputHash" CHAR(64),
ADD COLUMN     "channelModeVersion" BIGINT,
ADD COLUMN     "channelOrdinal" BIGINT,
ADD COLUMN     "channelParticipantId" TEXT,
ADD COLUMN     "channelPrincipalKey" VARCHAR(256),
ADD COLUMN     "channelResultKind" VARCHAR(16),
ADD COLUMN     "channelRouteId" TEXT,
ADD COLUMN     "channelRouteVersion" BIGINT,
ADD COLUMN     "channelSessionId" TEXT,
ADD COLUMN     "channelTenantId" TEXT,
ADD COLUMN     "envelopeVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "OperatorAuthority" (
    "id" TEXT NOT NULL,
    "issuer" VARCHAR(64) NOT NULL,
    "bootId" UUID NOT NULL,
    "epoch" BIGINT NOT NULL,
    "credentialEpoch" BIGINT NOT NULL DEFAULT 1,
    "principalKey" VARCHAR(256) NOT NULL,
    "credentialGeneration" CHAR(64) NOT NULL,
    "keyVersion" VARCHAR(32) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "registeredAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorProof" (
    "id" TEXT NOT NULL,
    "issuer" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "tenantId" TEXT,
    "principalKey" VARCHAR(256),
    "authorityId" TEXT,
    "authorityEpoch" BIGINT,
    "credentialEpoch" BIGINT,
    "generationHash" CHAR(64),
    "operationId" UUID NOT NULL,
    "nonceDigest" CHAR(64),
    "keyVersion" VARCHAR(32) NOT NULL,
    "bindingHash" CHAR(64) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "result" JSONB,
    "digestErasedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperatorProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSubject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "staffSourceId" TEXT,
    "authorityId" TEXT,
    "credentialEpoch" BIGINT NOT NULL DEFAULT 1,
    "permissionEpoch" BIGINT NOT NULL DEFAULT 1,
    "state" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorChannelRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "receiver" VARCHAR(64) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "configHash" CHAR(64) NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'disabled',
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorChannelRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorLinkChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "routeVersion" BIGINT NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "credentialEpoch" BIGINT NOT NULL,
    "adminGeneration" CHAR(64),
    "codeDigest" CHAR(64),
    "keyVersion" VARCHAR(32) NOT NULL,
    "startProofId" TEXT NOT NULL,
    "activationProofId" TEXT,
    "phoneProofJobId" TEXT,
    "replacesLinkId" TEXT,
    "state" VARCHAR(24) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "provedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "digestErasedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperatorLinkChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "challengeId" TEXT NOT NULL,
    "credentialEpoch" BIGINT NOT NULL,
    "adminGeneration" CHAR(64),
    "state" VARCHAR(16) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "currentAuthorizationId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "closeReason" VARCHAR(64),

    CONSTRAINT "OperatorLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAuthorization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "linkId" TEXT NOT NULL,
    "number" BIGINT NOT NULL,
    "proofId" TEXT NOT NULL,
    "credentialEpoch" BIGINT NOT NULL,
    "adminGeneration" CHAR(64),
    "routeVersion" BIGINT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorParticipant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "mode" VARCHAR(16) NOT NULL DEFAULT 'customer',
    "modeVersion" BIGINT NOT NULL DEFAULT 0,
    "admittedOrdinal" BIGINT NOT NULL DEFAULT 0,
    "resolvedOrdinal" BIGINT NOT NULL DEFAULT 0,
    "currentSessionId" TEXT,
    "blockedReason" VARCHAR(64),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "linkId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 1,
    "selectedEmployeeId" TEXT,
    "selectedActionId" TEXT,
    "taskContext" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperatorThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "linkId" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "credentialEpoch" BIGINT NOT NULL,
    "routeVersion" BIGINT NOT NULL,
    "modeVersion" BIGINT NOT NULL,
    "openedOrdinal" BIGINT NOT NULL,
    "lastActivityOrdinal" BIGINT NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "closeReason" VARCHAR(64),

    CONSTRAINT "OperatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "threadId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "incomingJobId" TEXT,
    "direction" VARCHAR(8) NOT NULL,
    "actorKind" VARCHAR(16) NOT NULL,
    "actorName" VARCHAR(160) NOT NULL,
    "content" JSONB NOT NULL,
    "accessClass" VARCHAR(24) NOT NULL,
    "accessProjection" JSONB NOT NULL,
    "permissionEpoch" BIGINT NOT NULL,
    "tenantAccessEpoch" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorInboundWork" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stepKey" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "requestKey" UUID,
    "operationalRequestId" TEXT,
    "actionId" TEXT,
    "expectedRevision" INTEGER,
    "state" VARCHAR(16) NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperatorInboundWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "actionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "basisId" TEXT,
    "sessionId" TEXT,
    "messageId" TEXT,
    "payloadHash" CHAR(64) NOT NULL,
    "previewHash" CHAR(64) NOT NULL,
    "permissionEpoch" BIGINT NOT NULL,
    "tenantAccessEpoch" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperatorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorInteraction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reviewId" TEXT,
    "kind" VARCHAR(24) NOT NULL,
    "actionId" TEXT,
    "expectedRevision" INTEGER,
    "productId" TEXT,
    "selectionContext" JSONB,
    "tokenDigest" CHAR(64) NOT NULL,
    "keyVersion" VARCHAR(32) NOT NULL,
    "modeVersion" BIGINT NOT NULL,
    "routeVersion" BIGINT NOT NULL,
    "permissionEpoch" BIGINT NOT NULL,
    "tenantAccessEpoch" BIGINT NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "offeredAt" TIMESTAMPTZ(3),
    "providerMessageId" TEXT,
    "consumedAt" TIMESTAMPTZ(3),
    "receiptId" TEXT,
    "resultReference" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256),
    "routeId" TEXT NOT NULL,
    "routeVersion" BIGINT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT,
    "messageId" TEXT,
    "sourceJobId" TEXT NOT NULL,
    "replyOrdinal" INTEGER NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "controlCode" VARCHAR(40),
    "modeVersion" BIGINT NOT NULL,
    "permissionEpoch" BIGINT,
    "tenantAccessEpoch" BIGINT,
    "state" VARCHAR(16) NOT NULL,
    "claimGeneration" BIGINT NOT NULL DEFAULT 0,
    "claimOwner" UUID,
    "claimUntil" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "acceptedAt" TIMESTAMPTZ(3),
    "blockedReason" VARCHAR(64),
    "lastErrorCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ownerPrincipalKey" VARCHAR(256),
    "actorKind" VARCHAR(24) NOT NULL,
    "actorPrincipalKey" VARCHAR(256),
    "eventCode" VARCHAR(48) NOT NULL,
    "causeKey" CHAR(64) NOT NULL,
    "deliveryId" TEXT,
    "attemptNumber" INTEGER,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatorAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAuthority_issuer_key" ON "OperatorAuthority"("issuer");

-- CreateIndex
CREATE INDEX "OPF_expiry_idx" ON "OperatorProof"("expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OPF_operation_key" ON "OperatorProof"("issuer", "kind", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "OPF_nonce_key" ON "OperatorProof"("issuer", "kind", "nonceDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OS_principal_key" ON "OperatorSubject"("tenantId", "principalKey");

-- CreateIndex
CREATE UNIQUE INDEX "OS_scope_key" ON "OperatorSubject"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OS_staff_source_key" ON "OperatorSubject"("tenantId", "staffSourceId");

-- CreateIndex
CREATE INDEX "OCR_receiver_idx" ON "OperatorChannelRoute"("provider", "receiver", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OCR_scope_key" ON "OperatorChannelRoute"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OLC_start_proof_key" ON "OperatorLinkChallenge"("startProofId");

-- CreateIndex
CREATE UNIQUE INDEX "OLC_activation_proof_key" ON "OperatorLinkChallenge"("activationProofId");

-- CreateIndex
CREATE UNIQUE INDEX "OLC_phone_proof_key" ON "OperatorLinkChallenge"("phoneProofJobId");

-- CreateIndex
CREATE INDEX "OLC_rate_idx" ON "OperatorLinkChallenge"("tenantId", "principalKey", "createdAt");

-- CreateIndex
CREATE INDEX "OLC_expiry_idx" ON "OperatorLinkChallenge"("state", "expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OLC_scope_key" ON "OperatorLinkChallenge"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OL_challenge_key" ON "OperatorLink"("challengeId");

-- CreateIndex
CREATE INDEX "OL_owner_idx" ON "OperatorLink"("tenantId", "principalKey", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OL_scope_key" ON "OperatorLink"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OAZ_proof_key" ON "OperatorAuthorization"("proofId");

-- CreateIndex
CREATE UNIQUE INDEX "OAZ_number_key" ON "OperatorAuthorization"("tenantId", "principalKey", "linkId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OAZ_link_scope_key" ON "OperatorAuthorization"("tenantId", "principalKey", "linkId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OPT_address_key" ON "OperatorParticipant"("tenantId", "routeId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "OPT_route_scope_key" ON "OperatorParticipant"("tenantId", "routeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OPT_scope_key" ON "OperatorParticipant"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OTH_link_key" ON "OperatorThread"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "OTH_scope_key" ON "OperatorThread"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE INDEX "OSS_expiry_idx" ON "OperatorSession"("state", "idleExpiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OSS_scope_key" ON "OperatorSession"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OSS_participant_scope_key" ON "OperatorSession"("tenantId", "participantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OM_incoming_key" ON "OperatorMessage"("incomingJobId");

-- CreateIndex
CREATE INDEX "OM_history_idx" ON "OperatorMessage"("tenantId", "principalKey", "threadId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OM_scope_key" ON "OperatorMessage"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE INDEX "OIW_owner_idx" ON "OperatorInboundWork"("tenantId", "principalKey", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OIW_step_key" ON "OperatorInboundWork"("jobId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "OIW_request_key" ON "OperatorInboundWork"("tenantId", "principalKey", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ORV_scope_key" ON "OperatorReview"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OI_token_key" ON "OperatorInteraction"("tokenDigest");

-- CreateIndex
CREATE INDEX "OI_expiry_idx" ON "OperatorInteraction"("state", "expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OI_scope_key" ON "OperatorInteraction"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OD_message_key" ON "OperatorDelivery"("messageId");

-- CreateIndex
CREATE INDEX "OD_claim_idx" ON "OperatorDelivery"("state", "claimUntil", "id");

-- CreateIndex
CREATE INDEX "OD_owner_idx" ON "OperatorDelivery"("tenantId", "principalKey", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OD_reply_key" ON "OperatorDelivery"("sourceJobId", "replyOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "OD_provider_key" ON "OperatorDelivery"("routeId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "OAU_cause_key" ON "OperatorAudit"("causeKey");

-- CreateIndex
CREATE INDEX "OAU_owner_idx" ON "OperatorAudit"("tenantId", "ownerPrincipalKey", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IJ_operator_ordinal_key" ON "InboundJob"("channelParticipantId", "channelOrdinal");

-- AddForeignKey
ALTER TABLE "OperatorProof" ADD CONSTRAINT "OperatorProof_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorProof" ADD CONSTRAINT "OperatorProof_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "OperatorAuthority"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSubject" ADD CONSTRAINT "OperatorSubject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSubject" ADD CONSTRAINT "OperatorSubject_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "OperatorAuthority"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorChannelRoute" ADD CONSTRAINT "OperatorChannelRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorChannelRoute" ADD CONSTRAINT "OperatorChannelRoute_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_tenantId_principalKey_subjectId_fkey" FOREIGN KEY ("tenantId", "principalKey", "subjectId") REFERENCES "OperatorSubject"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_tenantId_routeId_fkey" FOREIGN KEY ("tenantId", "routeId") REFERENCES "OperatorChannelRoute"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_startProofId_fkey" FOREIGN KEY ("startProofId") REFERENCES "OperatorProof"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_activationProofId_fkey" FOREIGN KEY ("activationProofId") REFERENCES "OperatorProof"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_phoneProofJobId_fkey" FOREIGN KEY ("phoneProofJobId") REFERENCES "InboundJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OperatorLinkChallenge_tenantId_principalKey_replacesLinkId_fkey" FOREIGN KEY ("tenantId", "principalKey", "replacesLinkId") REFERENCES "OperatorLink"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLink" ADD CONSTRAINT "OperatorLink_tenantId_principalKey_subjectId_fkey" FOREIGN KEY ("tenantId", "principalKey", "subjectId") REFERENCES "OperatorSubject"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLink" ADD CONSTRAINT "OperatorLink_tenantId_routeId_fkey" FOREIGN KEY ("tenantId", "routeId") REFERENCES "OperatorChannelRoute"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLink" ADD CONSTRAINT "OperatorLink_tenantId_principalKey_challengeId_fkey" FOREIGN KEY ("tenantId", "principalKey", "challengeId") REFERENCES "OperatorLinkChallenge"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorLink" ADD CONSTRAINT "OL_current_auth_fk" FOREIGN KEY ("tenantId", "principalKey", "id", "currentAuthorizationId") REFERENCES "OperatorAuthorization"("tenantId", "principalKey", "linkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorAuthorization" ADD CONSTRAINT "OperatorAuthorization_tenantId_principalKey_linkId_fkey" FOREIGN KEY ("tenantId", "principalKey", "linkId") REFERENCES "OperatorLink"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorAuthorization" ADD CONSTRAINT "OperatorAuthorization_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "OperatorProof"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorParticipant" ADD CONSTRAINT "OperatorParticipant_tenantId_routeId_fkey" FOREIGN KEY ("tenantId", "routeId") REFERENCES "OperatorChannelRoute"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorParticipant" ADD CONSTRAINT "OPT_current_session_fk" FOREIGN KEY ("tenantId", "id", "currentSessionId") REFERENCES "OperatorSession"("tenantId", "participantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorThread" ADD CONSTRAINT "OperatorThread_tenantId_principalKey_linkId_fkey" FOREIGN KEY ("tenantId", "principalKey", "linkId") REFERENCES "OperatorLink"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorThread" ADD CONSTRAINT "OperatorThread_tenantId_routeId_fkey" FOREIGN KEY ("tenantId", "routeId") REFERENCES "OperatorChannelRoute"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorThread" ADD CONSTRAINT "OperatorThread_tenantId_selectedEmployeeId_fkey" FOREIGN KEY ("tenantId", "selectedEmployeeId") REFERENCES "DigitalEmployee"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorThread" ADD CONSTRAINT "OperatorThread_tenantId_principalKey_selectedActionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "selectedActionId") REFERENCES "OperationalAction"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_tenantId_principalKey_linkId_fkey" FOREIGN KEY ("tenantId", "principalKey", "linkId") REFERENCES "OperatorLink"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_tenantId_principalKey_linkId_authorization_fkey" FOREIGN KEY ("tenantId", "principalKey", "linkId", "authorizationId") REFERENCES "OperatorAuthorization"("tenantId", "principalKey", "linkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_tenantId_participantId_fkey" FOREIGN KEY ("tenantId", "participantId") REFERENCES "OperatorParticipant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_tenantId_principalKey_threadId_fkey" FOREIGN KEY ("tenantId", "principalKey", "threadId") REFERENCES "OperatorThread"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorMessage" ADD CONSTRAINT "OperatorMessage_tenantId_principalKey_threadId_fkey" FOREIGN KEY ("tenantId", "principalKey", "threadId") REFERENCES "OperatorThread"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorMessage" ADD CONSTRAINT "OperatorMessage_tenantId_principalKey_sessionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "sessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorMessage" ADD CONSTRAINT "OperatorMessage_incomingJobId_fkey" FOREIGN KEY ("incomingJobId") REFERENCES "InboundJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OperatorInboundWork_tenantId_principalKey_subjectId_fkey" FOREIGN KEY ("tenantId", "principalKey", "subjectId") REFERENCES "OperatorSubject"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OperatorInboundWork_tenantId_principalKey_sessionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "sessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OperatorInboundWork_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InboundJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OperatorInboundWork_operationalRequestId_fkey" FOREIGN KEY ("operationalRequestId") REFERENCES "OperationalRequest"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OperatorInboundWork_tenantId_principalKey_actionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId") REFERENCES "OperationalAction"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorReview" ADD CONSTRAINT "OperatorReview_tenantId_principalKey_subjectId_fkey" FOREIGN KEY ("tenantId", "principalKey", "subjectId") REFERENCES "OperatorSubject"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorReview" ADD CONSTRAINT "OperatorReview_tenantId_principalKey_actionId_revision_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId", "revision") REFERENCES "ActionRevision"("tenantId", "principalKey", "actionId", "number") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorReview" ADD CONSTRAINT "OperatorReview_tenantId_principalKey_basisId_fkey" FOREIGN KEY ("tenantId", "principalKey", "basisId") REFERENCES "OperatorReview"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorReview" ADD CONSTRAINT "OperatorReview_tenantId_principalKey_sessionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "sessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorReview" ADD CONSTRAINT "OperatorReview_tenantId_principalKey_messageId_fkey" FOREIGN KEY ("tenantId", "principalKey", "messageId") REFERENCES "OperatorMessage"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_principalKey_sessionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "sessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_principalKey_messageId_fkey" FOREIGN KEY ("tenantId", "principalKey", "messageId") REFERENCES "OperatorMessage"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_principalKey_reviewId_fkey" FOREIGN KEY ("tenantId", "principalKey", "reviewId") REFERENCES "OperatorReview"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_principalKey_actionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId") REFERENCES "OperationalAction"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "InventoryProduct"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OperatorInteraction_tenantId_principalKey_receiptId_fkey" FOREIGN KEY ("tenantId", "principalKey", "receiptId") REFERENCES "ExecutionReceipt"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OperatorDelivery_tenantId_routeId_fkey" FOREIGN KEY ("tenantId", "routeId") REFERENCES "OperatorChannelRoute"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OperatorDelivery_tenantId_routeId_participantId_fkey" FOREIGN KEY ("tenantId", "routeId", "participantId") REFERENCES "OperatorParticipant"("tenantId", "routeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OperatorDelivery_tenantId_principalKey_sessionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "sessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OperatorDelivery_tenantId_principalKey_messageId_fkey" FOREIGN KEY ("tenantId", "principalKey", "messageId") REFERENCES "OperatorMessage"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OperatorDelivery_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "InboundJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorAudit" ADD CONSTRAINT "OperatorAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperatorAudit" ADD CONSTRAINT "OperatorAudit_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "OperatorDelivery"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InboundJob" ADD CONSTRAINT "InboundJob_channelTenantId_channelRouteId_channelParticipa_fkey" FOREIGN KEY ("channelTenantId", "channelRouteId", "channelParticipantId") REFERENCES "OperatorParticipant"("tenantId", "routeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InboundJob" ADD CONSTRAINT "InboundJob_channelTenantId_channelPrincipalKey_channelSess_fkey" FOREIGN KEY ("channelTenantId", "channelPrincipalKey", "channelSessionId") REFERENCES "OperatorSession"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;
