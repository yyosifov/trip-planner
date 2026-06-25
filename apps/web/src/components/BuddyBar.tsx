import { useState, useEffect, useRef, useCallback, type CSSProperties, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBuddy } from "../api/useBuddy";
import type { BuddyMessage, BuddyAction } from "@trip/shared";

interface Props {
  tripId: string;
}

const EXPANDED_HEIGHT = "min(50vh, 480px)";

export default function BuddyBar({ tripId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, loading, suggestion, error, loadHistory, sendMessage, checkSuggestion, dismissSuggestion, clearError } =
    useBuddy(tripId);
  const qc = useQueryClient();

  // Watch the places query cache — when it updates, check for suggestions
  useEffect(() => {
    const cache = qc.getQueryCache();
    const unsub = cache.subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "places" &&
        event.query.queryKey[1] === tripId
      ) {
        checkSuggestion();
      }
    });
    return unsub;
  }, [tripId, qc, checkSuggestion]);

  // Load history when first expanded
  useEffect(() => {
    if (expanded && messages.length === 0) {
      loadHistory();
    }
  }, [expanded, loadHistory, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  const handleOpen = () => {
    setExpanded(true);
    dismissSuggestion();
  };

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");
    await sendMessage(content);
  }, [input, loading, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const barStyle: CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: "var(--card)",
    borderTop: "2px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    height: expanded ? EXPANDED_HEIGHT : "40px",
    transition: "height 0.25s ease",
    overflow: "hidden",
  };

  const collapsedRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
    height: 40,
    flexShrink: 0,
    cursor: "pointer",
  };

  const messagesStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const inputRowStyle: CSSProperties = {
    display: "flex",
    gap: 8,
    padding: "8px 14px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  };

  return (
    <div style={barStyle}>
      {/* Collapsed clickable bar — always visible */}
      <div style={collapsedRowStyle} onClick={expanded ? undefined : handleOpen}>
        <span style={{ position: "relative", lineHeight: 1 }}>
          💬
          {suggestion && !expanded && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--primary)",
              }}
              title={suggestion.preview}
            />
          )}
        </span>
        {!expanded && (
          <>
            <span style={{ flex: 1, fontSize: 13, color: "var(--fg-muted)" }}>
              {suggestion ? suggestion.preview : "Ask Trip Buddy anything…"}
            </span>
            <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>▲</span>
          </>
        )}
        {expanded && (
          <>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--fg)" }}>💬 Trip Buddy</span>
            <span style={{ fontSize: 11, background: "var(--success-bg)", color: "var(--success)", padding: "1px 6px", borderRadius: 10 }}>
              online
            </span>
            <span style={{ flex: 1 }} />
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", fontSize: 12 }}
            >
              ▼ Close
            </button>
          </>
        )}
      </div>

      {/* Expanded chat area */}
      {expanded && (
        <>
          <div style={messagesStyle}>
            {messages.length === 0 && !loading && (
              <p style={{ color: "var(--fg-subtle)", fontSize: 13, textAlign: "center", marginTop: 16 }}>
                Ask me anything about your trip to get started.
              </p>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {error && (
              <div style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-sm)",
                padding: "8px 12px",
                fontSize: 12,
                color: "var(--fg-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span>{error}</span>
                <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-subtle)", fontSize: 11 }}>✕</button>
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>🧭</span>
                <div style={{ fontSize: 13, color: "var(--fg-muted)", fontStyle: "italic" }}>
                  Trip Buddy is thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={inputRowStyle}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={loading}
              style={{
                flex: 1,
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                borderRadius: "var(--r-sm)",
                padding: "6px 10px",
                fontSize: 13,
                color: "var(--fg)",
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 32,
                height: 32,
                background: "var(--primary)",
                color: "var(--primary-fg)",
                border: "none",
                borderRadius: "var(--r-sm)",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: BuddyMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 6, alignItems: "flex-start" }}>
      {!isUser && <span style={{ fontSize: 16, flexShrink: 0 }}>🧭</span>}
      <div
        style={{
          background: isUser ? "var(--primary)" : "var(--surface-2)",
          color: isUser ? "var(--primary-fg)" : "var(--fg)",
          borderRadius: isUser ? "var(--r-md) 0 var(--r-md) var(--r-md)" : "0 var(--r-md) var(--r-md) var(--r-md)",
          padding: "7px 10px",
          fontSize: 13,
          maxWidth: "78%",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content}
        {msg.actions && msg.actions.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {msg.actions.map((a, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                  padding: "1px 5px",
                  borderRadius: 10,
                }}
              >
                {actionLabel(a)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function actionLabel(a: BuddyAction): string {
  switch (a.type) {
    case "research_run": return `+${a.placesAdded} places`;
    case "place_status_changed": return `→ ${a.status}`;
    case "profile_updated": return "profile updated";
    case "dates_updated": return `${a.start} → ${a.end}`;
    case "web_search": return `🔍 ${a.query.slice(0, 20)}`;
  }
}
