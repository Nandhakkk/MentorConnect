-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "lastOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpExpiry" TIMESTAMP(3),
ADD COLUMN     "otpHash" TEXT,
ADD COLUMN     "otpMethod" TEXT,
ADD COLUMN     "verificationMethod" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "favoriteSubjects" TEXT,
ADD COLUMN     "gradeLevel" TEXT,
ADD COLUMN     "schoolName" TEXT;
