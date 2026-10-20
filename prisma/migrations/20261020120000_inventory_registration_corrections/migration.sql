BEGIN;
ALTER TABLE "InventoryProduct" ADD COLUMN "removedAt" TIMESTAMPTZ(3);
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "inventory_product_removed" CHECK ("removedAt" IS NULL OR NOT "active");
DROP INDEX "InventoryProduct_code_key";
DROP INDEX "InventoryProduct_barcode_key";
CREATE UNIQUE INDEX "InventoryProduct_code_key" ON "InventoryProduct" ("tenantId", "internalCodeKey") WHERE "removedAt" IS NULL;
CREATE UNIQUE INDEX "InventoryProduct_barcode_key" ON "InventoryProduct" ("tenantId", "barcode") WHERE "removedAt" IS NULL;

ALTER TABLE "InventoryOperation" DROP CONSTRAINT "inventory_operation_shape";
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "inventory_operation_shape" CHECK (
  length(btrim("principalKey")) > 0 AND length(btrim("actorId")) > 0 AND length(btrim("actorName")) > 0
  AND "actorRole" IN ('admin', 'receptionist', 'vet', 'groomer')
  AND "contractVersion" > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$'
  AND (
    ("kind" IN ('create_product', 'update_product', 'set_product_active', 'remove_product') AND "resultKind" = 'product'
      AND "resultProductId" IS NOT NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" = 'confirm_pos_sale' AND "resultKind" = 'sale'
      AND "resultSaleId" IS NOT NULL AND "resultProductId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" IN ('register_entry', 'adjust_stock', 'register_consumption') AND "resultKind" = 'movements'
      AND "resultProductId" IS NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
    OR ("kind" IN ('correct_consumption', 'correct_entry') AND "resultKind" = 'movements' AND "sourceOperationId" IS NOT NULL
      AND "sourceOperationId" <> "id" AND "resultProductId" IS NULL AND "resultSaleId" IS NULL)
    OR ("kind" = 'return_sale_items' AND "resultKind" = 'returns'
      AND "resultProductId" IS NULL AND "resultSaleId" IS NULL AND "sourceOperationId" IS NULL)
  ) AND ("resultEvidence" IS NULL OR jsonb_typeof("resultEvidence") = 'object')
);
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "inventory_movement_values";
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "inventory_movement_values" CHECK (
  "quantity" > 0 AND "ordinal" > 0 AND "balanceBefore" >= 0 AND "balanceAfter" >= 0
  AND "balanceAfter"::BIGINT = "balanceBefore"::BIGINT + "stockDelta"::BIGINT
  AND (
    ("kind" IN ('entry', 'adjustment_in', 'consumption_correction', 'return_restock') AND "stockDelta" = "quantity")
    OR ("kind" IN ('sale', 'consumption', 'adjustment_out', 'entry_reversal') AND "stockDelta"::BIGINT = -"quantity"::BIGINT)
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
  AND (("kind" IN ('consumption_correction', 'return_restock', 'return_discard', 'entry_reversal') AND "sourceMovementId" IS NOT NULL AND "sourceMovementId" <> "id")
    OR ("kind" NOT IN ('consumption_correction', 'return_restock', 'return_discard', 'entry_reversal') AND "sourceMovementId" IS NULL))
  AND (("kind" IN ('return_restock', 'return_discard') AND "returnLineId" IS NOT NULL)
    OR ("kind" NOT IN ('return_restock', 'return_discard') AND "returnLineId" IS NULL))
  AND (("kind" IN ('consumption', 'consumption_correction') AND "area" IS NOT NULL AND "area" IN ('veterinary', 'grooming'))
    OR ("kind" NOT IN ('consumption', 'consumption_correction') AND "area" IS NULL AND "appointmentId" IS NULL))
  AND (("countedQuantity" IS NULL AND "expectedStockRevision" IS NULL)
    OR ("kind" IN ('adjustment_in', 'adjustment_out') AND "countedQuantity" IS NOT NULL
      AND "countedQuantity" >= 0 AND "expectedStockRevision" IS NOT NULL AND "expectedStockRevision" >= 0))
  AND ("kind" NOT IN ('adjustment_in', 'adjustment_out', 'consumption_correction', 'return_restock', 'return_discard', 'entry_reversal')
    OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
  AND ("kind" <> 'consumption' OR "appointmentId" IS NOT NULL OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
);
CREATE UNIQUE INDEX "InventoryMovement_entry_reversal_key" ON "InventoryMovement" ("tenantId", "sourceMovementId") WHERE kind = 'entry_reversal';
CREATE FUNCTION inventory_guard_removed_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."removedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Removed inventory product cannot change' USING ERRCODE = '23514', CONSTRAINT = 'inventory_removed_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_removed_product BEFORE UPDATE ON "InventoryProduct"
  FOR EACH ROW EXECUTE FUNCTION inventory_guard_removed_product();
COMMIT;
