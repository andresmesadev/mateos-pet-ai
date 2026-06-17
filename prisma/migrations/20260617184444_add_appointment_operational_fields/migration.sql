-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
