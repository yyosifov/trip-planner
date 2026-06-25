# Trip Buddy — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A persistent bottom-bar chat agent available on every page that acts as both a trip-steering tool and a travel-advisor buddy, powered by a LangGraph ReAct agent with full action capability over the trip.

**Architecture:** LangGraph (`@langchain/langgraph`) ReAct agent inside a new NestJS `BuddyModule`. The agent has 5 tools (web search, profile update, research run, place status, trip dates). The frontend mounts a `BuddyBar` component once in `App.tsx`, outside the router, so it persists across page navigation.

**Tech Stack:** `@langchain/langgraph`, `@langchain/google-genai`, `@langchain/core`, NestJS, Prisma, React + inline styles (existing theme tokens from `src/theme.ts`).

---

## Global Constraints

- Bottom bar is always 40px tall collapsed; expanded panel is `min(50vh, 480px)` tall, slides up with CSS transition.
- Badge appears on the bar (indigo dot + count) when `GET /trips/:id/buddy/suggestions` returns `hasSuggestion: true`. Badge clears when the user opens the chat.
- The buddy's system prompt includes: trip destination, waypoints, current `TravelerProfile`, place counts by status/category, and trip dates. Injected fresh on every call.
- `TravelerProfile.extra` (already a `Json` column, default `{}`) is the flexible store for buddy-learned facts that don't fit typed columns. The buddy reads and writes it via the `updateProfile` tool.
- Conversation history: last 20 `BuddyMessage` rows passed as LangChain `HumanMessage` / `AIMessage` context per call.
- After each buddy response, the API returns an `actions[]` array. The frontend uses this to invalidate React Query keys: `["places", id]` on `research_run` or `place_status_changed`; `["profile", id]` on `profile_updated`; `["trip", id]` on `dates_updated`.
- Suggestion heuristic (no LLM): if ≥ 3 liked places share a category AND no `ResearchRun` was created for this trip in the last 10 minutes → `hasSuggestion: true`, preview = `"You've liked N [category] spots — want me to find more?"`.
- No streaming for v1 — single HTTP round-trip per message.
- The buddy is trip-scoped. `BuddyBar` only renders when a `tripId` is available (i.e., on any `/trips/:id/*` route). On the root `/` trips list page, the bar is hidden.

---

## Prisma Schema Changes

### New model: `BuddyMessage`

```prisma
model BuddyMessage {
  id        String   @id @default(cuid())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId    String
  role      String   // "user" | "assistant"
  content   String
  actions   Json?    // BuddyAction[] — what the agent did this turn
  createdAt DateTime @default(now())
}
```

### `Trip` model change

Add relation:

```prisma
buddyMessages BuddyMessage[]
```

### `TravelerProfile` — no change needed

`extra Json @default("{}")` already exists. The buddy reads/writes it freely.

---

## Shared Types (`packages/shared/src/buddy.ts`)

```typescript
import { z } from "zod";

export const BuddyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("research_run"), placesAdded: z.number() }),
  z.object({ type: z.literal("profile_updated"), changes: z.record(z.unknown()) }),
  z.object({ type: z.literal("place_status_changed"), placeId: z.string(), status: z.string() }),
  z.object({ type: z.literal("dates_updated"), start: z.string().nullable(), end: z.string().nullable() }),
  z.object({ type: z.literal("web_search"), query: z.string() }),
]);
export type BuddyAction = z.infer<typeof BuddyActionSchema>;

export const BuddyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  actions: z.array(BuddyActionSchema).optional(),
});
export type BuddyMessage = z.infer<typeof BuddyMessageSchema>;

export const BuddySuggestionSchema = z.object({
  hasSuggestion: z.boolean(),
  preview: z.string().optional(),
});
export type BuddySuggestion = z.infer<typeof BuddySuggestionSchema>;
```

Export from `packages/shared/src/index.ts`.

---

## Backend

### File layout

```
apps/api/src/buddy/
  buddy.module.ts
  buddy.controller.ts
  buddy.service.ts
  buddy.tools.ts      ← LangChain tool definitions
  buddy.graph.ts      ← LangGraph StateGraph / createReactAgent setup
```

### `buddy.tools.ts`

Five tools built with LangChain's `tool()` helper. Each tool receives injected Prisma + service references via closure (the graph is built inside `BuddyService` which has DI access).

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 1. searchWeb
export const makeSearchWebTool = (search: SearchPort) =>
  tool(async ({ query }) => {
    const results = await search.search(query, 5);
    return results.map((r) => `${r.title}: ${r.description}`).join("\n\n");
  }, {
    name: "searchWeb",
    description: "Search the web for travel info, destination advice, weather patterns, packing tips, or anything the user asks about.",
    schema: z.object({ query: z.string() }),
  });

