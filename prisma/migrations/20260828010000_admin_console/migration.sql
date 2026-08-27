-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "accessGrant" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SiteStat" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PublicVisitor" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PublicVisitor_pkey" PRIMARY KEY ("id")
);
