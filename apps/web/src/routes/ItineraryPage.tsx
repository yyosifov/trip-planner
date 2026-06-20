import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBoard, useCreateDay, useAddItem, useSuggestBackups, usePlaces, type Place, type BoardDay } from "../api/hooks";

function DayCol({ day, likedPlaces, onAddItem, onSuggest }: {
  day: BoardDay;
  likedPlaces: Place[];
  onAddItem: (dayId: string, placeId: string) => void;
  onSuggest: (dayId: string) => Promise<Place[]>;
}) {
  const [backups, setBackups] = useState<Place[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState("");
  const hasWeather = day.items.some((i) => i.place.weatherDependent);

  const suggest = async () => {
    setSuggesting(true);
    const b = await onSuggest(day.id);
    setBackups(b);
    setSuggesting(false);
  };

  const usedIds = new Set(day.items.map((i) => i.place.id));
  const available = likedPlaces.filter((p) => !usedIds.has(p.id));

  return (
    <div style={{ minWidth: 200, maxWidth: 240, border: "1px solid #ddd", borderRadius: 6, padding: 10 }}>
      <h4 style={{ margin: "0 0 8px" }}>Day {day.dayIndex} {day.baseCity && `— ${day.baseCity}`}</h4>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
        {day.items.map((item) => (
          <li key={item.id} style={{ fontSize: 13, padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>
            {item.place.name} {item.place.weatherDependent ? "🌦" : ""}
            <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>
              {item.place.category}
            </span>
          </li>
        ))}
        {day.items.length === 0 && <li style={{ fontSize: 12, color: "#aaa" }}>No items yet</li>}
      </ul>

      {/* Add a liked place */}
      {available.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <select
            value={addingPlaceId}
            onChange={(e) => setAddingPlaceId(e.target.value)}
            style={{ flex: 1, fontSize: 12 }}
          >
            <option value="">Add place…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            disabled={!addingPlaceId}
            onClick={() => { onAddItem(day.id, addingPlaceId); setAddingPlaceId(""); }}
            style={{ fontSize: 12 }}
          >
            +
          </button>
        </div>
      )}

      {hasWeather && (
        <button
          onClick={suggest}
          disabled={suggesting}
          style={{ fontSize: 12, width: "100%", marginBottom: 6 }}
        >
          {suggesting ? "…" : "Suggest backup"}
        </button>
      )}

      {backups.length > 0 && (
        <div style={{ background: "#fffbea", border: "1px solid #ffd", borderRadius: 4, padding: 6, fontSize: 12 }}>
          <strong>☁️ Backups:</strong>
          <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
            {backups.map((b) => (
              <li key={b.id}>
                {b.name}
                <button
                  style={{ marginLeft: 6, fontSize: 11 }}
                  onClick={() => { onAddItem(day.id, b.id); setBackups([]); }}
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ItineraryPage() {
  const { id = "" } = useParams();
  const { data: board, refetch } = useBoard(id);
  const { data: places } = usePlaces(id, "liked");
  const createDay = useCreateDay(id);
  const addItem = useAddItem(id);
  const suggest = useSuggestBackups(id);
  const [baseCity, setBaseCity] = useState("");

  const nextIndex = (board?.length ?? 0) + 1;

  const handleAddDay = async () => {
    await createDay.mutateAsync({ dayIndex: nextIndex, baseCity });
    setBaseCity("");
    refetch();
  };

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ marginBottom: 12, fontSize: 13 }}>
        <Link to={`/trips/${id}/discover`}>← Discover</Link>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Itinerary</h2>
        <input
          value={baseCity}
          onChange={(e) => setBaseCity(e.target.value)}
          placeholder="Base city for new day"
          style={{ fontSize: 13 }}
        />
        <button onClick={handleAddDay} disabled={createDay.isPending}>
          + Add day
        </button>
      </div>

      {board?.length === 0 && (
        <p style={{ color: "#888" }}>No days yet — add a day above.</p>
      )}

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
        {board?.map((day) => (
          <DayCol
            key={day.id}
            day={day}
            likedPlaces={places ?? []}
            onAddItem={async (dayId, placeId) => {
              await addItem.mutateAsync({ dayId, placeId });
              refetch();
            }}
            onSuggest={(dayId) => suggest.mutateAsync(dayId)}
          />
        ))}
      </div>

      {(places?.length ?? 0) > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#555" }}>
            Liked places pool ({places?.length})
          </summary>
          <ul style={{ fontSize: 13, marginTop: 6 }}>
            {places?.map((p) => (
              <li key={p.id}>{p.name} — {p.category} · {p.difficulty} · kids {p.kidSuitability}/5 {p.weatherDependent ? "🌦" : ""}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
