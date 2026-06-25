import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useWeather, useUpdateTrip, useTrip } from "../api/hooks";
import { TripNav } from "../components/TripNav";
import * as T from "../theme";
import type { DailyWeather } from "@trip/shared";

function fmt(n: number | null | undefined, decimals = 0): string {
  return n == null ? "—" : n.toFixed(decimals);
}

function precipBg(mm: number | null | undefined): string | undefined {
  if (mm == null || mm < 1) return undefined;
  if (mm < 5) return "rgba(59,130,246,0.12)";
  if (mm < 15) return "rgba(59,130,246,0.30)";
  return "#3b82f6";
}

function precipFg(mm: number | null | undefined): string {
  return mm != null && mm >= 15 ? "#ffffff" : "var(--fg)";
}

// ── Date editor ───────────────────────────────────────────────────────────────

function DateEditor({ id, initialStart, initialEnd, onDone }: {
  id: string; initialStart?: string; initialEnd?: string; onDone: () => void;
}) {
  const [start, setStart] = useState(initialStart ?? "");
  const [end, setEnd] = useState(initialEnd ?? "");
  const update = useUpdateTrip(id);
  const save = () => {
    if (!start || !end) return;
    update.mutate({ dateWindowStart: start, dateWindowEnd: end }, { onSuccess: onDone });
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <span style={T.text.muted}>→</span>
      <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} min={start} />
      <button onClick={save} disabled={!start || !end || update.isPending} style={T.btn.primary}>
        {update.isPending ? "Saving…" : "Save"}
      </button>
      <button onClick={onDone} style={T.btn.ghost}>Cancel</button>
      {update.isError && <span style={{ ...T.text.danger, fontSize: 12 }}>Save failed</span>}
    </div>
  );
}

// ── City selector ─────────────────────────────────────────────────────────────

