ALTER TABLE "Transaction"
  ADD COLUMN "cashAmount" DECIMAL(10,2),
  ADD COLUMN "transferAmount" DECIMAL(10,2);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_mixed_payment_check" CHECK (
  ("paymentMethod" = 'mixed' AND "cashAmount" IS NOT NULL AND "transferAmount" IS NOT NULL
    AND "cashAmount" > 0 AND "transferAmount" > 0 AND "cashAmount" + "transferAmount" = "total")
  OR
  ("paymentMethod" <> 'mixed' AND "cashAmount" IS NULL AND "transferAmount" IS NULL)
);
