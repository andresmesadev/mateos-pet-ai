-- Complement to the validated Prisma DSL. No data backfill.
ALTER TABLE "OperationalAction" ALTER CONSTRAINT "OA_current_revision_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "OperationalRequest" ADD CONSTRAINT "OR_shape_ck" CHECK (
  length("principalKey")>0 AND "contractVersion">0 AND "canonicalVersion">0
  AND "inputMode" IN ('texto','estructurado') AND jsonb_typeof("canonicalInput")='object'
  AND "inputHash" ~ '^[0-9a-f]{64}$' AND "claimGeneration">=0 AND "attemptCount" BETWEEN 0 AND 3
  AND state IN ('pendiente','procesando','resuelta','requiere_revision')
  AND ((state='procesando' AND "claimOwner" IS NOT NULL AND "claimUntil" IS NOT NULL AND "claimGeneration">0 AND "attemptCount">0)
    OR (state<>'procesando' AND "claimOwner" IS NULL AND "claimUntil" IS NULL))
  AND (state<>'resuelta' OR ("resultCode" IS NOT NULL AND result IS NOT NULL AND jsonb_typeof(result)='object'))
);
ALTER TABLE "OperationalAction" ADD CONSTRAINT "OA_shape_ck" CHECK (
  kind IN ('registrar_gasto','entrada_inventario') AND "currentRevision">0
  AND state IN ('borrador','lista','confirmada','descartada','vencida','rechazada')
  AND ((state IN ('borrador','lista') AND "closedAt" IS NULL) OR (state IN ('confirmada','descartada','vencida','rechazada') AND "closedAt" IS NOT NULL))
  AND (state NOT IN ('descartada','vencida','rechazada') OR ("terminalReason" IS NOT NULL AND length("terminalReason")>0))
);
ALTER TABLE "ActionRevision" ADD CONSTRAINT "AR_shape_ck" CHECK (
  number>0 AND "contractVersion">0 AND "canonicalVersion">0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
  AND jsonb_typeof(payload)='object' AND jsonb_typeof(preview)='object' AND jsonb_typeof("missingFields")='array'
  AND (("validationState"='lista' AND jsonb_array_length("missingFields")=0 AND "expiresAt" IS NOT NULL AND "expiresAt"="createdAt"+interval '15 minutes')
    OR ("validationState"='borrador' AND jsonb_array_length("missingFields")>0 AND "expiresAt" IS NULL))
);
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ER_shape_ck" CHECK (
  "revisionNumber">0 AND "contractVersion">0 AND "resultVersion">0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
  AND length("actorName")>0 AND "actorRole" IN ('admin','vet','groomer','receptionist') AND jsonb_typeof(result)='object'
  AND ((kind='registrar_gasto' AND "expenseId" IS NOT NULL AND "inventoryOperationId" IS NULL)
    OR (kind='entrada_inventario' AND "expenseId" IS NULL AND "inventoryOperationId" IS NOT NULL))
);
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PI_shape_ck" CHECK (
  ordinal>=0 AND "canonicalVersion">0 AND "claimGeneration">=0 AND "certificationTries">=0
  AND length("causeKey")>0 AND length("eventName")>0 AND length(origin)>0 AND jsonb_typeof(payload)='object'
  AND "envelopeHash" ~ '^[0-9a-f]{64}$'
  AND "certificationState" IN ('pendiente','certificada','requiere_revision')
  AND (("certificationState"='certificada' AND "domainEventId" IS NOT NULL AND "domainEventId"=id AND "certifiedAt" IS NOT NULL)
    OR ("certificationState"<>'certificada' AND "domainEventId" IS NULL AND "certifiedAt" IS NULL))
  AND (("claimOwner" IS NULL AND "claimUntil" IS NULL) OR ("claimOwner" IS NOT NULL AND "claimUntil" IS NOT NULL AND "certificationState"='pendiente' AND "claimGeneration">0))
  AND (("notificationState"='no_iniciada' AND "notificationId" IS NULL AND "notificationStarted" IS NULL AND "notificationEnded" IS NULL)
    OR ("certificationState"='certificada' AND "claimOwner" IS NULL AND "claimUntil" IS NULL AND "notificationId" IS NOT NULL AND "notificationStarted" IS NOT NULL
      AND (("notificationState"='iniciada' AND "notificationEnded" IS NULL)
        OR ("notificationState" IN ('verificada','requiere_revision') AND "notificationEnded" IS NOT NULL))))
);

