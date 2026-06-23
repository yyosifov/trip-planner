-- CreateTable
CREATE TABLE "WeatherDaily" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "tMaxC" DOUBLE PRECISION,
    "tMinC" DOUBLE PRECISION,
    "precipMm" DOUBLE PRECISION,
    "windMaxKmh" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherDaily_lat_lng_date_source_key" ON "WeatherDaily"("lat", "lng", "date", "source");
