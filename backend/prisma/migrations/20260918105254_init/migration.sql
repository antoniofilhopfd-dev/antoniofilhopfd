-- CreateTable
CREATE TABLE "SystemStatus" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemStatus_component_key" ON "SystemStatus"("component");
