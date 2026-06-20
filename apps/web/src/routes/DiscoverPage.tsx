import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { usePlaces, useSetPlaceStatus, useRunResearch, type Place } from "../api/hooks";
import type { PlaceStatus } from "@trip/shared";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function PlacePin({ place, onClick }: { place: Place; onClick: () => void }) {
  const color = place.status === "liked" ? "#22c55e" : place.status === "rejected" ? "#ef4444" : "#3b82f6";
  return (
    <AdvancedMarker position={{ lat: place.lat!, lng: place.lng! }} onClick={onClick}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        background: color, border: "2px solid white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </AdvancedMarker>
  );
}

function StatusBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 8px", fontSize: 12, borderRadius: 4,
        border: active ? "2px solid #333" : "1px solid #ccc",
        background: active ? "#333" : "#fff",
        color: active ? "#fff" : "#333",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PlaceRow({ place, onStatus, selected, onClick }: {
  place: Place;
  onStatus: (s: PlaceStatus) => void;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "8px 10px", borderBottom: "1px solid #eee",
        background: selected ? "#f0f7ff" : "#fff", cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>
          {place.name} {place.weatherDependent ? "🌦" : ""}
        </span>
        <span style={{ fontSize: 11, color: "#888" }}>{place.category} · {place.difficulty}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", margin: "3px 0 6px" }}>
        {place.description.slice(0, 80)}{place.description.length > 80 ? "…" : ""}
      </div>
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <StatusBtn label="👍 Like" active={place.status === "liked"} onClick={() => onStatus("liked")} />
        <StatusBtn label="🤔 Maybe" active={place.status === "maybe"} onClick={() => onStatus("maybe")} />
        <StatusBtn label="👎 Pass" active={place.status === "rejected"} onClick={() => onStatus("rejected")} />
      </div>
    </div>
  );
}

export function DiscoverPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: places, isLoading, refetch } = usePlaces(id);
  const setStatus = useSetPlaceStatus(id);
  const research = useRunResearch(id);
  const [selected, setSelected] = useState<Place | null>(null);
  const [filter, setFilter] = useState<PlaceStatus | "all">("all");

  const visible = places?.filter((p) => filter === "all" || p.status === filter) ?? [];
  const withCoords = visible.filter((p) => p.lat != null && p.lng != null);
  const center = withCoords[0] ? { lat: withCoords[0].lat!, lng: withCoords[0].lng! } : { lat: 60.4, lng: 8 };
  const likedCount = places?.filter((p) => p.status === "liked").length ?? 0;

  const runResearch = async () => {
    await research.mutateAsync();
    await refetch();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top bar */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 12, alignItems: "center" }}>
        <Link to={`/trips/${id}`} style={{ fontSize: 13 }}>← Interview</Link>
        <strong style={{ flex: 1 }}>Discover Places</strong>
        <button
          onClick={runResearch}
          disabled={research.isPending}
          style={{ padding: "4px 12px", fontSize: 13 }}
        >
          {research.isPending ? "Researching…" : "🔍 Run research"}
        </button>
        <button
          disabled={likedCount === 0}
          onClick={() => navigate(`/trips/${id}/itinerary`)}
          style={{ padding: "4px 12px", fontSize: 13, background: "#0070f3", color: "#fff", border: "none", borderRadius: 4, cursor: likedCount > 0 ? "pointer" : "not-allowed" }}
        >
          Plan itinerary ({likedCount} liked) →
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: list */}
        <div style={{ width: 320, borderRight: "1px solid #eee", display: "flex", flexDirection: "column" }}>
          {/* Filter tabs */}
          <div style={{ padding: "6px 10px", borderBottom: "1px solid #eee", display: "flex", gap: 6 }}>
            {(["all", "liked", "maybe", "new", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 12, padding: "2px 8px", borderRadius: 10,
                  border: "none", cursor: "pointer",
                  background: filter === f ? "#333" : "#eee",
                  color: filter === f ? "#fff" : "#333",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading && <p style={{ padding: 12, color: "#888" }}>Loading…</p>}
            {!isLoading && visible.length === 0 && (
              <p style={{ padding: 12, color: "#888" }}>
                {places?.length === 0 ? "No places yet — run research." : "No places match filter."}
              </p>
            )}
            {visible.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                selected={selected?.id === p.id}
                onClick={() => setSelected(p)}
                onStatus={(s) => setStatus.mutate({ placeId: p.id, status: s })}
              />
            ))}
          </div>
        </div>

        {/* Right: map */}
        <div style={{ flex: 1 }}>
          {!MAPS_KEY ? (
            <div style={{ padding: 24, color: "#888" }}>
              Map disabled — add <code>VITE_GOOGLE_MAPS_API_KEY</code> to .env
            </div>
          ) : (
            <APIProvider apiKey={MAPS_KEY}>
              <Map
                style={{ width: "100%", height: "100%" }}
                defaultCenter={center}
                defaultZoom={7}
                mapId="trip-discover"
              >
                {withCoords.map((p) => (
                  <PlacePin key={p.id} place={p} onClick={() => setSelected(p)} />
                ))}
                {selected?.lat != null && selected?.lng != null && (
                  <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => setSelected(null)}
                  >
                    <div style={{ maxWidth: 200 }}>
                      <strong>{selected.name}</strong>
                      <p style={{ margin: "4px 0", fontSize: 12 }}>{selected.description.slice(0, 120)}</p>
                      <p style={{ fontSize: 11, color: "#888" }}>
                        {selected.category} · {selected.difficulty} · kids {selected.kidSuitability}/5
                        · ~{selected.estDurationMin}min
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          )}
        </div>
      </div>
    </div>
  );
}
