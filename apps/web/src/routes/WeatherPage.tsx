import { Link, useParams } from "react-router-dom";
import { useWeather } from "../api/hooks";
import type { DailyWeather } from "@trip/shared";

function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? "—" : `${Math.round(n)}${unit}`;
}

function ForecastCard({ d }: { d: DailyWeather }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", minWidth: 90, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{d.date.slice(5)}</div>
      <div style={{ fontWeight: 600 }}>{fmt(d.tMaxC, "°")} / {fmt(d.tMinC, "°")}</div>
      <div style={{ fontSize: 11 }}>{fmt(d.precipMm, "mm")} · {fmt(d.windMaxKmh, "km/h")}</div>
    </div>
  );
}

function HistoryCell({ d }: { d: DailyWeather }) {
  return (
    <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 12, whiteSpace: "nowrap", verticalAlign: "top" }}>
      {fmt(d.tMaxC, "°")}/{fmt(d.tMinC, "°")}
      <br />
      <span style={{ color: "#6b7280" }}>{fmt(d.precipMm, "mm")} · {fmt(d.windMaxKmh, "km/h")}</span>
    </td>
  );
}

function Nav({ id }: { id: string }) {
  return (
    <nav style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 14 }}>
      <Link to={`/trips/${id}`}>Intake</Link>
      <Link to={`/trips/${id}/discover`}>Discover</Link>
      <Link to={`/trips/${id}/itinerary`}>Itinerary</Link>
      <Link to={`/trips/${id}/wildlife`}>Wildlife</Link>
      <span style={{ fontWeight: 600 }}>Weather</span>
    </nav>
  );
}

export function WeatherPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useWeather(id);

  if (isLoading) return <div style={{ padding: 20 }}>Loading…</div>;

  if (!data?.available) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
        <Nav id={id} />
        <h1>⛅ Weather</h1>
        <p>Set a date window for your trip to see weather information.</p>
      </div>
    );
  }

  const { location, window: win, forecast, normals, years = [] } = data;
  const dates = years[0]?.days.map((d) => d.date) ?? [];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
      <Nav id={id} />

      <h1>⛅ Weather — {location?.name}</h1>
      <p style={{ color: "#555", marginTop: -8 }}>
        {win?.start} → {win?.end}
      </p>

      {forecast ? (
        <section style={{ marginBottom: 24 }}>
          <h2>Forecast</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {forecast.map((d) => <ForecastCard key={d.date} d={d} />)}
          </div>
        </section>
      ) : (
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Forecast available ~16 days before your trip.
        </p>
      )}

      {normals && (
        <section style={{ marginBottom: 24, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Climate normals (5-yr avg)</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <span>🌡 {fmt(normals.tMaxC, "°")} / {fmt(normals.tMinC, "°")}</span>
            <span>🌧 {fmt(normals.precipMmAvg, "mm/day avg")}</span>
            <span>💨 {fmt(normals.windMaxKmh, " km/h")}</span>
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section>
          <h2>Historical</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Date</th>
                  {years.map((y) => (
                    <th key={y.year} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>{y.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date, rowIdx) => (
                  <tr key={date} style={{ background: rowIdx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ padding: "4px 8px", fontWeight: 500 }}>{date.slice(5)}</td>
                    {years.map((y) => {
                      const d = y.days[rowIdx];
                      return d ? <HistoryCell key={y.year} d={d} /> : <td key={y.year} style={{ padding: "4px 8px", textAlign: "center", color: "#9ca3af" }}>—</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
