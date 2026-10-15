BEGIN;
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

-- Application-independent integrity, invalidation and audit guards.

CREATE FUNCTION operator_digest_v1(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT encode(sha256(convert_to(value,'UTF8')),'hex') $$;
CREATE FUNCTION operator_text_set(value text[]) RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ SELECT coalesce(array_agg(DISTINCT item ORDER BY item),ARRAY[]::text[]) FROM unnest(value) item $$;

CREATE FUNCTION operator_source_audit(t text, p text, code text, cause text, details jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "OperatorAudit" (id,"tenantId","ownerPrincipalKey","actorKind","eventCode","causeKey",evidence,"createdAt")
  VALUES (gen_random_uuid()::text,t,p,'source_change',code,operator_digest_v1('source:v1:'||cause),details,clock_timestamp())
  ON CONFLICT ("causeKey") DO NOTHING;
END $$;

CREATE FUNCTION operator_subject_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member "Staff"; issuer "OperatorAuthority";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id,NEW."tenantId",NEW."principalKey",NEW.kind,NEW."staffSourceId",NEW."authorityId",NEW."createdAt")
      IS DISTINCT FROM (OLD.id,OLD."tenantId",OLD."principalKey",OLD.kind,OLD."staffSourceId",OLD."authorityId",OLD."createdAt")
      OR NEW."credentialEpoch" < OLD."credentialEpoch" OR NEW."permissionEpoch" < OLD."permissionEpoch"
      OR (OLD.state='deleted' AND NEW.state<>'deleted') THEN
      RAISE EXCEPTION 'OS_SOURCE_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.state='active' THEN
    IF NEW.kind='staff' THEN
      SELECT * INTO member FROM "Staff" WHERE id=NEW."staffSourceId" FOR SHARE;
      IF NOT FOUND OR member."tenantId" IS DISTINCT FROM NEW."tenantId" OR NOT member.active
        OR NOT EXISTS (SELECT 1 FROM "StaffCredential" WHERE "staffId"=member.id AND active) THEN
        RAISE EXCEPTION 'OS_SOURCE_UNAVAILABLE' USING ERRCODE='23514';
      END IF;
    ELSE
      SELECT * INTO issuer FROM "OperatorAuthority" WHERE id=NEW."authorityId" FOR SHARE;
      IF NOT FOUND OR issuer.state<>'active' OR issuer."principalKey"<>NEW."principalKey" THEN
        RAISE EXCEPTION 'OS_AUTHORITY_MISMATCH' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OS_source_guard" BEFORE INSERT OR UPDATE ON "OperatorSubject"
FOR EACH ROW EXECUTE FUNCTION operator_subject_source_guard();

CREATE FUNCTION operator_bump_staff_access() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id text; cred_changed boolean; permission_changed boolean; target_tenant text; enabled boolean; row_record record;
BEGIN
  source_id := CASE WHEN TG_TABLE_NAME='Staff' THEN coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id')
    ELSE coalesce(to_jsonb(NEW)->>'staffId',to_jsonb(OLD)->>'staffId') END;
  IF TG_TABLE_NAME='Staff' THEN
    cred_changed := TG_OP<>'UPDATE' OR (NEW.active,NEW."tenantId") IS DISTINCT FROM (OLD.active,OLD."tenantId");
    permission_changed := TG_OP<>'UPDATE' OR NEW.role IS DISTINCT FROM OLD.role
      OR operator_text_set(NEW."accessPermissions") IS DISTINCT FROM operator_text_set(OLD."accessPermissions");
  ELSE
    cred_changed := TG_OP<>'UPDATE' OR (NEW.active,NEW.email,NEW."passwordHash",NEW."sessionVersion")
      IS DISTINCT FROM (OLD.active,OLD.email,OLD."passwordHash",OLD."sessionVersion");
    permission_changed := false;
  END IF;
  IF NOT cred_changed AND NOT permission_changed THEN RETURN NULL; END IF;
  SELECT s."tenantId", s.active AND coalesce(c.active,false) INTO target_tenant, enabled
    FROM "Staff" s LEFT JOIN "StaffCredential" c ON c."staffId"=s.id WHERE s.id=source_id;
  FOR row_record IN SELECT * FROM "OperatorSubject" WHERE kind='staff' AND "staffSourceId"=source_id ORDER BY id FOR UPDATE LOOP
    UPDATE "OperatorSubject" SET
      "credentialEpoch"="credentialEpoch"+CASE WHEN cred_changed THEN 1 ELSE 0 END,
      "permissionEpoch"="permissionEpoch"+CASE WHEN permission_changed THEN 1 ELSE 0 END,
      state=CASE WHEN row_record.state='deleted' OR (TG_TABLE_NAME='Staff' AND TG_OP='DELETE') THEN 'deleted'
        WHEN row_record."tenantId"=target_tenant AND enabled THEN 'active' ELSE 'disabled' END,
      "updatedAt"=clock_timestamp() WHERE id=row_record.id;
    PERFORM operator_source_audit(row_record."tenantId",row_record."principalKey",'STAFF_ACCESS_CHANGED',
      source_id||':'||row_record.id||':'||row_record."credentialEpoch"||':'||row_record."permissionEpoch"||':'||TG_TABLE_NAME,
      jsonb_build_object('subjectId',row_record.id,'source',TG_TABLE_NAME,'operation',TG_OP));
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER "OS_staff_access_epoch" AFTER INSERT OR UPDATE OR DELETE ON "Staff"
FOR EACH ROW EXECUTE FUNCTION operator_bump_staff_access();
CREATE TRIGGER "OS_credential_access_epoch" AFTER INSERT OR UPDATE OR DELETE ON "StaffCredential"
FOR EACH ROW EXECUTE FUNCTION operator_bump_staff_access();

CREATE FUNCTION operator_bump_tenant_access() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE changed boolean;
BEGIN
  changed := NEW.active IS DISTINCT FROM OLD.active OR NEW.phone IS DISTINCT FROM OLD.phone
    OR operator_text_set(NEW."activeModules") IS DISTINCT FROM operator_text_set(OLD."activeModules");
  IF NEW."operatorAccessEpoch" IS DISTINCT FROM OLD."operatorAccessEpoch" THEN
    RAISE EXCEPTION 'TEN_OPERATOR_EPOCH_MANUAL_CHANGE' USING ERRCODE='23514';
  END IF;
  IF changed THEN
    NEW."operatorAccessEpoch":=OLD."operatorAccessEpoch"+1;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      UPDATE "OperatorChannelRoute" SET state='disabled',version=version+1,"updatedAt"=clock_timestamp()
        WHERE "tenantId"=OLD.id;
    END IF;
    PERFORM operator_source_audit(OLD.id,NULL,'TENANT_ACCESS_CHANGED',OLD.id||':'||NEW."operatorAccessEpoch",
      jsonb_build_object('epoch',NEW."operatorAccessEpoch"::text));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "TEN_operator_access_epoch" BEFORE UPDATE ON "Tenant"
FOR EACH ROW EXECUTE FUNCTION operator_bump_tenant_access();

CREATE FUNCTION operator_authority_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fingerprint_changed boolean;
BEGIN
  IF TG_OP='UPDATE' THEN
    fingerprint_changed := (NEW."credentialGeneration",NEW."principalKey",NEW."keyVersion",NEW.state)
      IS DISTINCT FROM (OLD."credentialGeneration",OLD."principalKey",OLD."keyVersion",OLD.state);
    IF NEW.id<>OLD.id OR NEW.issuer<>OLD.issuer OR NEW.epoch<OLD.epoch
      OR (NEW."bootId"<>OLD."bootId" AND NEW.epoch<>OLD.epoch+1)
      OR NEW."credentialEpoch"<>OLD."credentialEpoch"+(CASE WHEN fingerprint_changed THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'OAUT_GENERATION_CHANGED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OAUT_state_guard" BEFORE INSERT OR UPDATE ON "OperatorAuthority"
FOR EACH ROW EXECUTE FUNCTION operator_authority_state_guard();

CREATE FUNCTION operator_route_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_channel "Channel"; selected_tenant "Tenant";
BEGIN
  IF TG_OP='UPDATE' AND ((NEW.id,NEW."tenantId",NEW.provider,NEW.receiver,NEW."channelId",NEW."createdAt")
    IS DISTINCT FROM (OLD.id,OLD."tenantId",OLD.provider,OLD.receiver,OLD."channelId",OLD."createdAt")
    OR NEW.version<OLD.version OR ((NEW.state,NEW."configHash") IS DISTINCT FROM (OLD.state,OLD."configHash") AND NEW.version<>OLD.version+1)) THEN
    RAISE EXCEPTION 'OCR_ROUTE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.state='enabled' THEN
    SELECT * INTO selected_channel FROM "Channel" WHERE id=NEW."channelId" FOR SHARE;
    SELECT * INTO selected_tenant FROM "Tenant" WHERE id=NEW."tenantId" FOR SHARE;
    IF selected_channel.id IS NULL OR selected_channel.type<>'whatsapp' OR NOT selected_channel.active
      OR (selected_channel."tenantId" IS NOT NULL AND selected_channel."tenantId"<>NEW."tenantId")
      OR selected_tenant.id IS NULL OR NOT selected_tenant.active OR selected_tenant.phone<>NEW.receiver
      OR (SELECT count(*) FROM "Tenant" WHERE active AND phone=NEW.receiver)<>1 THEN
      RAISE EXCEPTION 'OCR_CHANNEL_MISMATCH' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OCR_scope_guard" BEFORE INSERT OR UPDATE ON "OperatorChannelRoute"
FOR EACH ROW EXECUTE FUNCTION operator_route_scope_guard();
CREATE FUNCTION operator_channel_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.active,NEW.type,NEW."tenantId") IS DISTINCT FROM (OLD.active,OLD.type,OLD."tenantId") THEN
    UPDATE "OperatorChannelRoute" SET state='disabled',version=version+1,"updatedAt"=clock_timestamp() WHERE "channelId"=OLD.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "OCR_channel_changed" AFTER UPDATE ON "Channel" FOR EACH ROW EXECUTE FUNCTION operator_channel_changed();

CREATE FUNCTION operator_immutable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed text[]; old_json jsonb; new_json jsonb;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OPERATOR_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  allowed := CASE TG_TABLE_NAME
    WHEN 'OperatorProof' THEN ARRAY['consumedAt','result','nonceDigest','digestErasedAt']
    WHEN 'OperatorLinkChallenge' THEN ARRAY['state','failedAttempts','provedAt','phoneProofJobId','activationProofId','finishedAt','codeDigest','digestErasedAt']
    WHEN 'OperatorLink' THEN ARRAY['state','version','currentAuthorizationId','closedAt','closeReason']
    WHEN 'OperatorParticipant' THEN ARRAY['mode','modeVersion','admittedOrdinal','resolvedOrdinal','currentSessionId','blockedReason','updatedAt']
    WHEN 'OperatorSession' THEN ARRAY['state','lastActivityAt','lastActivityOrdinal','idleExpiresAt','closedAt','closeReason']
    WHEN 'OperatorThread' THEN ARRAY['state','version','selectedEmployeeId','selectedActionId','taskContext','closedAt']
    WHEN 'OperatorInboundWork' THEN ARRAY['operationalRequestId','state','result','resolvedAt']
    WHEN 'OperatorInteraction' THEN ARRAY['state','offeredAt','providerMessageId','consumedAt','receiptId','resultReference']
    WHEN 'OperatorDelivery' THEN ARRAY['state','claimGeneration','claimOwner','claimUntil','attemptCount','providerMessageId','acceptedAt','blockedReason','lastErrorCode','updatedAt']
    ELSE ARRAY[]::text[] END;
  old_json:=to_jsonb(OLD); new_json:=to_jsonb(NEW);
  IF old_json-allowed IS DISTINCT FROM new_json-allowed THEN
    RAISE EXCEPTION 'OPERATOR_FIELDS_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='OperatorProof' THEN
  IF ((OLD."consumedAt" IS NOT NULL AND (old_json->'result',old_json->'consumedAt') IS DISTINCT FROM (new_json->'result',new_json->'consumedAt'))
    OR (OLD."nonceDigest" IS NULL AND NEW."nonceDigest" IS NOT NULL)
    OR (OLD."nonceDigest" IS NOT NULL AND NEW."nonceDigest" IS NOT NULL AND OLD."nonceDigest"<>NEW."nonceDigest")
    OR (NEW."nonceDigest" IS NULL AND NEW."consumedAt" IS NULL AND NEW."expiresAt">clock_timestamp())) THEN
    RAISE EXCEPTION 'OPF_INVALID_CONSUMPTION' USING ERRCODE='23514';
  END IF;
  IF OLD."consumedAt" IS NULL AND NEW."consumedAt" IS NOT NULL AND NEW."expiresAt"<=clock_timestamp() THEN
    RAISE EXCEPTION 'OPF_EXPIRED' USING ERRCODE='23514';
  END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['OperatorProof','OperatorLinkChallenge','OperatorLink','OperatorAuthorization','OperatorParticipant','OperatorThread','OperatorSession','OperatorMessage','OperatorInboundWork','OperatorReview','OperatorInteraction','OperatorDelivery','OperatorAudit'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION operator_immutable_guard()',table_name||'_immutable',table_name);
  END LOOP;
END $$;

CREATE FUNCTION operator_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j jsonb; l "OperatorLink"; c "OperatorLinkChallenge"; s "OperatorSubject";
  a "OperatorAuthorization"; p "OperatorProof"; m "OperatorParticipant"; x "OperatorSession";
  th "OperatorThread"; msg "OperatorMessage"; r "OperatorReview"; rev "ActionRevision";
  job "InboundJob"; req "OperationalRequest"; act "OperationalAction"; rec "ExecutionReceipt";
  d "OperatorDelivery"; other_count bigint;
BEGIN
  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id=$1',TG_TABLE_NAME) INTO j USING NEW.id;
  IF j IS NULL THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME='OperatorLinkChallenge' THEN
    SELECT * INTO c FROM "OperatorLinkChallenge" WHERE id=j->>'id';
    SELECT * INTO p FROM "OperatorProof" WHERE id=c."startProofId";
    IF p."tenantId" IS DISTINCT FROM c."tenantId" OR p."principalKey" IS DISTINCT FROM c."principalKey"
      OR p.kind<>'recent_dashboard' OR p.purpose<>'link_start' OR p."consumedAt" IS NULL
      OR c."createdAt">p."expiresAt" OR c."createdAt"<p."issuedAt"-interval '5 seconds' THEN
      RAISE EXCEPTION 'OLC_START_PROOF_SCOPE' USING ERRCODE='23514';
    END IF;
    IF c."phoneProofJobId" IS NOT NULL THEN
      SELECT * INTO job FROM "InboundJob" WHERE id=c."phoneProofJobId";
      SELECT * INTO m FROM "OperatorParticipant" WHERE id=job."channelParticipantId";
      IF job."envelopeVersion"<>2 OR job."channelTenantId" IS DISTINCT FROM c."tenantId"
        OR job."channelRouteId" IS DISTINCT FROM c."routeId" OR m.phone IS DISTINCT FROM c.phone
        OR job.payload->>'kind' IS DISTINCT FROM 'link'
        OR (c."codeDigest" IS NOT NULL AND job.payload->>'codeDigest' IS DISTINCT FROM c."codeDigest") THEN
        RAISE EXCEPTION 'OLC_PHONE_PROOF_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
    IF c.state='consumed' THEN
      SELECT * INTO p FROM "OperatorProof" WHERE id=c."activationProofId";
      SELECT count(*) INTO other_count FROM "OperatorLink" WHERE "challengeId"=c.id;
      IF other_count<>1 OR p."tenantId" IS DISTINCT FROM c."tenantId" OR p."principalKey" IS DISTINCT FROM c."principalKey"
        OR p.purpose<>'link_activate' OR p.kind<>'recent_dashboard' OR p."consumedAt" IS NULL THEN
        RAISE EXCEPTION 'OLC_ACTIVATION_PROOF_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorLink' THEN
    SELECT * INTO l FROM "OperatorLink" WHERE id=j->>'id';
    SELECT * INTO c FROM "OperatorLinkChallenge" WHERE id=l."challengeId";
    SELECT * INTO s FROM "OperatorSubject" WHERE id=l."subjectId";
    IF c.state<>'consumed' OR (l."subjectId",l."routeId",l.phone,l."credentialEpoch",l."adminGeneration")
      IS DISTINCT FROM (c."subjectId",c."routeId",c.phone,c."credentialEpoch",c."adminGeneration")
      OR (s.kind='admin') IS DISTINCT FROM (l."adminGeneration" IS NOT NULL) THEN
      RAISE EXCEPTION 'OL_CHALLENGE_SCOPE' USING ERRCODE='23514';
    END IF;
    SELECT count(*) INTO other_count FROM "OperatorThread" WHERE "linkId"=l.id;
    IF other_count<>1 THEN RAISE EXCEPTION 'OL_THREAD_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='OperatorAuthorization' THEN
    SELECT * INTO a FROM "OperatorAuthorization" WHERE id=j->>'id';
    SELECT * INTO l FROM "OperatorLink" WHERE id=a."linkId";
    SELECT * INTO p FROM "OperatorProof" WHERE id=a."proofId";
    IF (a."credentialEpoch",a."adminGeneration") IS DISTINCT FROM (l."credentialEpoch",l."adminGeneration")
      OR p."tenantId" IS DISTINCT FROM a."tenantId" OR p."principalKey" IS DISTINCT FROM a."principalKey"
      OR p."consumedAt" IS NULL OR p.kind<>'recent_dashboard'
      OR p.purpose<>(CASE WHEN a.number=1 THEN 'link_activate' ELSE 'link_renew' END)
      OR a."issuedAt">p."expiresAt" OR a."issuedAt"<p."issuedAt"-interval '5 seconds' THEN
      RAISE EXCEPTION 'OAZ_PROOF_SCOPE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorThread' THEN
    SELECT * INTO th FROM "OperatorThread" WHERE id=j->>'id';
    SELECT * INTO l FROM "OperatorLink" WHERE id=th."linkId";
    IF th."routeId"<>l."routeId" THEN RAISE EXCEPTION 'OTH_ROUTE_SCOPE' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='OperatorParticipant' THEN
    SELECT * INTO m FROM "OperatorParticipant" WHERE id=j->>'id';
    IF m.mode='business' THEN
      SELECT * INTO x FROM "OperatorSession" WHERE id=m."currentSessionId";
      IF x.state<>'active' OR x."modeVersion"<>m."modeVersion" THEN RAISE EXCEPTION 'OPT_SESSION_SCOPE' USING ERRCODE='23514'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorSession' THEN
    SELECT * INTO x FROM "OperatorSession" WHERE id=j->>'id';
    SELECT * INTO l FROM "OperatorLink" WHERE id=x."linkId";
    SELECT * INTO th FROM "OperatorThread" WHERE id=x."threadId";
    SELECT * INTO m FROM "OperatorParticipant" WHERE id=x."participantId";
    SELECT * INTO a FROM "OperatorAuthorization" WHERE id=x."authorizationId";
    IF th."linkId"<>l.id OR m."routeId"<>l."routeId" OR m.phone<>l.phone OR x."absoluteExpiresAt"<>a."expiresAt"
      OR x."credentialEpoch"<>l."credentialEpoch" OR x."routeVersion"<>a."routeVersion"
      OR x."openedOrdinal">m."admittedOrdinal" OR x."lastActivityOrdinal">m."admittedOrdinal" THEN
      RAISE EXCEPTION 'OSS_LINK_SCOPE' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorMessage' THEN
    SELECT * INTO msg FROM "OperatorMessage" WHERE id=j->>'id';
    SELECT * INTO x FROM "OperatorSession" WHERE id=msg."sessionId";
    IF msg."threadId"<>x."threadId" THEN RAISE EXCEPTION 'OM_THREAD_SCOPE' USING ERRCODE='23514'; END IF;
    IF msg."incomingJobId" IS NOT NULL THEN
      SELECT * INTO job FROM "InboundJob" WHERE id=msg."incomingJobId";
      IF (job."channelTenantId",job."channelPrincipalKey",job."channelSessionId",job."channelResultKind")
        IS DISTINCT FROM (msg."tenantId",msg."principalKey",msg."sessionId",'operator'::text) THEN
        RAISE EXCEPTION 'OM_INCOMING_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorInboundWork' THEN
    SELECT * INTO job FROM "InboundJob" WHERE id=j->>'jobId';
    IF (job."channelTenantId",job."channelPrincipalKey",job."channelSessionId",job."channelResultKind")
      IS DISTINCT FROM (j->>'tenantId',j->>'principalKey',j->>'sessionId','operator'::text) THEN
      RAISE EXCEPTION 'OIW_JOB_SCOPE' USING ERRCODE='23514';
    END IF;
    IF j->>'operationalRequestId' IS NOT NULL THEN
      SELECT * INTO req FROM "OperationalRequest" WHERE id=j->>'operationalRequestId';
      IF (req."tenantId",req."principalKey") IS DISTINCT FROM (j->>'tenantId',j->>'principalKey')
        OR (j->>'kind'='request' AND req."requestId"::text IS DISTINCT FROM j->>'requestKey') THEN
        RAISE EXCEPTION 'OIW_REQUEST_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorReview' THEN
    SELECT * INTO r FROM "OperatorReview" WHERE id=j->>'id';
    SELECT * INTO rev FROM "ActionRevision" WHERE "actionId"=r."actionId" AND number=r.revision;
    IF rev."payloadHash" IS DISTINCT FROM r."payloadHash" OR r."previewHash" IS DISTINCT FROM operator_digest_v1(operator_canonical_json(rev.preview)) THEN
      RAISE EXCEPTION 'ORV_PAYLOAD_CHANGED' USING ERRCODE='23514';
    END IF;
    IF r.kind='display' THEN
      SELECT * INTO msg FROM "OperatorMessage" WHERE id=r."messageId";
      SELECT * INTO x FROM "OperatorSession" WHERE id=r."sessionId";
      IF NOT EXISTS (SELECT 1 FROM "OperatorReview" b WHERE b.id=r."basisId" AND b.kind='basis'
        AND b."actionId"=r."actionId" AND b.revision=r.revision AND b."payloadHash"=r."payloadHash"
        AND b."permissionEpoch"=r."permissionEpoch" AND b."tenantAccessEpoch"=r."tenantAccessEpoch")
        OR msg."sessionId"<>x.id OR msg.direction<>'out'
        OR r."expiresAt">least(x."idleExpiresAt",x."absoluteExpiresAt",coalesce(rev."expiresAt",x."absoluteExpiresAt")) THEN
        RAISE EXCEPTION 'ORV_DISPLAY_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorInteraction' THEN
    SELECT * INTO msg FROM "OperatorMessage" WHERE id=j->>'messageId';
    IF msg."sessionId" IS DISTINCT FROM j->>'sessionId' OR msg.direction<>'out' THEN
      RAISE EXCEPTION 'OI_MESSAGE_SCOPE' USING ERRCODE='23514';
    END IF;
    IF j->>'state' IN ('offered','consumed') AND NOT EXISTS (SELECT 1 FROM "OperatorDelivery" od
      WHERE od."messageId"=msg.id AND od.state='accepted' AND od."providerMessageId"=j->>'providerMessageId') THEN
      RAISE EXCEPTION 'OI_DELIVERY_REQUIRED' USING ERRCODE='23514';
    END IF;
    IF j->>'kind'='confirm' THEN
      SELECT * INTO r FROM "OperatorReview" WHERE id=j->>'reviewId';
      IF r.kind<>'display' OR r."messageId"<>msg.id OR r."sessionId" IS DISTINCT FROM j->>'sessionId'
        OR r."actionId" IS DISTINCT FROM j->>'actionId' OR r.revision IS DISTINCT FROM (j->>'expectedRevision')::int THEN
        RAISE EXCEPTION 'OI_REVIEW_SCOPE' USING ERRCODE='23514';
      END IF;
      IF j->>'state'='consumed' THEN
        SELECT * INTO rec FROM "ExecutionReceipt" WHERE id=j->>'receiptId';
        IF rec."actionId" IS DISTINCT FROM j->>'actionId' OR rec."revisionNumber" IS DISTINCT FROM (j->>'expectedRevision')::int
          OR rec."payloadHash" IS DISTINCT FROM r."payloadHash" THEN
          RAISE EXCEPTION 'OI_RECEIPT_SCOPE' USING ERRCODE='23514';
        END IF;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='OperatorDelivery' THEN
    SELECT * INTO d FROM "OperatorDelivery" WHERE id=j->>'id';
    SELECT * INTO job FROM "InboundJob" WHERE id=d."sourceJobId";
    IF (job."channelTenantId",job."channelRouteId",job."channelParticipantId",job."channelRouteVersion",job."channelModeVersion")
      IS DISTINCT FROM (d."tenantId",d."routeId",d."participantId",d."routeVersion",d."modeVersion") THEN
      RAISE EXCEPTION 'OD_SOURCE_SCOPE' USING ERRCODE='23514';
    END IF;
    IF d.kind='private' THEN
      SELECT * INTO msg FROM "OperatorMessage" WHERE id=d."messageId";
      IF msg.direction<>'out' OR msg."sessionId"<>d."sessionId"
        OR (job."channelResultKind",job."channelPrincipalKey",job."channelSessionId") IS DISTINCT FROM ('operator'::text,d."principalKey",d."sessionId")
        OR (msg."permissionEpoch",msg."tenantAccessEpoch") IS DISTINCT FROM (d."permissionEpoch",d."tenantAccessEpoch") THEN
        RAISE EXCEPTION 'OD_MESSAGE_SCOPE' USING ERRCODE='23514';
      END IF;
    END IF;
    IF d.state='accepted' AND NOT EXISTS(SELECT 1 FROM "OperatorAudit" oa WHERE oa."deliveryId"=d.id AND oa."attemptNumber"=d."attemptCount" AND oa."eventCode"='provider_call_authorized') THEN
      RAISE EXCEPTION 'OD_AUTHORIZATION_AUDIT_REQUIRED' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorAudit' AND j->>'deliveryId' IS NOT NULL THEN
    SELECT * INTO d FROM "OperatorDelivery" WHERE id=j->>'deliveryId';
    IF (d."tenantId",d."principalKey") IS DISTINCT FROM (j->>'tenantId',j->>'ownerPrincipalKey') THEN
      RAISE EXCEPTION 'OAU_DELIVERY_SCOPE' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['OperatorLinkChallenge','OperatorLink','OperatorAuthorization','OperatorThread','OperatorParticipant','OperatorSession','OperatorMessage','OperatorInboundWork','OperatorReview','OperatorInteraction','OperatorDelivery','OperatorAudit'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION operator_scope_guard()',table_name||'_scope',table_name);
  END LOOP;
END $$;

CREATE FUNCTION operator_cycle_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_j jsonb:=to_jsonb(OLD); new_j jsonb:=to_jsonb(NEW); old_state text; new_state text;
BEGIN
  old_state:=old_j->>'state'; new_state:=new_j->>'state';
  IF TG_TABLE_NAME='OperatorLink' THEN
    IF OLD.state<>'active' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OL_CLOSED' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='OperatorSession' THEN
    IF OLD.state<>'active' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OSS_CLOSED' USING ERRCODE='23514'; END IF;
    IF NEW."lastActivityAt" IS DISTINCT FROM OLD."lastActivityAt" AND
      (NEW."lastActivityOrdinal"<=OLD."lastActivityOrdinal" OR NEW."lastActivityAt"<OLD."lastActivityAt"
        OR clock_timestamp()>=OLD."idleExpiresAt" OR clock_timestamp()>=OLD."absoluteExpiresAt") THEN
      RAISE EXCEPTION 'OSS_ACTIVITY_REPLAY' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorLinkChallenge' THEN
    IF OLD.state NOT IN ('pending','proved') AND
      old_j-ARRAY['codeDigest','digestErasedAt'] IS DISTINCT FROM new_j-ARRAY['codeDigest','digestErasedAt'] THEN
      RAISE EXCEPTION 'OLC_CLOSED' USING ERRCODE='23514';
    END IF;
    IF NEW."failedAttempts"<OLD."failedAttempts" OR NEW."failedAttempts">OLD."failedAttempts"+1 OR (NEW.state IN ('proved','consumed') AND NEW.state<>OLD.state AND NEW."expiresAt"<=clock_timestamp()) THEN
      RAISE EXCEPTION 'OLC_EXPIRED_OR_REPLAY' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorInteraction' THEN
    IF OLD.state IN ('consumed','invalidated') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OI_CLOSED' USING ERRCODE='23514'; END IF;
    IF NEW.state='consumed' AND OLD.state<>'consumed' AND (OLD.state<>'offered' OR NEW."expiresAt"<=clock_timestamp()) THEN
      RAISE EXCEPTION 'OI_EXPIRED_OR_UNOFFERED' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorDelivery' THEN
    IF OLD.state IN ('accepted','blocked','uncertain') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OD_TERMINAL' USING ERRCODE='23514'; END IF;
    IF NEW.state='sending' AND (OLD.state NOT IN ('prepared','rejected','sending') OR NEW."claimGeneration"<OLD."claimGeneration") THEN
      RAISE EXCEPTION 'OD_INVALID_ATTEMPT' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='OperatorParticipant' THEN
    IF NEW."modeVersion"<OLD."modeVersion" OR NEW."admittedOrdinal"<OLD."admittedOrdinal" OR NEW."resolvedOrdinal"<OLD."resolvedOrdinal"
      OR NEW."resolvedOrdinal">OLD."resolvedOrdinal"+1 OR NEW."admittedOrdinal">OLD."admittedOrdinal"+1
      OR ((NEW.mode,NEW."currentSessionId") IS DISTINCT FROM (OLD.mode,OLD."currentSessionId") AND NEW."modeVersion"<>OLD."modeVersion"+1) THEN
      RAISE EXCEPTION 'OPT_MODE_FENCE' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['OperatorLink','OperatorSession','OperatorLinkChallenge','OperatorInteraction','OperatorDelivery','OperatorParticipant'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION operator_cycle_guard()',table_name||'_cycle',table_name);
  END LOOP;
END $$;

CREATE FUNCTION operator_canonical_json(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE result text;
BEGIN
  IF jsonb_typeof(value)='object' THEN
    SELECT '{'||coalesce(string_agg(to_jsonb(k)::text||':'||operator_canonical_json(v),',' ORDER BY k COLLATE "C"),'')||'}'
      INTO result FROM jsonb_each(value) e(k,v);
  ELSIF jsonb_typeof(value)='array' THEN
    SELECT '['||coalesce(string_agg(operator_canonical_json(v),',' ORDER BY n),'')||']'
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY e(v,n);
  ELSE result:=value::text;
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION operator_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'OPERATOR_SOURCE_HISTORY_REQUIRED' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "OAUT_no_delete" BEFORE DELETE ON "OperatorAuthority" FOR EACH ROW EXECUTE FUNCTION operator_no_delete();
CREATE TRIGGER "OS_no_delete" BEFORE DELETE ON "OperatorSubject" FOR EACH ROW EXECUTE FUNCTION operator_no_delete();
CREATE TRIGGER "OCR_no_delete" BEFORE DELETE ON "OperatorChannelRoute" FOR EACH ROW EXECUTE FUNCTION operator_no_delete();

CREATE FUNCTION operator_inbound_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_json jsonb; after_json jsonb; participant "OperatorParticipant";
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD."envelopeVersion"=2 THEN RAISE EXCEPTION 'IJ_OPERATOR_IMMUTABLE' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW."envelopeVersion" IS DISTINCT FROM OLD."envelopeVersion" THEN RAISE EXCEPTION 'IJ_ENVELOPE_IMMUTABLE' USING ERRCODE='23514'; END IF;
    IF OLD."envelopeVersion"=2 THEN
      before_json:=to_jsonb(OLD); after_json:=to_jsonb(NEW);
      IF before_json-ARRAY['status','attempts','lastError','phase','replies','replyCursor','nextAttemptAt','leaseExpiresAt','claimedAt','finishedAt',
        'channelResultKind','channelPrincipalKey','channelSessionId','channelModeVersion','channelClaimGeneration','channelClaimOwner']
        IS DISTINCT FROM after_json-ARRAY['status','attempts','lastError','phase','replies','replyCursor','nextAttemptAt','leaseExpiresAt','claimedAt','finishedAt',
        'channelResultKind','channelPrincipalKey','channelSessionId','channelModeVersion','channelClaimGeneration','channelClaimOwner']
        OR (OLD."channelResultKind" IS NOT NULL AND (NEW."channelResultKind",NEW."channelPrincipalKey",NEW."channelSessionId",NEW."channelModeVersion")
          IS DISTINCT FROM (OLD."channelResultKind",OLD."channelPrincipalKey",OLD."channelSessionId",OLD."channelModeVersion"))
        OR NEW."channelClaimGeneration"<OLD."channelClaimGeneration"
        OR (NEW."channelClaimOwner" IS DISTINCT FROM OLD."channelClaimOwner" AND NEW."channelClaimOwner" IS NOT NULL AND NEW."channelClaimGeneration"<>OLD."channelClaimGeneration"+1)
        OR (OLD.status IN ('done','failed','needs_review') AND NEW IS DISTINCT FROM OLD) THEN
        RAISE EXCEPTION 'IJ_OPERATOR_FENCE_CHANGED' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  IF NEW."envelopeVersion"=2 THEN
    SELECT * INTO participant FROM "OperatorParticipant" WHERE id=NEW."channelParticipantId";
    IF NEW.payload->>'v' IS DISTINCT FROM '2' OR NEW.payload->>'id' IS DISTINCT FROM NEW."providerEventId"
      OR NEW.payload->>'from' IS DISTINCT FROM participant.phone OR NEW."channelOrdinal">participant."admittedOrdinal"
      OR NEW."channelInputHash" IS DISTINCT FROM operator_digest_v1(operator_canonical_json(NEW.payload))
      OR NEW.payload ? 'code' OR NEW.payload ? 'token' OR NEW.payload ? 'password'
      OR (NEW.payload->>'kind'='link' AND (NEW.payload ? 'text' OR NEW.payload ? 'body')) THEN
      RAISE EXCEPTION 'IJ_OPERATOR_ENVELOPE_INVALID' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "IJ_operator_guard" BEFORE INSERT OR UPDATE OR DELETE ON "InboundJob"
FOR EACH ROW EXECUTE FUNCTION operator_inbound_guard();

CREATE FUNCTION operator_work_terminal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state<>'reserved' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OIW_TERMINAL' USING ERRCODE='23514'; END IF;
  IF OLD."operationalRequestId" IS NOT NULL AND NEW."operationalRequestId" IS DISTINCT FROM OLD."operationalRequestId" THEN
    RAISE EXCEPTION 'OIW_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OIW_terminal_guard" BEFORE UPDATE ON "OperatorInboundWork" FOR EACH ROW EXECUTE FUNCTION operator_work_terminal_guard();

COMMIT;
