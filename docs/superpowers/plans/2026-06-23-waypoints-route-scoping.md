# Waypoints & Route-Scoped Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ordered waypoint cities to trips so research fires per-segment queries and Discover filters by segment.

**Architecture:** Prisma `Waypoint` model stores ordered city list per trip. Research parser emits `{segment, queries[]}[]` instead of flat `string[]`. ResearchService loops segments, tags each `Place.segment`. Frontend form gets waypoints builder; Discover gets segment filter row.

**Tech Stack:** Prisma (PostgreSQL), NestJS, Zod (`packages/shared`), TanStack Query, React, TypeScript, Jest (API tests).

## Global Constraints

- No new npm packages — use existing deps only.
- `buildQueries` stays exported (used in existing tests + service fallback).
- `Place.segment = null` on all existing records — zero migration needed for data.
- `waypoints = []` in `CreateTripInput` is backward-compatible — old clients still work.
- Test runner for API: `pnpm --filter api test` (Jest, configured in `apps/api/package.json`).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `apps/api/prisma/schema.prisma` | Add `Waypoint` model, `Trip.waypoints`, `Trip.maxDrivingHoursPerDay`, `Place.segment` |
| Modify | `packages/shared/src/trip.ts` | Add `WaypointInputSchema`, extend `CreateTripSchema` |
| Modify | `apps/api/src/trips/trips.service.ts` | Create waypoints on trip create; include in findAll/findOne |
| Modify | `apps/api/src/research/research.parser.ts` | Add `buildSegmentedQueries` + `SegmentQueries` type |
| Modify | `apps/api/src/research/research.parser.spec.ts` | Tests for `buildSegmentedQueries` |
| Modify | `apps/api/src/research/research.service.ts` | Loop over segments; write `Place.segment` |
| Modify | `apps/web/src/api/hooks.ts` | Add `segment` to `Place`; add `waypoints` to `Trip` |
| Modify | `apps/web/src/routes/TripsPage.tsx` | routeType selector, waypoints builder, maxDriving input |
| Modify | `apps/web/src/routes/DiscoverPage.tsx` | Segment filter row + segment badge on `PlaceCard` |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `Waypoint` table; `Trip.waypoints`, `Trip.maxDrivingHoursPerDay`, `Place.segment` columns in DB

- [ ] **Step 1: Edit schema.prisma — add Waypoint model and new fields**

In `apps/api/prisma/schema.prisma`:

Add after the `Trip` model closing brace, the new `Waypoint` model:

```prisma
model Waypoint {
  id     String @id @default(cuid())
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId String
  city   String
  order  Int
  lat    Float?
  lng    Float?
}
```

Add to the `Trip` model (after `wildlifeReport  WildlifeReport?`):

```prisma
  maxDrivingHoursPerDay Float?
  waypoints             Waypoint[]
```

Add to the `Place` model (after `status  String  @default("new")`):

```prisma
  segment  String?
```

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate
```

When Prisma prompts for a migration name, enter: `add-waypoints-and-segments`

Expected output includes:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
  migrations/20260623XXXXXX_add_waypoints_and_segments/migration.sql
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add Waypoint model and Place.segment to schema"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/trip.ts`

**Interfaces:**
- Produces: `WaypointInputSchema`, `WaypointInput`, updated `CreateTripSchema` with `waypoints` and `maxDrivingHoursPerDay`
- Consumed by: Task 3 (trips service), Task 7 (TripsPage form)

- [ ] **Step 1: Update `packages/shared/src/trip.ts`**

Replace the entire file content:

```ts
import { z } from "zod";

export const RouteTypeSchema = z.enum(["roundtrip", "oneway", "open"]);

export const WaypointInputSchema = z.object({
  city: z.string().min(1),
  order: z.number().int().min(0),
});
export type WaypointInput = z.infer<typeof WaypointInputSchema>;

export const CreateTripSchema = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  dateWindowStart: z.string().nullable(),
  dateWindowEnd: z.string().nullable(),
  daysMin: z.number().int().min(1),
  daysMax: z.number().int().min(1),
  routeType: RouteTypeSchema,
  notes: z.string().default(""),
  waypoints: z.array(WaypointInputSchema).default([]),
  maxDrivingHoursPerDay: z.number().nullable().default(null),
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter shared build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/trip.ts
git commit -m "feat: add WaypointInput and waypoints/maxDrivingHoursPerDay to CreateTripSchema"
```

