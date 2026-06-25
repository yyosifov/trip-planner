# Trip Buddy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent bottom-bar LangGraph chat agent ("Trip Buddy") to every trip page that can answer travel questions and take real actions (update profile, run research, set place status, set dates).

**Architecture:** New `BuddyModule` in the NestJS API wires a LangGraph `createReactAgent` with 5 tools backed by existing services. The frontend mounts a single `BuddyBar` component in `App.tsx` outside the router so it persists across page navigation; it renders only on `/trips/:id/*` routes.

**Tech Stack:** `@langchain/langgraph`, `@langchain/google-genai`, `@langchain/core`, NestJS, Prisma, React + inline styles using existing `src/theme.ts` CSS variables, TanStack Query v5.

## Global Constraints

- Bottom bar: 40px collapsed, `min(50vh, 480px)` expanded, CSS `transition: height 0.25s ease`.
- Badge (indigo dot) appears when `GET /trips/:id/buddy/suggestions` returns `{ hasSuggestion: true }`; clears when chat opens.
- All inline styles use CSS variable tokens from `src/theme.ts` — no hardcoded hex colors.
- Buddy's system prompt injected fresh every call: destination, waypoints, TravelerProfile, place counts by status/category, trip dates.
- `TravelerProfile.extra` (already `Json @default("{}")`) stores buddy-learned facts.
- Last 20 `BuddyMessage` rows passed as conversation history each call.
- After each buddy response, `actions[]` returns to frontend; frontend invalidates React Query keys: `["places", id]` on `research_run`/`place_status_changed`, `["profile", id]` on `profile_updated`, `["trip", id]` and `["weather", id]` on `dates_updated`.
- No streaming (v1): single HTTP round-trip per message.
- `BuddyBar` hidden when not on a `/trips/:id/*` route (check with `useMatch`).
- `GEMINI_API_KEY` env var must exist in `.env` for the LangGraph agent.
- pnpm workspace; run API tests with `pnpm --filter api test`; shared tests with `pnpm --filter @trip/shared test`; web build check: `pnpm --filter web build`.

---

## File Map

**New files:**
- `packages/shared/src/buddy.ts` — Zod schemas + TS types for BuddyAction, BuddyMessage, BuddySuggestion
- `packages/shared/src/buddy.test.ts` — Vitest schema tests
- `apps/api/src/buddy/buddy.tools.ts` — 5 LangChain tool factories
- `apps/api/src/buddy/buddy.graph.ts` — buildBuddyAgent, buildSystemPrompt, extractActions
- `apps/api/src/buddy/buddy.graph.spec.ts` — tests for buildSystemPrompt + extractActions
- `apps/api/src/buddy/buddy.service.ts` — BuddyService (postMessage, getMessages, getSuggestion)
- `apps/api/src/buddy/buddy.service.spec.ts` — Jest tests
- `apps/api/src/buddy/buddy.module.ts` — NestJS module
- `apps/api/src/buddy/buddy.controller.ts` — 3 endpoints
- `apps/web/src/api/useBuddy.ts` — React hook (messages, loading, suggestion, sendMessage, checkSuggestion)
- `apps/web/src/components/BuddyBar.tsx` — collapsed/expanded chat UI

**Modified files:**
- `packages/shared/src/index.ts` — add `export * from "./buddy"`
- `apps/api/prisma/schema.prisma` — add `BuddyMessage` model + `buddyMessages BuddyMessage[]` on `Trip`
- `apps/api/src/research/research.module.ts` — add `exports: [ResearchService]`
- `apps/api/src/app.module.ts` — import `BuddyModule`
- `apps/web/src/App.tsx` — import `BuddyBar`, add `BuddyRoute` component after `<Routes>`

---

## Task 1: Shared types

**Files:**
- Create: `packages/shared/src/buddy.ts`
- Create: `packages/shared/src/buddy.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `BuddyAction`, `BuddyMessage`, `BuddySuggestion` types and Zod schemas — used by Tasks 3, 4, 5, 6, 7.

- [ ] **Step 1: Create `packages/shared/src/buddy.ts`**

```typescript
import { z } from "zod";

export const BuddyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("research_run"), placesAdded: z.number() }),
  z.object({ type: z.literal("profile_updated"), changes: z.record(z.unknown()) }),
  z.object({ type: z.literal("place_status_changed"), placeId: z.string(), status: z.string() }),
  z.object({ type: z.literal("dates_updated"), start: z.string(), end: z.string() }),
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

