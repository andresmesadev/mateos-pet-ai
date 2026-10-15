-- Preserve UTC semantics of legacy TIMESTAMP and complete query-task linkage.
CREATE OR REPLACE FUNCTION op_assistant_check_attention(request_id text) RETURNS void LANGUAGE plpgsql AS $$
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
 IF t.status='completada' AND t.result->>'operationalRequestId' IS DISTINCT FROM q.id THEN RAISE EXCEPTION 'Task request mismatch' USING ERRCODE='23514'; END IF;
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

CREATE OR REPLACE FUNCTION op_assistant_publication_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
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
   IF e."tenantId" IS DISTINCT FROM p."tenantId" OR event_name IS DISTINCT FROM p."eventName" OR e.origin IS DISTINCT FROM p.origin OR (e."occurredAt" AT TIME ZONE 'UTC') IS DISTINCT FROM p."occurredAt" OR e.payload IS DISTINCT FROM p.payload
   THEN RAISE EXCEPTION 'Publication envelope mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
