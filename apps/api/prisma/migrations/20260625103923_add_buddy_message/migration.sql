-- CreateTable
CREATE TABLE "BuddyMessage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuddyMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BuddyMessage" ADD CONSTRAINT "BuddyMessage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