- [ ] **Step 2: Write tests — `packages/shared/src/buddy.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { BuddyActionSchema, BuddyMessageSchema, BuddySuggestionSchema } from "./buddy";

describe("BuddyActionSchema", () => {
  it("parses research_run", () => {
    const r = BuddyActionSchema.parse({ type: "research_run", placesAdded: 5 });
    expect(r.type).toBe("research_run");
  });
  it("parses place_status_changed", () => {
    const r = BuddyActionSchema.parse({ type: "place_status_changed", placeId: "p1", status: "liked" });
    expect(r.placeId).toBe("p1");
  });
  it("rejects unknown type", () => {
    expect(() => BuddyActionSchema.parse({ type: "unknown" })).toThrow();
  });
});

describe("BuddyMessageSchema", () => {
  it("parses user message", () => {
    const m = BuddyMessageSchema.parse({ role: "user", content: "hello" });
    expect(m.role).toBe("user");
  });
  it("parses assistant message with actions", () => {
    const m = BuddyMessageSchema.parse({
      role: "assistant",
      content: "Done",
      actions: [{ type: "web_search", query: "norway" }],
    });
    expect(m.actions?.[0].type).toBe("web_search");
  });
});

describe("BuddySuggestionSchema", () => {
  it("parses hasSuggestion true with preview", () => {
    const s = BuddySuggestionSchema.parse({ hasSuggestion: true, preview: "3 hikes liked" });
    expect(s.preview).toBe("3 hikes liked");
  });
  it("parses hasSuggestion false without preview", () => {
    const s = BuddySuggestionSchema.parse({ hasSuggestion: false });
    expect(s.hasSuggestion).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
pnpm --filter @trip/shared test
```

Expected: all 7 tests pass.

- [ ] **Step 4: Export from `packages/shared/src/index.ts`**

Add this line at the end of the file:

```typescript
export * from "./buddy";
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/buddy.ts packages/shared/src/buddy.test.ts packages/shared/src/index.ts
git commit -m "feat: add shared BuddyAction/BuddyMessage/BuddySuggestion types"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/research/research.module.ts`

**Interfaces:**
- Produces: `BuddyMessage` Prisma model usable via `prisma.buddyMessage.*` — used by Task 4.
- Produces: `ResearchService` exported from `ResearchModule` — imported by Task 4's `BuddyModule`.

- [ ] **Step 1: Add `BuddyMessage` model to schema**

In `apps/api/prisma/schema.prisma`, add `buddyMessages BuddyMessage[]` to the `Trip` model (after the existing `waypoints` line):

```prisma
model Trip {
  id              String           @id @default(cuid())
  name            String
  destination     String
  dateWindowStart DateTime?
  dateWindowEnd   DateTime?
  daysMin         Int
  daysMax         Int
  routeType       String
  notes           String           @default("")
  createdAt       DateTime         @default(now())
  profile         TravelerProfile?
  messages        IntakeMessage[]
  places          Place[]
  days            ItineraryDay[]
  researchRuns    ResearchRun[]
  wildlifeReport        WildlifeReport?
  maxDrivingHoursPerDay Float?
  waypoints             Waypoint[]
  buddyMessages         BuddyMessage[]
}
```

Then add the `BuddyMessage` model at the bottom of the file:

```prisma
model BuddyMessage {
  id        String   @id @default(cuid())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId    String
  role      String
  content   String
  actions   Json?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

From repo root:

```bash
dotenv-cli -e .env -- npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name add_buddy_message
```

Expected: migration file created at `apps/api/prisma/migrations/<timestamp>_add_buddy_message/migration.sql`, Prisma client regenerated.

- [ ] **Step 3: Export ResearchService from ResearchModule**

Edit `apps/api/src/research/research.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { ResearchService } from "./research.service";
import { ResearchController } from "./research.controller";
import { IntakeModule } from "../intake/intake.module";