// 2. updateProfile
export const makeUpdateProfileTool = (prisma: PrismaService, tripId: string) =>
  tool(async ({ changes }) => {
    // merge changes into existing profile; typed fields go to columns, rest to `extra`
    // returns "Profile updated."
  }, {
    name: "updateProfile",
    description: "Update the traveler profile when the user expresses preferences, constraints, or things they like/dislike. Use `extra` for anything without a dedicated field.",
    schema: z.object({
      changes: z.object({
        maxHikeKm: z.number().optional(),
        maxHikeElevationM: z.number().optional(),
        pace: z.enum(["relaxed", "moderate", "packed"]).optional(),
        interests: z.array(z.string()).optional(),
        dislikes: z.array(z.string()).optional(),
        extra: z.record(z.unknown()).optional(),
      }),
    }),
  });

// 3. runResearch
export const makeRunResearchTool = (research: ResearchService, tripId: string) =>
  tool(async () => {
    const result = await research.run(tripId);
    return `Research complete. Added ${result.created} new places.`;
  }, {
    name: "runResearch",
    description: "Run a new web research pass to find more places matching the traveler profile. Use when the user wants more options or after updating their preferences.",
    schema: z.object({}),
  });

// 4. setPlaceStatus
export const makeSetPlaceStatusTool = (places: PlacesService) =>
  tool(async ({ placeId, status }) => {
    await places.setStatus(placeId, status as PlaceStatus);
    return `Place ${placeId} marked as ${status}.`;
  }, {
    name: "setPlaceStatus",
    description: "Mark a place as liked, maybe, rejected, or new. Use when the user says they like/dislike a specific place by name.",
    schema: z.object({
      placeId: z.string().describe("The place ID"),
      status: z.enum(["liked", "maybe", "rejected", "new"]),
    }),
  });

// 5. setTripDates
export const makeSetTripDatesTool = (prisma: PrismaService, tripId: string) =>
  tool(async ({ start, end }) => {
    await prisma.trip.update({
      where: { id: tripId },
      data: { dateWindowStart: new Date(start), dateWindowEnd: new Date(end) },
    });
    return `Trip dates set to ${start} → ${end}.`;
  }, {
    name: "setTripDates",
    description: "Set or update the trip date window. Use when the user mentions travel dates.",
    schema: z.object({
      start: z.string().describe("ISO date string YYYY-MM-DD"),
      end: z.string().describe("ISO date string YYYY-MM-DD"),
    }),
  });
```

### `buddy.graph.ts`

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export function buildBuddyAgent(tools: BaseTool[], systemPrompt: string) {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: process.env.GEMINI_API_KEY,
  });

  return createReactAgent({
    llm,
    tools,
    stateModifier: systemPrompt,
  });
}
```

### `buddy.service.ts`

```typescript
@Injectable()
export class BuddyService {
  constructor(
    private prisma: PrismaService,
    private research: ResearchService,
    private places: PlacesService,
    @Inject(SEARCH) private search: SearchPort,
  ) {}

  async postMessage(tripId: string, content: string): Promise<{ reply: string; actions: BuddyAction[] }> {
    // 1. Load context
    const [trip, profile, recentPlaces, history] = await Promise.all([
      this.prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: { waypoints: true } }),
      this.prisma.travelerProfile.findUnique({ where: { tripId } }),
      this.prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.buddyMessage.findMany({ where: { tripId }, orderBy: { createdAt: "asc" }, take: 20 }),
    ]);

    // 2. Save user message
    await this.prisma.buddyMessage.create({ data: { tripId, role: "user", content } });

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(trip, profile, recentPlaces);

    // 4. Build tools
    const tools = [
      makeSearchWebTool(this.search),
      makeUpdateProfileTool(this.prisma, tripId),
      makeRunResearchTool(this.research, tripId),
      makeSetPlaceStatusTool(this.places),
      makeSetTripDatesTool(this.prisma, tripId),
    ];

    // 5. Build agent + invoke
    const agent = buildBuddyAgent(tools, systemPrompt);
    const lcHistory = history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    );
    const result = await agent.invoke({ messages: [...lcHistory, new HumanMessage(content)] });

    // 6. Extract reply
    const lastMsg = result.messages.at(-1);
    const reply = typeof lastMsg?.content === "string" ? lastMsg.content : JSON.stringify(lastMsg?.content);

    // 7. Collect actions (inspect tool call results in message chain)
    const actions = extractActions(result.messages);

    // 8. Persist reply
    await this.prisma.buddyMessage.create({ data: { tripId, role: "assistant", content: reply, actions: actions as any } });

    return { reply, actions };
  }

  async getMessages(tripId: string) {
    return this.prisma.buddyMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, actions: true },
    });
  }

  async getSuggestion(tripId: string): Promise<BuddySuggestion> {
    const places = await this.prisma.place.findMany({ where: { tripId, status: "liked" } });
    const recent = await this.prisma.researchRun.findFirst({
      where: { tripId, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    if (recent) return { hasSuggestion: false };

    // Count by category
    const counts: Record<string, number> = {};
    for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;
    const [topCat, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topCount >= 3) {
      return { hasSuggestion: true, preview: `You've liked ${topCount} ${topCat} spots — want more?` };
    }
    return { hasSuggestion: false };
  }
}

