-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "breed" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sterilized" BOOLEAN,
ADD COLUMN     "weight" DOUBLE PRECISION;