---

### Task 3: Trips Service — Create/Find with Waypoints

**Files:**
- Modify: `apps/api/src/trips/trips.service.ts`

**Interfaces:**
- Consumes: `CreateTripInput` from `@trip/shared` (updated in Task 2)
- Produces: Trip records with `waypoints` included in responses

- [ ] **Step 1: Update `apps/api/src/trips/trips.service.ts`**

Replace entire file:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTripInput } from "@trip/shared";

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateTripInput) {
    const { waypoints, maxDrivingHoursPerDay, ...rest } = input;
    return this.prisma.trip.create({
      data: {
        name: rest.name,
        destination: rest.destination,
        dateWindowStart: rest.dateWindowStart ? new Date(rest.dateWindowStart) : null,
        dateWindowEnd: rest.dateWindowEnd ? new Date(rest.dateWindowEnd) : null,
        daysMin: rest.daysMin,
        daysMax: rest.daysMax,
        routeType: rest.routeType,
        notes: rest.notes,
        maxDrivingHoursPerDay: maxDrivingHoursPerDay ?? null,
        ...(waypoints.length > 0 && {
          waypoints: { create: waypoints.map((w) => ({ city: w.city, order: w.order })) },
        }),
      },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
  }

  findAll() {
    return this.prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }
}
```

- [ ] **Step 2: Verify API compiles and starts**

```bash
pnpm --filter api build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/trips/trips.service.ts
git commit -m "feat: trips service creates and returns waypoints"
```

---

### Task 4: Research Parser — buildSegmentedQueries

**Files:**
- Modify: `apps/api/src/research/research.parser.ts`
- Modify: `apps/api/src/research/research.parser.spec.ts`

**Interfaces:**
- Produces: `SegmentQueries = { segment: string; queries: string[] }`, `buildSegmentedQueries(waypoints, destination, profile): SegmentQueries[]`
- `buildQueries` stays exported (used by Task 5 as fallback and by existing test)
- Consumed by: Task 5 (research service)

- [ ] **Step 1: Write failing tests first**

Replace `apps/api/src/research/research.parser.spec.ts` with:

```ts
import { buildQueries, buildSegmentedQueries, dedupePlaces } from "./research.parser";

const PROFILE_KIDS = {
  partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
  pace: "moderate" as const, interests: ["hikes", "waterfalls"], dislikes: [], completed: true,
};
const PROFILE_ADULT = {
  partyAdults: 2, partyKids: 0, kidsAges: [], maxHikeKm: 15, maxHikeElevationM: 1000,
  pace: "fast" as const, interests: ["photography"], dislikes: [], completed: true,
};

describe("buildQueries", () => {
  it("includes destination and kid-friendly hikes when interests include hikes", () => {
    const qs = buildQueries("Norway", PROFILE_KIDS);
    expect(qs.some((q) => /Norway/.test(q))).toBe(true);
    expect(qs.some((q) => /kid|family/i.test(q))).toBe(true);
  });
});

describe("buildSegmentedQueries", () => {
  it("falls back to buildQueries output when no waypoints", () => {
    const result = buildSegmentedQueries([], "Norway", PROFILE_KIDS);
    expect(result).toHaveLength(1);
    expect(result[0].segment).toBe("Norway");
    expect(result[0].queries).toEqual(buildQueries("Norway", PROFILE_KIDS));
  });

  it("oneway [Oslo, Bergen] → hub Oslo, leg Oslo→Bergen, hub Bergen", () => {
    const result = buildSegmentedQueries(
      [{ city: "Oslo", order: 0 }, { city: "Bergen", order: 1 }],
      "Norway",
      PROFILE_KIDS,
    );
    expect(result.map((r) => r.segment)).toEqual(["Oslo", "Oslo→Bergen", "Bergen"]);
  });

  it("roundtrip [Oslo, Flåm, Bergen, Oslo] → no duplicate hub for end city", () => {
    const result = buildSegmentedQueries(
      [
        { city: "Oslo", order: 0 },
        { city: "Flåm", order: 1 },
        { city: "Bergen", order: 2 },
        { city: "Oslo", order: 3 },
      ],
      "Norway",
      PROFILE_KIDS,
    );
    expect(result.map((r) => r.segment)).toEqual([
      "Oslo", "Oslo→Flåm", "Flåm", "Flåm→Bergen", "Bergen", "Bergen→Oslo",
    ]);
  });

  it("single waypoint → hub only, no legs", () => {
    const result = buildSegmentedQueries([{ city: "Oslo", order: 0 }], "Norway", PROFILE_KIDS);
    expect(result.map((r) => r.segment)).toEqual(["Oslo"]);
  });

  it("hub queries use kid-friendly wording for profiles with kids", () => {
    const result = buildSegmentedQueries([{ city: "Oslo", order: 0 }], "Norway", PROFILE_KIDS);
    expect(result[0].queries.some((q) => /kid|family/i.test(q))).toBe(true);
  });

  it("hub queries use best wording for adult-only profiles", () => {
    const result = buildSegmentedQueries([{ city: "Oslo", order: 0 }], "Norway", PROFILE_ADULT);
    expect(result[0].queries.every((q) => !/kid|family/i.test(q))).toBe(true);
  });

  it("leg queries reference both cities", () => {
    const result = buildSegmentedQueries(
      [{ city: "Oslo", order: 0 }, { city: "Bergen", order: 1 }],
      "Norway",
      PROFILE_ADULT,
    );
    const legQ = result.find((r) => r.segment === "Oslo→Bergen")!.queries;
    expect(legQ.some((q) => /Oslo/i.test(q) && /Bergen/i.test(q))).toBe(true);
  });

  it("sorts waypoints by order regardless of input order", () => {
    const result = buildSegmentedQueries(
      [{ city: "Bergen", order: 1 }, { city: "Oslo", order: 0 }],
      "Norway",
      PROFILE_ADULT,
    );
    expect(result[0].segment).toBe("Oslo");
    expect(result[1].segment).toBe("Oslo→Bergen");
  });
});

describe("dedupePlaces", () => {
  it("removes incoming places matching an existing name (case-insensitive)", () => {
    const out = dedupePlaces(
      [{ name: "Trolltunga", lat: 60, lng: 6 }],
      [
        {
          name: "trolltunga", category: "hike", description: "", difficulty: "hard",
          kidSuitability: 2, estDurationMin: 600, weatherDependent: true, sourceUrl: null,
          sourceType: "web", tags: [],
        },
        {
          name: "Fløyen", category: "hike", description: "", difficulty: "easy",
          kidSuitability: 5, estDurationMin: 120, weatherDependent: true, sourceUrl: null,
          sourceType: "web", tags: [],
        },
      ],
    );
    expect(out.map((p) => p.name)).toEqual(["Fløyen"]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm --filter api test research.parser
```

Expected: FAIL with `buildSegmentedQueries is not a function`.

- [ ] **Step 3: Implement `buildSegmentedQueries` in `research.parser.ts`**

Replace `apps/api/src/research/research.parser.ts` with:

```ts
import { ResearchPlace, TravelerProfile } from "@trip/shared";

export type SegmentQueries = { segment: string; queries: string[] };

export function buildQueries(destination: string, profile: TravelerProfile): string[] {
  const kidWord = profile.partyKids > 0 ? "family kid-friendly" : "best";
  const base = [
    `${kidWord} things to do in ${destination}`,
    `${kidWord} day hikes in ${destination}`,
    `top museums and attractions in ${destination} with kids`,
    `best beaches in ${destination}`,
  ];
  for (const interest of profile.interests) {
    base.push(`${kidWord} ${interest} in ${destination}`);
  }
  return [...new Set(base)];
}

function buildHubQueries(city: string, destination: string, profile: TravelerProfile): string[] {
  const kidWord = profile.partyKids > 0 ? "family kid-friendly" : "best";
  const base = [
    `${kidWord} things to do in ${city} ${destination}`,
    `${kidWord} day hikes near ${city}`,
  ];
  for (const interest of profile.interests.slice(0, 2)) {
    base.push(`${kidWord} ${interest} in ${city}`);
  }
  return [...new Set(base)];
}

function buildLegQueries(from: string, to: string, destination: string): string[] {
  return [
    `things to do between ${from} and ${to} ${destination}`,
    `scenic stops ${from} to ${to} drive`,
    `day trips along ${from} to ${to} route`,
  ];
}

export function buildSegmentedQueries(
  waypoints: { city: string; order: number }[],
  destination: string,
  profile: TravelerProfile,
): SegmentQueries[] {
  if (waypoints.length === 0) {
    return [{ segment: destination, queries: buildQueries(destination, profile) }];
  }

  const sorted = [...waypoints].sort((a, b) => a.order - b.order);
  const result: SegmentQueries[] = [];
  const startCity = sorted[0].city;

  result.push({ segment: startCity, queries: buildHubQueries(startCity, destination, profile) });

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i].city;
    const to = sorted[i + 1].city;

    result.push({ segment: `${from}→${to}`, queries: buildLegQueries(from, to, destination) });

    const isLast = i === sorted.length - 2;
    if (!isLast) {
      result.push({ segment: to, queries: buildHubQueries(to, destination, profile) });
    } else if (to !== startCity) {
      result.push({ segment: to, queries: buildHubQueries(to, destination, profile) });
    }
  }

  return result;
}

export function dedupePlaces(
  existing: { name: string; lat: number | null; lng: number | null }[],
  incoming: ResearchPlace[],
): ResearchPlace[] {
  const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));
  const out: ResearchPlace[] = [];
  for (const p of incoming) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm --filter api test research.parser
```

Expected:
```
PASS src/research/research.parser.spec.ts
  buildQueries
    ✓ includes destination and kid-friendly hikes when interests include hikes
  buildSegmentedQueries
    ✓ falls back to buildQueries output when no waypoints
    ✓ oneway [Oslo, Bergen] → hub Oslo, leg Oslo→Bergen, hub Bergen
    ✓ roundtrip [Oslo, Flåm, Bergen, Oslo] → no duplicate hub for end city
    ✓ single waypoint → hub only, no legs
    ✓ hub queries use kid-friendly wording for profiles with kids
    ✓ hub queries use best wording for adult-only profiles
    ✓ leg queries reference both cities
    ✓ sorts waypoints by order regardless of input order
  dedupePlaces
    ✓ removes incoming places matching an existing name (case-insensitive)
Tests: 10 passed
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/research/research.parser.ts apps/api/src/research/research.parser.spec.ts
git commit -m "feat: add buildSegmentedQueries for per-segment research queries"
```

---

### Task 5: Research Service — Segment-Aware Loop

**Files:**
- Modify: `apps/api/src/research/research.service.ts`

**Interfaces:**
- Consumes: `buildSegmentedQueries` from `./research.parser` (Task 4); `Trip.waypoints` from Prisma include (Task 1/3)
- Produces: `Place` records with `segment` field set to segment label

- [ ] **Step 1: Update `apps/api/src/research/research.service.ts`**

Replace entire file:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntakeService } from "../intake/intake.service";
import { GEMINI, SEARCH, MAPS, GeminiPort, SearchPort, MapsPort } from "../ai/ports";
import { ResearchPlace, ResearchPlaceSchema } from "@trip/shared";
import { buildSegmentedQueries, dedupePlaces } from "./research.parser";

const PLACES_SCHEMA = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["hike", "activity", "museum", "beach", "food", "sight", "other"] },
          description: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "moderate", "hard"] },
          kidSuitability: { type: "integer" },
          estDurationMin: { type: "integer" },
          weatherDependent: { type: "boolean" },
          sourceUrl: { type: ["string", "null"] },
          sourceType: { type: "string", enum: ["web", "article", "video", "social"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "category", "difficulty", "kidSuitability", "weatherDependent"],
      },
    },
  },
  required: ["places"],
};

@Injectable()
export class ResearchService {
  constructor(
    private prisma: PrismaService,
    private intake: IntakeService,
    @Inject(SEARCH) private search: SearchPort,
    @Inject(GEMINI) private gemini: GeminiPort,
    @Inject(MAPS) private maps: MapsPort,
  ) {}

  async run(tripId: string) {
    const profile = await this.intake.getProfile(tripId);
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });
    const destination = trip?.destination ?? "";
    const waypoints = (trip?.waypoints ?? []).map((w) => ({ city: w.city, order: w.order }));

    const segmentedQueries = buildSegmentedQueries(waypoints, destination, profile);
    const allQueries = segmentedQueries.flatMap((s) => s.queries);

    const run = await this.prisma.researchRun.create({
      data: { tripId, queries: allQueries, status: "running" },
    });

    try {
      const created: object[] = [];

      for (const { segment, queries } of segmentedQueries) {
        const rawResults = await Promise.all(queries.map((q) => this.search.search(q, 6)));
        const results = rawResults.flat();

        const snippet = results
          .slice(0, 30)
          .map((r) => `- ${r.title} (${r.url}): ${r.description}`)
          .join("\n");

        const prompt =
          `From these search results about ${segment} (${destination}), extract distinct real places to visit ` +
          `for a family (${profile.partyKids} kids, ages ${profile.kidsAges.join(",")}, ` +
          `max hike ${profile.maxHikeKm ?? "?"}km). ` +
          `Set weatherDependent true for outdoor places. Return JSON.\n${snippet}`;

        const extracted = await this.gemini.extractJson<{ places: unknown[] }>(prompt, PLACES_SCHEMA);

        const incoming: ResearchPlace[] = (extracted.places ?? [])
          .map((p) => ResearchPlaceSchema.safeParse(p))
          .filter((r) => r.success)
          .map((r) => (r as { success: true; data: ResearchPlace }).data);

        const existing = await this.prisma.place.findMany({
          where: { tripId },
          select: { name: true, lat: true, lng: true },
        });

        const fresh = dedupePlaces(existing, incoming);

        for (const p of fresh) {
          const geo = await this.maps.geocode(`${p.name}, ${destination}`);
          const photoUrl = await this.maps.photoUrl(`${p.name}, ${destination}`);
          created.push(
            await this.prisma.place.create({
              data: {
                tripId,
                segment,
                name: p.name,
                category: p.category,
                description: p.description,
                lat: geo?.lat ?? null,
                lng: geo?.lng ?? null,
                photoUrl,
                sourceUrl: p.sourceUrl,
                sourceType: p.sourceType,
                estDurationMin: p.estDurationMin,
                difficulty: p.difficulty,
                kidSuitability: p.kidSuitability,
                weatherDependent: p.weatherDependent,
                tags: p.tags,
                raw: p as object,
                status: "new",
              },
            }),
          );
        }
      }

      await this.prisma.researchRun.update({
        where: { id: run.id },
        data: { status: "done", stats: { created: created.length } },
      });

      return { runId: run.id, created: created.length, places: created };
    } catch (e) {
      await this.prisma.researchRun.update({
        where: { id: run.id },
        data: { status: "error", error: String((e as Error)?.message ?? e) },
      });
      throw e;
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter api build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/research/research.service.ts
git commit -m "feat: research service loops over segments and tags Place.segment"
```

---

### Task 6: Frontend Types — hooks.ts

**Files:**
- Modify: `apps/web/src/api/hooks.ts`

**Interfaces:**
- Produces: `Place.segment: string | null`; `Trip.waypoints: { id: string; city: string; order: number }[]`; `Trip.maxDrivingHoursPerDay: number | null`
- Consumed by: Task 7 (TripsPage), Task 8 (DiscoverPage)

- [ ] **Step 1: Update interfaces in `apps/web/src/api/hooks.ts`**

Replace the `Trip` interface:

```ts
export interface Waypoint {
  id: string;
  city: string;
  order: number;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  daysMin: number;
  daysMax: number;
  routeType: string;
  notes: string;
  maxDrivingHoursPerDay: number | null;
  waypoints: Waypoint[];
}
```

Add `segment` to the `Place` interface (after `sourceUrl: string | null`):

```ts
  segment: string | null;
```

- [ ] **Step 2: Verify TypeScript in web app**

```bash
pnpm --filter web build
```

Expected: exits 0 (or only pre-existing errors, not new ones from these types).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/hooks.ts
git commit -m "feat: add segment to Place and waypoints to Trip frontend types"
```

---

### Task 7: TripsPage — Waypoints Builder Form

**Files:**
- Modify: `apps/web/src/routes/TripsPage.tsx`

**Interfaces:**
- Consumes: `CreateTripInput` from `@trip/shared` (waypoints + maxDrivingHoursPerDay now present)
- Produces: trip creation form with routeType selector, waypoints builder, maxDriving input

- [ ] **Step 1: Replace `apps/web/src/routes/TripsPage.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTrips, useCreateTrip } from "../api/hooks";
import type { RouteType } from "@trip/shared";

type RouteTypeValue = "roundtrip" | "oneway" | "open";

export function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const create = useCreateTrip();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [daysMin, setDaysMin] = useState(7);
  const [daysMax, setDaysMax] = useState(10);
  const [routeType, setRouteType] = useState<RouteTypeValue>("open");
  const [startCity, setStartCity] = useState("");
  const [endCity, setEndCity] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [maxDriving, setMaxDriving] = useState("");

  const buildWaypoints = () => {
    if (routeType === "open" || !startCity.trim()) return [];
    const midStops = stops.map((s) => s.trim()).filter(Boolean);
    const endValue = routeType === "roundtrip" ? startCity.trim() : endCity.trim();
    const cities = [startCity.trim(), ...midStops, endValue].filter(Boolean);
    return cities.map((city, order) => ({ city, order }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !destination) return;
    create.mutate({
      name, destination, daysMin, daysMax,
      dateWindowStart: null, dateWindowEnd: null,
      routeType, notes: "",
      waypoints: buildWaypoints(),
      maxDrivingHoursPerDay: maxDriving ? parseFloat(maxDriving) : null,
    });
    setName(""); setDestination(""); setStartCity(""); setEndCity(""); setStops([]); setMaxDriving("");
  };

  const addStop = () => setStops((s) => [...s, ""]);
  const updateStop = (i: number, v: string) => setStops((s) => s.map((x, j) => (j === i ? v : x)));
  const removeStop = (i: number) => setStops((s) => s.filter((_, j) => j !== i));
  const moveStop = (i: number, dir: -1 | 1) => {
    setStops((s) => {
      const next = [...s];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>Trip Planner</h1>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        <input
          aria-label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Trip name (e.g. Norway 2025)"
          required
        />
        <input
          aria-label="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Region / country (e.g. Norway)"
          required
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={daysMin} onChange={(e) => setDaysMin(+e.target.value)} min={1} placeholder="Min days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>–</span>
          <input type="number" value={daysMax} onChange={(e) => setDaysMax(+e.target.value)} min={1} placeholder="Max days" style={{ width: 80 }} />
          <span style={{ lineHeight: "30px" }}>days</span>
        </div>

        {/* Route type */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, width: 90 }}>Route type</label>
          <select
            value={routeType}
            onChange={(e) => { setRouteType(e.target.value as RouteTypeValue); setStops([]); }}
            style={{ flex: 1 }}
          >
            <option value="open">Open (no fixed route)</option>
            <option value="roundtrip">Roundtrip (return to start)</option>
            <option value="oneway">One-way (A → B)</option>
          </select>
        </div>

        {/* Waypoints builder */}
        {routeType !== "open" && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Route cities</div>

            {/* Start */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 52, fontSize: 12, color: "#374151" }}>Start</span>
              <input
                value={startCity}
                onChange={(e) => setStartCity(e.target.value)}
                placeholder="e.g. Oslo"
                style={{ flex: 1, fontSize: 13 }}
              />
            </div>

            {/* Intermediate stops */}
            {stops.map((stop, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 52, fontSize: 12, color: "#374151" }}>Stop {i + 1}</span>
                <input
                  value={stop}
                  onChange={(e) => updateStop(i, e.target.value)}
                  placeholder="City name"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0} style={{ padding: "1px 5px", fontSize: 11 }}>↑</button>
                <button type="button" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} style={{ padding: "1px 5px", fontSize: 11 }}>↓</button>
                <button type="button" onClick={() => removeStop(i)} style={{ padding: "1px 6px", fontSize: 11, color: "#ef4444", border: "1px solid #fca5a5", borderRadius: 3 }}>✕</button>
              </div>
            ))}

            {/* End */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 52, fontSize: 12, color: "#374151" }}>End</span>
              {routeType === "roundtrip" ? (
                <input
                  value={startCity || "Same as start"}
                  disabled
                  style={{ flex: 1, fontSize: 13, color: "#9ca3af", background: "#f9fafb" }}
                />
              ) : (
                <input
                  value={endCity}
                  onChange={(e) => setEndCity(e.target.value)}
                  placeholder="e.g. Bergen"
                  style={{ flex: 1, fontSize: 13 }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={addStop}
              style={{ alignSelf: "flex-start", fontSize: 12, padding: "3px 10px", marginTop: 2 }}
            >
              + Add stop
            </button>
          </div>
        )}

        {/* Max driving */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, width: 90 }}>Max driving</label>
          <input
            type="number"
            value={maxDriving}
            onChange={(e) => setMaxDriving(e.target.value)}
            min={0.5}
            max={12}
            step={0.5}
            placeholder="hours/day"
            style={{ width: 90, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: "#6b7280" }}>hours/day (optional)</span>
        </div>

        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create trip"}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {trips?.map((t) => (
          <li key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <Link to={`/trips/${t.id}`}>
              <strong>{t.name}</strong>
            </Link>
            {" — "}
            {t.destination}
            {t.waypoints?.length > 0 && (
              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 6 }}>
                ({t.waypoints.map((w) => w.city).join(" → ")})
              </span>
            )}
            {" · "}{t.daysMin}–{t.daysMax} days
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter web build
```

Expected: exits 0.

- [ ] **Step 3: Manual browser test**

Start dev server (`pnpm dev`) and verify:
- "Open" selected by default → no waypoints builder shown
- Switch to "Roundtrip" → builder appears with Start/End, End auto-mirrors Start
- "Add stop" adds intermediate row with ↑↓✕
- Switch to "One-way" → End is editable
- Submit a roundtrip with Oslo → Flåm stop → Bergen stop → Oslo; check DB/API returns waypoints
- Max driving field accepts decimals

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/TripsPage.tsx
git commit -m "feat: add waypoints builder and routeType selector to trip creation form"
```

