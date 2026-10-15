-- DESIGN ONLY: reviewed alongside operational-employees-whatsapp-physical-schema.md.
-- Applies AFTER the tables/FKs from the standalone Prisma draft are integrated.
-- This is NOT a migration: cross-row/source-change/state guards are specified
-- in that document and must be implemented and tested before enabling the feature.
-- Do not execute against any database during design.

CREATE UNIQUE INDEX "OCR_enabled_receiver_key"
  ON "OperatorChannelRoute" (provider, receiver) WHERE state = 'enabled';
CREATE UNIQUE INDEX "OL_active_operator_key"
  ON "OperatorLink" ("tenantId", "principalKey", "routeId") WHERE state = 'active';
CREATE UNIQUE INDEX "OL_active_phone_key"
  ON "OperatorLink" ("tenantId", "routeId", phone) WHERE state = 'active';
CREATE UNIQUE INDEX "OLC_pending_key"
  ON "OperatorLinkChallenge" ("tenantId", "principalKey", "routeId")
  WHERE state IN ('pending', 'proved');
CREATE UNIQUE INDEX "OSS_active_participant_key"
  ON "OperatorSession" ("tenantId", "participantId") WHERE state = 'active';
CREATE UNIQUE INDEX "ORV_basis_key"
  ON "OperatorReview" ("actionId", revision) WHERE kind = 'basis';

ALTER TABLE "OperatorLink" ALTER CONSTRAINT "OL_current_auth_fk"
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "OperatorParticipant" ALTER CONSTRAINT "OPT_current_session_fk"
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "Tenant" ADD CONSTRAINT "TEN_operator_epoch_check"
  CHECK ("operatorAccessEpoch" >= 1);