@Module({
  imports: [IntakeModule],
  providers: [ResearchService],
  controllers: [ResearchController],
  exports: [ResearchService],
})
export class ResearchModule {}
```

- [ ] **Step 4: Verify API still builds**

```bash
pnpm --filter api build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/research/research.module.ts
git commit -m "feat: add BuddyMessage model + export ResearchService"
```

---

## Task 3: LangChain deps + buddy tools + graph helpers

**Files:**
- Create: `apps/api/src/buddy/buddy.tools.ts`
- Create: `apps/api/src/buddy/buddy.graph.ts`
- Create: `apps/api/src/buddy/buddy.graph.spec.ts`

**Interfaces:**
- Consumes (existing): `SEARCH` / `SearchPort` from `apps/api/src/ai/ports.ts`; `PlacesService.setStatus(placeId, status)`; `ResearchService.run(tripId) → { created: number }`; `PrismaService`
- Produces:
  - `makeSearchWebTool(search: SearchPort): StructuredTool` — name `"searchWeb"`
  - `makeUpdateProfileTool(prisma: PrismaService, tripId: string): StructuredTool` — name `"updateProfile"`
  - `makeRunResearchTool(research: ResearchService, tripId: string): StructuredTool` — name `"runResearch"`
  - `makeSetPlaceStatusTool(places: PlacesService): StructuredTool` — name `"setPlaceStatus"`
  - `makeSetTripDatesTool(prisma: PrismaService, tripId: string): StructuredTool` — name `"setTripDates"`
  - `buildBuddyAgent(tools: StructuredTool[], systemPrompt: string): CompiledStateGraph`
  - `buildSystemPrompt(trip, profile, places): string`
  - `extractActions(messages: BaseMessage[]): BuddyAction[]`

- [ ] **Step 1: Install LangChain packages**

```bash
pnpm --filter api add @langchain/langgraph @langchain/google-genai @langchain/core
```

Expected: packages appear in `apps/api/package.json` dependencies.

- [ ] **Step 2: Create `apps/api/src/buddy/buddy.tools.ts`**

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PlacesService } from "../places/places.service";
import { ResearchService } from "../research/research.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchPort } from "../ai/ports";
import { PlaceStatus } from "@trip/shared";

export const makeSearchWebTool = (search: SearchPort) =>
  tool(
    async ({ query }: { query: string }) => {
      const results = await search.search(query, 5);
      return results.map((r) => `${r.title}: ${r.description}`).join("\n\n");
    },
    {
      name: "searchWeb",
      description:
        "Search the web for travel info, destination advice, weather patterns, packing tips, or anything the user asks about.",
      schema: z.object({ query: z.string().describe("search query") }),
    },
  );

export const makeUpdateProfileTool = (prisma: PrismaService, tripId: string) =>
  tool(
    async ({ changes }: { changes: {
      maxHikeKm?: number;
      maxHikeElevationM?: number;
      pace?: string;
      interests?: string[];
      dislikes?: string[];
      extra?: Record<string, unknown>;
    } }) => {
      const profile = await prisma.travelerProfile.findUnique({ where: { tripId } });
      const currentExtra = (profile?.extra ?? {}) as Record<string, unknown>;
      const { extra, ...typedChanges } = changes;
      await prisma.travelerProfile.updateMany({
        where: { tripId },
        data: {
          ...typedChanges,
          extra: { ...currentExtra, ...(extra ?? {}) },
        },
      });
      return "Profile updated.";
    },
    {
      name: "updateProfile",
      description:
        "Update traveler profile when user expresses preferences or constraints. Use `extra` for anything without a dedicated field.",
      schema: z.object({
        changes: z.object({
          maxHikeKm: z.number().optional(),
          maxHikeElevationM: z.number().optional(),
          pace: z.string().optional(),
          interests: z.array(z.string()).optional(),
          dislikes: z.array(z.string()).optional(),
          extra: z.record(z.unknown()).optional(),
        }),
      }),
    },
  );

export const makeRunResearchTool = (research: ResearchService, tripId: string) =>
  tool(
    async () => {
      const result = await research.run(tripId);
      return `Research complete. Added ${result.created} new places.`;
    },
    {
      name: "runResearch",
      description:
        "Run a new web research pass to find more places matching the traveler profile. Use when the user wants more options or after updating preferences.",
      schema: z.object({}),
    },
  );

export const makeSetPlaceStatusTool = (places: PlacesService) =>
  tool(
    async ({ placeId, status }: { placeId: string; status: string }) => {
      await places.setStatus(placeId, status as PlaceStatus);
      return `Place ${placeId} marked as ${status}.`;
    },
    {
      name: "setPlaceStatus",
      description: "Mark a place as liked, maybe, rejected, or new when the user expresses a preference.",
      schema: z.object({
        placeId: z.string().describe("The place ID"),
        status: z.enum(["liked", "maybe", "rejected", "new"]),
      }),
    },
  );

export const makeSetTripDatesTool = (prisma: PrismaService, tripId: string) =>
  tool(
    async ({ start, end }: { start: string; end: string }) => {
      await prisma.trip.update({
        where: { id: tripId },
        data: { dateWindowStart: new Date(start), dateWindowEnd: new Date(end) },
      });
      return `Trip dates set to ${start} → ${end}.`;
    },
    {
      name: "setTripDates",
      description: "Set or update the trip date window when the user mentions travel dates.",
      schema: z.object({
        start: z.string().describe("ISO date string YYYY-MM-DD"),
        end: z.string().describe("ISO date string YYYY-MM-DD"),
      }),
    },
  );
```

