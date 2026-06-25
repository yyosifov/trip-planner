import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TripNav } from "../components/TripNav";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { usePlaces, useSetPlaceStatus, useRunResearch, type Place } from "../api/hooks";
import type { PlaceStatus } from "@trip/shared";

const CAT_ICON: Record<string, string> = {
  hike: "🥾", activity: "🎯", museum: "🏛️", beach: "🏖️",
  food: "🍽️", sight: "👁️", other: "📍",
};
const CAT_COLOR: Record<string, string> = {
  hike: "#10b981", activity: "#f59e0b", museum: "#8b5cf6", beach: "#06b6d4",
  food: "#ef4444", sight: "#3b82f6", other: "var(--fg-muted)",
};
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#22c55e", moderate: "#f59e0b", hard: "#ef4444",
};
const CATEGORIES = ["all", "hike", "activity", "museum", "beach", "food", "sight", "other"] as const;
type CategoryFilter = typeof CATEGORIES[number];
const STATUS_FILTERS = ["all", "liked", "maybe", "new", "rejected"] as const;

function Stars({ n }: { n: number }) {
  return (
    <span title={`Kid suitability: ${n}/5`}>
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: bg, color, fontWeight: 500 }}>
      {label}
    </span>
  );
}

function PlaceCard({ place, selected, onClick, onStatus }: {
  place: Place;
  selected: boolean;
  onClick: () => void;
  onStatus: (s: PlaceStatus) => void;
}) {
  const icon = CAT_ICON[place.category] ?? "📍";
  const catColor = CAT_COLOR[place.category] ?? "var(--fg-muted)";
  const diffColor = DIFFICULTY_COLOR[place.difficulty] ?? "var(--fg-muted)";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px", borderBottom: "1px solid var(--border)",
        background: selected ? "var(--primary-soft)" : "var(--card)",
        cursor: "pointer", transition: "background 0.1s",
        borderLeft: selected ? "3px solid var(--primary)" : "3px solid transparent",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>{place.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <Badge label={place.category} color={catColor} bg={catColor + "20"} />
            <Badge label={place.difficulty} color={diffColor} bg={diffColor + "20"} />
            {place.weatherDependent && (
              <Badge label="☔ rain risk" color="var(--info)" bg="var(--surface-2)" />
            )}
            {place.segment && (
              <Badge label={`📍 ${place.segment}`} color="var(--fg)" bg="var(--surface-2)" />
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--warning)", flexShrink: 0 }}>
          <Stars n={place.kidSuitability} />
        </div>
      </div>

      {/* Description snippet */}
      <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "4px 0 6px 26px", lineHeight: 1.4 }}>
        {place.description.slice(0, 90)}{place.description.length > 90 ? "…" : ""}
      </p>

      {/* Duration */}
      {place.estDurationMin > 0 && (
        <div style={{ fontSize: 11, color: "var(--fg-subtle)", marginBottom: 6, marginLeft: 26 }}>
          ⏱ ~{place.estDurationMin >= 60 ? `${Math.round(place.estDurationMin / 60)}h` : `${place.estDurationMin}min`}
          {!place.lat && <span style={{ color: "var(--warning)", marginLeft: 6 }}>⚠ no map pin</span>}
        </div>
      )}

      {/* Status buttons */}
      <div style={{ display: "flex", gap: 5, marginLeft: 26 }} onClick={(e) => e.stopPropagation()}>
        {(["liked", "maybe", "rejected"] as PlaceStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            style={{
              padding: "2px 8px", fontSize: 11, borderRadius: 4, cursor: "pointer",
              border: place.status === s ? "2px solid var(--border-strong)" : "1px solid var(--border)",
              background: place.status === s ? "var(--fg)" : "var(--surface-2)",
              color: place.status === s ? "var(--card)" : "var(--fg-muted)",
            }}
          >
            {s === "liked" ? "👍" : s === "maybe" ? "🤔" : "👎"} {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ place, onClose, onStatus }: {
  place: Place;
  onClose: () => void;
  onStatus: (s: PlaceStatus) => void;
}) {
  const icon = CAT_ICON[place.category] ?? "📍";
  const catColor = CAT_COLOR[place.category] ?? "var(--fg-muted)";
  const mapsSearch = `https://www.google.com/maps/search/${encodeURIComponent(place.name)}`;
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(place.name + " Norway")}`;
  const reviewsSearch = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(place.name)}`;

  return (
    <div style={{
      width: 360, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
      overflowY: "auto", background: "var(--card)",
    }}>
      {/* Photo / placeholder */}
      {place.photoUrl ? (
        <img src={place.photoUrl} alt={place.name} style={{ width: "100%", height: 180, objectFit: "cover" }} />
      ) : (
        <div style={{
          height: 140, background: (catColor) + "15",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 52,
        }}>
          {icon}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: 16, flex: 1 }}>
        {/* Name + close */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.3, flex: 1 }}>{place.name}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--fg-subtle)", marginLeft: 8, padding: 0 }}>✕</button>
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          <Badge label={`${icon} ${place.category}`} color={catColor} bg={catColor + "20"} />
          <Badge
            label={place.difficulty}
            color={DIFFICULTY_COLOR[place.difficulty]}
            bg={DIFFICULTY_COLOR[place.difficulty] + "20"}
          />
          {place.estDurationMin > 0 && (
            <Badge
              label={`⏱ ~${place.estDurationMin >= 60 ? `${Math.round(place.estDurationMin / 60)}h` : `${place.estDurationMin}min`}`}
              color="var(--fg-muted)"
              bg="var(--surface-2)"
            />
          )}
        </div>

        {/* Kid suitability */}
        <div style={{ fontSize: 13, marginBottom: 8, color: "var(--fg-muted)" }}>
          👨‍👩‍👧 Kid suitability: <span style={{ color: "var(--warning)" }}><Stars n={place.kidSuitability} /></span> {place.kidSuitability}/5
        </div>

        {/* Weather */}
        <div style={{
          fontSize: 13, marginBottom: 12, padding: "8px 10px", borderRadius: 6,
          background: place.weatherDependent ? "var(--surface-3)" : "var(--surface-2)",
          color: place.weatherDependent ? "var(--warning)" : "var(--success)",
        }}>
          {place.weatherDependent
            ? "☔ Weather-dependent — best avoided on rainy days"
            : "✅ Indoor or weather-independent — fine in any weather"}
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.6, margin: "0 0 12px" }}>
          {place.description}
        </p>

        {/* Tags */}
        {place.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
            {(place.tags as string[]).map((t) => (
              <span key={t} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "var(--surface-3)", color: "var(--fg)" }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Status buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["liked", "maybe", "rejected"] as PlaceStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              style={{
                flex: 1, padding: "6px 0", fontSize: 12, borderRadius: 6, cursor: "pointer",
                border: place.status === s ? "2px solid var(--border-strong)" : "1px solid var(--border)",
                background: place.status === s ? "var(--fg)" : "var(--surface-2)",
                color: place.status === s ? "var(--card)" : "var(--fg-muted)",
              }}
            >
              {s === "liked" ? "👍 Like" : s === "maybe" ? "🤔 Maybe" : "👎 Pass"}
            </button>
          ))}
        </div>

        {/* External links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a href={mapsSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            🗺 Open in Google Maps
          </a>
          <a href={ytSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "var(--danger)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            ▶ Search on YouTube
          </a>
          <a href={reviewsSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "var(--success)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            ⭐ Find reviews on TripAdvisor
          </a>
          {place.sourceUrl && (
            <a href={place.sourceUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "var(--fg-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              🔗 Source article
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PlacePin({ place, selected, onClick }: { place: Place; selected: boolean; onClick: () => void }) {
  const color = place.status === "liked" ? "var(--success)" : place.status === "rejected" ? "var(--danger)" : (CAT_COLOR[place.category] ?? "var(--primary)");
  return (
    <CircleMarker
      center={[place.lat!, place.lng!]}
      radius={selected ? 9 : 7}
      pathOptions={{ color: "var(--card)", weight: 2, fillColor: color, fillOpacity: 1 }}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <strong style={{ fontSize: 13 }}>{place.name}</strong>
        <br />
        <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
          {CAT_ICON[place.category]} {place.category} · {place.difficulty}
        </span>
      </Popup>
    </CircleMarker>
  );
}

export function DiscoverPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: places, isLoading, refetch } = usePlaces(id);
  const setStatus = useSetPlaceStatus(id);
  const research = useRunResearch(id);
  const [selected, setSelected] = useState<Place | null>(null);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("all");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [segFilter, setSegFilter] = useState("all");

  const segments = useMemo(
    () =>
      [...new Set((places ?? []).map((p) => p.segment).filter((s): s is string => s !== null))].sort(),
    [places],
  );

  const visible = (places ?? []).filter(
    (p) =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (catFilter === "all" || p.category === catFilter) &&
      (segFilter === "all" || p.segment === segFilter),
  );
  const withCoords = visible.filter((p) => p.lat != null && p.lng != null);
  const allWithCoords = (places ?? []).filter((p) => p.lat != null && p.lng != null);
  const center: [number, number] = allWithCoords[0] ? [allWithCoords[0].lat!, allWithCoords[0].lng!] : [60.4, 8];
  const likedCount = places?.filter((p) => p.status === "liked").length ?? 0;

  const runResearch = () => {
    toast.promise(
      research.mutateAsync().then(async (result) => { await refetch(); return result; }),
      {
        loading: "Researching places… this takes 20–40 s",
        success: (r) => `Found ${r.created} new place${r.created === 1 ? "" : "s"}`,
        error: "Research failed — check API logs",
      },
    );
  };

  const handleStatus = (place: Place, s: PlaceStatus) => {
    setStatus.mutate({ placeId: place.id, status: s });
    if (selected?.id === place.id) setSelected({ ...selected, status: s });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Research banner */}
      {research.isPending && (
        <div style={{
          background: "var(--primary-soft)", borderBottom: "1px solid var(--primary-border)",
          padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 13,
        }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--primary)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "var(--primary)" }}>Researching places — searching the web and extracting with AI…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", background: "var(--card)" }}>
        <TripNav id={id} mb={0} />
        <div style={{ flex: 1 }} />
        <button onClick={runResearch} disabled={research.isPending} style={{ padding: "5px 12px", fontSize: 13, borderRadius: 6 }}>
          {research.isPending ? "Researching…" : "🔍 Run research"}
        </button>
        <button
          disabled={likedCount === 0}
          onClick={() => navigate(`/trips/${id}/itinerary`)}
          style={{ padding: "5px 12px", fontSize: 13, background: "var(--primary)", color: "var(--primary-fg)", border: "none", borderRadius: 6, cursor: likedCount > 0 ? "pointer" : "not-allowed", opacity: likedCount > 0 ? 1 : 0.5 }}
        >
          Plan itinerary ({likedCount} liked) →
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: list */}
        <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Category filter */}
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "none", cursor: "pointer",
                background: catFilter === c ? "var(--fg)" : "var(--surface-2)",
                color: catFilter === c ? "var(--card)" : "var(--fg)",
              }}>
                {c === "all" ? "🌍 all" : `${CAT_ICON[c]} ${c}`}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)", display: "flex", gap: 4 }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "none", cursor: "pointer",
                background: statusFilter === f ? "var(--fg)" : "var(--surface-2)",
                color: statusFilter === f ? "var(--card)" : "var(--fg)",
              }}>
                {f === "liked" ? "👍" : f === "maybe" ? "🤔" : f === "rejected" ? "👎" : f === "new" ? "🆕" : "🌍"} {f}
              </button>
            ))}
          </div>

          {/* Segment filter */}
          {segments.length > 0 && (
            <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["all", ...segments].map((s) => (
                <button
                  key={s}
                  onClick={() => setSegFilter(s)}
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10, border: "none",
                    cursor: "pointer",
                    background: segFilter === s ? "var(--fg)" : "var(--surface-2)",
                    color: segFilter === s ? "var(--card)" : "var(--fg)",
                    fontWeight: segFilter === s ? 600 : 400,
                  }}
                >
                  {s === "all" ? "🗺 all" : s}
                </button>
              ))}
            </div>
          )}

          {/* Count */}
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)" }}>
            {visible.length} place{visible.length !== 1 ? "s" : ""}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading && <p style={{ padding: 12, color: "var(--fg-subtle)" }}>Loading…</p>}
            {!isLoading && visible.length === 0 && (
              <p style={{ padding: 12, color: "var(--fg-subtle)", fontSize: 13 }}>
                {places?.length === 0 ? "No places yet — run research." : "No places match filters."}
              </p>
            )}
            {visible.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                selected={selected?.id === p.id}
                onClick={() => setSelected((prev) => prev?.id === p.id ? null : p)}
                onStatus={(s) => handleStatus(p, s)}
              />
            ))}
          </div>
        </div>

        {/* Center: detail panel */}
        {selected && (
          <DetailPanel
            place={selected}
            onClose={() => setSelected(null)}
            onStatus={(s) => handleStatus(selected, s)}
          />
        )}

        {/* Right: map (OpenStreetMap, free) */}
        <div style={{ flex: 1 }}>
          <MapContainer center={center} zoom={6} style={{ width: "100%", height: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {withCoords.map((p) => (
              <PlacePin
                key={p.id}
                place={p}
                selected={selected?.id === p.id}
                onClick={() => setSelected((prev) => prev?.id === p.id ? null : p)}
              />
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