CREATE FUNCTION op_assistant_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Operational evidence is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER op_assistant_revision_immutable BEFORE UPDATE OR DELETE ON "ActionRevision" FOR EACH ROW EXECUTE FUNCTION op_assistant_immutable();
CREATE TRIGGER op_assistant_receipt_immutable BEFORE UPDATE OR DELETE ON "ExecutionReceipt" FOR EACH ROW EXECUTE FUNCTION op_assistant_immutable();

CREATE FUNCTION op_assistant_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Operational request cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','claimGeneration','claimOwner','claimUntil','attemptCount','resultCode','result','lastErrorCode','updatedAt'])
   IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','claimGeneration','claimOwner','claimUntil','attemptCount','resultCode','result','lastErrorCode','updatedAt'])
   OR (OLD.state IN ('resuelta','requiere_revision') AND NEW IS DISTINCT FROM OLD)
   OR NEW."claimGeneration"<OLD."claimGeneration" OR NEW."claimGeneration">OLD."claimGeneration"+1
   OR NEW."attemptCount"<OLD."attemptCount" OR NEW."attemptCount">OLD."attemptCount"+1
   OR (OLD.state='pendiente' AND NEW.state NOT IN ('pendiente','procesando','requiere_revision'))
 THEN RAISE EXCEPTION 'Invalid operational request transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER op_assistant_request_guard BEFORE UPDATE OR DELETE ON "OperationalRequest" FOR EACH ROW EXECUTE FUNCTION op_assistant_request_guard();

CREATE FUNCTION op_assistant_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Operational action cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','currentRevision','terminalReason','closedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','currentRevision','terminalReason','closedAt'])
   OR (OLD.state NOT IN ('borrador','lista') AND NEW IS DISTINCT FROM OLD)
   OR NEW."currentRevision"<OLD."currentRevision" OR NEW."currentRevision">OLD."currentRevision"+1
   OR (NEW."currentRevision"<>OLD."currentRevision" AND NEW.state NOT IN ('borrador','lista'))
 THEN RAISE EXCEPTION 'Invalid operational action transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER op_assistant_action_guard BEFORE UPDATE OR DELETE ON "OperationalAction" FOR EACH ROW EXECUTE FUNCTION op_assistant_action_guard();

CREATE FUNCTION op_assistant_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Publication evidence cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['certificationState','domainEventId','claimGeneration','claimOwner','claimUntil','certificationTries','nextAttemptAt','certificationError','certifiedAt','notificationState','notificationId','notificationStarted','notificationEnded','notificationCode','notificationEvidence','updatedAt'])
   IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['certificationState','domainEventId','claimGeneration','claimOwner','claimUntil','certificationTries','nextAttemptAt','certificationError','certifiedAt','notificationState','notificationId','notificationStarted','notificationEnded','notificationCode','notificationEvidence','updatedAt'])
   OR (OLD."domainEventId" IS NOT NULL AND (NEW."domainEventId" IS DISTINCT FROM OLD."domainEventId" OR NEW."certifiedAt" IS DISTINCT FROM OLD."certifiedAt" OR NEW."certificationState"<>'certificada'))
   OR (OLD."notificationId" IS NOT NULL AND (NEW."notificationId" IS DISTINCT FROM OLD."notificationId" OR NEW."notificationStarted" IS DISTINCT FROM OLD."notificationStarted" OR NEW."notificationState"='no_iniciada'))
   OR (OLD."notificationState"='verificada' AND NEW."notificationState"<>'verificada')
   OR NEW."claimGeneration"<OLD."claimGeneration" OR NEW."claimGeneration">OLD."claimGeneration"+1
   OR NEW."certificationTries"<OLD."certificationTries"
 THEN RAISE EXCEPTION 'Invalid publication transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER op_assistant_intent_guard BEFORE UPDATE OR DELETE ON "PublicationIntent" FOR EACH ROW EXECUTE FUNCTION op_assistant_intent_guard();