function CitySelector({ waypoints, destination, active, onChange }: {
  waypoints: string[]; destination: string; active: string; onChange: (city: string) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chips = [...new Set([...waypoints, destination])];
  const isCustom = !chips.includes(active);

  const submit = () => {
    const v = input.trim();
    if (v) { onChange(v); setInput(""); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ ...T.label }}>Location</span>
      {chips.map((city) => (
        <button key={city} onClick={() => onChange(city)} style={city === active && !isCustom ? T.chip.active : T.chip.base}>
          {city}
        </button>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Other city…"
          style={{ ...T.input, width: 130, borderRadius: "var(--r-pill)", ...(isCustom && { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--primary-soft)" }) }}
        />
        <button onClick={submit} disabled={!input.trim()} style={{ ...T.btn.ghost, borderRadius: "var(--r-pill)", padding: "4px 12px" }}>
          →
        </button>
      </div>
      {isCustom && <span style={{ ...T.text.primary, fontSize: 12, fontWeight: 500 }}>📍 {active}</span>}
    </div>
  );
}

// ── Forecast card ─────────────────────────────────────────────────────────────

function ForecastCard({ d }: { d: DailyWeather }) {
  const bg = precipBg(d.precipMm);
  const fg = precipFg(d.precipMm);
  return (
    <div style={{ ...T.card, padding: "10px 14px", minWidth: 84, textAlign: "center", background: bg ?? "var(--card)", color: fg }}>
      <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.65 }}>{d.date.slice(5)}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(d.tMaxC)}° / {fmt(d.tMinC)}°</div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
        {d.precipMm != null && d.precipMm > 0 ? `🌧 ${fmt(d.precipMm)}mm  ` : ""}
        💨 {fmt(d.windMaxKmh)}km/h
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WeatherPage() {
  const { id = "" } = useParams();
  const { data: trip } = useTrip(id);
  const [editingDates, setEditingDates] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | undefined>(undefined);

  const waypointCities = (trip?.waypoints ?? []).map((w) => w.city);
  const destination = trip?.destination ?? "";
  const activeCity = selectedCity ?? waypointCities[0] ?? destination;

  const { data, isLoading } = useWeather(id, activeCity || undefined);

  if (isLoading) {
    return (
      <div style={{ padding: "20px 24px" }}>
        <TripNav id={id} />
        <p style={T.text.muted}>Loading…</p>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px" }}>
        <TripNav id={id} />
        <h2 style={{ marginBottom: 8 }}>⛅ Weather</h2>
        <p style={{ ...T.text.muted, marginBottom: 20 }}>
          Set your trip dates to see historical weather data and forecasts.
        </p>
        <div style={{ ...T.cardPadded }}>
          <DateEditor id={id} onDone={() => {}} />
        </div>
      </div>
    );
  }

  const { location, window: win, forecast, normals, years = [] } = data;
  const dates = years[0]?.days.map((d) => d.date) ?? [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 48px" }}>
      <TripNav id={id} />

      {/* Header card */}
      <div style={{ ...T.cardPadded, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⛅ Weather — {location?.name}</h2>
          {!editingDates && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...T.text.muted, fontSize: 13 }}>📅 {win?.start} → {win?.end}</span>
              <button onClick={() => setEditingDates(true)} style={T.btn.ghost}>Edit dates</button>
            </div>
          )}
        </div>
        {editingDates && (
          <div style={{ marginBottom: 12 }}>
            <DateEditor id={id} initialStart={win?.start} initialEnd={win?.end} onDone={() => setEditingDates(false)} />
          </div>
        )}
        <CitySelector waypoints={waypointCities} destination={destination} active={activeCity} onChange={setSelectedCity} />
      </div>

      {/* Climate normals */}
      {normals && (
        <div style={{ ...T.cardPadded, marginBottom: 12, display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={T.label}>Temp (avg)</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{fmt(normals.tMaxC)}° / {fmt(normals.tMinC)}°</div>
          </div>
          <div>
            <div style={T.label}>Rain (avg/day)</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>🌧 {fmt(normals.precipMmAvg, 1)} mm</div>
          </div>
          <div>
            <div style={T.label}>Wind (max avg)</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>💨 {fmt(normals.windMaxKmh)} km/h</div>
          </div>
          <div style={{ ...T.text.subtle, fontSize: 12 }}>5-year historical average</div>
        </div>
      )}

      {/* Forecast */}
      {forecast ? (
        <div style={{ ...T.cardPadded, marginBottom: 12 }}>
          <div style={{ ...T.label, marginBottom: 10 }}>Forecast</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {forecast.map((d) => <ForecastCard key={d.date} d={d} />)}
          </div>
        </div>
      ) : (
        <p style={{ ...T.text.subtle, fontSize: 13, marginBottom: 12 }}>
          Forecast available ~16 days before your trip.
        </p>
      )}

      {/* Historical table */}
      {years.length > 0 && (
        <div style={{ ...T.card, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={T.label}>Historical data</div>
              <p style={{ ...T.text.subtle, fontSize: 12, marginTop: 4 }}>
                Max/min °C · rain mm · wind km/h per day
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...T.text.subtle, fontSize: 11 }}>🌧 Rain:</span>
              {[
                { bg: "var(--surface-2)", label: "< 1 mm", fg: "var(--fg-subtle)" },
                { bg: "rgba(59,130,246,0.12)", label: "1–4 mm", fg: "var(--fg)" },
                { bg: "rgba(59,130,246,0.30)", label: "5–14 mm", fg: "var(--fg)" },
                { bg: "#3b82f6", label: "≥ 15 mm", fg: "#fff" },
              ].map(({ bg, label, fg }) => (
                <span
                  key={label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: "var(--r-sm)",
                    background: bg,
                    color: fg,
                    fontSize: 11,
                    fontWeight: 500,
                    border: "1px solid rgba(59,130,246,0.20)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%", minWidth: 560 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "var(--fg-muted)", fontSize: 12 }}>Date</th>
                  {years.map((y) => (
                    <th key={y.year} style={{ padding: "8px 14px", textAlign: "center", fontWeight: 600, color: "var(--fg-muted)", fontSize: 12 }}>{y.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date, rowIdx) => (
                  <tr key={date} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "7px 14px", fontWeight: 600, fontSize: 12, background: "var(--card)", whiteSpace: "nowrap" }}>
                      {date.slice(5)}
                    </td>
                    {years.map((y) => {
                      const d = y.days[rowIdx];
                      if (!d) return <td key={y.year} style={{ padding: "7px 14px", textAlign: "center", color: "var(--fg-subtle)" }}>—</td>;
                      const bg = precipBg(d.precipMm);
                      const fg = precipFg(d.precipMm);
                      return (
                        <td key={y.year} style={{ padding: "7px 14px", textAlign: "center", background: bg ?? (rowIdx % 2 === 0 ? "var(--card)" : "var(--surface-2)"), color: fg, whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{fmt(d.tMaxC)}° / {fmt(d.tMinC)}°</div>
                          <div style={{ fontSize: 11, marginTop: 1, opacity: 0.75 }}>{fmt(d.precipMm)}mm · {fmt(d.windMaxKmh)}km/h</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
