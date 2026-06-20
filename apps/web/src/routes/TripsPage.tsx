import { useState } from "react";
import { Link } from "react-router-dom";
import { useTrips, useCreateTrip } from "../api/hooks";

export function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const create = useCreateTrip();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [daysMin, setDaysMin] = useState(7);
  const [daysMax, setDaysMax] = useState(10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !destination) return;
    create.mutate({
      name, destination, daysMin, daysMax,
      dateWindowStart: null, dateWindowEnd: null,
      routeType: "open", notes: "",
    });
    setName(""); setDestination("");
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Trip Planner</h1>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
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
          placeholder="Destination (e.g. Norway)"
          required
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={daysMin} onChange={(e) => setDaysMin(+e.target.value)} min={1} placeholder="Min days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>–</span>
          <input type="number" value={daysMax} onChange={(e) => setDaysMax(+e.target.value)} min={1} placeholder="Max days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>days</span>
        </div>
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create trip"}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {trips?.map((t) => (
          <li key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <Link to={`/trips/${t.id}`}>
              <strong>{t.name}</strong>
            </Link>
            {" — "}
            {t.destination} · {t.daysMin}–{t.daysMax} days
          </li>
        ))}
      </ul>
    </div>
  );
}
