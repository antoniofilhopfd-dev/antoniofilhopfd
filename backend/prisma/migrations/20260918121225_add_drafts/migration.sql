-- CreateEnum
CREATE TYPE "CallToAction" AS ENUM ('SAIBA_MAIS', 'CADASTRE_SE', 'FALE_CONOSCO', 'GARANTA_JA');

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "campaignName" TEXT,
    "adSetName" TEXT,
    "dailyBudget" DECIMAL(10,2),
    "country" TEXT DEFAULT 'BR',
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "adName" TEXT,
    "facebookPageName" TEXT,
    "title" TEXT,
    "bodyText" TEXT,
    "destinationUrl" TEXT,
    "callToAction" "CallToAction",
    "imageFilename" TEXT,
    "imageOriginalName" TEXT,
    "imageMimeType" TEXT,
    "imageSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_createdById_idx" ON "Draft"("createdById");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
