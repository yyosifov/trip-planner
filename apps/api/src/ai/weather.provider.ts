import type { DailyWeather } from "@trip/shared";
import type { WeatherPort } from "./ports";

type FetchFn = typeof fetch;

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}

export class OpenMeteoProvider implements WeatherPort {
  constructor(private fetchFn: FetchFn = fetch) {}

  async fetchDaily(
    lat: number,
    lng: number,
    start: string,
    end: string,
    kind: "archive" | "forecast",
  ): Promise<DailyWeather[]> {
    const base =
      kind === "archive"
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      start_date: start,
      end_date: end,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      timezone: "auto",
    });

    const res = await this.fetchFn(`${base}?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo ${kind} error: ${res.status}`);
    const body = (await res.json()) as { daily: OpenMeteoDaily };
    const d = body.daily;

    return d.time.map((date, i) => ({
      date,
      tMaxC: d.temperature_2m_max[i] ?? null,
      tMinC: d.temperature_2m_min[i] ?? null,
      precipMm: d.precipitation_sum[i] ?? null,
      windMaxKmh: d.wind_speed_10m_max[i] ?? null,
    }));
  }
}
