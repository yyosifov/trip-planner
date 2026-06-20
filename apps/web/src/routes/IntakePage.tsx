import { useRef, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTrip, useMessages, useProfile, usePostIntake, type ChatMsg } from "../api/hooks";
import type { TravelerProfile } from "@trip/shared";

function ProfilePanel({ p }: { p?: TravelerProfile }) {
  if (!p) return null;
  return (
    <aside style={{ background: "#f9f9f9", padding: 12, borderRadius: 6, fontSize: 13 }}>
      <strong>Profile {p.completed ? "✓" : "(filling…)"}</strong>
      <ul style={{ margin: "6px 0", paddingLeft: 16 }}>
        <li>Adults: {p.partyAdults}, Kids: {p.partyKids} ({p.kidsAges.join(", ")} yrs)</li>
        <li>Max hike: {p.maxHikeKm ?? "?"} km / {p.maxHikeElevationM ?? "?"} m</li>
        <li>Pace: {p.pace ?? "?"}</li>
        {p.interests.length > 0 && <li>Interests: {p.interests.join(", ")}</li>}
        {p.dislikes.length > 0 && <li>Dislikes: {p.dislikes.join(", ")}</li>}
      </ul>
    </aside>
  );
}

export function IntakePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: trip } = useTrip(id);
  const { data: savedMsgs } = useMessages(id);
  const { data: profile, refetch: refetchProfile } = useProfile(id);
  const post = usePostIntake(id);

  const [localMsgs, setLocalMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const allMsgs = savedMsgs?.length ? savedMsgs : localMsgs;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMsgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || post.isPending) return;
    setInput("");
    setLocalMsgs((m) => [...m, { role: "user", content: text }]);
    const res = await post.mutateAsync(text);
    setLocalMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
    await refetchProfile();
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <nav style={{ marginBottom: 12, fontSize: 13 }}>
        <Link to="/">← All trips</Link>
        {" · "}
        <Link to={`/trips/${id}/discover`}>Discover places →</Link>
      </nav>

      <h2>{trip?.name ?? "Trip"} — Interview</h2>
      <p style={{ color: "#666", fontSize: 13 }}>
        Chat to describe your family and preferences. The AI will research places once your profile is complete.
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            height: 400, overflowY: "auto", border: "1px solid #ddd",
            borderRadius: 6, padding: 12, marginBottom: 8, background: "#fff",
          }}>
            {allMsgs.length === 0 && (
              <p style={{ color: "#aaa" }}>Start by telling me about your trip…</p>
            )}
            {allMsgs.map((m, i) => (
              <div key={i} style={{
                marginBottom: 10, textAlign: m.role === "user" ? "right" : "left",
              }}>
                <span style={{
                  display: "inline-block", padding: "6px 10px", borderRadius: 8,
                  background: m.role === "user" ? "#0070f3" : "#f0f0f0",
                  color: m.role === "user" ? "#fff" : "#000",
                  maxWidth: "80%",
                }}>
                  {m.content}
                </span>
              </div>
            ))}
            {post.isPending && (
              <div style={{ color: "#aaa", fontStyle: "italic" }}>AI is thinking…</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              aria-label="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              style={{ flex: 1 }}
              disabled={post.isPending}
            />
            <button onClick={send} disabled={post.isPending}>Send</button>
          </div>
        </div>

        {/* Profile panel */}
        <div style={{ width: 200 }}>
          <ProfilePanel p={profile} />
          {profile?.completed && (
            <button
              style={{ marginTop: 12, width: "100%", background: "#0070f3", color: "#fff", border: "none", padding: "8px 0", borderRadius: 4, cursor: "pointer" }}
              onClick={() => navigate(`/trips/${id}/discover`)}
            >
              Go research places →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