- [ ] **Step 3: Create `apps/api/src/buddy/buddy.graph.ts`**

```typescript
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
```

- [ ] **Step 4: Write tests — `apps/api/src/buddy/buddy.graph.spec.ts`**

```typescript
import { buildSystemPrompt, extractActions } from "./buddy.graph";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

const tripCtx = {
  destination: "Norway",
  dateWindowStart: new Date("2026-08-01"),
  dateWindowEnd: new Date("2026-08-14"),
  waypoints: [{ city: "Bergen", order: 0 }, { city: "Oslo", order: 1 }],
};

const profileCtx = {
  partyAdults: 2,
  partyKids: 2,
  kidsAges: [8, 11],
  maxHikeKm: 10,
  maxHikeElevationM: 500,
  pace: "moderate",
  interests: ["hiking", "nature"],
  dislikes: ["crowds"],
  extra: { prefersMorning: true },
};

describe("buildSystemPrompt", () => {
  it("includes destination", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("Norway");
  });

  it("includes waypoints in order", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("Bergen → Oslo");
  });

  it("includes date range", () => {
    const s = buildSystemPrompt(tripCtx, profileCtx, []);
    expect(s).toContain("2026-08-01 → 2026-08-14");
  });

  it("counts liked places by category", () => {
    const places = [
      { status: "liked", category: "hike" },
      { status: "liked", category: "hike" },
      { status: "liked", category: "hike" },
      { status: "maybe", category: "food" },
    ];
    const s = buildSystemPrompt(tripCtx, profileCtx, places);
    expect(s).toContain("hike(3)");
    expect(s).toContain("3 liked");
  });

  it("handles null profile", () => {
    const s = buildSystemPrompt(tripCtx, null, []);
    expect(s).toContain("No profile yet");
  });
});

describe("extractActions", () => {
  function makeToolPair(toolName: string, args: Record<string, unknown>, content: string) {
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [{ id: "call1", name: toolName, args }],
    });
    const toolMsg = new ToolMessage({ tool_call_id: "call1", content });
    return [aiMsg, toolMsg];
  }

  it("extracts web_search action", () => {
    const msgs = makeToolPair("searchWeb", { query: "norway august weather" }, "Results...");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "web_search", query: "norway august weather" }]);
  });

  it("extracts research_run and parses placesAdded", () => {
    const msgs = makeToolPair("runResearch", {}, "Research complete. Added 7 new places.");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "research_run", placesAdded: 7 }]);
  });

  it("extracts place_status_changed", () => {
    const msgs = makeToolPair("setPlaceStatus", { placeId: "p1", status: "liked" }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "place_status_changed", placeId: "p1", status: "liked" }]);
  });

  it("extracts dates_updated", () => {
    const msgs = makeToolPair("setTripDates", { start: "2026-08-01", end: "2026-08-14" }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "dates_updated", start: "2026-08-01", end: "2026-08-14" }]);
  });

  it("extracts profile_updated", () => {
    const msgs = makeToolPair("updateProfile", { changes: { pace: "relaxed" } }, "ok");
    const actions = extractActions(msgs);
    expect(actions).toEqual([{ type: "profile_updated", changes: { pace: "relaxed" } }]);
  });

  it("ignores messages that are not tool messages", () => {
    const actions = extractActions([new HumanMessage("hello")]);
    expect(actions).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter api test --testPathPattern=buddy.graph
```

