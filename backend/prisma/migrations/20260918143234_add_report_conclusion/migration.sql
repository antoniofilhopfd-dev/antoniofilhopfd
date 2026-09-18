-- CreateTable
CREATE TABLE "ReportConclusion" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportConclusion_weekStart_key" ON "ReportConclusion"("weekStart");

-- AddForeignKey
ALTER TABLE "ReportConclusion" ADD CONSTRAINT "ReportConclusion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