ALTER TABLE "OperatorAuthority" ADD CONSTRAINT "OAUT_shape_check" CHECK (
  issuer = 'dashboard-admin' AND epoch >= 1 AND "credentialEpoch" >= 1
  AND state IN ('active', 'disabled')
  AND "principalKey" ~ '^admin:.+'
  AND "credentialGeneration" ~ '^[0-9a-f]{64}$'
  AND length("keyVersion") BETWEEN 1 AND 32
  AND "updatedAt" >= "registeredAt"
);
ALTER TABLE "OperatorProof" ADD CONSTRAINT "OPF_shape_check" CHECK (
  kind IN ('recent_dashboard', 'live_admin', 'issuer_register')
  AND "expiresAt" > "issuedAt"
  AND "expiresAt" <= "issuedAt" + CASE WHEN kind = 'recent_dashboard'
      THEN interval '60 seconds' ELSE interval '30 seconds' END
  AND ("nonceDigest" IS NULL OR "nonceDigest" ~ '^[0-9a-f]{64}$')
  AND ("nonceDigest" IS NOT NULL OR "digestErasedAt" IS NOT NULL)
  AND "bindingHash" ~ '^[0-9a-f]{64}$'
  AND length(issuer) BETWEEN 1 AND 64
  AND length("keyVersion") BETWEEN 1 AND 32
  AND (("consumedAt" IS NULL AND result IS NULL)
    OR ("consumedAt" IS NOT NULL AND result IS NOT NULL AND jsonb_typeof(result) = 'object'))
  AND (
    (kind = 'recent_dashboard' AND purpose IN ('link_start','link_activate','link_renew')
      AND "tenantId" IS NOT NULL AND "principalKey" IS NOT NULL)
    OR (kind = 'live_admin' AND purpose IN ('access','read','prepare','revise','confirm','recover','deliver')
      AND "tenantId" IS NOT NULL AND "principalKey" IS NOT NULL
      AND "authorityId" IS NOT NULL AND "authorityEpoch" IS NOT NULL AND "authorityEpoch" >= 1
      AND "credentialEpoch" IS NOT NULL AND "credentialEpoch" >= 1
      AND "generationHash" IS NOT NULL AND "generationHash" ~ '^[0-9a-f]{64}$')
    OR (kind = 'issuer_register' AND purpose = 'register_issuer'
      AND "tenantId" IS NULL AND "principalKey" IS NULL)
  )
);
ALTER TABLE "OperatorSubject" ADD CONSTRAINT "OS_shape_check" CHECK (
  "credentialEpoch" >= 1 AND "permissionEpoch" >= 1
  AND state IN ('active','disabled','deleted')
  AND ((kind = 'staff' AND "staffSourceId" IS NOT NULL AND "authorityId" IS NULL
      AND "principalKey" = 'staff:' || "staffSourceId")
    OR (kind = 'admin' AND "staffSourceId" IS NULL AND "authorityId" IS NOT NULL AND "credentialEpoch" = 1
      AND "principalKey" ~ '^admin:.+'))
);
ALTER TABLE "OperatorChannelRoute" ADD CONSTRAINT "OCR_shape_check" CHECK (
  provider = 'whatsapp' AND receiver ~ '^[0-9]{1,64}$'
  AND version >= 1 AND state IN ('enabled','disabled')
  AND "configHash" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "OperatorLinkChallenge" ADD CONSTRAINT "OLC_shape_check" CHECK (
  phone ~ '^[1-9][0-9]{6,14}$'
  AND "routeVersion" >= 1 AND "credentialEpoch" >= 1
  AND "failedAttempts" BETWEEN 0 AND 5
  AND "expiresAt" = "createdAt" + interval '5 minutes'
  AND ("codeDigest" IS NULL OR "codeDigest" ~ '^[0-9a-f]{64}$')
  AND ("adminGeneration" IS NULL OR "adminGeneration" ~ '^[0-9a-f]{64}$')
  AND (
    (state = 'pending' AND "provedAt" IS NULL AND "phoneProofJobId" IS NULL
      AND "activationProofId" IS NULL AND "finishedAt" IS NULL AND "codeDigest" IS NOT NULL)
    OR (state = 'proved' AND "provedAt" IS NOT NULL AND "phoneProofJobId" IS NOT NULL
      AND "activationProofId" IS NULL AND "finishedAt" IS NULL AND "codeDigest" IS NOT NULL)
    OR (state = 'consumed' AND "provedAt" IS NOT NULL AND "phoneProofJobId" IS NOT NULL
      AND "activationProofId" IS NOT NULL AND "finishedAt" IS NOT NULL)
    OR (state IN ('expired','exhausted','cancelled','replaced') AND "finishedAt" IS NOT NULL)
  )
  AND ("codeDigest" IS NOT NULL OR "digestErasedAt" IS NOT NULL)
  AND (state NOT IN ('pending','proved') OR "failedAttempts" < 5)
  AND (state <> 'exhausted' OR "failedAttempts" = 5)
  AND ("provedAt" IS NULL OR ("provedAt" >= "createdAt" AND "provedAt" <= "expiresAt"))
  AND (state <> 'consumed' OR ("finishedAt" >= "provedAt" AND "finishedAt" <= "expiresAt"))
);
ALTER TABLE "OperatorLink" ADD CONSTRAINT "OL_shape_check" CHECK (
  phone ~ '^[1-9][0-9]{6,14}$' AND "credentialEpoch" >= 1 AND version >= 1
  AND ("adminGeneration" IS NULL OR "adminGeneration" ~ '^[0-9a-f]{64}$')
  AND ((state = 'active' AND "currentAuthorizationId" IS NOT NULL AND "closedAt" IS NULL AND "closeReason" IS NULL)
    OR (state IN ('revoked','replaced') AND "closedAt" IS NOT NULL AND "closeReason" IS NOT NULL))
);
ALTER TABLE "OperatorAuthorization" ADD CONSTRAINT "OAZ_shape_check" CHECK (
  number >= 1 AND "credentialEpoch" >= 1 AND "routeVersion" >= 1
  AND "expiresAt" = "issuedAt" + interval '8 hours'
  AND ("adminGeneration" IS NULL OR "adminGeneration" ~ '^[0-9a-f]{64}$')
);
ALTER TABLE "OperatorParticipant" ADD CONSTRAINT "OPT_shape_check" CHECK (
  phone ~ '^[1-9][0-9]{6,14}$' AND "modeVersion" >= 0
  AND "resolvedOrdinal" >= 0 AND "admittedOrdinal" >= "resolvedOrdinal"
  AND ((mode = 'business' AND "currentSessionId" IS NOT NULL AND "blockedReason" IS NULL)
    OR (mode = 'customer' AND "currentSessionId" IS NULL AND "blockedReason" IS NULL)
    OR (mode = 'blocked' AND "currentSessionId" IS NULL AND "blockedReason" IS NOT NULL))
);
ALTER TABLE "OperatorThread" ADD CONSTRAINT "OTH_shape_check" CHECK (
  version >= 1
  AND ("taskContext" IS NULL OR (jsonb_typeof("taskContext") = 'object'
    AND octet_length("taskContext"::text) <= 16384))
  AND ((state = 'open' AND "closedAt" IS NULL) OR (state = 'closed' AND "closedAt" IS NOT NULL))
);
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OSS_shape_check" CHECK (
  "credentialEpoch" >= 1 AND "routeVersion" >= 1 AND "modeVersion" >= 1 AND "openedOrdinal" >= 1
  AND "lastActivityOrdinal" >= "openedOrdinal"
  AND "lastActivityAt" >= "openedAt" AND "idleExpiresAt" = "lastActivityAt" + interval '15 minutes'
  AND "absoluteExpiresAt" > "openedAt"
  AND ((state = 'active' AND "closedAt" IS NULL AND "closeReason" IS NULL)
    OR (state IN ('closed','expired','revoked') AND "closedAt" IS NOT NULL AND "closeReason" IS NOT NULL))
);
ALTER TABLE "OperatorMessage" ADD CONSTRAINT "OM_shape_check" CHECK (
  direction IN ('in','out') AND "actorKind" IN ('operator','agent','system')
  AND length("actorName") BETWEEN 1 AND 160
  AND jsonb_typeof(content) = 'object' AND octet_length(content::text) <= 65536
  AND "accessClass" IN ('finance','inventory_manage','inventory_read','private_generic')
  AND jsonb_typeof("accessProjection") = 'object' AND octet_length("accessProjection"::text) <= 4096
  AND "permissionEpoch" >= 1 AND "tenantAccessEpoch" >= 1
  AND ((direction = 'in' AND "incomingJobId" IS NOT NULL AND "actorKind" = 'operator')
    OR (direction = 'out' AND "incomingJobId" IS NULL AND "actorKind" IN ('agent','system')))
);
ALTER TABLE "OperatorInboundWork" ADD CONSTRAINT "OIW_shape_check" CHECK (
  length("stepKey") BETWEEN 1 AND 64 AND "inputHash" ~ '^[0-9a-f]{64}$'
  AND kind IN ('request','revise','refresh','discard','confirm','recover','select')
  AND state IN ('reserved','resolved','review')
  AND ((kind = 'request' AND "requestKey" IS NOT NULL AND "actionId" IS NULL AND "expectedRevision" IS NULL)
    OR (kind = 'recover' AND "requestKey" IS NULL AND
      (("operationalRequestId" IS NOT NULL AND "actionId" IS NULL AND "expectedRevision" IS NULL)
        OR ("operationalRequestId" IS NULL AND "actionId" IS NOT NULL
          AND "expectedRevision" IS NOT NULL AND "expectedRevision" >= 1)))
    OR (kind NOT IN ('request','recover') AND "requestKey" IS NULL AND "operationalRequestId" IS NULL
      AND "actionId" IS NOT NULL AND "expectedRevision" IS NOT NULL AND "expectedRevision" >= 1))
  AND (result IS NULL OR (jsonb_typeof(result) = 'object' AND octet_length(result::text) <= 16384))
  AND ((state = 'reserved' AND "resolvedAt" IS NULL)
    OR (state IN ('resolved','review') AND "resolvedAt" IS NOT NULL AND result IS NOT NULL))
);
ALTER TABLE "OperatorReview" ADD CONSTRAINT "ORV_shape_check" CHECK (
  revision >= 1 AND "permissionEpoch" >= 1 AND "tenantAccessEpoch" >= 1
  AND "payloadHash" ~ '^[0-9a-f]{64}$' AND "previewHash" ~ '^[0-9a-f]{64}$'
  AND ((kind = 'basis' AND "basisId" IS NULL AND "sessionId" IS NULL AND "messageId" IS NULL)
    OR (kind = 'display' AND "basisId" IS NOT NULL AND "sessionId" IS NOT NULL
      AND "messageId" IS NOT NULL AND "expiresAt" IS NOT NULL))
);
ALTER TABLE "OperatorInteraction" ADD CONSTRAINT "OI_shape_check" CHECK (
  kind IN ('confirm','revise','discard','select_product','continue')
  AND "tokenDigest" ~ '^[0-9a-f]{64}$'
  AND "modeVersion" >= 1 AND "routeVersion" >= 1 AND "permissionEpoch" >= 1 AND "tenantAccessEpoch" >= 1
  AND "expiresAt" > "createdAt"
  AND ((kind IN ('confirm','revise','discard') AND "actionId" IS NOT NULL
      AND "expectedRevision" IS NOT NULL AND "expectedRevision" >= 1 AND "productId" IS NULL)
    OR (kind = 'select_product' AND "actionId" IS NOT NULL AND "expectedRevision" IS NOT NULL
      AND "expectedRevision" >= 1 AND "productId" IS NOT NULL AND "selectionContext" IS NOT NULL
      AND jsonb_typeof("selectionContext") = 'object')
    OR (kind = 'continue' AND "actionId" IS NULL AND "expectedRevision" IS NULL
      AND "productId" IS NULL AND "selectionContext" IS NOT NULL AND jsonb_typeof("selectionContext") = 'object'))
  AND (kind <> 'confirm' OR "reviewId" IS NOT NULL)
  AND ((state = 'prepared' AND "offeredAt" IS NULL AND "providerMessageId" IS NULL AND "consumedAt" IS NULL)
    OR (state = 'offered' AND "offeredAt" IS NOT NULL AND "providerMessageId" IS NOT NULL AND "consumedAt" IS NULL)
    OR (state = 'consumed' AND "offeredAt" IS NOT NULL AND "providerMessageId" IS NOT NULL AND "consumedAt" IS NOT NULL)
    OR (state = 'invalidated' AND "consumedAt" IS NULL))
  AND ("receiptId" IS NULL OR (kind = 'confirm' AND state = 'consumed'))
  AND (state <> 'consumed' OR kind <> 'confirm' OR "receiptId" IS NOT NULL)
);
ALTER TABLE "OperatorDelivery" ADD CONSTRAINT "OD_shape_check" CHECK (
  "routeVersion" >= 1 AND "modeVersion" >= 0 AND "replyOrdinal" >= 0
  AND "claimGeneration" >= 0 AND "attemptCount" BETWEEN 0 AND 4
  AND ((kind = 'private' AND "principalKey" IS NOT NULL AND "sessionId" IS NOT NULL AND "messageId" IS NOT NULL
      AND "permissionEpoch" IS NOT NULL AND "permissionEpoch" >= 1
      AND "tenantAccessEpoch" IS NOT NULL AND "tenantAccessEpoch" >= 1 AND "controlCode" IS NULL)
    OR (kind = 'control' AND "principalKey" IS NULL AND "sessionId" IS NULL AND "messageId" IS NULL
      AND "permissionEpoch" IS NULL AND "tenantAccessEpoch" IS NULL
      AND "controlCode" IS NOT NULL
      AND "controlCode" IN ('link_proved','link_invalid','access_denied','session_expired','use_dashboard','use_text','customer_mode')))
  AND ((state = 'prepared' AND "claimOwner" IS NULL AND "claimUntil" IS NULL)
    OR (state = 'sending' AND "claimOwner" IS NOT NULL AND "claimUntil" IS NOT NULL AND "claimGeneration" >= 1 AND "attemptCount" >= 1)
    OR (state IN ('accepted','rejected','blocked','uncertain') AND "claimOwner" IS NULL AND "claimUntil" IS NULL))
  AND ((state = 'accepted' AND "acceptedAt" IS NOT NULL AND "providerMessageId" IS NOT NULL)
    OR (state <> 'accepted' AND "acceptedAt" IS NULL))
);
ALTER TABLE "OperatorAudit" ADD CONSTRAINT "OAU_shape_check" CHECK (
  "actorKind" IN ('operator','administrator','service','source_change')
  AND "causeKey" ~ '^[0-9a-f]{64}$' AND length("eventCode") BETWEEN 1 AND 48
  AND jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 16384
  AND (("deliveryId" IS NULL AND "attemptNumber" IS NULL)
    OR ("deliveryId" IS NOT NULL AND "attemptNumber" IS NOT NULL AND "attemptNumber" BETWEEN 1 AND 4))
  AND ("actorKind" NOT IN ('operator','administrator') OR "actorPrincipalKey" IS NOT NULL)
  AND ("ownerPrincipalKey" IS NULL OR "tenantId" IS NOT NULL)
);
ALTER TABLE "InboundJob" ADD CONSTRAINT "IJ_operator_shape_check" CHECK (
  "envelopeVersion" IN (1,2) AND "channelClaimGeneration" >= 0
  AND (("envelopeVersion" = 1 AND "channelTenantId" IS NULL AND "channelRouteId" IS NULL
      AND "channelParticipantId" IS NULL AND "channelOrdinal" IS NULL AND "channelRouteVersion" IS NULL
      AND "channelInputHash" IS NULL AND "channelResultKind" IS NULL AND "channelPrincipalKey" IS NULL
      AND "channelSessionId" IS NULL AND "channelModeVersion" IS NULL AND "channelClaimOwner" IS NULL)
    OR ("envelopeVersion" = 2 AND "channelTenantId" IS NOT NULL AND "channelRouteId" IS NOT NULL
      AND "channelParticipantId" IS NOT NULL AND "channelOrdinal" IS NOT NULL AND "channelOrdinal" >= 1
      AND "channelRouteVersion" IS NOT NULL AND "channelRouteVersion" >= 1
      AND "channelInputHash" IS NOT NULL AND "channelInputHash" ~ '^[0-9a-f]{64}$'
      AND ("channelResultKind" IS NULL OR "channelResultKind" IN ('customer','operator','control','blocked'))
      AND (("channelResultKind" IS NULL AND "channelModeVersion" IS NULL)
        OR ("channelResultKind" IS NOT NULL AND "channelModeVersion" IS NOT NULL AND "channelModeVersion" >= 0))
      AND ((status = 'claimed' AND "channelClaimOwner" IS NOT NULL AND "channelClaimGeneration" >= 1 AND "leaseExpiresAt" IS NOT NULL)
        OR (status <> 'claimed' AND "channelClaimOwner" IS NULL))
      AND (("channelResultKind" = 'operator' AND "channelPrincipalKey" IS NOT NULL AND "channelSessionId" IS NOT NULL
          AND "channelModeVersion" IS NOT NULL AND "channelModeVersion" >= 1)
        OR (("channelResultKind" IS NULL OR "channelResultKind" <> 'operator')
          AND "channelPrincipalKey" IS NULL AND "channelSessionId" IS NULL))))
);
