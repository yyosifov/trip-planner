import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  food: "#ef4444", sight: "#3b82f6", other: "#6b7280",
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
  const catColor = CAT_COLOR[place.category] ?? "#6b7280";
  const diffColor = DIFFICULTY_COLOR[place.difficulty] ?? "#6b7280";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px", borderBottom: "1px solid #f0f0f0",
        background: selected ? "#eff6ff" : "#fff",
        cursor: "pointer", transition: "background 0.1s",
        borderLeft: selected ? "3px solid #3b82f6" : "3px solid transparent",
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
              <Badge label="☔ rain risk" color="#0369a1" bg="#e0f2fe" />
            )}
            {place.segment && (
              <Badge label={`📍 ${place.segment}`} color="#374151" bg="#f1f5f9" />
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#f59e0b", flexShrink: 0 }}>
          <Stars n={place.kidSuitability} />
        </div>
      </div>

      {/* Description snippet */}
      <p style={{ fontSize: 12, color: "#555", margin: "4px 0 6px 26px", lineHeight: 1.4 }}>
        {place.description.slice(0, 90)}{place.description.length > 90 ? "…" : ""}
      </p>

      {/* Duration */}
      {place.estDurationMin > 0 && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, marginLeft: 26 }}>
          ⏱ ~{place.estDurationMin >= 60 ? `${Math.round(place.estDurationMin / 60)}h` : `${place.estDurationMin}min`}
          {!place.lat && <span style={{ color: "#f59e0b", marginLeft: 6 }}>⚠ no map pin</span>}
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
              border: place.status === s ? "2px solid #333" : "1px solid #ddd",
              background: place.status === s ? "#333" : "#fafafa",
              color: place.status === s ? "#fff" : "#555",
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
  const catColor = CAT_COLOR[place.category] ?? "#6b7280";
  const mapsSearch = `https://www.google.com/maps/search/${encodeURIComponent(place.name)}`;
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(place.name + " Norway")}`;
  const reviewsSearch = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(place.name)}`;

  return (
    <div style={{
      width: 360, borderRight: "1px solid #eee", display: "flex", flexDirection: "column",
      overflowY: "auto", background: "#fff",
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
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#888", marginLeft: 8, padding: 0 }}>✕</button>
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
              color="#4b5563"
              bg="#f3f4f6"
            />
          )}
        </div>

        {/* Kid suitability */}
        <div style={{ fontSize: 13, marginBottom: 8, color: "#92400e" }}>
          👨‍👩‍👧 Kid suitability: <span style={{ color: "#f59e0b" }}><Stars n={place.kidSuitability} /></span> {place.kidSuitability}/5
        </div>

        {/* Weather */}
        <div style={{
          fontSize: 13, marginBottom: 12, padding: "8px 10px", borderRadius: 6,
          background: place.weatherDependent ? "#fef3c7" : "#f0fdf4",
          color: place.weatherDependent ? "#92400e" : "#166534",
        }}>
          {place.weatherDependent
            ? "☔ Weather-dependent — best avoided on rainy days"
            : "✅ Indoor or weather-independent — fine in any weather"}
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 12px" }}>
          {place.description}
        </p>

        {/* Tags */}
        {place.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
            {(place.tags as string[]).map((t) => (
              <span key={t} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "#f3f4f6", color: "#374151" }}>
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
                border: place.status === s ? "2px solid #333" : "1px solid #ddd",
                background: place.status === s ? "#333" : "#fafafa",
                color: place.status === s ? "#fff" : "#555",
              }}
            >
              {s === "liked" ? "👍 Like" : s === "maybe" ? "🤔 Maybe" : "👎 Pass"}
            </button>
          ))}
        </div>

        {/* External links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a href={mapsSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            🗺 Open in Google Maps
          </a>
          <a href={ytSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "#dc2626", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            ▶ Search on YouTube
          </a>
          <a href={reviewsSearch} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "#059669", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            ⭐ Find reviews on TripAdvisor
          </a>
          {place.sourceUrl && (
            <a href={place.sourceUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#7c3aed", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              🔗 Source article
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PlacePin({ place, selected, onClick }: { place: Place; selected: boolean; onClick: () => void }) {
  const color = place.status === "liked" ? "#22c55e" : place.status === "rejected" ? "#ef4444" : (CAT_COLOR[place.category] ?? "#3b82f6");
  return (
    <CircleMarker
      center={[place.lat!, place.lng!]}
      radius={selected ? 9 : 7}
      pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <strong style={{ fontSize: 13 }}>{place.name}</strong>
        <br />
        <span style={{ fontSize: 12, color: "#555" }}>
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
          background: "#eff6ff", borderBottom: "1px solid #bfdbfe",
          padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 13,
        }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "#1d4ed8" }}>Researching places — searching the web and extracting with AI…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 12, alignItems: "center" }}>
        <Link to={`/trips/${id}`} style={{ fontSize: 13 }}>← Interview</Link>
        <Link to={`/trips/${id}/wildlife`} style={{ fontSize: 13 }}>Wildlife</Link>
        <Link to={`/trips/${id}/weather`} style={{ fontSize: 13 }}>Weather</Link>
        <strong style={{ flex: 1 }}>Discover Places</strong>
        <button onClick={runResearch} disabled={research.isPending} style={{ padding: "4px 12px", fontSize: 13 }}>
          {research.isPending ? "Researching…" : "🔍 Run research"}
        </button>
        <button
          disabled={likedCount === 0}
          onClick={() => navigate(`/trips/${id}/itinerary`)}
          style={{ padding: "4px 12px", fontSize: 13, background: "#0070f3", color: "#fff", border: "none", borderRadius: 4, cursor: likedCount > 0 ? "pointer" : "not-allowed", opacity: likedCount > 0 ? 1 : 0.5 }}
        >
          Plan itinerary ({likedCount} liked) →
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: list */}
        <div style={{ width: 300, borderRight: "1px solid #eee", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Category filter */}
          <div style={{ padding: "6px 8px", borderBottom: "1px solid #f0f0f0", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "none", cursor: "pointer",
                background: catFilter === c ? "#1f2937" : "#f3f4f6",
                color: catFilter === c ? "#fff" : "#374151",
              }}>
                {c === "all" ? "🌍 all" : `${CAT_ICON[c]} ${c}`}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div style={{ padding: "4px 8px", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 4 }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "none", cursor: "pointer",
                background: statusFilter === f ? "#374151" : "#f3f4f6",
                color: statusFilter === f ? "#fff" : "#374151",
              }}>
                {f === "liked" ? "👍" : f === "maybe" ? "🤔" : f === "rejected" ? "👎" : f === "new" ? "🆕" : "🌍"} {f}
              </button>
            ))}
          </div>

          {/* Segment filter */}
          {segments.length > 0 && (
            <div style={{ padding: "6px 8px", borderBottom: "1px solid #f0f0f0", display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["all", ...segments].map((s) => (
                <button
                  key={s}
                  onClick={() => setSegFilter(s)}
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10, border: "none",
                    cursor: "pointer",
                    background: segFilter === s ? "#0f172a" : "#f3f4f6",
                    color: segFilter === s ? "#fff" : "#374151",
                    fontWeight: segFilter === s ? 600 : 400,
                  }}
                >
                  {s === "all" ? "🗺 all" : s}
                </button>
              ))}
            </div>
          )}

          {/* Count */}
          <div style={{ padding: "4px 12px", fontSize: 11, color: "#9ca3af", borderBottom: "1px solid #f0f0f0" }}>
            {visible.length} place{visible.length !== 1 ? "s" : ""}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading && <p style={{ padding: 12, color: "#888" }}>Loading…</p>}
            {!isLoading && visible.length === 0 && (
              <p style={{ padding: 12, color: "#888", fontSize: 13 }}>
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
