# Trip Weather — Design

## Summary

Add a display-only, trip-level **Weather** page that helps a user "sneak peek" the
weather for their trip window. It shows three things for the destination over the
trip's date window (`dateWindowStart`..`dateWindowEnd`):

1. **Forecast** — only when the window falls within Open-Meteo's ~16-day horizon.
2. **Climate normals** — average high/low, typical rain, and wind for the window,
   derived from the last 5 years.
3. **5-year historical table** — actual daily readings, one column per past year.

The feature is purely informational. It does **not** influence itinerary logic,
the `weatherDependent` flag, or AI research.

## Data source

[Open-Meteo](https://open-meteo.com) — free, no API key, matches the project's
existing "no-billing" external-API approach (Nominatim geocoding).

- Archive (historical): `https://archive-api.open-meteo.com/v1/archive`
- Forecast: `https://api.open-meteo.com/v1/forecast`
- Daily variables: `temperature_2m_max`, `temperature_2m_min`,
  `precipitation_sum`, `wind_speed_10m_max`
- `timezone=auto`

Units: **metric** — °C, mm, km/h.

## Decisions

- **Granularity:** trip-level (whole date window), not per itinerary day.
- **Historical depth:** 5 years, one column per year (shows variability).
- **Cell metrics:** max temp, min temp, rain (precip), wind.
- **Caching:** persisted in the database (shared across trips, survives restarts,
  seedable in tests) — chosen over in-memory.

## Data model (Prisma)

A shared cache table, **not** related to `Trip`. Keyed by rounded coordinates so
multiple trips to the same place reuse rows.

```prisma
model WeatherDaily {
  id         String   @id @default(cuid())
  lat        Float    // rounded to 2 decimal places for cache-key stability
  lng        Float
  date       DateTime @db.Date
  source     String   // "archive" | "forecast"
  tMaxC      Float?
  tMinC      Float?
  precipMm   Float?
  windMaxKmh Float?
  fetchedAt  DateTime @default(now())

  @@unique([lat, lng, date, source])
}
```

- **Archive rows** are immutable — once cached, never refetched.
- **Forecast rows** are refetched when `fetchedAt` is older than the TTL (~3 hours).
- Climate normals are **computed on read** from cached archive rows, not stored.

Requires a Prisma migration.

## Provider (port pattern)

Follows the existing `MapsPort` / `GeminiPort` pattern in `apps/api/src/ai/`.

New port in `ai/ports.ts`:

```ts
export const WEATHER = "WeatherPort";

export interface DailyWeather {
  date: string;        // YYYY-MM-DD
  tMaxC: number | null;
  tMinC: number | null;
  precipMm: number | null;
  windMaxKmh: number | null;
}

export interface WeatherPort {
  fetchDaily(
    lat: number,
    lng: number,
    start: string,
    end: string,
    kind: "archive" | "forecast",
  ): Promise<DailyWeather[]>;
}
```

`OpenMeteoProvider` implements `WeatherPort`:

- Builds the correct URL/params per `kind`.
- Parses the `daily` arrays into `DailyWeather[]`.
- Injectable `fetchFn` for tests (mirrors `MapsProvider`).

## Service

`WeatherModule` + `WeatherService`. Flow for a trip:

1. Load the trip → `destination`, `dateWindowStart/End`.
   If either date is missing → return `{ available: false }`.
2. Geocode `destination` via the existing `MapsProvider`; round coords to 2 dp.
3. **Historical:** for each of the last 5 years, build the same month/day span as
   the window. Read cache → fetch missing spans from the archive endpoint →
   upsert into `WeatherDaily` (`source: "archive"`).
4. **Forecast:** if any window date is within ~16 days of today, fetch the
   forecast for those dates → upsert (`source: "forecast"`, TTL-checked).
5. **Normals:** compute avg `tMaxC`, avg `tMinC`, avg & total `precipMm`, avg
   `windMaxKmh` across all cached archive rows for the window.
6. Assemble and return the response.

## API

`GET /trips/:id/weather`

```ts
{
  available: boolean;
  location: { name: string; lat: number; lng: number };
  window: { start: string; end: string };          // YYYY-MM-DD
  forecast: DailyWeather[] | null;                  // null when > ~16 days out
  normals: {
    tMaxC: number;
    tMinC: number;
    precipMmAvg: number;
    windMaxKmh: number;
  };
  years: { year: number; days: DailyWeather[] }[];  // 5 entries, recent first
}
```

`DailyWeather` and the response type live in `packages/shared` for reuse by web.

## Web UI

New route `/trips/:id/weather`, with a nav link alongside Discover / Itinerary.
`useWeather(id)` react-query hook in `apps/web/src/api/hooks.ts`.

Layout (top to bottom):

- **Forecast strip** — only rendered when `forecast != null`. Otherwise a notice:
  "Forecast available ~16 days before your trip."
- **Normals card** — avg high/low, typical rain, wind for the window.
- **History table** — rows = each date in the window (e.g. Aug 10–18), columns =
  the 5 years (e.g. 2021–2025). Each cell is compact, e.g. `28°/17° · 2mm · 14km/h`.

When `available === false` (no trip dates), show a prompt to set the trip date
window.

## Error handling

- Geocode failure → `available: false` with a reason; UI shows a friendly message.
- Open-Meteo request failure for a given year/span → that year's column shows
  gaps (null cells) rather than failing the whole response.
- Forecast fetch failure → fall back to `forecast: null` (normals + history still
  render).

## Testing

- **`OpenMeteoProvider` spec** — URL/param building per `kind` + response parsing,
  with a mocked `fetch` (mirrors `maps.provider.spec.ts`).
- **`WeatherService` spec** — cache hit vs miss, forecast in-range vs out-of-range,
  normals math, geocode-failure path. Mock `WeatherPort`, real Prisma test DB.
- **Web `WeatherPage.test.tsx`** — renders the history table; hides the forecast
  strip when `forecast` is null; shows the no-dates prompt when `available` is
  false.

## Out of scope (YAGNI)

- Per itinerary-day weather.
- Feeding weather into itinerary logic, `weatherDependent`, or AI research.
- Imperial units (metric only for now).
- Hourly data, additional metrics (humidity, UV, etc.).
