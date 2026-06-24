import { OpenMeteoProvider } from "./weather.provider";

const ARCHIVE_RESP = {
  daily: {
    time: ["2025-08-10", "2025-08-11"],
    temperature_2m_max: [22.1, 20.5],
    temperature_2m_min: [14.2, 13.8],
    precipitation_sum: [0.0, 1.2],
    wind_speed_10m_max: [15.3, 12.0],
  },
};

function mockFetch(body: object, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("OpenMeteoProvider", () => {
  it("uses archive-api host for kind=archive", async () => {
    const fetch = mockFetch(ARCHIVE_RESP);
    const provider = new OpenMeteoProvider(fetch as never);
    await provider.fetchDaily(60.39, 5.32, "2025-08-10", "2025-08-11", "archive");
    const url = new URL((fetch.mock.calls[0] as [string])[0]);
    expect(url.host).toBe("archive-api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("60.39");
    expect(url.searchParams.get("start_date")).toBe("2025-08-10");
    expect(url.searchParams.get("end_date")).toBe("2025-08-11");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  it("uses api.open-meteo.com host for kind=forecast", async () => {
    const fetch = mockFetch(ARCHIVE_RESP);
    const provider = new OpenMeteoProvider(fetch as never);
    await provider.fetchDaily(60.39, 5.32, "2026-06-23", "2026-06-30", "forecast");
    const url = new URL((fetch.mock.calls[0] as [string])[0]);
    expect(url.host).toBe("api.open-meteo.com");
  });

  it("parses daily arrays into DailyWeather[]", async () => {
    const provider = new OpenMeteoProvider(mockFetch(ARCHIVE_RESP) as never);
    const result = await provider.fetchDaily(60.39, 5.32, "2025-08-10", "2025-08-11", "archive");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: "2025-08-10", tMaxC: 22.1, tMinC: 14.2, precipMm: 0.0, windMaxKmh: 15.3 });
    expect(result[1].precipMm).toBe(1.2);
  });

  it("coerces null values in the array", async () => {
    const resp = {
      daily: {
        time: ["2025-08-10"],
        temperature_2m_max: [null],
        temperature_2m_min: [null],
        precipitation_sum: [null],
        wind_speed_10m_max: [null],
      },
    };
    const provider = new OpenMeteoProvider(mockFetch(resp) as never);
    const result = await provider.fetchDaily(60.39, 5.32, "2025-08-10", "2025-08-10", "archive");
    expect(result[0]).toEqual({ date: "2025-08-10", tMaxC: null, tMinC: null, precipMm: null, windMaxKmh: null });
  });

  it("throws on non-2xx response", async () => {
    const provider = new OpenMeteoProvider(mockFetch({}, 500) as never);
    await expect(
      provider.fetchDaily(60.39, 5.32, "2025-08-10", "2025-08-10", "archive"),
    ).rejects.toThrow("Open-Meteo archive error: 500");
  });
});
