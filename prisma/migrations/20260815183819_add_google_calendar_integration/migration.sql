-- AlterTable
ALTER TABLE "Task" ADD COLUMN "googleEventId" TEXT;

-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
