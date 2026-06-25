import { useParams } from "react-router-dom";
import { TripNav } from "../components/TripNav";
import { toast } from "sonner";
import { useWildlife, useGenerateWildlife } from "../api/hooks";
import type { SpeciesToSpot, SafetyItem, PerPlaceNote } from "@trip/shared";

const TYPE_ICON: Record<string, string> = {
  bird: "🐦", mammal: "🦊", reptile: "🦎", insect: "🐛", amphibian: "🐸", other: "🐾",
};
const RISK_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#ef4444",
};

function SpeciesCard({ s }: { s: SpeciesToSpot }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
      <div style={{ fontWeight: 600 }}>
        {TYPE_ICON[s.type] ?? "🐾"} {s.name}{" "}
        <span title={`Kid appeal: ${s.kidAppeal}/5`}>{"★".repeat(Math.max(0, s.kidAppeal))}{"☆".repeat(Math.max(0, 5 - s.kidAppeal))}</span>
      </div>
      {s.funFact && <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>{s.funFact}</div>}
    </div>
  );
}

function SafetyRow({ s }: { s: SafetyItem }) {
  return (
    <li style={{ marginBottom: 4 }}>
      <span style={{ fontWeight: 600 }}>{s.animal}</span>{" "}
      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, color: "#fff", background: RISK_COLOR[s.risk] ?? "var(--fg-muted)" }}>
        {s.risk}
      </span>
      {s.danger && <span> — {s.danger}</span>}
      {s.whatToDo && <span style={{ color: "var(--fg-muted)" }}> ({s.whatToDo})</span>}
    </li>
  );
}

function PerPlace({ note }: { note: PerPlaceNote }) {
  if (note.species.length === 0 && note.safety.length === 0) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <h3>{note.placeName}</h3>
      {note.species.map((s, i) => <SpeciesCard key={i} s={s} />)}
      {note.safety.length > 0 && <ul>{note.safety.map((s, i) => <SafetyRow key={i} s={s} />)}</ul>}
    </section>
  );
}

export function WildlifePage() {
  const { id = "" } = useParams();
  const { data: report, isLoading } = useWildlife(id);
  const gen = useGenerateWildlife(id);

  const onGenerate = () =>
    gen.mutate(undefined, {
      onSuccess: () => toast.success("Wildlife info generated"),
      onError: (e) => toast.error(String((e as Error)?.message ?? e)),
    });

  const data = report?.data;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20, paddingBottom: 48 }}>
      <TripNav id={id} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>🦌 Wildlife & Fauna</h1>
        {!isLoading && (
          <button onClick={onGenerate} disabled={gen.isPending}>
            {gen.isPending ? "Generating…" : report ? "Regenerate" : "Generate wildlife info"}
          </button>
        )}
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && !report && <p>No wildlife info yet. Click "Generate wildlife info".</p>}

      {data && (
        <>
          {data.summary && <p>{data.summary}</p>}

          {data.species.length > 0 && (
            <section>
              <h2>Spot these</h2>
              {data.species.map((s, i) => <SpeciesCard key={i} s={s} />)}
            </section>
          )}

          {data.seasonal.length > 0 && (
            <section>
              <h2>Seasonal notes</h2>
              <ul>{data.seasonal.map((n, i) => <li key={i}><b>{n.window}:</b> {n.note}</li>)}</ul>
            </section>
          )}

          {data.safety.length > 0 && (
            <section>
              <h2>⚠️ Safety</h2>
              <ul>{data.safety.map((s, i) => <SafetyRow key={i} s={s} />)}</ul>
            </section>
          )}

          {data.perPlace.length > 0 && (
            <section>
              <h2>By place</h2>
              {data.perPlace.map((n, i) => <PerPlace key={i} note={n} />)}
            </section>
          )}

          {report?.generatedAt && (
            <p style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 24 }}>
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
