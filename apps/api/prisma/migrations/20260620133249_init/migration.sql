-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateWindowStart" TIMESTAMP(3),
    "dateWindowEnd" TIMESTAMP(3),
    "daysMin" INTEGER NOT NULL,
    "daysMax" INTEGER NOT NULL,
    "routeType" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelerProfile" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "partyAdults" INTEGER NOT NULL DEFAULT 0,
    "partyKids" INTEGER NOT NULL DEFAULT 0,
    "kidsAges" JSONB NOT NULL DEFAULT '[]',
    "maxHikeKm" DOUBLE PRECISION,
    "maxHikeElevationM" DOUBLE PRECISION,
    "pace" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extra" JSONB NOT NULL DEFAULT '{}',
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TravelerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeMessage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'web',
    "estDurationMin" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'easy',
    "kidSuitability" INTEGER NOT NULL DEFAULT 3,
    "weatherDependent" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "baseCity" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "timeSlot" TEXT,
    "isBackup" BOOLEAN NOT NULL DEFAULT false,
    "backupForItemId" TEXT,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "queries" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT NOT NULL DEFAULT 'brave+gemini',
    "status" TEXT NOT NULL DEFAULT 'running',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelerProfile_tripId_key" ON "TravelerProfile"("tripId");

-- AddForeignKey
ALTER TABLE "TravelerProfile" ADD CONSTRAINT "TravelerProfile_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeMessage" ADD CONSTRAINT "IntakeMessage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
