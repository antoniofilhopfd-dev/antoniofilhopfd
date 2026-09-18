-- CreateEnum
CREATE TYPE "DraftSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'AMBIGUOUS_BLOCKED');

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "lastSubmissionError" TEXT,
ADD COLUMN     "submissionStatus" "DraftSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "submittedAdExternalId" TEXT,
ADD COLUMN     "submittedAdSetExternalId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "submittedCampaignExternalId" TEXT,
ADD COLUMN     "submittedCreativeExternalId" TEXT;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
