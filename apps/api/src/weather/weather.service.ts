import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MAPS, MapsPort, WEATHER, WeatherPort } from "../ai/ports";
import type { DailyWeather, WeatherResponse } from "@trip/shared";

const HISTORY_YEARS = 5;
const FORECAST_HORIZON_DAYS = 16;
const FORECAST_TTL_MS = 3 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function shiftYear(dateStr: string, year: number): string {
  return `${year}-${dateStr.slice(5)}`;
}

function daysDiff(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

function nonNull<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => x != null);
}

@Injectable()
export class WeatherService {
  constructor(
    private prisma: PrismaService,
    @Inject(MAPS) private maps: MapsPort,
    @Inject(WEATHER) private weather: WeatherPort,
  ) {}

  async getWeather(tripId: string): Promise<WeatherResponse> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip?.dateWindowStart || !trip?.dateWindowEnd) return { available: false };

    const windowStart = trip.dateWindowStart.toISOString().slice(0, 10);
    const windowEnd = trip.dateWindowEnd.toISOString().slice(0, 10);

    const geo = await this.maps.geocode(trip.destination);
    if (!geo) return { available: false };

    const lat = round2(geo.lat);
    const lng = round2(geo.lng);
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const histYears = Array.from({ length: HISTORY_YEARS }, (_, i) => currentYear - 1 - i);

    // Historical: fill cache year by year
    for (const year of histYears) {
      const start = shiftYear(windowStart, year);
      const end = shiftYear(windowEnd, year);
      const expectedCount = daysDiff(start, end) + 1;

      const cached = await this.prisma.weatherDaily.findMany({
        where: { lat, lng, source: "archive", date: { gte: new Date(start), lte: new Date(end) } },
      });

      if (cached.length < expectedCount) {
        try {
          const rows = await this.weather.fetchDaily(lat, lng, start, end, "archive");
          for (const row of rows) {
            await this.prisma.weatherDaily.upsert({
              where: { lat_lng_date_source: { lat, lng, date: new Date(row.date), source: "archive" } },
              create: { lat, lng, date: new Date(row.date), source: "archive", tMaxC: row.tMaxC, tMinC: row.tMinC, precipMm: row.precipMm, windMaxKmh: row.windMaxKmh },
              update: { tMaxC: row.tMaxC, tMinC: row.tMinC, precipMm: row.precipMm, windMaxKmh: row.windMaxKmh },
            });
          }
        } catch {
          // partial year failure: continue with cached data
        }
      }
    }

    // Forecast
    let forecast: DailyWeather[] | null = null;
    const daysUntilStart = daysDiff(today, windowStart);

    if (daysUntilStart <= FORECAST_HORIZON_DAYS && windowEnd >= today) {
      const forecastStart = daysUntilStart < 0 ? today : windowStart;

      const existing = await this.prisma.weatherDaily.findFirst({
        where: { lat, lng, source: "forecast", date: { gte: new Date(forecastStart) } },
        orderBy: { fetchedAt: "desc" },
      });

      const stale = !existing || Date.now() - existing.fetchedAt.getTime() > FORECAST_TTL_MS;

      if (stale) {
        try {
          const rows = await this.weather.fetchDaily(lat, lng, forecastStart, windowEnd, "forecast");
          for (const row of rows) {
            await this.prisma.weatherDaily.upsert({
              where: { lat_lng_date_source: { lat, lng, date: new Date(row.date), source: "forecast" } },
              create: { lat, lng, date: new Date(row.date), source: "forecast", tMaxC: row.tMaxC, tMinC: row.tMinC, precipMm: row.precipMm, windMaxKmh: row.windMaxKmh },
              update: { tMaxC: row.tMaxC, tMinC: row.tMinC, precipMm: row.precipMm, windMaxKmh: row.windMaxKmh, fetchedAt: new Date() },
            });
          }
        } catch {
          // forecast failure is non-fatal
        }
      }

      const fcRows = await this.prisma.weatherDaily.findMany({
        where: { lat, lng, source: "forecast", date: { gte: new Date(forecastStart), lte: new Date(windowEnd) } },
        orderBy: { date: "asc" },
      });

      if (fcRows.length > 0) {
        forecast = fcRows.map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          tMaxC: r.tMaxC,
          tMinC: r.tMinC,
          precipMm: r.precipMm,
          windMaxKmh: r.windMaxKmh,
        }));
      }
    }

    // Build years array from cache
    const years = await Promise.all(
      histYears.map(async (year) => {
        const start = shiftYear(windowStart, year);
        const end = shiftYear(windowEnd, year);
        const rows = await this.prisma.weatherDaily.findMany({
          where: { lat, lng, source: "archive", date: { gte: new Date(start), lte: new Date(end) } },
          orderBy: { date: "asc" },
        });
        return {
          year,
          days: rows.map((r) => ({
            date: r.date.toISOString().slice(0, 10),
            tMaxC: r.tMaxC,
            tMinC: r.tMinC,
            precipMm: r.precipMm,
            windMaxKmh: r.windMaxKmh,
          })),
        };
      }),
    );

    // Normals from all archive rows
    const allDays = years.flatMap((y) => y.days);
    const normals = {
      tMaxC: avg(nonNull(allDays.map((d) => d.tMaxC))),
      tMinC: avg(nonNull(allDays.map((d) => d.tMinC))),
      precipMmAvg: avg(nonNull(allDays.map((d) => d.precipMm))),
      windMaxKmh: avg(nonNull(allDays.map((d) => d.windMaxKmh))),
    };

    return {
      available: true,
      location: { name: trip.destination, lat, lng },
      window: { start: windowStart, end: windowEnd },
      forecast,
      normals,
      years,
    };
  }
}
