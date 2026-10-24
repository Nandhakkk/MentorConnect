-- DropForeignKey
ALTER TABLE "Guardian" DROP CONSTRAINT IF EXISTS "Guardian_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Guardian_userId_minorStudentId_key";

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN IF NOT EXISTS "accessRevokedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "accessRevokedReason" TEXT,
ADD COLUMN IF NOT EXISTS "consentPolicyVersion" TEXT DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS "consentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "consentTimestamp" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB,
ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verificationSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verificationTokenExpiry" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verificationTokenHash" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'IN_APP',
ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT DEFAULT 'DELIVERED',
ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
ADD COLUMN IF NOT EXISTS "guardianId" TEXT,
ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT,
ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GuardianAccessToken" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianAccessToken_tokenHash_key" ON "GuardianAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuardianAccessToken_guardianId_idx" ON "GuardianAccessToken"("guardianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuardianAccessToken_tokenHash_idx" ON "GuardianAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Guardian_minorStudentId_idx" ON "Guardian"("minorStudentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Guardian_email_idx" ON "Guardian"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_guardianId_idx" ON "Notification"("guardianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_referenceId_idx" ON "Notification"("referenceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Guardian_userId_fkey'
    ) THEN
        ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GuardianAccessToken_guardianId_fkey'
    ) THEN
        ALTER TABLE "GuardianAccessToken" ADD CONSTRAINT "GuardianAccessToken_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_guardianId_fkey'
    ) THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
