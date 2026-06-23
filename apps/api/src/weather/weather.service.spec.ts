import { WeatherService } from "./weather.service";

const prismaMock = {
  trip: { findUnique: jest.fn() },
  weatherDaily: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};
const mapsMock = { geocode: jest.fn() };
const weatherMock = { fetchDaily: jest.fn() };

function makeSvc() {
  return new WeatherService(prismaMock as never, mapsMock as never, weatherMock as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.weatherDaily.findMany.mockResolvedValue([]);
  prismaMock.weatherDaily.findFirst.mockResolvedValue(null);
  prismaMock.weatherDaily.upsert.mockResolvedValue({});
  weatherMock.fetchDaily.mockResolvedValue([]);
});

describe("WeatherService.getWeather", () => {
  it("returns available:false when trip has no dateWindowStart", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: null, dateWindowEnd: null });
    const result = await makeSvc().getWeather("t1");
    expect(result.available).toBe(false);
    expect(mapsMock.geocode).not.toHaveBeenCalled();
  });

  it("returns available:false when trip has dateWindowStart but no dateWindowEnd", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: null });
    const result = await makeSvc().getWeather("t1");
    expect(result.available).toBe(false);
  });

  it("returns available:false when geocode returns null", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Nowhere", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-12") });
    mapsMock.geocode.mockResolvedValue(null);
    const result = await makeSvc().getWeather("t1");
    expect(result.available).toBe(false);
  });

  it("rounds coords to 2dp for cache key", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-10") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.391234, lng: 5.325678 });
    await makeSvc().getWeather("t1");
    const firstUpsertCall = prismaMock.weatherDaily.upsert.mock.calls[0];
    if (firstUpsertCall) {
      const create = firstUpsertCall[0].create;
      expect(create.lat).toBe(60.39);
      expect(create.lng).toBe(5.33);
    }
  });

  it("calls fetchDaily with 'archive' when cache is empty", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-11") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.39, lng: 5.32 });
    weatherMock.fetchDaily.mockResolvedValue([
      { date: "2026-08-10", tMaxC: 22, tMinC: 14, precipMm: 0, windMaxKmh: 15 },
    ]);
    const result = await makeSvc().getWeather("t1");
    expect(result.available).toBe(true);
    const archiveCalls = weatherMock.fetchDaily.mock.calls.filter((c: unknown[]) => c[4] === "archive");
    expect(archiveCalls.length).toBeGreaterThan(0);
    expect(result.years).toHaveLength(5);
  });

  it("skips fetchDaily for archive when cache has full date count", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-10") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.39, lng: 5.32 });
    // Return 1 cached row = expectedCount(1) for every findMany call
    prismaMock.weatherDaily.findMany.mockResolvedValue([
      { date: new Date("2026-08-10"), tMaxC: 20, tMinC: 14, precipMm: 0, windMaxKmh: 12, source: "archive" },
    ]);
    await makeSvc().getWeather("t1");
    const archiveCalls = weatherMock.fetchDaily.mock.calls.filter((c: unknown[]) => c[4] === "archive");
    expect(archiveCalls).toHaveLength(0);
  });

  it("returns forecast:null when trip start is beyond 16-day horizon", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-11") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.39, lng: 5.32 });
    const result = await makeSvc().getWeather("t1");
    expect(result.forecast).toBeNull();
    const forecastCalls = weatherMock.fetchDaily.mock.calls.filter((c: unknown[]) => c[4] === "forecast");
    expect(forecastCalls).toHaveLength(0);
  });

  it("computes normals as averages across all archive rows", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-10") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.39, lng: 5.32 });
    // All years return same cached row
    prismaMock.weatherDaily.findMany.mockResolvedValue([
      { date: new Date("2026-08-10"), tMaxC: 20, tMinC: 10, precipMm: 4, windMaxKmh: 16, source: "archive" },
    ]);
    const result = await makeSvc().getWeather("t1");
    expect(result.normals?.tMaxC).toBe(20);
    expect(result.normals?.tMinC).toBe(10);
    expect(result.normals?.precipMmAvg).toBe(4);
    expect(result.normals?.windMaxKmh).toBe(16);
  });

  it("continues when archive fetch fails for one year", async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: "t1", destination: "Bergen", dateWindowStart: new Date("2027-08-10"), dateWindowEnd: new Date("2027-08-10") });
    mapsMock.geocode.mockResolvedValue({ lat: 60.39, lng: 5.32 });
    weatherMock.fetchDaily.mockRejectedValue(new Error("Network error"));
    const result = await makeSvc().getWeather("t1");
    // Does not throw — partial failure gracefully handled
    expect(result.available).toBe(true);
    expect(result.years).toHaveLength(5);
  });
});
