-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "segment" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "maxDrivingHoursPerDay" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Waypoint" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Waypoint_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Waypoint" ADD CONSTRAINT "Waypoint_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
