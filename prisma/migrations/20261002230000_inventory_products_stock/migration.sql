-- Inventario: Etapa 5 aprobada explícitamente 2026-10-02.
-- Base generada por Prisma 7.10.0 desde la proyección; conserva las tablas existentes.
-- Incorporación aditiva; antecedentes manuales permanecen sin producto ni stock.
BEGIN;

ALTER TABLE "TransactionItem"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "productCodeSnapshot" TEXT,
  ADD COLUMN "presentationSnapshot" TEXT,
  ADD COLUMN "priceSourceSnapshot" TEXT,
  ADD COLUMN "priceVersionSnapshot" INTEGER;

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "internalCode" VARCHAR(64) NOT NULL,
    "internalCodeKey" VARCHAR(64) NOT NULL,
    "barcode" VARCHAR(80),
    "presentation" VARCHAR(80) NOT NULL,
    "uses" TEXT[],
    "referenceCost" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "stockMinimum" INTEGER NOT NULL DEFAULT 0,
    "lotPolicy" VARCHAR(16) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataVersion" INTEGER NOT NULL DEFAULT 1,
    "priceVersion" INTEGER NOT NULL DEFAULT 1,
    "stockRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "groupKind" VARCHAR(16) NOT NULL,
    "commercialCode" VARCHAR(80),
    "commercialKey" VARCHAR(80),
    "expiresOn" DATE,
    "balancePhysical" INTEGER NOT NULL DEFAULT 0,
    "firstReceivedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "requestKey" UUID NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "actorId" VARCHAR(256) NOT NULL,
    "actorName" VARCHAR(160) NOT NULL,
    "actorRole" VARCHAR(32) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL,
    "resultKind" VARCHAR(16) NOT NULL,
    "resultProductId" TEXT,
    "resultSaleId" TEXT,
    "sourceOperationId" TEXT,
    "resultEvidence" JSONB,

    CONSTRAINT "InventoryOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockDelta" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(1000),
    "actorId" VARCHAR(256) NOT NULL,
    "actorName" VARCHAR(160) NOT NULL,
    "actorRole" VARCHAR(32) NOT NULL,
    "productNameSnapshot" VARCHAR(160) NOT NULL,
    "productCodeSnapshot" VARCHAR(64) NOT NULL,
    "presentationSnapshot" VARCHAR(80) NOT NULL,
    "lotCodeSnapshot" VARCHAR(80),
    "expiresOnSnapshot" DATE,
    "entryUnitCost" DECIMAL(10,2),
    "transactionId" TEXT,
    "transactionItemId" TEXT,
    "area" VARCHAR(16),
    "appointmentId" TEXT,
    "sourceMovementId" TEXT,
    "returnLineId" TEXT,
    "countedQuantity" INTEGER,
    "expectedStockRevision" INTEGER,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReturnLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "disposition" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InventoryReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_inventory_tenant_id_key" ON "Transaction"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionItem_inventory_identity_key" ON "TransactionItem"("tenantId", "transactionId", "id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_inventory_tenant_id_key" ON "Appointment"("tenantId", "id");

-- CreateIndex
CREATE INDEX "InventoryProduct_catalog_idx" ON "InventoryProduct"("tenantId", "active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_tenant_id_key" ON "InventoryProduct"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_code_key" ON "InventoryProduct"("tenantId", "internalCodeKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_barcode_key" ON "InventoryProduct"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "InventoryLot_selection_idx" ON "InventoryLot"("tenantId", "productId", "expiresOn", "firstReceivedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_identity_key" ON "InventoryLot"("tenantId", "productId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_commercial_key" ON "InventoryLot"("tenantId", "productId", "commercialKey");

-- CreateIndex
CREATE INDEX "InventoryOperation_history_idx" ON "InventoryOperation"("tenantId", "confirmedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_tenant_id_key" ON "InventoryOperation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_request_key" ON "InventoryOperation"("tenantId", "principalKey", "kind", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_sale_key" ON "InventoryOperation"("tenantId", "resultSaleId");

-- CreateIndex
CREATE INDEX "InventoryMovement_product_history_idx" ON "InventoryMovement"("tenantId", "productId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "InventoryMovement_compensation_idx" ON "InventoryMovement"("tenantId", "sourceMovementId");

-- CreateIndex
CREATE INDEX "InventoryMovement_sale_item_idx" ON "InventoryMovement"("tenantId", "transactionItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_return_idx" ON "InventoryMovement"("tenantId", "returnLineId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_source_key" ON "InventoryMovement"("tenantId", "id", "productId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_ordinal_key" ON "InventoryMovement"("tenantId", "operationId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReturnLine_once_key" ON "InventoryReturnLine"("transactionItemId");

-- CreateIndex
CREATE INDEX "InventoryReturnLine_sale_idx" ON "InventoryReturnLine"("tenantId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReturnLine_identity_key" ON "InventoryReturnLine"("tenantId", "id", "transactionId", "transactionItemId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReturnLine_item_identity_key" ON "InventoryReturnLine"("tenantId", "transactionId", "transactionItemId", "productId");

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_tenantId_transactionId_fkey" FOREIGN KEY ("tenantId", "transactionId") REFERENCES "Transaction"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "InventoryProduct"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "InventoryProduct"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_tenantId_resultProductId_fkey" FOREIGN KEY ("tenantId", "resultProductId") REFERENCES "InventoryProduct"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_tenantId_resultSaleId_fkey" FOREIGN KEY ("tenantId", "resultSaleId") REFERENCES "Transaction"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_tenantId_sourceOperationId_fkey" FOREIGN KEY ("tenantId", "sourceOperationId") REFERENCES "InventoryOperation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_operationId_fkey" FOREIGN KEY ("tenantId", "operationId") REFERENCES "InventoryOperation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_productId_lotId_fkey" FOREIGN KEY ("tenantId", "productId", "lotId") REFERENCES "InventoryLot"("tenantId", "productId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_transactionId_transactionItemId_fkey" FOREIGN KEY ("tenantId", "transactionId", "transactionItemId", "productId") REFERENCES "TransactionItem"("tenantId", "transactionId", "id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_appointmentId_fkey" FOREIGN KEY ("tenantId", "appointmentId") REFERENCES "Appointment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_sourceMovementId_productId_lotI_fkey" FOREIGN KEY ("tenantId", "sourceMovementId", "productId", "lotId") REFERENCES "InventoryMovement"("tenantId", "id", "productId", "lotId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_returnLineId_transactionId_tran_fkey" FOREIGN KEY ("tenantId", "returnLineId", "transactionId", "transactionItemId", "productId") REFERENCES "InventoryReturnLine"("tenantId", "id", "transactionId", "transactionItemId", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryReturnLine" ADD CONSTRAINT "InventoryReturnLine_tenantId_operationId_fkey" FOREIGN KEY ("tenantId", "operationId") REFERENCES "InventoryOperation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryReturnLine" ADD CONSTRAINT "InventoryReturnLine_tenantId_transactionId_transactionItem_fkey" FOREIGN KEY ("tenantId", "transactionId", "transactionItemId", "productId") REFERENCES "TransactionItem"("tenantId", "transactionId", "id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- CHECK/índices/triggers que Prisma no representa. Nombres estables para clasificar errores.
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "inventory_product_values" CHECK (
  length(btrim("name")) > 0 AND length(btrim("category")) > 0
  AND length(btrim("internalCode")) > 0 AND length(btrim("internalCodeKey")) > 0
  AND length(btrim("presentation")) > 0
  AND ("barcode" IS NULL OR ("barcode" = btrim("barcode") AND length("barcode") > 0))
  AND "referenceCost" BETWEEN 0 AND 99999999.99
  AND ("salePrice" IS NULL OR "salePrice" BETWEEN 0.01 AND 99999999.99)
  AND "stockMinimum" >= 0 AND "metadataVersion" > 0 AND "priceVersion" > 0 AND "stockRevision" >= 0
  AND "lotPolicy" IN ('untracked', 'lot', 'lot_expiry')
  AND cardinality("uses") BETWEEN 1 AND 3 AND array_position("uses", NULL) IS NULL
  AND "uses" <@ ARRAY['retail', 'veterinary', 'grooming']::TEXT[]
  AND (NOT ('retail' = ANY("uses")) OR "salePrice" IS NOT NULL)
);

ALTER TABLE "InventoryLot" ADD CONSTRAINT "inventory_lot_shape" CHECK (
  "balancePhysical" >= 0 AND (
    ("groupKind" = 'untracked' AND "commercialCode" IS NULL AND "commercialKey" IS NULL AND "expiresOn" IS NULL)
    OR ("groupKind" = 'commercial' AND "commercialCode" IS NOT NULL AND "commercialKey" IS NOT NULL
      AND length(btrim("commercialCode")) > 0 AND length(btrim("commercialKey")) > 0)
  )
);
CREATE UNIQUE INDEX "InventoryLot_untracked_key"
  ON "InventoryLot" ("tenantId", "productId") WHERE "groupKind" = 'untracked';
CREATE INDEX "InventoryLot_expiry_alert_idx"
  ON "InventoryLot" ("tenantId", "expiresOn", "productId")
  WHERE "balancePhysical" > 0 AND "expiresOn" IS NOT NULL;

ALTER TABLE "InventoryOperation" ADD CONSTRAINT "inventory_operation_shape" CHECK (
  length(btrim("principalKey")) > 0 AND length(btrim("actorId")) > 0 AND length(btrim("actorName")) > 0
  AND "actorRole" IN ('admin', 'receptionist', 'vet', 'groomer')
  AND "contractVersion" > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
  AND (
    ("kind" IN ('create_product', 'update_product', 'set_product_active') AND "resultKind" = 'product'
      AND "resultProductId" IS NOT NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" = 'confirm_pos_sale' AND "resultKind" = 'sale'
      AND "resultSaleId" IS NOT NULL AND "resultProductId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" IN ('register_entry', 'adjust_stock', 'register_consumption') AND "resultKind" = 'movements'
      AND "resultProductId" IS NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" = 'correct_consumption' AND "resultKind" = 'movements' AND "sourceOperationId" IS NOT NULL
      AND "sourceOperationId" <> "id" AND "resultProductId" IS NULL AND "resultSaleId" IS NULL)
    OR ("kind" = 'return_sale_items' AND "resultKind" = 'returns'
      AND "resultProductId" IS NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
  ) AND ("resultEvidence" IS NULL OR jsonb_typeof("resultEvidence") = 'object')
);
-- Solo estas referencias de resultado se difieren: su destino se crea en el mismo commit.
ALTER TABLE "InventoryOperation" ALTER CONSTRAINT "InventoryOperation_tenantId_resultProductId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "InventoryOperation" ALTER CONSTRAINT "InventoryOperation_tenantId_resultSaleId_fkey" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "TransactionItem" ADD CONSTRAINT "inventory_item_shape" CHECK (
  ("productId" IS NULL AND "productCodeSnapshot" IS NULL AND "presentationSnapshot" IS NULL
    AND "priceSourceSnapshot" IS NULL AND "priceVersionSnapshot" IS NULL)
  OR ("productId" IS NOT NULL AND "tenantId" IS NOT NULL AND "itemKind" = 'product'
    AND "productCodeSnapshot" IS NOT NULL AND length(btrim("productCodeSnapshot")) > 0
    AND "presentationSnapshot" IS NOT NULL AND length(btrim("presentationSnapshot")) > 0
    AND "priceSourceSnapshot" IS NOT NULL AND "priceSourceSnapshot" = 'product_base_price'
    AND "priceVersionSnapshot" IS NOT NULL AND "priceVersionSnapshot" > 0
    AND "quantity" > 0 AND "unitPrice" BETWEEN 0.01 AND 99999999.99 AND "total" = "quantity"::NUMERIC * "unitPrice")
);

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "inventory_movement_values" CHECK (
  "quantity" > 0 AND "ordinal" > 0 AND "balanceBefore" >= 0 AND "balanceAfter" >= 0
  AND "balanceAfter"::BIGINT = "balanceBefore"::BIGINT + "stockDelta"::BIGINT
  AND (
    ("kind" IN ('entry', 'adjustment_in', 'consumption_correction', 'return_restock') AND "stockDelta" = "quantity")
    OR ("kind" IN ('sale', 'consumption', 'adjustment_out') AND "stockDelta"::BIGINT = -"quantity"::BIGINT)
    OR ("kind" = 'return_discard' AND "stockDelta" = 0)
  )
  AND length(btrim("actorId")) > 0 AND length(btrim("actorName")) > 0
  AND "actorRole" IN ('admin', 'receptionist', 'vet', 'groomer')
  AND length(btrim("productNameSnapshot")) > 0 AND length(btrim("productCodeSnapshot")) > 0
  AND length(btrim("presentationSnapshot")) > 0
  AND (("kind" = 'entry' AND "entryUnitCost" IS NOT NULL AND "entryUnitCost" BETWEEN 0 AND 99999999.99)
    OR ("kind" <> 'entry' AND "entryUnitCost" IS NULL))
  AND (("kind" IN ('sale', 'return_restock', 'return_discard') AND "transactionId" IS NOT NULL AND "transactionItemId" IS NOT NULL)
    OR ("kind" NOT IN ('sale', 'return_restock', 'return_discard') AND "transactionId" IS NULL AND "transactionItemId" IS NULL))
  AND (("kind" IN ('consumption_correction', 'return_restock', 'return_discard') AND "sourceMovementId" IS NOT NULL AND "sourceMovementId" <> "id")
    OR ("kind" NOT IN ('consumption_correction', 'return_restock', 'return_discard') AND "sourceMovementId" IS NULL))
  AND (("kind" IN ('return_restock', 'return_discard') AND "returnLineId" IS NOT NULL)
    OR ("kind" NOT IN ('return_restock', 'return_discard') AND "returnLineId" IS NULL))
  AND (("kind" IN ('consumption', 'consumption_correction') AND "area" IS NOT NULL AND "area" IN ('veterinary', 'grooming'))
    OR ("kind" NOT IN ('consumption', 'consumption_correction') AND "area" IS NULL AND "appointmentId" IS NULL))
  AND (("countedQuantity" IS NULL AND "expectedStockRevision" IS NULL)
    OR ("kind" IN ('adjustment_in', 'adjustment_out') AND "countedQuantity" IS NOT NULL
      AND "countedQuantity" >= 0 AND "expectedStockRevision" IS NOT NULL AND "expectedStockRevision" >= 0))
  AND ("kind" NOT IN ('adjustment_in', 'adjustment_out', 'consumption_correction', 'return_restock', 'return_discard')
    OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
  AND ("kind" <> 'consumption' OR "appointmentId" IS NOT NULL OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
);

ALTER TABLE "InventoryReturnLine" ADD CONSTRAINT "inventory_return_values" CHECK (
  "quantity" > 0 AND "disposition" IN ('restock', 'discard') AND length(btrim("reason")) > 0
);

-- Hechos auditables: compensar con nuevas filas, nunca editar/borrar el antecedente.
CREATE FUNCTION inventory_reject_fact_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Inventory facts are immutable' USING ERRCODE = '23514', CONSTRAINT = 'inventory_fact_immutable';
END $$;
CREATE TRIGGER inventory_operation_immutable BEFORE UPDATE OR DELETE ON "InventoryOperation"
  FOR EACH ROW EXECUTE FUNCTION inventory_reject_fact_change();
CREATE TRIGGER inventory_movement_immutable BEFORE UPDATE OR DELETE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION inventory_reject_fact_change();
CREATE TRIGGER inventory_return_immutable BEFORE UPDATE OR DELETE ON "InventoryReturnLine"
  FOR EACH ROW EXECUTE FUNCTION inventory_reject_fact_change();
CREATE TRIGGER inventory_product_retained BEFORE DELETE ON "InventoryProduct"
  FOR EACH ROW EXECUTE FUNCTION inventory_reject_fact_change();
CREATE TRIGGER inventory_lot_retained BEFORE DELETE ON "InventoryLot"
  FOR EACH ROW EXECUTE FUNCTION inventory_reject_fact_change();

CREATE FUNCTION inventory_guard_product_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."tenantId", NEW."id") IS DISTINCT FROM (OLD."tenantId", OLD."id") THEN
    RAISE EXCEPTION 'Inventory identity cannot change' USING ERRCODE = '23514', CONSTRAINT = 'inventory_identity_immutable';
  END IF;
  IF (NEW."presentation", NEW."lotPolicy") IS DISTINCT FROM (OLD."presentation", OLD."lotPolicy")
    AND EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "tenantId" = OLD."tenantId" AND "productId" = OLD."id") THEN
    RAISE EXCEPTION 'Presentation and lot policy already used' USING ERRCODE = '23514', CONSTRAINT = 'inventory_policy_used';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_product_policy BEFORE UPDATE ON "InventoryProduct"
  FOR EACH ROW EXECUTE FUNCTION inventory_guard_product_policy();

CREATE FUNCTION inventory_guard_lot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."tenantId", NEW."id", NEW."productId", NEW."groupKind", NEW."commercialCode", NEW."commercialKey", NEW."expiresOn", NEW."firstReceivedAt")
    IS DISTINCT FROM (OLD."tenantId", OLD."id", OLD."productId", OLD."groupKind", OLD."commercialCode", OLD."commercialKey", OLD."expiresOn", OLD."firstReceivedAt") THEN
    RAISE EXCEPTION 'Lot identity cannot change' USING ERRCODE = '23514', CONSTRAINT = 'inventory_lot_immutable';
  END IF;
  SELECT "lotPolicy" INTO policy FROM "InventoryProduct" WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."productId";
  IF policy IS NULL OR NOT (
    (policy = 'untracked' AND NEW."groupKind" = 'untracked')
    OR (policy = 'lot' AND NEW."groupKind" = 'commercial' AND NEW."expiresOn" IS NULL)
    OR (policy = 'lot_expiry' AND NEW."groupKind" = 'commercial' AND NEW."expiresOn" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Lot does not match product policy' USING ERRCODE = '23514', CONSTRAINT = 'inventory_lot_policy';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_lot_policy BEFORE INSERT OR UPDATE ON "InventoryLot"
  FOR EACH ROW EXECUTE FUNCTION inventory_guard_lot();

CREATE FUNCTION inventory_guard_item_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."productId" IS NOT NULL OR (TG_OP = 'UPDATE' AND NEW."productId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Catalogue sale item is immutable' USING ERRCODE = '23514', CONSTRAINT = 'inventory_item_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_item_snapshot BEFORE UPDATE OR DELETE ON "TransactionItem"
  FOR EACH ROW EXECUTE FUNCTION inventory_guard_item_snapshot();

-- Reglas agregadas (asignación completa, corrección acotada, permisos, precio,
-- expiración y delta/balance/revisión juntos) se validan dentro del comando
-- SERIALIZABLE + lock de producto, como precisa inventory-physical-schema.md.
COMMIT;



