import { useRef, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TripNav } from "../components/TripNav";
import { toast } from "sonner";
import { useTrip, useMessages, useProfile, usePostIntake, useClearMessages, type ChatMsg } from "../api/hooks";
import type { TravelerProfile } from "@trip/shared";

function ProfilePanel({ p }: { p?: TravelerProfile }) {
  if (!p) return null;
  return (
    <aside style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, fontSize: 13 }}>
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
  const clear = useClearMessages(id);

  const [localMsgs, setLocalMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [failedMsg, setFailedMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const base = savedMsgs ?? [];
  const allMsgs = [...base, ...localMsgs.slice(base.length)];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMsgs, post.isPending]);

  const send = async (opts?: { retryText?: string }) => {
    const text = (opts?.retryText ?? input).trim();
    if (!text || post.isPending) return;
    setFailedMsg(null);
    if (!opts?.retryText) {
      setInput("");
      setLocalMsgs((m) => [...m, { role: "user", content: text }]);
    }
    try {
      const res = await post.mutateAsync(text);
      setLocalMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
      await refetchProfile();
    } catch (err) {
      const msg = String(err);
      const isOverloaded = msg.includes("503") || msg.includes("UNAVAILABLE");
      toast.error(isOverloaded ? "Gemini is overloaded — try again in a few seconds." : "Failed to send message.");
      setFailedMsg(text);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link to="/" style={{ fontSize: 13, color: "var(--fg-muted)", textDecoration: "none" }}>← All trips</Link>
      </div>
      <TripNav id={id} />

      <h2>{trip?.name ?? "Trip"} — Interview</h2>
      <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
        Chat to describe your family and preferences. The AI will research places once your profile is complete.
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button
              onClick={() => { setLocalMsgs([]); clear.mutate(); }}
              disabled={clear.isPending || post.isPending || allMsgs.length === 0}
              style={{ fontSize: 12, padding: "2px 8px", cursor: "pointer" }}
            >
              Clear chat
            </button>
          </div>
          <div style={{
            height: 400, overflowY: "auto", border: "1px solid var(--border)",
            borderRadius: 6, padding: 12, marginBottom: 8, background: "var(--card)",
          }}>
            {allMsgs.length === 0 && (
              <p style={{ color: "var(--fg-subtle)" }}>Start by telling me about your trip…</p>
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
              <div style={{ color: "var(--fg-subtle)", fontStyle: "italic" }}>AI is thinking…</div>
            )}
            <div ref={bottomRef} />
          </div>

          {failedMsg && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6,
              padding: "8px 12px", marginBottom: 8, fontSize: 13,
            }}>
              <span style={{ color: "#856404" }}>⚠ Message failed to send.</span>
              <button
                onClick={() => send({ retryText: failedMsg })}
                disabled={post.isPending}
                style={{ marginLeft: 12, padding: "4px 12px", cursor: "pointer", background: "var(--primary)", color: "var(--primary-fg)", border: "none", borderRadius: 4, fontSize: 13 }}
              >
                {post.isPending ? "Retrying…" : "Retry"}
              </button>
            </div>
          )}

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
            <button onClick={() => send()} disabled={post.isPending}>Send</button>
          </div>
        </div>

        {/* Profile panel */}
        <div style={{ width: 200 }}>
          <ProfilePanel p={profile} />
          <button
            style={{
              marginTop: 12, width: "100%", padding: "8px 0", borderRadius: 4,
              cursor: "pointer", border: "none",
              background: profile?.completed ? "var(--primary)" : "var(--surface-3)",
              color: profile?.completed ? "var(--primary-fg)" : "var(--fg-muted)",
            }}
            onClick={() => navigate(`/trips/${id}/discover`)}
          >
            {profile?.completed ? "Go research places →" : "Skip to Discover →"}
          </button>
        </div>
      </div>
    </div>
  );
}
