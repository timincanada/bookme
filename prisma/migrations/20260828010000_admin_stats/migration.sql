-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "accessGrant" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PublicVisitor" (
    "id" TEXT NOT NULL,

    CONSTRAINT "PublicVisitor_pkey" PRIMARY KEY ("id")
);