function extractActions(messages: BaseMessage[]): BuddyAction[] {
  // Walk the LangGraph message list.
  // ToolMessage objects (role === "tool") carry a `name` field equal to the tool that was called.
  // Map each tool name to its BuddyAction type and fill in relevant fields:
  //   "searchWeb"       → { type: "web_search", query: <tool input from preceding AIMessage.tool_calls> }
  //   "runResearch"     → { type: "research_run", placesAdded: <parse from tool result content> }
  //   "updateProfile"   → { type: "profile_updated", changes: <tool input.changes> }
  //   "setPlaceStatus"  → { type: "place_status_changed", placeId, status }
  //   "setTripDates"    → { type: "dates_updated", start, end }
  // Pair each ToolMessage with the tool_calls entry in the immediately preceding AIMessage to get inputs.
  // Return deduplicated (last wins per placeId for setPlaceStatus).
  const actions: BuddyAction[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m._getType() !== "tool") continue;
    const tm = m as ToolMessage;
    const prevAI = messages.slice(0, i).reverse().find((x) => x._getType() === "ai") as AIMessage | undefined;
    const call = prevAI?.tool_calls?.find((c) => c.id === tm.tool_call_id);
    if (!call) continue;
    switch (call.name) {
      case "searchWeb": actions.push({ type: "web_search", query: call.args.query }); break;
      case "runResearch": {
        const n = parseInt(String(tm.content).match(/Added (\d+)/)?.[1] ?? "0", 10);
        actions.push({ type: "research_run", placesAdded: n }); break;
      }
      case "updateProfile": actions.push({ type: "profile_updated", changes: call.args.changes }); break;
      case "setPlaceStatus": actions.push({ type: "place_status_changed", placeId: call.args.placeId, status: call.args.status }); break;
      case "setTripDates": actions.push({ type: "dates_updated", start: call.args.start, end: call.args.end }); break;
    }
  }
  return actions;
}

function buildSystemPrompt(trip, profile, places): string {
  const statusCounts = { liked: 0, maybe: 0, rejected: 0, new: 0 };
  for (const p of places) statusCounts[p.status as keyof typeof statusCounts]++;
  const byCat: Record<string, number> = {};
  for (const p of places.filter((p) => p.status === "liked")) byCat[p.category] = (byCat[p.category] ?? 0) + 1;

  return `You are Trip Buddy — a knowledgeable, friendly travel companion for a family trip to ${trip.destination}.
${trip.waypoints.length > 0 ? `Route: ${trip.waypoints.map((w) => w.city).join(" → ")}` : ""}
Dates: ${trip.dateWindowStart ? `${trip.dateWindowStart.toISOString().slice(0,10)} → ${trip.dateWindowEnd?.toISOString().slice(0,10)}` : "not set yet"}

Traveler profile:
${profile ? `- ${profile.partyAdults} adults, ${profile.partyKids} kids (ages: ${(profile.kidsAges as number[]).join(", ") || "none"})
- Max hike: ${profile.maxHikeKm ?? "?"}km / ${profile.maxHikeElevationM ?? "?"}m elevation
- Pace: ${profile.pace ?? "not set"}
- Interests: ${profile.interests.join(", ") || "none yet"}
- Dislikes: ${profile.dislikes.join(", ") || "none yet"}
- Extra notes: ${JSON.stringify(profile.extra)}` : "No profile yet."}

Discovered places: ${places.length} total — ${statusCounts.liked} liked, ${statusCounts.maybe} maybe, ${statusCounts.rejected} rejected.
Liked by category: ${Object.entries(byCat).map(([k,v]) => `${k}(${v})`).join(", ") || "none yet"}.

You can take real actions using your tools: search the web, update the traveler profile, run new research, change place statuses, or set trip dates. Be concise. When you take an action, confirm it briefly. Ask at most one follow-up question per turn.`;
}
```

### `buddy.controller.ts`

```typescript
@Controller("trips/:id/buddy")
export class BuddyController {
  constructor(private buddy: BuddyService) {}

  @Post("message")
  postMessage(@Param("id") id: string, @Body() body: { content: string }) {
    return this.buddy.postMessage(id, body.content);
  }

  @Get("messages")
  getMessages(@Param("id") id: string) {
    return this.buddy.getMessages(id);
  }