---

### Task 8: DiscoverPage — Segment Filter + Badge

**Files:**
- Modify: `apps/web/src/routes/DiscoverPage.tsx`

**Interfaces:**
- Consumes: `Place.segment: string | null` (Task 6)
- Produces: segment filter chips above place list; `📍 segment` badge on each PlaceCard that has a non-null segment

- [ ] **Step 1: Add `segFilter` state and segment derivation**

In `DiscoverPage.tsx`, after the existing `STATUS_FILTERS` constant (around line 22), find the existing state declarations and the `visible` filter computation. Add the following:

**Add import for `useMemo`** — change the React import at the top:
```tsx
import { useState, useMemo } from "react";
```

**Add state** (after the other `useState` declarations):
```tsx
const [segFilter, setSegFilter] = useState("all");
```

**Add segment derivation** (after `places` is available, before `visible`):
```tsx
const segments = useMemo(
  () =>
    [...new Set((places ?? []).map((p) => p.segment).filter((s): s is string => s !== null))].sort(),
  [places],
);
```

- [ ] **Step 2: Add segment to the `visible` filter**

Find the existing `visible` computation that filters by `statusFilter` and `catFilter`. Add the segment condition:

```tsx
const visible = (places ?? []).filter(
  (p) =>
    (statusFilter === "all" || p.status === statusFilter) &&
    (catFilter === "all" || p.category === catFilter) &&
    (segFilter === "all" || p.segment === segFilter),
);
```

