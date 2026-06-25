import { useState, useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { BuddyMessage, BuddyAction, BuddySuggestion } from "@trip/shared";

function invalidateFromActions(qc: QueryClient, tripId: string, actions: BuddyAction[]) {
  for (const a of actions) {
    if (a.type === "research_run" || a.type === "place_status_changed") {
      qc.invalidateQueries({ queryKey: ["places", tripId] });
    }
    if (a.type === "profile_updated") {
      qc.invalidateQueries({ queryKey: ["profile", tripId] });
    }
    if (a.type === "dates_updated") {
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["weather", tripId] });
    }
  }
}

export function useBuddy(tripId: string) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<BuddySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const msgs = await api.get<BuddyMessage[]>(`/trips/${tripId}/buddy/messages`);
    setMessages(msgs);
  }, [tripId]);

  const sendMessage = useCallback(
    async (content: string) => {
      setMessages((m) => [...m, { role: "user", content }]);
      setError(null);
      setLoading(true);
      try {
        const { reply, actions } = await api.post<{ reply: string; actions: BuddyAction[] }>(
          `/trips/${tripId}/buddy/message`,
          { content },
        );
        setMessages((m) => [...m, { role: "assistant", content: reply, actions }]);
        invalidateFromActions(qc, tripId, actions);
      } catch (e) {
        setError("Trip Buddy couldn't respond. Please try again.");
        // Roll back the optimistic user message
        setMessages((m) => m.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [tripId, qc],
  );

  const checkSuggestion = useCallback(async () => {
    try {
      const s = await api.get<BuddySuggestion>(`/trips/${tripId}/buddy/suggestions`);
      setSuggestion(s.hasSuggestion ? s : null);
    } catch {
      // ignore — suggestion check is best-effort
    }
  }, [tripId]);

  const dismissSuggestion = useCallback(() => setSuggestion(null), []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, loading, suggestion, error, loadHistory, sendMessage, checkSuggestion, dismissSuggestion, clearError };
}