  @Get("suggestions")
  getSuggestion(@Param("id") id: string) {
    return this.buddy.getSuggestion(id);
  }
}
```

---

## Frontend

### `src/api/useBuddy.ts`

```typescript
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { BuddyMessage, BuddyAction, BuddySuggestion } from "@trip/shared";

export function useBuddy(tripId: string) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<BuddySuggestion | null>(null);

  const loadHistory = useCallback(async () => {
    const msgs = await api.get<BuddyMessage[]>(`/trips/${tripId}/buddy/messages`);
    setMessages(msgs);
  }, [tripId]);

  const sendMessage = useCallback(async (content: string) => {
    setMessages((m) => [...m, { role: "user", content }]);
    setLoading(true);
    try {
      const { reply, actions } = await api.post<{ reply: string; actions: BuddyAction[] }>(
        `/trips/${tripId}/buddy/message`,
        { content },
      );
      setMessages((m) => [...m, { role: "assistant", content: reply, actions }]);
      invalidateFromActions(qc, tripId, actions);
    } finally {
      setLoading(false);
    }
  }, [tripId, qc]);

  const checkSuggestion = useCallback(async () => {
    const s = await api.get<BuddySuggestion>(`/trips/${tripId}/buddy/suggestions`);
    setSuggestion(s.hasSuggestion ? s : null);
  }, [tripId]);

  const dismissSuggestion = () => setSuggestion(null);

  return { messages, loading, suggestion, loadHistory, sendMessage, checkSuggestion, dismissSuggestion };
}

function invalidateFromActions(qc: QueryClient, tripId: string, actions: BuddyAction[]) {
  for (const a of actions) {
    if (a.type === "research_run" || a.type === "place_status_changed") {
      qc.invalidateQueries({ queryKey: ["places", tripId] });
    }
    if (a.type === "profile_updated") qc.invalidateQueries({ queryKey: ["profile", tripId] });
    if (a.type === "dates_updated") {
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["weather", tripId] });
    }
  }
}
```

### `src/components/BuddyBar.tsx`

```typescript
// Props: tripId string
// State: expanded bool, input string
// On mount (when expanded first time): loadHistory()
// On setPlaceStatus success (wired via useSetPlaceStatus onSuccess): checkSuggestion()
// Renders:
//   collapsed: 40px bar — 💬 icon, placeholder input, badge dot if suggestion, ▲ expand button
//   expanded: slides up to min(50vh, 480px)
//     - header: "💬 Trip Buddy" + online dot + ▼ close
//     - scrollable messages (user = right/primary, buddy = left/card + 🧭 icon)
//     - loading indicator: "Trip Buddy is thinking…" with animated dots
//     - input row: text input + send button (↑)
// Suggestion badge: indigo dot on collapsed bar, tooltip = suggestion.preview
// Opening chat clears badge (dismissSuggestion)
```

### `App.tsx` change

```typescript
// Add after <Routes>...</Routes>:
<BuddyRoute />

// BuddyRoute is a small component that reads the tripId from the URL
// and renders <BuddyBar tripId={tripId} /> only when on a /trips/:id/* route.
// Uses useMatch("/trips/:id/*") from react-router-dom.
```

### Wiring `checkSuggestion` into place status changes

In `hooks.ts`, `useSetPlaceStatus` gains an optional `onSuggestionCheck` callback that callers can pass. `DiscoverPage` passes it down. Alternatively, `BuddyBar` can subscribe to query cache changes on `["places", tripId]` and call `checkSuggestion` when that key invalidates.

Simpler approach: `BuddyBar` uses a `useEffect` watching the `["places", tripId]` query's `dataUpdatedAt` timestamp. When it changes, call `checkSuggestion()`.

---

## File Checklist

### New files
- `apps/api/src/buddy/buddy.module.ts`
- `apps/api/src/buddy/buddy.controller.ts`
- `apps/api/src/buddy/buddy.service.ts`
- `apps/api/src/buddy/buddy.tools.ts`
- `apps/api/src/buddy/buddy.graph.ts`
- `apps/api/prisma/migrations/<timestamp>_add_buddy/migration.sql`
- `packages/shared/src/buddy.ts`
- `apps/web/src/api/useBuddy.ts`
- `apps/web/src/components/BuddyBar.tsx`

### Modified files
- `apps/api/prisma/schema.prisma` — add `BuddyMessage`, add `buddyMessages` to `Trip`
- `apps/api/src/app.module.ts` — import `BuddyModule`
- `packages/shared/src/index.ts` — export from `./buddy`
- `apps/web/src/App.tsx` — mount `BuddyRoute`
- `packages/shared/package.json` — no change needed (zod already a dep)

### New npm dependencies (api)
- `@langchain/langgraph`
- `@langchain/google-genai`
- `@langchain/core`
