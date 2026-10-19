-- Optional owner neighborhood; preserve existing addresses and notes unchanged.
ALTER TABLE "User" ADD COLUMN "neighborhood" TEXT;
