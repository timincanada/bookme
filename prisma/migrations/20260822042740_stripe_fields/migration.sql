-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "stripeAccountId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "stripePaymentIntentId" TEXT;