Expected: all 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/buddy/ apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add LangChain deps, buddy tools, and graph helpers"
```

---

## Task 4: BuddyService + BuddyModule + BuddyController + app.module registration

**Files:**
- Create: `apps/api/src/buddy/buddy.service.ts`
- Create: `apps/api/src/buddy/buddy.service.spec.ts`
- Create: `apps/api/src/buddy/buddy.module.ts`
- Create: `apps/api/src/buddy/buddy.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `buildBuddyAgent`, `buildSystemPrompt`, `extractActions` from `./buddy.graph`; all 5 tool makers from `./buddy.tools`; `BuddyAction`, `BuddySuggestion` from `@trip/shared`
- Produces:
  - `POST /trips/:id/buddy/message` → `{ reply: string, actions: BuddyAction[] }`
  - `GET /trips/:id/buddy/messages` → `{ role, content, actions }[]`
  - `GET /trips/:id/buddy/suggestions` → `BuddySuggestion`

- [ ] **Step 1: Write the failing tests — `apps/api/src/buddy/buddy.service.spec.ts`**

```typescript
import { BuddyService } from "./buddy.service";

// Mock the LangGraph module so we never actually call the LLM in tests
jest.mock("./buddy.graph", () => ({
  buildBuddyAgent: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({
      messages: [
        {
          _getType: () => "ai",
          content: "Great question! Bergen is stunning in August.",
          tool_calls: [],
        },
      ],
    }),
  }),
  buildSystemPrompt: jest.fn().mockReturnValue("system prompt"),
  extractActions: jest.fn().mockReturnValue([]),
}));

const now = new Date();
const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);

const prismaMock = {
  trip: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({
      id: "t1",
      destination: "Norway",
      dateWindowStart: null,
      dateWindowEnd: null,
      waypoints: [],
    }),
  },
  travelerProfile: {
    findUnique: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  place: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  buddyMessage: {
    create: jest.fn().mockImplementation((args) =>
      Promise.resolve({ id: "m1", ...args.data }),
    ),
    findMany: jest.fn().mockResolvedValue([
      { role: "user", content: "hello", actions: null },
      { role: "assistant", content: "hi", actions: null },
    ]),
  },
  researchRun: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
};

const researchMock = { run: jest.fn().mockResolvedValue({ created: 3, places: [] }) };
const placesMock = { setStatus: jest.fn().mockResolvedValue({ id: "p1" }) };
const searchMock = { search: jest.fn().mockResolvedValue([]) };

describe("BuddyService", () => {
  let svc: BuddyService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new BuddyService(
      prismaMock as never,
      researchMock as never,
      placesMock as never,
      searchMock as never,
    );
  });

  describe("getMessages", () => {
    it("returns messages ordered asc", async () => {
      const msgs = await svc.getMessages("t1");
      expect(prismaMock.buddyMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: "t1" },
          orderBy: { createdAt: "asc" },
        }),
      );
      expect(msgs).toHaveLength(2);
    });
  });

  describe("getSuggestion", () => {
    it("returns false when recent ResearchRun exists", async () => {
      prismaMock.researchRun.findFirst.mockResolvedValueOnce({ id: "r1", createdAt: now });
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(false);
    });

    it("returns false when fewer than 3 liked places share a category", async () => {
      prismaMock.place.findMany.mockResolvedValueOnce([
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
        { status: "liked", category: "food" },
      ]);
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(false);
    });

    it("returns suggestion when ≥3 liked places same category and no recent run", async () => {
      prismaMock.researchRun.findFirst.mockResolvedValueOnce(null);
      prismaMock.place.findMany.mockResolvedValueOnce([
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
        { status: "liked", category: "hike" },
      ]);
      const s = await svc.getSuggestion("t1");
      expect(s.hasSuggestion).toBe(true);
      expect(s.preview).toContain("3 hike");
    });
  });

  describe("postMessage", () => {
    it("persists user message then assistant message", async () => {
      await svc.postMessage("t1", "Is August good for Norway?");
      expect(prismaMock.buddyMessage.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: expect.objectContaining({ role: "user" }) }),
      );
      expect(prismaMock.buddyMessage.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: expect.objectContaining({ role: "assistant" }) }),
      );
    });

    it("returns reply string", async () => {
      const { reply } = await svc.postMessage("t1", "hello");
      expect(typeof reply).toBe("string");
      expect(reply.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter api test --testPathPattern=buddy.service
```

Expected: FAIL — `Cannot find module './buddy.service'`

