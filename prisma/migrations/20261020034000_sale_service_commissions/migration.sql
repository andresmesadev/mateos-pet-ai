ALTER TABLE "TransactionItem" ADD COLUMN "serviceId" TEXT, ADD COLUMN "performedByStaffId" TEXT;
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_performedByStaffId_fkey" FOREIGN KEY ("performedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ALTER COLUMN "appointmentId" DROP NOT NULL, ALTER COLUMN "splitRate" TYPE DECIMAL(5,4), ADD COLUMN "transactionItemId" TEXT, ADD COLUMN "serviceId" TEXT;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_transactionItemId_fkey" FOREIGN KEY ("transactionItemId") REFERENCES "TransactionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_source_check" CHECK (("appointmentId" IS NOT NULL AND "transactionItemId" IS NULL) OR ("appointmentId" IS NULL AND "transactionItemId" IS NOT NULL AND "serviceId" IS NOT NULL AND "staffId" IS NOT NULL));
CREATE UNIQUE INDEX "Commission_active_transactionItemId_key" ON "Commission"("transactionItemId") WHERE status = 'active' AND "transactionItemId" IS NOT NULL;
