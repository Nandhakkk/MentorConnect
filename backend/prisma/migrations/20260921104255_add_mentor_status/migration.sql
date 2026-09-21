-- CreateEnum
CREATE TYPE "MentorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "status" "MentorStatus" NOT NULL DEFAULT 'PENDING';
