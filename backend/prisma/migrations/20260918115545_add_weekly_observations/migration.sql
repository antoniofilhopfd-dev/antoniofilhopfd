-- CreateTable
CREATE TABLE "WeeklyObservation" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyObservation_weekStart_idx" ON "WeeklyObservation"("weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyObservation" ADD CONSTRAINT "WeeklyObservation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
