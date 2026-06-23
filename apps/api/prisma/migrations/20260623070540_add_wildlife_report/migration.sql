-- CreateTable
CREATE TABLE "WildlifeReport" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WildlifeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WildlifeReport_tripId_key" ON "WildlifeReport"("tripId");

-- AddForeignKey
ALTER TABLE "WildlifeReport" ADD CONSTRAINT "WildlifeReport_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