CREATE FUNCTION op_assistant_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked boolean;
BEGIN
 IF TG_TABLE_NAME='AgentTask' THEN
   SELECT EXISTS(SELECT 1 FROM "OperationalRequest" WHERE "taskId"=OLD.id) INTO linked;
   IF linked AND (TG_OP='DELETE' OR NEW."digitalEmployeeId" IS DISTINCT FROM OLD."digitalEmployeeId" OR (OLD.status<>'en_proceso' AND NEW IS DISTINCT FROM OLD))
   THEN RAISE EXCEPTION 'Operational task evidence is immutable' USING ERRCODE='23514'; END IF;
 ELSE
   SELECT EXISTS(SELECT 1 FROM "OperationalRequest" WHERE "taskId"=OLD."agentTaskId" OR (TG_OP='UPDATE' AND "taskId"=NEW."agentTaskId")) INTO linked;
   IF linked THEN RAISE EXCEPTION 'Operational decision is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER op_assistant_task_guard BEFORE UPDATE OR DELETE ON "AgentTask" FOR EACH ROW EXECUTE FUNCTION op_assistant_audit_guard();
CREATE TRIGGER op_assistant_decision_guard BEFORE UPDATE OR DELETE ON "AgentDecision" FOR EACH ROW EXECUTE FUNCTION op_assistant_audit_guard();

CREATE FUNCTION op_assistant_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "PublicationIntent" WHERE "domainEventId"=OLD.id) AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD)
 THEN RAISE EXCEPTION 'Operational event is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER op_assistant_event_guard BEFORE UPDATE OR DELETE ON "DomainEvent" FOR EACH ROW EXECUTE FUNCTION op_assistant_event_guard();

