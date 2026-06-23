import { describe, it, expect } from "vitest";
import { DailyWeatherSchema, WeatherResponseSchema } from "./weather";

describe("DailyWeatherSchema", () => {
  it("parses a full row", () => {
    const r = DailyWeatherSchema.parse({ date: "2025-08-10", tMaxC: 22, tMinC: 14, precipMm: 0, windMaxKmh: 15 });
    expect(r.tMaxC).toBe(22);
  });
  it("allows null fields", () => {
    const r = DailyWeatherSchema.parse({ date: "2025-08-10", tMaxC: null, tMinC: null, precipMm: null, windMaxKmh: null });
    expect(r.tMaxC).toBeNull();
  });
});

describe("WeatherResponseSchema", () => {
  it("parses available:false with no other fields", () => {
    const r = WeatherResponseSchema.parse({ available: false });
    expect(r.available).toBe(false);
    expect(r.forecast).toBeUndefined();
  });
  it("parses a full available response", () => {
    const r = WeatherResponseSchema.parse({
      available: true,
      location: { name: "Bergen", lat: 60.39, lng: 5.32 },
      window: { start: "2025-08-10", end: "2025-08-12" },
      forecast: null,
      normals: { tMaxC: 22, tMinC: 14, precipMmAvg: 2.1, windMaxKmh: 15 },
      years: [{ year: 2024, days: [{ date: "2024-08-10", tMaxC: 21, tMinC: 13, precipMm: 0, windMaxKmh: 12 }] }],
    });
    expect(r.available).toBe(true);
    expect(r.years).toHaveLength(1);
    expect(r.forecast).toBeNull();
  });
});
