-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "languages" TEXT NOT NULL DEFAULT 'English',
    "photoUrl" TEXT,
    "email" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "plan" TEXT NOT NULL DEFAULT 'none',
    "trialEndsAt" DATETIME
);
INSERT INTO "new_Coach" ("city", "email", "id", "languages", "name", "photoUrl", "slug", "stripeAccountId", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "timezone", "title", "trialEndsAt") SELECT "city", "email", "id", "languages", "name", "photoUrl", "slug", "stripeAccountId", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "timezone", "title", "trialEndsAt" FROM "Coach";
DROP TABLE "Coach";
ALTER TABLE "new_Coach" RENAME TO "Coach";
CREATE UNIQUE INDEX "Coach_slug_key" ON "Coach"("slug");
CREATE UNIQUE INDEX "Coach_email_key" ON "Coach"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
