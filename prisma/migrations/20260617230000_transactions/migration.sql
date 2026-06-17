CREATE TABLE "Transaction" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT,
  "userId"        TEXT,
  "petId"         TEXT,
  "appointmentId" TEXT,
  "total"         DECIMAL(10,2) NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
  "notes"         TEXT,
  "paidAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transaction_appointmentId_key" ON "Transaction"("appointmentId");

CREATE TABLE "TransactionItem" (
  "id"            TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "quantity"      INTEGER NOT NULL DEFAULT 1,
  "unitPrice"     DECIMAL(10,2) NOT NULL,
  "total"         DECIMAL(10,2) NOT NULL,
  CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_petId_fkey"
  FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
