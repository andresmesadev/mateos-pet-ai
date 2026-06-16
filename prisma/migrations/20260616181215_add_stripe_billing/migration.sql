-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;
