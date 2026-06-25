import { useState } from "react";
import { Link } from "react-router-dom";
import { useTrips, useCreateTrip } from "../api/hooks";

type RouteTypeValue = "roundtrip" | "oneway" | "open";

export function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const create = useCreateTrip();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [daysMin, setDaysMin] = useState(7);
  const [daysMax, setDaysMax] = useState(10);
  const [routeType, setRouteType] = useState<RouteTypeValue>("open");
  const [startCity, setStartCity] = useState("");
  const [endCity, setEndCity] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [maxDriving, setMaxDriving] = useState("");

  const buildWaypoints = () => {
    if (routeType === "open" || !startCity.trim()) return [];
    const midStops = stops.map((s) => s.trim()).filter(Boolean);
    const endValue = routeType === "roundtrip" ? startCity.trim() : endCity.trim();
    const cities = [startCity.trim(), ...midStops, endValue].filter(Boolean);
    return cities.map((city, order) => ({ city, order }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !destination) return;
    create.mutate({
      name, destination, daysMin, daysMax,
      dateWindowStart: null, dateWindowEnd: null,
      routeType, notes: "",
      waypoints: buildWaypoints(),
      maxDrivingHoursPerDay: maxDriving ? parseFloat(maxDriving) : null,
    });
    setName(""); setDestination(""); setStartCity(""); setEndCity(""); setStops([]); setMaxDriving("");
  };

  const addStop = () => setStops((s) => [...s, ""]);
  const updateStop = (i: number, v: string) => setStops((s) => s.map((x, j) => (j === i ? v : x)));
  const removeStop = (i: number) => setStops((s) => s.filter((_, j) => j !== i));
  const moveStop = (i: number, dir: -1 | 1) => {
    setStops((s) => {
      const next = [...s];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Trip Planner</h1>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        <input
          aria-label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Trip name (e.g. Norway 2025)"
          required
        />
        <input
          aria-label="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Region / country (e.g. Norway)"
          required
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={daysMin} onChange={(e) => setDaysMin(+e.target.value)} min={1} placeholder="Min days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>–</span>
          <input type="number" value={daysMax} onChange={(e) => setDaysMax(+e.target.value)} min={1} placeholder="Max days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>days</span>
        </div>

        {/* Route type */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, width: 90 }}>Route type</label>
          <select
            value={routeType}
            onChange={(e) => { setRouteType(e.target.value as RouteTypeValue); setStops([]); }}
            style={{ flex: 1 }}
          >
            <option value="open">Open (no fixed route)</option>
            <option value="roundtrip">Roundtrip (return to start)</option>
            <option value="oneway">One-way (A → B)</option>
          </select>
        </div>

        {/* Waypoints builder */}
        {routeType !== "open" && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 2 }}>Route cities</div>

            {/* Start */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 52, fontSize: 12, color: "var(--fg)" }}>Start</span>
              <input
                value={startCity}
                onChange={(e) => setStartCity(e.target.value)}
                placeholder="e.g. Oslo"
                style={{ flex: 1, fontSize: 13 }}
              />
            </div>

            {/* Intermediate stops */}
            {stops.map((stop, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 52, fontSize: 12, color: "var(--fg)" }}>Stop {i + 1}</span>
                <input
                  value={stop}
                  onChange={(e) => updateStop(i, e.target.value)}
                  placeholder="City name"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0} style={{ padding: "1px 5px", fontSize: 11 }}>↑</button>
                <button type="button" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} style={{ padding: "1px 5px", fontSize: 11 }}>↓</button>
                <button type="button" onClick={() => removeStop(i)} style={{ padding: "1px 6px", fontSize: 11, color: "#ef4444", border: "1px solid #fca5a5", borderRadius: 3 }}>✕</button>
              </div>
            ))}

            {/* End */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 52, fontSize: 12, color: "var(--fg)" }}>End</span>
              {routeType === "roundtrip" ? (
                <input
                  value={startCity || "Same as start"}
                  disabled
                  style={{ flex: 1, fontSize: 13, color: "var(--fg-subtle)", background: "var(--surface-2)" }}
                />
              ) : (
                <input
                  value={endCity}
                  onChange={(e) => setEndCity(e.target.value)}
                  placeholder="e.g. Bergen"
                  style={{ flex: 1, fontSize: 13 }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={addStop}
              style={{ alignSelf: "flex-start", fontSize: 12, padding: "3px 10px", marginTop: 2 }}
            >
              + Add stop
            </button>
          </div>
        )}

        {/* Max driving */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, width: 90 }}>Max driving</label>
          <input
            type="number"
            value={maxDriving}
            onChange={(e) => setMaxDriving(e.target.value)}
            min={0.5}
            max={12}
            step={0.5}
            placeholder="hours/day"
            style={{ width: 90, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>hours/day (optional)</span>
        </div>

        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create trip"}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {trips?.map((t) => (
          <li key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <Link to={`/trips/${t.id}`}>
              <strong>{t.name}</strong>
            </Link>
            {" — "}
            {t.destination}
            {t.waypoints?.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--fg-muted)", marginLeft: 6 }}>
                ({t.waypoints.map((w) => w.city).join(" → ")})
              </span>
            )}
            {" · "}{t.daysMin}–{t.daysMax} days
          </li>
        ))}
      </ul>
    </div>
  );
}