- [ ] **Step 3: Add segment filter UI row in the sidebar**

In the JSX, find the category filter row (the `<div>` that renders `CATEGORIES.map(...)` chips). Add a segment filter row **below** the status filter row and **above** the place list, visible only when there are segments:

```tsx
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
```

- [ ] **Step 4: Add segment badge to `PlaceCard`**

In the `PlaceCard` component, find the badge row (the `<div>` with `display: "flex", flexWrap: "wrap", gap: 4`). Add a segment badge after the existing `weatherDependent` badge:

```tsx
{place.segment && (
  <Badge label={`📍 ${place.segment}`} color="#374151" bg="#f1f5f9" />
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm --filter web build
```

Expected: exits 0.

- [ ] **Step 6: Manual browser test**

With dev server running, on a trip that has places with `segment` values:
- Segment filter row appears with one chip per distinct segment
- Clicking a segment chip hides places from other segments
- "🗺 all" restores all
- "📍 Oslo→Flåm" badge visible on PlaceCards from that segment
- Places with `segment = null` (legacy) show under "all" only, no badge

On a trip with no segmented places (legacy or no research yet): segment row hidden entirely.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/DiscoverPage.tsx
git commit -m "feat: add segment filter row and badge to Discover page"
```

---

## Self-Review

**Spec coverage:**
- ✅ `Waypoint` model with `id/tripId/city/order/lat?/lng?` — Task 1
- ✅ `Trip.maxDrivingHoursPerDay Float?` — Task 1
- ✅ `Place.segment String?` null-safe — Task 1
- ✅ `CreateTripInput.waypoints` + `maxDrivingHoursPerDay` — Task 2
- ✅ Waypoints created on trip.create — Task 3
- ✅ `buildSegmentedQueries` replaces `buildQueries` in service — Tasks 4+5
- ✅ Leg segments for consecutive pairs — Task 4
- ✅ Hub segments for intermediate + start + oneway-end — Task 4
- ✅ Roundtrip: no duplicate hub for end == start — Task 4 (test asserts this)
- ✅ Fallback to `buildQueries` when no waypoints — Task 4
- ✅ `Place.segment` set at creation time — Task 5
- ✅ Route type selector + waypoints builder in form — Task 7
- ✅ Start/End auto-mirror on roundtrip — Task 7
- ✅ Up/down arrows for intermediate stop reorder — Task 7
- ✅ Segment filter row in Discover — Task 8
- ✅ Segment badge on PlaceCard — Task 8
- ✅ Filter hidden when all places have `segment = null` — Task 8

**Out of scope (confirmed in spec):**
- Per-leg transport mode
- Hard enforcement of maxDrivingHoursPerDay as place filter
- Geocoding waypoints at creation time
- Drag-and-drop reorder

**Type consistency check:**
- `SegmentQueries.segment` used consistently in parser (Task 4) and service (Task 5) ✅
- `Place.segment` in Prisma schema (Task 1) matches `place.create({ data: { segment } })` in service (Task 5) ✅
- `Place.segment: string | null` in hooks.ts (Task 6) matches `place.segment &&` guard in DiscoverPage (Task 8) ✅
- `WaypointInput.city/order` from shared (Task 2) matches `{ city: w.city, order: w.order }` in service (Task 3) ✅
