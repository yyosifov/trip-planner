import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BuddyAction } from "@trip/shared";

export function buildBuddyAgent(tools: StructuredToolInterface[], systemPrompt: string) {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: process.env.GEMINI_API_KEY,
  });
  return createReactAgent({ llm, tools, stateModifier: systemPrompt });
}

type TripCtx = {
  destination: string;
  dateWindowStart: Date | null;
  dateWindowEnd: Date | null;
  waypoints: { city: string; order: number }[];
};

type ProfileCtx = {
  partyAdults: number;
  partyKids: number;
  kidsAges: unknown;
  maxHikeKm: number | null;
  maxHikeElevationM: number | null;
  pace: string | null;
  interests: string[];
  dislikes: string[];
  extra: unknown;
} | null;

type PlaceCtx = { status: string; category: string }[];

export function buildSystemPrompt(trip: TripCtx, profile: ProfileCtx, places: PlaceCtx): string {
  const statusCounts: Record<string, number> = { liked: 0, maybe: 0, rejected: 0, new: 0 };
  for (const p of places) statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;

  const byCat: Record<string, number> = {};
  for (const p of places.filter((p) => p.status === "liked")) {
    byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  }

  const dateStr = trip.dateWindowStart
    ? `${trip.dateWindowStart.toISOString().slice(0, 10)} → ${trip.dateWindowEnd?.toISOString().slice(0, 10) ?? "?"}`
    : "not set yet";

  const waypointStr =
    trip.waypoints.length > 0
      ? `Route: ${trip.waypoints
          .sort((a, b) => a.order - b.order)
          .map((w) => w.city)
          .join(" → ")}`
      : "";

  const profileStr = profile
    ? [
        `${profile.partyAdults} adults, ${profile.partyKids} kids (ages: ${(profile.kidsAges as number[]).join(", ") || "none"})`,
        `Max hike: ${profile.maxHikeKm ?? "?"}km / ${profile.maxHikeElevationM ?? "?"}m elevation`,
        `Pace: ${profile.pace ?? "not set"}`,
        `Interests: ${profile.interests.join(", ") || "none yet"}`,
        `Dislikes: ${profile.dislikes.join(", ") || "none yet"}`,
        `Extra notes: ${JSON.stringify(profile.extra)}`,
      ].join("\n- ")
    : "No profile yet.";

  const placeCountStr = `${places.length} total — ${statusCounts.liked} liked, ${statusCounts.maybe} maybe, ${statusCounts.rejected} rejected`;
  const byCatStr =
    Object.entries(byCat)
      .map(([k, v]) => `${k}(${v})`)
      .join(", ") || "none yet";

  return `You are Trip Buddy — a knowledgeable, friendly travel companion for a trip to ${trip.destination}.
${waypointStr}
Dates: ${dateStr}

Traveler profile:
- ${profileStr}

Discovered places: ${placeCountStr}.
Liked by category: ${byCatStr}.

You can take real actions using your tools: search the web, update the traveler profile, run new research, change place statuses, or set trip dates. Be concise. When you take an action, confirm it briefly. Ask at most one follow-up question per turn.`;
}

export function extractActions(messages: BaseMessage[]): BuddyAction[] {
  const actions: BuddyAction[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m._getType() !== "tool") continue;
    const tm = m as ToolMessage;
    const prevAI = messages
      .slice(0, i)
      .reverse()
      .find((x) => x._getType() === "ai") as AIMessage | undefined;
    const call = prevAI?.tool_calls?.find((c) => c.id === tm.tool_call_id);
    if (!call) continue;
    switch (call.name) {
      case "searchWeb":
        actions.push({ type: "web_search", query: call.args.query as string });
        break;
      case "runResearch": {
        const n = parseInt(String(tm.content).match(/Added (\d+)/)?.[1] ?? "0", 10);
        actions.push({ type: "research_run", placesAdded: n });
        break;
      }
      case "updateProfile":
        actions.push({ type: "profile_updated", changes: call.args.changes as Record<string, unknown> });
        break;
      case "setPlaceStatus":
        actions.push({
          type: "place_status_changed",
          placeId: call.args.placeId as string,
          status: call.args.status as string,
        });
        break;
      case "setTripDates":
        actions.push({
          type: "dates_updated",
          start: call.args.start as string,
          end: call.args.end as string,
        });
        break;
    }
  }
  return actions;
}
