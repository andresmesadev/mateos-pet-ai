-- Independent from product price snapshots: retain inventory_item_shape.
ALTER TABLE "TransactionItem" ADD COLUMN "appointmentComponent" VARCHAR(16);
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_appointment_component_shape"
  CHECK ("appointmentComponent" IS NULL OR (
    "appointmentComponent" IN ('service', 'transport') AND "itemKind" = 'service'
    AND "productId" IS NULL AND quantity = 1
  ));
CREATE UNIQUE INDEX "TransactionItem_appointment_component_unique"
  ON "TransactionItem" ("transactionId", "appointmentComponent")
  WHERE "appointmentComponent" IS NOT NULL;
