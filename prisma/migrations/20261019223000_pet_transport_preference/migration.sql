ALTER TABLE "Pet" ADD COLUMN "defaultGroomingTransportMode" TEXT;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_defaultGroomingTransportMode_check"
CHECK ("defaultGroomingTransportMode" IN ('none', 'round_trip', 'pickup', 'delivery'));