- [ ] **Step 3: Create `apps/api/src/buddy/buddy.service.ts`**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ResearchService } from "../research/research.service";
import { PlacesService } from "../places/places.service";
import { SEARCH, SearchPort } from "../ai/ports";
import { buildBuddyAgent, buildSystemPrompt, extractActions } from "./buddy.graph";
import {
  makeSearchWebTool,
  makeUpdateProfileTool,
  makeRunResearchTool,
  makeSetPlaceStatusTool,
  makeSetTripDatesTool,
} from "./buddy.tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BuddyAction, BuddySuggestion } from "@trip/shared";

@Injectable()
export class BuddyService {
  constructor(
    private prisma: PrismaService,
    private research: ResearchService,
    private places: PlacesService,
    @Inject(SEARCH) private search: SearchPort,
  ) {}

  async postMessage(tripId: string, content: string): Promise<{ reply: string; actions: BuddyAction[] }> {
    const [trip, profile, recentPlaces, history] = await Promise.all([
      this.prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: { waypoints: { orderBy: { order: "asc" } } },
      }),
      this.prisma.travelerProfile.findUnique({ where: { tripId } }),
      this.prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.buddyMessage.findMany({
        where: { tripId },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
    ]);

    await this.prisma.buddyMessage.create({ data: { tripId, role: "user", content } });

    const systemPrompt = buildSystemPrompt(trip, profile, recentPlaces);
    const tools = [
      makeSearchWebTool(this.search),
      makeUpdateProfileTool(this.prisma, tripId),
      makeRunResearchTool(this.research, tripId),
      makeSetPlaceStatusTool(this.places),
      makeSetTripDatesTool(this.prisma, tripId),
    ];

    const agent = buildBuddyAgent(tools, systemPrompt);
    const lcHistory = history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content),
    );
    const result = await agent.invoke({ messages: [...lcHistory, new HumanMessage(content)] });

    const lastMsg = result.messages.at(-1);
    const reply =
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg?.content ?? "");

    const actions = extractActions(result.messages);

    await this.prisma.buddyMessage.create({
      data: { tripId, role: "assistant", content: reply, actions: actions as object[] },
    });

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
    const [places, recentRun] = await Promise.all([
      this.prisma.place.findMany({
        where: { tripId, status: "liked" },
        select: { category: true, status: true },
      }),
      this.prisma.researchRun.findFirst({
        where: { tripId, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      }),
    ]);

    if (recentRun) return { hasSuggestion: false };

    const counts: Record<string, number> = {};
    for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;
    const topEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topEntry || topEntry[1] < 3) return { hasSuggestion: false };

    return {
      hasSuggestion: true,
      preview: `You've liked ${topEntry[1]} ${topEntry[0]} spots — want more?`,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter api test --testPathPattern=buddy.service
```

Expected: all 6 tests pass.

- [ ] **Step 5: Create `apps/api/src/buddy/buddy.controller.ts`**

```typescript
import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { BuddyService } from "./buddy.service";

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

- [ ] **Step 6: Create `apps/api/src/buddy/buddy.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { BuddyService } from "./buddy.service";
import { BuddyController } from "./buddy.controller";
import { PlacesModule } from "../places/places.module";
import { ResearchModule } from "../research/research.module";

@Module({
  imports: [PlacesModule, ResearchModule],
  providers: [BuddyService],
  controllers: [BuddyController],
})
export class BuddyModule {}
```

- [ ] **Step 7: Add BuddyModule to `apps/api/src/app.module.ts`**

Add the import at the top:
```typescript
import { BuddyModule } from './buddy/buddy.module';
```

Add `BuddyModule` to the `imports` array (after `WeatherModule`):
```typescript
imports: [
  PrismaModule,
  AiModule,
  TripsModule,
  IntakeModule,
  ResearchModule,
  PlacesModule,
  ItineraryModule,
  WildlifeModule,
  WeatherModule,
  BuddyModule,
],
```

- [ ] **Step 8: Verify API builds**

```bash
pnpm --filter api build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/buddy/ apps/api/src/app.module.ts
git commit -m "feat: add BuddyService, BuddyController, BuddyModule"
```

---

## Task 5: Frontend `useBuddy` hook

**Files:**
- Create: `apps/web/src/api/useBuddy.ts`

**Interfaces:**
- Consumes: `api` from `./client` (existing); `useQueryClient` from `@tanstack/react-query`; `BuddyMessage`, `BuddyAction`, `BuddySuggestion` from `@trip/shared`
- Produces: `useBuddy(tripId: string)` → `{ messages, loading, suggestion, loadHistory, sendMessage, checkSuggestion, dismissSuggestion }`

- [ ] **Step 1: Create `apps/web/src/api/useBuddy.ts`**

```typescript
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

  const loadHistory = useCallback(async () => {
    const msgs = await api.get<BuddyMessage[]>(`/trips/${tripId}/buddy/messages`);
    setMessages(msgs);
  }, [tripId]);

  const sendMessage = useCallback(
    async (content: string) => {
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

  return { messages, loading, suggestion, loadHistory, sendMessage, checkSuggestion, dismissSuggestion };
}
```

- [ ] **Step 2: Verify web app builds**

```bash
pnpm --filter web build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/useBuddy.ts
git commit -m "feat: add useBuddy hook"
```

---

## Task 6: BuddyBar component

**Files:**
- Create: `apps/web/src/components/BuddyBar.tsx`

**Interfaces:**
- Consumes: `useBuddy(tripId)` from `../api/useBuddy`; `useQueryClient` from `@tanstack/react-query`; theme tokens via `var(--token)` CSS variables
- Produces: `<BuddyBar tripId={string} />` — default export, no additional props

- [ ] **Step 1: Create `apps/web/src/components/BuddyBar.tsx`**

```typescript
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
  const { messages, loading, suggestion, loadHistory, sendMessage, checkSuggestion, dismissSuggestion } =
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
  }, [expanded]);

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

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    height: 40,
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
            <span style={{ fontSize: 11, background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "1px 6px", borderRadius: 10 }}>
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
                  background: "rgba(99,102,241,0.15)",
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
```

- [ ] **Step 2: Verify the app builds**

```bash
pnpm --filter web build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/BuddyBar.tsx
git commit -m "feat: add BuddyBar component"
```

---

## Task 7: App.tsx integration

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `BuddyBar` from `./components/BuddyBar`; `useMatch` from `react-router-dom`

- [ ] **Step 1: Update `apps/web/src/App.tsx`**

Add the `BuddyBar` import at the top with other imports:
```typescript
import BuddyBar from "./components/BuddyBar";
```

Add `useMatch` to the react-router-dom import:
```typescript
import { Routes, Route, useMatch } from "react-router-dom";
```

Add a `BuddyRoute` component before the `export default function App()` (or inside it, after the `Routes` block):

```typescript
function BuddyRoute() {
  // Match both the base route (/trips/:id) and sub-routes (/trips/:id/*)
  const matchSub = useMatch("/trips/:id/*");
  const matchBase = useMatch("/trips/:id");
  const match = matchSub ?? matchBase;
  if (!match?.params.id) return null;
  return <BuddyBar tripId={match.params.id} />;
}
```

Inside `App`, render `<BuddyRoute />` after `</Routes>` and before the closing `</>`:

```typescript
export default function App() {
  const [dark, setDark] = useDarkMode();

  return (
    <>
      <Toaster position="top-right" richColors theme={dark ? "dark" : "light"} />
      <button
        onClick={() => setDark((d) => !d)}
        title="Toggle dark / light mode"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {dark ? "☀️" : "🌙"}
      </button>
      <Routes>
        <Route path="/" element={<TripsPage />} />
        <Route path="/trips/:id" element={<IntakePage />} />
        <Route path="/trips/:id/discover" element={<DiscoverPage />} />
        <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
        <Route path="/trips/:id/weather" element={<WeatherPage />} />
      </Routes>
      <BuddyRoute />
    </>
  );
}
```

Note: The dark-mode toggle button is at `bottom: 20, right: 20, zIndex: 9999` and the BuddyBar is at `bottom: 0, zIndex: 1000`. The toggle button's `bottom: 20` puts it above the 40px collapsed bar automatically.

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run the full app and manually test**

```bash
pnpm dev
```

Open http://localhost:5173, navigate to an existing trip (e.g. `/trips/<id>/discover`). Verify:
- BuddyBar appears as a 40px bar at bottom of screen
- Clicking the bar expands it to ~50% height
- Can type a message and press Enter or click ↑ to send
- "Close" button collapses it back
- On root `/` page, BuddyBar is not visible

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: mount BuddyBar in App.tsx via BuddyRoute"
```
