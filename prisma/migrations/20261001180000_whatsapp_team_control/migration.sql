ALTER TABLE "Conversation"
  ADD COLUMN "assignedActorId" TEXT,
  ADD COLUMN "assignedActorName" TEXT,
  ADD COLUMN "assignedActorRole" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "controlChangedAt" TIMESTAMP(3),
  ADD COLUMN "controlVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
  ADD COLUMN "senderKind" TEXT,
  ADD COLUMN "senderActorId" TEXT,
  ADD COLUMN "senderName" TEXT,
  ADD COLUMN "senderRole" TEXT;