CREATE FUNCTION op_assistant_check_attention(request_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q "OperationalRequest"%ROWTYPE; a "OperationalAction"%ROWTYPE; v "ActionRevision"%ROWTYPE;
 r "ExecutionReceipt"%ROWTYPE; t "AgentTask"%ROWTYPE; d "AgentDecision"%ROWTYPE; io "InventoryOperation"%ROWTYPE; spec text; has_action boolean; has_receipt boolean;
BEGIN
 SELECT * INTO q FROM "OperationalRequest" WHERE id=request_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO a FROM "OperationalAction" WHERE "requestId"=q.id FOR UPDATE; has_action:=FOUND;
 SELECT * INTO t FROM "AgentTask" WHERE id=q."taskId";
 SELECT specialization INTO spec FROM "DigitalEmployee" WHERE id=q."employeeId";
 IF q.state IN ('pendiente','procesando') AND (t.status<>'en_proceso' OR has_action) THEN RAISE EXCEPTION 'Request/task mismatch' USING ERRCODE='23514'; END IF;
 IF q.state='requiere_revision' AND (t.status<>'escalada' OR NOT EXISTS(SELECT 1 FROM "Escalation" WHERE "agentTaskId"=t.id)) THEN RAISE EXCEPTION 'Escalation missing' USING ERRCODE='23514'; END IF;
 IF q.state='resuelta' AND NOT has_action AND (t.status<>'completada' OR t.result->>'outcome' IS DISTINCT FROM 'consulta') THEN RAISE EXCEPTION 'Query completion missing' USING ERRCODE='23514'; END IF;
 IF NOT has_action THEN RETURN; END IF;
 IF q.state<>'resuelta' OR (a.kind='registrar_gasto' AND spec<>'asistente_financiero') OR (a.kind='entrada_inventario' AND spec<>'asistente_administrativo') THEN RAISE EXCEPTION 'Action owner mismatch' USING ERRCODE='23514'; END IF;
 SELECT * INTO v FROM "ActionRevision" WHERE "actionId"=a.id AND number=a."currentRevision";
 IF NOT FOUND OR (a.state IN ('borrador','lista') AND a.state<>v."validationState") THEN RAISE EXCEPTION 'Current revision mismatch' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM "ExecutionReceipt" WHERE "actionId"=a.id; has_receipt:=FOUND;
 IF (a.state='confirmada')<>has_receipt THEN RAISE EXCEPTION 'Confirmation/receipt mismatch' USING ERRCODE='23514'; END IF;
 IF a.state IN ('borrador','lista') AND t.status<>'en_proceso' THEN RAISE EXCEPTION 'Open proposal task closed' USING ERRCODE='23514'; END IF;
 IF a.state NOT IN ('borrador','lista') AND (t.status<>'completada' OR t.result->>'actionId' IS DISTINCT FROM a.id OR t.result->>'outcome' IS DISTINCT FROM a.state) THEN RAISE EXCEPTION 'Action/task result mismatch' USING ERRCODE='23514'; END IF;
 IF t.status='completada' AND t.result->>'operationalRequestId' IS DISTINCT FROM q.id THEN RAISE EXCEPTION 'Task request mismatch' USING ERRCODE='23514'; END IF;
 IF has_receipt THEN
   IF r."revisionNumber"<>a."currentRevision" OR r."payloadHash"<>v."payloadHash" OR r."executionKey"<>a."executionKey" OR r."contractVersion"<>v."contractVersion" OR v."validationState"<>'lista' OR t.result->>'receiptId' IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'Receipt revision mismatch' USING ERRCODE='23514'; END IF;
   SELECT * INTO d FROM "AgentDecision" WHERE id=r."decisionId";
   IF d.input->>'actionId' IS DISTINCT FROM a.id OR d.input->>'revision' IS DISTINCT FROM a."currentRevision"::text OR d.input->>'payloadHash' IS DISTINCT FROM r."payloadHash" THEN RAISE EXCEPTION 'Execution decision mismatch' USING ERRCODE='23514'; END IF;
   IF r."inventoryOperationId" IS NOT NULL THEN
     SELECT * INTO io FROM "InventoryOperation" WHERE id=r."inventoryOperationId";
     IF io.kind<>'register_entry' OR io."requestKey"<>a."executionKey" THEN RAISE EXCEPTION 'Inventory receipt mismatch' USING ERRCODE='23514'; END IF;
   END IF;
 END IF;
END $$;

CREATE FUNCTION op_assistant_attention_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE qid text;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'OperationalRequest' THEN qid:=NEW.id;
 WHEN 'OperationalAction' THEN qid:=NEW."requestId";
 WHEN 'ActionRevision' THEN SELECT "requestId" INTO qid FROM "OperationalAction" WHERE id=NEW."actionId";
 WHEN 'ExecutionReceipt' THEN SELECT "requestId" INTO qid FROM "OperationalAction" WHERE id=NEW."actionId";
 WHEN 'AgentTask' THEN SELECT id INTO qid FROM "OperationalRequest" WHERE "taskId"=NEW.id;
 WHEN 'AgentDecision' THEN SELECT id INTO qid FROM "OperationalRequest" WHERE "taskId"=NEW."agentTaskId";
 END CASE;
 IF qid IS NOT NULL THEN PERFORM op_assistant_check_attention(qid); END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER op_assistant_request_consistency AFTER INSERT OR UPDATE ON "OperationalRequest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_action_consistency AFTER INSERT OR UPDATE ON "OperationalAction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_revision_consistency AFTER INSERT ON "ActionRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_receipt_consistency AFTER INSERT ON "ExecutionReceipt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_task_consistency AFTER INSERT OR UPDATE ON "AgentTask" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_decision_consistency AFTER INSERT OR UPDATE ON "AgentDecision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_attention_consistency();

CREATE FUNCTION op_assistant_publication_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PublicationIntent"%ROWTYPE; e "DomainEvent"%ROWTYPE; owner_request text; event_name text;
BEGIN
 IF TG_TABLE_NAME='PublicationIntent' THEN SELECT * INTO p FROM "PublicationIntent" WHERE id=NEW.id;
 ELSE SELECT * INTO p FROM "PublicationIntent" WHERE "domainEventId"=NEW.id; END IF;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF p."receiptId" IS NOT NULL THEN
   SELECT a."requestId" INTO owner_request FROM "ExecutionReceipt" r JOIN "OperationalAction" a ON a.id=r."actionId" WHERE r.id=p."receiptId";
   IF owner_request IS DISTINCT FROM p."requestId" THEN RAISE EXCEPTION 'Publication/receipt mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 IF p."domainEventId" IS NOT NULL THEN
   SELECT * INTO e FROM "DomainEvent" WHERE id=p."domainEventId";
   SELECT name INTO event_name FROM "EventType" WHERE id=e."eventTypeId";
   IF e."tenantId" IS DISTINCT FROM p."tenantId" OR event_name IS DISTINCT FROM p."eventName" OR e.origin IS DISTINCT FROM p.origin OR e."occurredAt" IS DISTINCT FROM p."occurredAt" OR e.payload IS DISTINCT FROM p.payload
   THEN RAISE EXCEPTION 'Publication envelope mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER op_assistant_publication_consistency AFTER INSERT OR UPDATE ON "PublicationIntent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_publication_consistency();
CREATE CONSTRAINT TRIGGER op_assistant_certified_consistency AFTER INSERT OR UPDATE ON "DomainEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION op_assistant_publication_consistency();
