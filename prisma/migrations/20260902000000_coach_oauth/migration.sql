-- CreateTable
CREATE TABLE "CoachOAuthAccount" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachOAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachOAuthAccount_coachId_idx" ON "CoachOAuthAccount"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachOAuthAccount_provider_providerUserId_key" ON "CoachOAuthAccount"("provider", "providerUserId");

-- AddForeignKey
ALTER TABLE "CoachOAuthAccount" ADD CONSTRAINT "CoachOAuthAccount_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
