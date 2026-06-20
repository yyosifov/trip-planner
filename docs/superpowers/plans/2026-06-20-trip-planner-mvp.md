# Trip Planner MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user web app that takes a destination, interviews the traveler (family profile), AI-researches candidate places, lets the user like/reject them on a Google Map, and assembles a day-by-day itinerary with weather backups.

**Architecture:** pnpm monorepo. NestJS + Prisma backend (`apps/api`) exposes a REST API and orchestrates two AI agents (intake interview, research) behind injectable provider interfaces (Gemini, Brave Search, Google Maps). React + Vite frontend (`apps/web`) renders trips, an intake chat, a Google Map discover view, and an itinerary board. Shared zod schemas/types live in `packages/shared`.

**Tech Stack:** TypeScript, NestJS 10, Prisma 5 + PostgreSQL, `@google/genai` (Gemini), Brave Search API (REST), Google Maps (Geocoding + Places + `@vis.gl/react-google-maps`), React 18 + Vite + TanStack Query, zod. Tests: Jest + Supertest (api), Vitest + React Testing Library + MSW (web), Vitest (shared).

## Global Constraints

- No auth, single local user — never add login/session/user tables.
- All persistent state in PostgreSQL on `localhost:5432`; runtime DB `trip_planner`, test DB `trip_planner_test`.
- Package manager: **pnpm** workspaces. Node >= 20.
- AI providers MUST sit behind injectable interfaces (`GeminiPort`, `SearchPort`, `MapsPort`) so tests stub them; no test makes a real network call.
- LLM = Gemini via `@google/genai`. Search = Brave Search API. Map = Google Maps. Do not substitute other providers.
- Env keys: `DATABASE_URL`, `GEMINI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`.
- Every task ends with a green test run and a commit. TDD: failing test first.
- Out of scope (do NOT build): flights/transport APIs, live weather feed, on-trip dynamic re-planning, paste-a-link ingestion.

---

## File Structure

```
trip-planner/
  pnpm-workspace.yaml
  package.json                      # root scripts
  .env                              # secrets (gitignored)
  .env.example
  packages/
    shared/
      package.json
      src/index.ts                  # re-exports
      src/profile.ts                # TravelerProfile zod + type
      src/place.ts                  # Place enums + DTO zod
      src/itinerary.ts              # itinerary DTO zod
      src/trip.ts                   # trip DTO zod
      vitest.config.ts
      src/*.test.ts
  apps/
    api/
      package.json
      prisma/schema.prisma
      src/main.ts
      src/app.module.ts
      src/prisma/prisma.service.ts
      src/ai/                       # provider ports + impls
        ports.ts                    # GeminiPort, SearchPort, MapsPort interfaces + tokens
        gemini.provider.ts
        brave.provider.ts
        maps.provider.ts
        ai.module.ts
      src/trips/                    # trips.module/controller/service + specs
      src/intake/                   # intake.module/controller/service + specs
      src/research/                 # research.module/controller/service + parser + specs
      src/places/                   # places.module/controller/service + specs
      src/itinerary/                # itinerary.module/controller/service + backup logic + specs
      test/                         # e2e specs + test db helpers
        utils/test-db.ts
        utils/stub-ai.module.ts
    web/
      package.json
      vite.config.ts
      vitest.config.ts
      src/main.tsx
      src/api/client.ts             # typed fetch wrapper
      src/api/hooks.ts              # TanStack Query hooks
      src/test/setup.ts             # MSW server
      src/test/handlers.ts
      src/routes/TripsPage.tsx
      src/routes/IntakePage.tsx
      src/routes/DiscoverPage.tsx
      src/routes/ItineraryPage.tsx
      src/components/*              # PlaceCard, MapView, DayColumn, ChatBox, ProfilePanel
```

---

### Task 1: Monorepo scaffold + tooling + smoke tests

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `.gitignore`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`
- Create: `apps/api` via Nest CLI, then trim
- Create: `apps/web` via Vite, then add Vitest

- [ ] **Step 1: Init git + workspace files**

`.gitignore`:
```
node_modules
dist
.env
*.log
coverage
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

Root `package.json`:
```json
{
  "name": "trip-planner",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev:api": "pnpm --filter api start:dev",
    "dev:web": "pnpm --filter web dev"
  }
}
```

`.env.example`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trip_planner
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trip_planner_test
GEMINI_API_KEY=
BRAVE_API_KEY=
GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

Run:
```bash
cd /Users/yosifov/dev/trip-planner
git init
corepack enable
```

- [ ] **Step 2: Create shared package with a failing smoke test**

`packages/shared/package.json`:
```json
{
  "name": "@trip/shared",
  "version": "0.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "build": "tsc -p tsconfig.json" },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "vitest": "^2.0.0", "typescript": "^5.5.0" }
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

`packages/shared/src/index.ts`:
```ts
export const SHARED_OK = true;
```

`packages/shared/src/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SHARED_OK } from "./index";

describe("shared", () => {
  it("loads", () => {
    expect(SHARED_OK).toBe(true);
  });
});
```

- [ ] **Step 3: Install and run shared test**

Run:
```bash
pnpm install
pnpm --filter @trip/shared test
```
Expected: 1 passing test.

- [ ] **Step 4: Scaffold NestJS api**

Run:
```bash
pnpm --filter api exec true 2>/dev/null || npx -y @nestjs/cli@10 new apps/api --package-manager pnpm --skip-git --skip-install
```
Then set `apps/api/package.json` name to `"api"`, add deps:
```bash
pnpm --filter api add @prisma/client @google/genai zod
pnpm --filter api add -D prisma supertest @types/supertest
```
Confirm default Nest Jest smoke test passes:
```bash
pnpm --filter api test
```
Expected: AppController test passes.

- [ ] **Step 5: Scaffold Vite web + Vitest**

Run:
```bash
npm create vite@latest apps/web -- --template react-ts
pnpm --filter web add @tanstack/react-query @vis.gl/react-google-maps @trip/shared
pnpm --filter web add -D vitest @testing-library/react @testing-library/jest-dom jsdom msw
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

`apps/web/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

Add `"test": "vitest run"` to `apps/web/package.json` scripts.

`apps/web/src/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("web", () => { it("loads", () => { expect(1 + 1).toBe(2); }); });
```

Run:
```bash
pnpm --filter web test
```
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with api, web, shared and smoke tests"
```

---

### Task 2: Shared domain schemas (zod)

**Files:**
- Create: `packages/shared/src/profile.ts`, `place.ts`, `trip.ts`, `itinerary.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/profile.test.ts`, `place.test.ts`

**Interfaces:**
- Produces:
  - `TravelerProfileSchema` / `TravelerProfile` — `{ partyAdults:number; partyKids:number; kidsAges:number[]; maxHikeKm:number|null; maxHikeElevationM:number|null; pace:'relaxed'|'moderate'|'packed'|null; interests:string[]; dislikes:string[]; completed:boolean }`
  - `PlaceCategory` = `'hike'|'activity'|'museum'|'beach'|'food'|'sight'|'other'`
  - `PlaceStatus` = `'new'|'liked'|'maybe'|'rejected'`
  - `PlaceDifficulty` = `'easy'|'moderate'|'hard'`
  - `ResearchPlaceSchema` / `ResearchPlace` — the agent's per-place output (no id/coords yet): `{ name:string; category:PlaceCategory; description:string; difficulty:PlaceDifficulty; kidSuitability:number; estDurationMin:number; weatherDependent:boolean; sourceUrl:string|null; sourceType:'web'|'article'|'video'|'social'; tags:string[] }`
  - `TripSchema` / `CreateTripInput`
  - `TimeSlot` = `'morning'|'afternoon'|'evening'`

- [ ] **Step 1: Write failing profile + place tests**

`packages/shared/src/profile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TravelerProfileSchema } from "./profile";

describe("TravelerProfileSchema", () => {
  it("accepts a complete profile", () => {
    const p = TravelerProfileSchema.parse({
      partyAdults: 2, partyKids: 2, kidsAges: [5, 8],
      maxHikeKm: 6, maxHikeElevationM: 300, pace: "moderate",
      interests: ["hikes", "beaches"], dislikes: ["long drives"], completed: true,
    });
    expect(p.kidsAges).toEqual([5, 8]);
  });

  it("rejects negative party size", () => {
    expect(() => TravelerProfileSchema.parse({
      partyAdults: -1, partyKids: 0, kidsAges: [], maxHikeKm: null,
      maxHikeElevationM: null, pace: null, interests: [], dislikes: [], completed: false,
    })).toThrow();
  });
});
```

`packages/shared/src/place.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ResearchPlaceSchema } from "./place";

describe("ResearchPlaceSchema", () => {
  it("parses a research place and clamps kidSuitability range", () => {
    const r = ResearchPlaceSchema.parse({
      name: "Trolltunga", category: "hike", description: "Iconic cliff hike",
      difficulty: "hard", kidSuitability: 2, estDurationMin: 600,
      weatherDependent: true, sourceUrl: "https://x", sourceType: "web", tags: ["cliff"],
    });
    expect(r.category).toBe("hike");
  });

  it("rejects kidSuitability above 5", () => {
    expect(() => ResearchPlaceSchema.parse({
      name: "x", category: "hike", description: "d", difficulty: "easy",
      kidSuitability: 9, estDurationMin: 60, weatherDependent: false,
      sourceUrl: null, sourceType: "web", tags: [],
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm --filter @trip/shared test`
Expected: FAIL — `Cannot find module './profile'`.

- [ ] **Step 3: Implement schemas**

`packages/shared/src/profile.ts`:
```ts
import { z } from "zod";

export const PaceSchema = z.enum(["relaxed", "moderate", "packed"]);

export const TravelerProfileSchema = z.object({
  partyAdults: z.number().int().min(0),
  partyKids: z.number().int().min(0),
  kidsAges: z.array(z.number().int().min(0).max(18)),
  maxHikeKm: z.number().min(0).nullable(),
  maxHikeElevationM: z.number().min(0).nullable(),
  pace: PaceSchema.nullable(),
  interests: z.array(z.string()),
  dislikes: z.array(z.string()),
  completed: z.boolean(),
});
export type TravelerProfile = z.infer<typeof TravelerProfileSchema>;
```

`packages/shared/src/place.ts`:
```ts
import { z } from "zod";

export const PlaceCategorySchema = z.enum([
  "hike", "activity", "museum", "beach", "food", "sight", "other",
]);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

export const PlaceStatusSchema = z.enum(["new", "liked", "maybe", "rejected"]);
export type PlaceStatus = z.infer<typeof PlaceStatusSchema>;

export const PlaceDifficultySchema = z.enum(["easy", "moderate", "hard"]);
export type PlaceDifficulty = z.infer<typeof PlaceDifficultySchema>;

export const SourceTypeSchema = z.enum(["web", "article", "video", "social"]);

export const ResearchPlaceSchema = z.object({
  name: z.string().min(1),
  category: PlaceCategorySchema,
  description: z.string(),
  difficulty: PlaceDifficultySchema,
  kidSuitability: z.number().int().min(1).max(5),
  estDurationMin: z.number().int().min(0),
  weatherDependent: z.boolean(),
  sourceUrl: z.string().url().nullable(),
  sourceType: SourceTypeSchema,
  tags: z.array(z.string()),
});
export type ResearchPlace = z.infer<typeof ResearchPlaceSchema>;
```

`packages/shared/src/trip.ts`:
```ts
import { z } from "zod";

export const RouteTypeSchema = z.enum(["roundtrip", "oneway", "open"]);

export const CreateTripSchema = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  dateWindowStart: z.string().nullable(),  // ISO date or null
  dateWindowEnd: z.string().nullable(),
  daysMin: z.number().int().min(1),
  daysMax: z.number().int().min(1),
  routeType: RouteTypeSchema,
  notes: z.string().default(""),
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
```

`packages/shared/src/itinerary.ts`:
```ts
import { z } from "zod";
export const TimeSlotSchema = z.enum(["morning", "afternoon", "evening"]);
export type TimeSlot = z.infer<typeof TimeSlotSchema>;
```

`packages/shared/src/index.ts`:
```ts
export * from "./profile";
export * from "./place";
export * from "./trip";
export * from "./itinerary";
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm --filter @trip/shared test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): add traveler, place, trip, itinerary zod schemas"
```

---

### Task 3: Prisma schema, databases, PrismaService

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/test/utils/test-db.ts`
- Test: `apps/api/test/prisma.e2e-spec.ts`

**Interfaces:**
- Produces: `PrismaService` (extends `PrismaClient`, global module exporting it). DB models: `Trip`, `TravelerProfile`, `IntakeMessage`, `Place`, `ItineraryDay`, `ItineraryItem`, `ResearchRun`.

- [ ] **Step 1: Write schema**

`apps/api/prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Trip {
  id              String   @id @default(cuid())
  name            String
  destination     String
  dateWindowStart DateTime?
  dateWindowEnd   DateTime?
  daysMin         Int
  daysMax         Int
  routeType       String
  notes           String   @default("")
  createdAt       DateTime @default(now())
  profile         TravelerProfile?
  messages        IntakeMessage[]
  places          Place[]
  days            ItineraryDay[]
  researchRuns    ResearchRun[]
}

model TravelerProfile {
  id                String  @id @default(cuid())
  trip              Trip    @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId            String  @unique
  partyAdults       Int     @default(0)
  partyKids         Int     @default(0)
  kidsAges          Json    @default("[]")
  maxHikeKm         Float?
  maxHikeElevationM Float?
  pace              String?
  interests         String[] @default([])
  dislikes          String[] @default([])
  extra             Json    @default("{}")
  completed         Boolean @default(false)
}

model IntakeMessage {
  id        String   @id @default(cuid())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId    String
  role      String   // user | assistant
  content   String
  createdAt DateTime @default(now())
}

model Place {
  id              String   @id @default(cuid())
  trip            Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId          String
  name            String
  category        String
  description     String   @default("")
  lat             Float?
  lng             Float?
  photoUrl        String?
  sourceUrl       String?
  sourceType      String   @default("web")
  estDurationMin  Int      @default(0)
  difficulty      String   @default("easy")
  kidSuitability  Int      @default(3)
  weatherDependent Boolean @default(false)
  tags            String[] @default([])
  raw             Json     @default("{}")
  status          String   @default("new")
  createdAt       DateTime @default(now())
  items           ItineraryItem[]
}

model ItineraryDay {
  id       String @id @default(cuid())
  trip     Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId   String
  dayIndex Int
  date     DateTime?
  baseCity String @default("")
  items    ItineraryItem[]
}

model ItineraryItem {
  id            String  @id @default(cuid())
  day           ItineraryDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  dayId         String
  place         Place   @relation(fields: [placeId], references: [id], onDelete: Cascade)
  placeId       String
  sortOrder     Int     @default(0)
  timeSlot      String?
  isBackup      Boolean @default(false)
  backupForItemId String?
}

model ResearchRun {
  id        String   @id @default(cuid())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId    String
  queries   Json     @default("[]")
  provider  String   @default("brave+gemini")
  status    String   @default("running")
  stats     Json     @default("{}")
  error     String?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Create databases + first migration**

Run:
```bash
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE trip_planner;" || true
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE trip_planner_test;" || true
cp .env.example .env   # then fill secrets manually
cd apps/api && pnpm exec prisma migrate dev --name init && cd ../..
```
Expected: migration `init` applied to `trip_planner`; `@prisma/client` generated.

- [ ] **Step 3: Write PrismaService + module**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Register `PrismaModule` in `apps/api/src/app.module.ts` imports.

- [ ] **Step 4: Test-DB helper + e2e migration test**

`apps/api/test/utils/test-db.ts`:
```ts
import { execSync } from "node:child_process";

export function resetTestDb() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  execSync("pnpm exec prisma migrate deploy", {
    cwd: __dirname + "/../..",
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: "ignore",
  });
}
```

`apps/api/test/prisma.e2e-spec.ts`:
```ts
import { PrismaService } from "../src/prisma/prisma.service";
import { resetTestDb } from "./utils/test-db";

describe("Prisma (e2e)", () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    resetTestDb();
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("creates and reads a trip", async () => {
    const trip = await prisma.trip.create({
      data: { name: "Norway", destination: "Norway", daysMin: 7, daysMax: 10, routeType: "open" },
    });
    const found = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(found?.destination).toBe("Norway");
    await prisma.trip.delete({ where: { id: trip.id } });
  });
});
```

Ensure `apps/api/test/jest-e2e.json` sets `"testEnvironment": "node"` and loads `.env` (add `setupFiles: ["dotenv/config"]`; `pnpm --filter api add -D dotenv`).

- [ ] **Step 5: Run e2e, verify pass**

Run: `pnpm --filter api test:e2e`
Expected: Prisma e2e passes.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(api): prisma schema, migration, PrismaService, test-db helper"
```

---

### Task 4: AI provider ports + implementations

**Files:**
- Create: `apps/api/src/ai/ports.ts`, `gemini.provider.ts`, `brave.provider.ts`, `maps.provider.ts`, `ai.module.ts`
- Create: `apps/api/test/utils/stub-ai.module.ts`
- Test: `apps/api/src/ai/maps.provider.spec.ts`

**Interfaces:**
- Produces (DI tokens are the string constants):
  - `GEMINI = 'GeminiPort'`, `SEARCH = 'SearchPort'`, `MAPS = 'MapsPort'`
  - `GeminiPort`:
    - `chat(messages: {role:'user'|'assistant'|'system'; content:string}[]): Promise<string>`
    - `extractJson<T>(prompt: string, schema: object): Promise<T>` — returns parsed JSON matching a Gemini responseSchema
  - `SearchPort.search(query: string, count: number): Promise<{ title:string; url:string; description:string }[]>`
  - `MapsPort`:
    - `geocode(query: string): Promise<{ lat:number; lng:number } | null>`
    - `photoUrl(query: string): Promise<string | null>`
  - `AiModule` (global) providing all three from real impls.
  - `StubAiModule` (test) providing in-memory deterministic stubs.

- [ ] **Step 1: Define ports + tokens**

`apps/api/src/ai/ports.ts`:
```ts
export const GEMINI = "GeminiPort";
export const SEARCH = "SearchPort";
export const MAPS = "MapsPort";

export interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }

export interface GeminiPort {
  chat(messages: ChatMessage[]): Promise<string>;
  extractJson<T>(prompt: string, schema: object): Promise<T>;
}
export interface SearchResult { title: string; url: string; description: string; }
export interface SearchPort { search(query: string, count: number): Promise<SearchResult[]>; }
export interface MapsPort {
  geocode(query: string): Promise<{ lat: number; lng: number } | null>;
  photoUrl(query: string): Promise<string | null>;
}
```

- [ ] **Step 2: Write failing MapsProvider test (URL building, no network)**

`apps/api/src/ai/maps.provider.spec.ts`:
```ts
import { MapsProvider } from "./maps.provider";

describe("MapsProvider", () => {
  it("returns null geocode when fetch yields zero results", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });
    const m = new MapsProvider("KEY", fetchFn as any);
    expect(await m.geocode("nowhere xyz")).toBeNull();
  });

  it("parses lat/lng from a geocode hit", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: 60.4, lng: 5.3 } } }] }),
    });
    const m = new MapsProvider("KEY", fetchFn as any);
    expect(await m.geocode("Bergen")).toEqual({ lat: 60.4, lng: 5.3 });
  });
});
```

- [ ] **Step 3: Run test, verify fail**

Run: `pnpm --filter api test maps.provider`
Expected: FAIL — cannot find `./maps.provider`.

- [ ] **Step 4: Implement providers**

`apps/api/src/ai/maps.provider.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { MapsPort } from "./ports";

type FetchFn = typeof fetch;

@Injectable()
export class MapsProvider implements MapsPort {
  constructor(private key = process.env.GOOGLE_MAPS_API_KEY ?? "", private fetchFn: FetchFn = fetch) {}

  async geocode(query: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.key}`;
    const res = await this.fetchFn(url);
    const body: any = await res.json();
    if (body.status !== "OK" || !body.results?.length) return null;
    const loc = body.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }

  async photoUrl(query: string) {
    const find = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos&key=${this.key}`;
    const res = await this.fetchFn(find);
    const body: any = await res.json();
    const ref = body.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${ref}&key=${this.key}`;
  }
}
```

`apps/api/src/ai/brave.provider.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { SearchPort, SearchResult } from "./ports";

type FetchFn = typeof fetch;

@Injectable()
export class BraveProvider implements SearchPort {
  constructor(private key = process.env.BRAVE_API_KEY ?? "", private fetchFn: FetchFn = fetch) {}

  async search(query: string, count: number): Promise<SearchResult[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = await this.fetchFn(url, { headers: { "X-Subscription-Token": this.key, Accept: "application/json" } });
    const body: any = await res.json();
    return (body.web?.results ?? []).map((r: any) => ({ title: r.title, url: r.url, description: r.description ?? "" }));
  }
}
```

`apps/api/src/ai/gemini.provider.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, GeminiPort } from "./ports";

@Injectable()
export class GeminiProvider implements GeminiPort {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  private model = "gemini-2.0-flash";

  async chat(messages: ChatMessage[]): Promise<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: system ? { systemInstruction: system } : {},
    });
    return res.text ?? "";
  }

  async extractJson<T>(prompt: string, schema: object): Promise<T> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: schema as any },
    });
    return JSON.parse(res.text ?? "null") as T;
  }
}
```

`apps/api/src/ai/ai.module.ts`:
```ts
import { Global, Module } from "@nestjs/common";
import { GEMINI, SEARCH, MAPS } from "./ports";
import { GeminiProvider } from "./gemini.provider";
import { BraveProvider } from "./brave.provider";
import { MapsProvider } from "./maps.provider";

@Global()
@Module({
  providers: [
    { provide: GEMINI, useClass: GeminiProvider },
    { provide: SEARCH, useClass: BraveProvider },
    { provide: MAPS, useClass: MapsProvider },
  ],
  exports: [GEMINI, SEARCH, MAPS],
})
export class AiModule {}
```

- [ ] **Step 5: Stub AI module for tests**

`apps/api/test/utils/stub-ai.module.ts`:
```ts
import { Global, Module } from "@nestjs/common";
import { GEMINI, SEARCH, MAPS, GeminiPort, SearchPort, MapsPort } from "../../src/ai/ports";

export const stubGemini: GeminiPort = {
  chat: async () => "stub reply",
  extractJson: async () => ({}) as any,
};
export const stubSearch: SearchPort = { search: async () => [] };
export const stubMaps: MapsPort = { geocode: async () => ({ lat: 0, lng: 0 }), photoUrl: async () => null };

@Global()
@Module({
  providers: [
    { provide: GEMINI, useValue: stubGemini },
    { provide: SEARCH, useValue: stubSearch },
    { provide: MAPS, useValue: stubMaps },
  ],
  exports: [GEMINI, SEARCH, MAPS],
})
export class StubAiModule {}
```

- [ ] **Step 6: Run test, verify pass; register AiModule**

Add `AiModule` to `app.module.ts` imports. Run: `pnpm --filter api test maps.provider`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): AI ports (Gemini/Brave/Maps) with impls and test stubs"
```

---

### Task 5: Trips module (CRUD)

**Files:**
- Create: `apps/api/src/trips/trips.service.ts`, `trips.controller.ts`, `trips.module.ts`
- Test: `apps/api/src/trips/trips.service.spec.ts`, `apps/api/test/trips.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `CreateTripInput` from `@trip/shared`.
- Produces:
  - `TripsService.create(input: CreateTripInput): Promise<Trip>`
  - `TripsService.findAll(): Promise<Trip[]>`
  - `TripsService.findOne(id: string): Promise<Trip>` (throws `NotFoundException` if missing)
  - REST: `POST /trips`, `GET /trips`, `GET /trips/:id`

- [ ] **Step 1: Failing service spec**

`apps/api/src/trips/trips.service.spec.ts`:
```ts
import { NotFoundException } from "@nestjs/common";
import { TripsService } from "./trips.service";

const prismaMock = {
  trip: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe("TripsService", () => {
  let svc: TripsService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TripsService(prismaMock as any);
  });

  it("creates a trip from input", async () => {
    prismaMock.trip.create.mockResolvedValue({ id: "t1", destination: "Norway" });
    const r = await svc.create({
      name: "Norway", destination: "Norway", dateWindowStart: null, dateWindowEnd: null,
      daysMin: 7, daysMax: 10, routeType: "open", notes: "",
    });
    expect(r.id).toBe("t1");
    expect(prismaMock.trip.create).toHaveBeenCalled();
  });

  it("throws NotFound when trip missing", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);
    await expect(svc.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter api test trips.service`
Expected: FAIL — cannot find `./trips.service`.

- [ ] **Step 3: Implement service + controller + module**

`apps/api/src/trips/trips.service.ts`:
```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTripInput } from "@trip/shared";

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateTripInput) {
    return this.prisma.trip.create({
      data: {
        name: input.name,
        destination: input.destination,
        dateWindowStart: input.dateWindowStart ? new Date(input.dateWindowStart) : null,
        dateWindowEnd: input.dateWindowEnd ? new Date(input.dateWindowEnd) : null,
        daysMin: input.daysMin,
        daysMax: input.daysMax,
        routeType: input.routeType,
        notes: input.notes,
      },
    });
  }

  findAll() { return this.prisma.trip.findMany({ orderBy: { createdAt: "desc" } }); }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }
}
```

`apps/api/src/trips/trips.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CreateTripSchema, CreateTripInput } from "@trip/shared";
import { TripsService } from "./trips.service";

@Controller("trips")
export class TripsController {
  constructor(private trips: TripsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTripSchema))
  create(@Body() body: CreateTripInput) { return this.trips.create(body); }

  @Get() findAll() { return this.trips.findAll(); }

  @Get(":id") findOne(@Param("id") id: string) { return this.trips.findOne(id); }
}
```

`apps/api/src/common/zod-validation.pipe.ts`:
```ts
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
```

`apps/api/src/trips/trips.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { TripsService } from "./trips.service";
import { TripsController } from "./trips.controller";

@Module({ providers: [TripsService], controllers: [TripsController], exports: [TripsService] })
export class TripsModule {}
```

Register `TripsModule` in `app.module.ts`.

- [ ] **Step 4: Run service spec, verify pass**

Run: `pnpm --filter api test trips.service`
Expected: PASS.

- [ ] **Step 5: e2e spec**

`apps/api/test/trips.e2e-spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { resetTestDb } from "./utils/test-db";

describe("Trips (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it("POST /trips then GET /trips/:id", async () => {
    const created = await request(app.getHttpServer()).post("/trips").send({
      name: "Norway", destination: "Norway", dateWindowStart: null, dateWindowEnd: null,
      daysMin: 7, daysMax: 10, routeType: "open", notes: "",
    }).expect(201);
    const id = created.body.id;
    await request(app.getHttpServer()).get(`/trips/${id}`).expect(200)
      .expect((r) => expect(r.body.destination).toBe("Norway"));
  });

  it("rejects invalid trip", async () => {
    await request(app.getHttpServer()).post("/trips").send({ name: "" }).expect(400);
  });
});
```

- [ ] **Step 6: Run e2e, verify pass**

Run: `pnpm --filter api test:e2e trips`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): trips CRUD module with zod validation"
```

---

### Task 6: Intake module (chat + profile extraction)

**Files:**
- Create: `apps/api/src/intake/intake.service.ts`, `intake.controller.ts`, `intake.module.ts`
- Test: `apps/api/src/intake/intake.service.spec.ts`, `apps/api/test/intake.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `GeminiPort` (token `GEMINI`), `TravelerProfileSchema`/`TravelerProfile`.
- Produces:
  - `IntakeService.postMessage(tripId: string, content: string): Promise<{ reply: string; profile: TravelerProfile }>`
    - Persists the user message, calls Gemini chat for the next interview reply, calls `extractJson` to update the structured profile, upserts `TravelerProfile`, persists assistant reply, returns both.
  - `IntakeService.getProfile(tripId: string): Promise<TravelerProfile>`
  - REST: `POST /trips/:id/intake/messages` `{ content }`, `GET /trips/:id/profile`
- Constants: `INTAKE_SYSTEM_PROMPT` (interviewer persona, one question at a time, must establish: kids ages, max hike km + elevation, pace, interests, dislikes; says `READY` when enough info).

- [ ] **Step 1: Failing service spec (Gemini stubbed)**

`apps/api/src/intake/intake.service.spec.ts`:
```ts
import { IntakeService } from "./intake.service";

const prismaMock = {
  intakeMessage: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  travelerProfile: { upsert: jest.fn(), findUnique: jest.fn() },
};
const geminiMock = {
  chat: jest.fn().mockResolvedValue("How old are your kids?"),
  extractJson: jest.fn().mockResolvedValue({
    partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
    pace: "moderate", interests: ["hikes"], dislikes: [], completed: false,
  }),
};

describe("IntakeService", () => {
  let svc: IntakeService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new IntakeService(prismaMock as any, geminiMock as any);
    prismaMock.travelerProfile.upsert.mockImplementation(async ({ create }) => create);
  });

  it("persists user message, gets reply, extracts + upserts profile", async () => {
    const res = await svc.postMessage("t1", "We are a family of 4");
    expect(res.reply).toBe("How old are your kids?");
    expect(res.profile.kidsAges).toEqual([5, 8]);
    expect(prismaMock.intakeMessage.create).toHaveBeenCalledTimes(2); // user + assistant
    expect(prismaMock.travelerProfile.upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter api test intake.service`
Expected: FAIL — cannot find `./intake.service`.

- [ ] **Step 3: Implement service**

`apps/api/src/intake/intake.service.ts`:
```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GEMINI, GeminiPort, ChatMessage } from "../ai/ports";
import { TravelerProfile, TravelerProfileSchema } from "@trip/shared";

export const INTAKE_SYSTEM_PROMPT = `You are a family-trip intake interviewer.
Ask ONE concise question at a time to learn: number of adults and kids, each kid's age,
the max hike distance (km) and elevation gain (m) the group can handle, preferred pace
(relaxed/moderate/packed), interests, and dislikes. When you have all of these, reply with
a short confirmation that starts with the token READY.`;

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    partyAdults: { type: "integer" }, partyKids: { type: "integer" },
    kidsAges: { type: "array", items: { type: "integer" } },
    maxHikeKm: { type: ["number", "null"] }, maxHikeElevationM: { type: ["number", "null"] },
    pace: { type: ["string", "null"], enum: ["relaxed", "moderate", "packed", null] },
    interests: { type: "array", items: { type: "string" } },
    dislikes: { type: "array", items: { type: "string" } },
    completed: { type: "boolean" },
  },
  required: ["partyAdults", "partyKids", "kidsAges", "interests", "dislikes", "completed"],
};

@Injectable()
export class IntakeService {
  constructor(private prisma: PrismaService, @Inject(GEMINI) private gemini: GeminiPort) {}

  async postMessage(tripId: string, content: string) {
    await this.prisma.intakeMessage.create({ data: { tripId, role: "user", content } });
    const history = await this.prisma.intakeMessage.findMany({
      where: { tripId }, orderBy: { createdAt: "asc" },
    });
    const messages: ChatMessage[] = [
      { role: "system", content: INTAKE_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];
    const reply = await this.gemini.chat(messages);
    await this.prisma.intakeMessage.create({ data: { tripId, role: "assistant", content: reply } });

    const transcript = history.map((m) => `${m.role}: ${m.content}`).join("\n") + `\nassistant: ${reply}`;
    const raw = await this.gemini.extractJson<unknown>(
      `From this trip-intake conversation, extract the traveler profile as JSON.\n${transcript}`,
      PROFILE_SCHEMA,
    );
    const parsed = TravelerProfileSchema.parse({
      maxHikeKm: null, maxHikeElevationM: null, pace: null, ...(raw as object),
      completed: reply.trimStart().startsWith("READY"),
    });
    const profile = await this.persist(tripId, parsed);
    return { reply, profile };
  }

  private async persist(tripId: string, p: TravelerProfile): Promise<TravelerProfile> {
    const data = {
      partyAdults: p.partyAdults, partyKids: p.partyKids, kidsAges: p.kidsAges,
      maxHikeKm: p.maxHikeKm, maxHikeElevationM: p.maxHikeElevationM, pace: p.pace,
      interests: p.interests, dislikes: p.dislikes, completed: p.completed,
    };
    await this.prisma.travelerProfile.upsert({
      where: { tripId }, create: { tripId, ...data }, update: data,
    });
    return p;
  }

  async getProfile(tripId: string): Promise<TravelerProfile> {
    const row = await this.prisma.travelerProfile.findUnique({ where: { tripId } });
    if (!row) {
      return TravelerProfileSchema.parse({
        partyAdults: 0, partyKids: 0, kidsAges: [], maxHikeKm: null, maxHikeElevationM: null,
        pace: null, interests: [], dislikes: [], completed: false,
      });
    }
    return TravelerProfileSchema.parse({
      partyAdults: row.partyAdults, partyKids: row.partyKids, kidsAges: row.kidsAges as number[],
      maxHikeKm: row.maxHikeKm, maxHikeElevationM: row.maxHikeElevationM, pace: row.pace as any,
      interests: row.interests, dislikes: row.dislikes, completed: row.completed,
    });
  }
}
```

`apps/api/src/intake/intake.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IntakeService } from "./intake.service";

@Controller("trips/:id")
export class IntakeController {
  constructor(private intake: IntakeService) {}

  @Post("intake/messages")
  post(@Param("id") id: string, @Body("content") content: string) {
    return this.intake.postMessage(id, content);
  }

  @Get("profile") profile(@Param("id") id: string) { return this.intake.getProfile(id); }
}
```

`apps/api/src/intake/intake.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { IntakeService } from "./intake.service";
import { IntakeController } from "./intake.controller";

@Module({ providers: [IntakeService], controllers: [IntakeController], exports: [IntakeService] })
export class IntakeModule {}
```

Register `IntakeModule` in `app.module.ts`.

- [ ] **Step 4: Run service spec, verify pass**

Run: `pnpm --filter api test intake.service`
Expected: PASS.

- [ ] **Step 5: e2e (real DB, AI stubbed via module override)**

`apps/api/test/intake.e2e-spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule, stubGemini } from "./utils/stub-ai.module";
import { resetTestDb } from "./utils/test-db";

describe("Intake (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    resetTestDb();
    (stubGemini.chat as any) = async () => "READY thanks!";
    (stubGemini.extractJson as any) = async () => ({
      partyAdults: 2, partyKids: 1, kidsAges: [7], maxHikeKm: 5, maxHikeElevationM: 250,
      pace: "moderate", interests: ["beaches"], dislikes: [], completed: false,
    });
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(AiModule).useModule(StubAiModule).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it("posts a message and fills the profile", async () => {
    const trip = await request(app.getHttpServer()).post("/trips").send({
      name: "Malaga", destination: "Malaga", dateWindowStart: null, dateWindowEnd: null,
      daysMin: 5, daysMax: 5, routeType: "roundtrip", notes: "",
    });
    const id = trip.body.id;
    const res = await request(app.getHttpServer())
      .post(`/trips/${id}/intake/messages`).send({ content: "family of 3" }).expect(201);
    expect(res.body.profile.completed).toBe(true);   // reply starts with READY
    expect(res.body.profile.kidsAges).toEqual([7]);
  });
});
```

- [ ] **Step 6: Run e2e, verify pass**

Run: `pnpm --filter api test:e2e intake`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): intake chat agent with profile extraction"
```

---

### Task 7: Research module (search → extract → geocode → dedupe → persist)

**Files:**
- Create: `apps/api/src/research/research.service.ts`, `research.controller.ts`, `research.module.ts`, `research.parser.ts`
- Test: `apps/api/src/research/research.parser.spec.ts`, `apps/api/src/research/research.service.spec.ts`, `apps/api/test/research.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `GeminiPort`, `SearchPort`, `MapsPort`, `IntakeService.getProfile`, `ResearchPlaceSchema`/`ResearchPlace`.
- Produces:
  - `buildQueries(destination: string, profile: TravelerProfile): string[]` (pure, in `research.parser.ts`)
  - `dedupePlaces(existing: {name:string; lat:number|null; lng:number|null}[], incoming: ResearchPlace[]): ResearchPlace[]` (pure — drops incoming whose name case-insensitively matches an existing name)
  - `ResearchService.run(tripId: string): Promise<{ runId: string; created: number; places: Place[] }>`
  - REST: `POST /trips/:id/research`

- [ ] **Step 1: Failing parser spec**

`apps/api/src/research/research.parser.spec.ts`:
```ts
import { buildQueries, dedupePlaces } from "./research.parser";

describe("buildQueries", () => {
  it("includes destination and kid-friendly hikes when interests include hikes", () => {
    const qs = buildQueries("Norway", {
      partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
      pace: "moderate", interests: ["hikes"], dislikes: [], completed: true,
    });
    expect(qs.some((q) => /Norway/.test(q))).toBe(true);
    expect(qs.some((q) => /kid|family/i.test(q))).toBe(true);
  });
});

describe("dedupePlaces", () => {
  it("removes incoming places matching an existing name (case-insensitive)", () => {
    const out = dedupePlaces(
      [{ name: "Trolltunga", lat: 60, lng: 6 }],
      [
        { name: "trolltunga", category: "hike", description: "", difficulty: "hard",
          kidSuitability: 2, estDurationMin: 600, weatherDependent: true, sourceUrl: null,
          sourceType: "web", tags: [] },
        { name: "Fløyen", category: "hike", description: "", difficulty: "easy",
          kidSuitability: 5, estDurationMin: 120, weatherDependent: true, sourceUrl: null,
          sourceType: "web", tags: [] },
      ],
    );
    expect(out.map((p) => p.name)).toEqual(["Fløyen"]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter api test research.parser`
Expected: FAIL — cannot find `./research.parser`.

- [ ] **Step 3: Implement parser**

`apps/api/src/research/research.parser.ts`:
```ts
import { ResearchPlace, TravelerProfile } from "@trip/shared";

export function buildQueries(destination: string, profile: TravelerProfile): string[] {
  const kidWord = profile.partyKids > 0 ? "family kid-friendly" : "best";
  const base = [
    `${kidWord} things to do in ${destination}`,
    `${kidWord} day hikes in ${destination}`,
    `top museums and attractions in ${destination} with kids`,
    `best beaches in ${destination}`,
  ];
  for (const interest of profile.interests) base.push(`${kidWord} ${interest} in ${destination}`);
  return [...new Set(base)];
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

- [ ] **Step 4: Run parser spec, verify pass**

Run: `pnpm --filter api test research.parser`
Expected: PASS.

- [ ] **Step 5: Failing service spec (all ports mocked)**

`apps/api/src/research/research.service.spec.ts`:
```ts
import { ResearchService } from "./research.service";

const sampleProfile = {
  partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
  pace: "moderate", interests: ["hikes"], dislikes: [], completed: true,
};

function makeMocks() {
  const prisma = {
    place: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockImplementation(async ({ data }) => ({ id: "p_" + data.name, ...data })) },
    researchRun: { create: jest.fn().mockResolvedValue({ id: "run1" }), update: jest.fn() },
  };
  const intake = { getProfile: jest.fn().mockResolvedValue(sampleProfile) };
  const search = { search: jest.fn().mockResolvedValue([{ title: "t", url: "https://u", description: "d" }]) };
  const gemini = {
    chat: jest.fn(),
    extractJson: jest.fn().mockResolvedValue({ places: [
      { name: "Fløyen", category: "hike", description: "funicular hill", difficulty: "easy",
        kidSuitability: 5, estDurationMin: 120, weatherDependent: true, sourceUrl: "https://u", sourceType: "web", tags: ["view"] },
    ] }),
  };
  const maps = { geocode: jest.fn().mockResolvedValue({ lat: 60.4, lng: 5.3 }), photoUrl: jest.fn().mockResolvedValue("https://photo") };
  return { prisma, intake, search, gemini, maps };
}

describe("ResearchService", () => {
  it("runs research and persists geocoded places", async () => {
    const { prisma, intake, search, gemini, maps } = makeMocks();
    const svc = new ResearchService(prisma as any, intake as any, search as any, gemini as any, maps as any);
    const res = await svc.run("t1");
    expect(res.created).toBe(1);
    expect(prisma.place.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Fløyen", lat: 60.4, lng: 5.3, photoUrl: "https://photo", tripId: "t1" }),
    }));
    expect(prisma.researchRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run1" }, data: expect.objectContaining({ status: "done" }),
    }));
  });

  it("skips places already present by name", async () => {
    const { prisma, intake, search, gemini, maps } = makeMocks();
    prisma.place.findMany.mockResolvedValue([{ name: "Fløyen", lat: 60.4, lng: 5.3 }]);
    const svc = new ResearchService(prisma as any, intake as any, search as any, gemini as any, maps as any);
    const res = await svc.run("t1");
    expect(res.created).toBe(0);
    expect(prisma.place.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `pnpm --filter api test research.service`
Expected: FAIL — cannot find `./research.service`.

- [ ] **Step 7: Implement service + controller + module**

`apps/api/src/research/research.service.ts`:
```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntakeService } from "../intake/intake.service";
import { GEMINI, SEARCH, MAPS, GeminiPort, SearchPort, MapsPort } from "../ai/ports";
import { ResearchPlace, ResearchPlaceSchema } from "@trip/shared";
import { buildQueries, dedupePlaces } from "./research.parser";

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
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    const destination = trip?.destination ?? "";
    const queries = buildQueries(destination, profile);
    const run = await this.prisma.researchRun.create({ data: { tripId, queries, status: "running" } });

    try {
      const results = (await Promise.all(queries.map((q) => this.search.search(q, 6)))).flat();
      const snippet = results.slice(0, 30).map((r) => `- ${r.title} (${r.url}): ${r.description}`).join("\n");
      const extracted = await this.gemini.extractJson<{ places: unknown[] }>(
        `From these search results about ${destination}, extract distinct real places to visit for a family ` +
        `(${profile.partyKids} kids, ages ${profile.kidsAges.join(",")}, max hike ${profile.maxHikeKm}km). ` +
        `Set weatherDependent true for outdoor places. Return JSON.\n${snippet}`,
        PLACES_SCHEMA,
      );
      const incoming: ResearchPlace[] = (extracted.places ?? [])
        .map((p) => ResearchPlaceSchema.safeParse(p))
        .filter((r) => r.success)
        .map((r) => (r as { data: ResearchPlace }).data);

      const existing = await this.prisma.place.findMany({
        where: { tripId }, select: { name: true, lat: true, lng: true },
      });
      const fresh = dedupePlaces(existing, incoming);

      const created = [];
      for (const p of fresh) {
        const geo = await this.maps.geocode(`${p.name}, ${destination}`);
        const photoUrl = await this.maps.photoUrl(`${p.name}, ${destination}`);
        created.push(await this.prisma.place.create({
          data: {
            tripId, name: p.name, category: p.category, description: p.description,
            lat: geo?.lat ?? null, lng: geo?.lng ?? null, photoUrl,
            sourceUrl: p.sourceUrl, sourceType: p.sourceType, estDurationMin: p.estDurationMin,
            difficulty: p.difficulty, kidSuitability: p.kidSuitability,
            weatherDependent: p.weatherDependent, tags: p.tags, raw: p as object, status: "new",
          },
        }));
      }

      await this.prisma.researchRun.update({
        where: { id: run.id }, data: { status: "done", stats: { created: created.length } },
      });
      return { runId: run.id, created: created.length, places: created };
    } catch (e: any) {
      await this.prisma.researchRun.update({ where: { id: run.id }, data: { status: "error", error: String(e?.message ?? e) } });
      throw e;
    }
  }
}
```

`apps/api/src/research/research.controller.ts`:
```ts
import { Controller, Param, Post } from "@nestjs/common";
import { ResearchService } from "./research.service";

@Controller("trips/:id")
export class ResearchController {
  constructor(private research: ResearchService) {}
  @Post("research") run(@Param("id") id: string) { return this.research.run(id); }
}
```

`apps/api/src/research/research.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ResearchService } from "./research.service";
import { ResearchController } from "./research.controller";
import { IntakeModule } from "../intake/intake.module";

@Module({ imports: [IntakeModule], providers: [ResearchService], controllers: [ResearchController] })
export class ResearchModule {}
```

Register `ResearchModule` in `app.module.ts`.

- [ ] **Step 8: Run service spec, verify pass**

Run: `pnpm --filter api test research.service`
Expected: PASS (both cases).

- [ ] **Step 9: e2e (stubbed AI returns one place)**

`apps/api/test/research.e2e-spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule, stubGemini, stubSearch, stubMaps } from "./utils/stub-ai.module";
import { resetTestDb } from "./utils/test-db";

describe("Research (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    resetTestDb();
    (stubSearch.search as any) = async () => [{ title: "Fløyen", url: "https://u", description: "hill" }];
    (stubGemini.extractJson as any) = async () => ({ places: [{
      name: "Fløyen", category: "hike", description: "funicular hill", difficulty: "easy",
      kidSuitability: 5, estDurationMin: 120, weatherDependent: true, sourceUrl: "https://u",
      sourceType: "web", tags: ["view"] }] });
    (stubMaps.geocode as any) = async () => ({ lat: 60.4, lng: 5.3 });
    (stubMaps.photoUrl as any) = async () => "https://photo";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(AiModule).useModule(StubAiModule).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it("creates geocoded places for a trip", async () => {
    const trip = await request(app.getHttpServer()).post("/trips").send({
      name: "Norway", destination: "Bergen", dateWindowStart: null, dateWindowEnd: null,
      daysMin: 7, daysMax: 10, routeType: "open", notes: "" });
    const res = await request(app.getHttpServer()).post(`/trips/${trip.body.id}/research`).expect(201);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
    expect(res.body.places[0].lat).toBe(60.4);
  });
});
```

- [ ] **Step 10: Run e2e, verify pass**

Run: `pnpm --filter api test:e2e research`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(api): research agent — search, extract, geocode, dedupe, persist"
```

---

### Task 8: Places module (list + status updates)

**Files:**
- Create: `apps/api/src/places/places.service.ts`, `places.controller.ts`, `places.module.ts`
- Test: `apps/api/src/places/places.service.spec.ts`, `apps/api/test/places.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `PlaceStatusSchema`.
- Produces:
  - `PlacesService.list(tripId: string, status?: PlaceStatus): Promise<Place[]>`
  - `PlacesService.setStatus(placeId: string, status: PlaceStatus): Promise<Place>`
  - REST: `GET /trips/:id/places?status=`, `PATCH /places/:placeId` `{ status }`

- [ ] **Step 1: Failing service spec**

`apps/api/src/places/places.service.spec.ts`:
```ts
import { BadRequestException } from "@nestjs/common";
import { PlacesService } from "./places.service";

const prisma = {
  place: {
    findMany: jest.fn().mockResolvedValue([{ id: "p1" }]),
    update: jest.fn().mockResolvedValue({ id: "p1", status: "liked" }),
  },
};

describe("PlacesService", () => {
  let svc: PlacesService;
  beforeEach(() => { jest.clearAllMocks(); svc = new PlacesService(prisma as any); });

  it("filters by status when provided", async () => {
    await svc.list("t1", "liked");
    expect(prisma.place.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tripId: "t1", status: "liked" },
    }));
  });

  it("sets a valid status", async () => {
    const r = await svc.setStatus("p1", "liked");
    expect(r.status).toBe("liked");
  });

  it("rejects an invalid status", async () => {
    await expect(svc.setStatus("p1", "banana" as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter api test places.service`
Expected: FAIL — cannot find `./places.service`.

- [ ] **Step 3: Implement**

`apps/api/src/places/places.service.ts`:
```ts
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlaceStatus, PlaceStatusSchema } from "@trip/shared";

@Injectable()
export class PlacesService {
  constructor(private prisma: PrismaService) {}

  list(tripId: string, status?: PlaceStatus) {
    return this.prisma.place.findMany({
      where: status ? { tripId, status } : { tripId },
      orderBy: { createdAt: "desc" },
    });
  }

  setStatus(placeId: string, status: PlaceStatus) {
    const parsed = PlaceStatusSchema.safeParse(status);
    if (!parsed.success) throw new BadRequestException("invalid status");
    return this.prisma.place.update({ where: { id: placeId }, data: { status: parsed.data } });
  }
}
```

`apps/api/src/places/places.controller.ts`:
```ts
import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { PlacesService } from "./places.service";
import { PlaceStatus } from "@trip/shared";

@Controller()
export class PlacesController {
  constructor(private places: PlacesService) {}

  @Get("trips/:id/places")
  list(@Param("id") id: string, @Query("status") status?: PlaceStatus) {
    return this.places.list(id, status);
  }

  @Patch("places/:placeId")
  setStatus(@Param("placeId") placeId: string, @Body("status") status: PlaceStatus) {
    return this.places.setStatus(placeId, status);
  }
}
```

`apps/api/src/places/places.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { PlacesService } from "./places.service";
import { PlacesController } from "./places.controller";

@Module({ providers: [PlacesService], controllers: [PlacesController], exports: [PlacesService] })
export class PlacesModule {}
```

Register `PlacesModule` in `app.module.ts`.

- [ ] **Step 4: Run service spec, verify pass**

Run: `pnpm --filter api test places.service`
Expected: PASS.

- [ ] **Step 5: e2e**

`apps/api/test/places.e2e-spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetTestDb } from "./utils/test-db";

describe("Places (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });

  it("lists liked places after status update", async () => {
    const trip = await prisma.trip.create({ data: { name: "x", destination: "x", daysMin: 1, daysMax: 1, routeType: "open" } });
    const place = await prisma.place.create({ data: { tripId: trip.id, name: "Beach", category: "beach" } });
    await request(app.getHttpServer()).patch(`/places/${place.id}`).send({ status: "liked" }).expect(200);
    const res = await request(app.getHttpServer()).get(`/trips/${trip.id}/places?status=liked`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("liked");
  });
});
```

- [ ] **Step 6: Run e2e, verify pass**

Run: `pnpm --filter api test:e2e places`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): places list + status (like/reject/maybe)"
```

---

### Task 9: Itinerary module (days, items, weather backups)

**Files:**
- Create: `apps/api/src/itinerary/itinerary.service.ts`, `itinerary.controller.ts`, `itinerary.module.ts`, `backup.ts`
- Test: `apps/api/src/itinerary/backup.spec.ts`, `apps/api/src/itinerary/itinerary.service.spec.ts`, `apps/api/test/itinerary.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `TimeSlot`.
- Produces:
  - `rankBackups(weatherItemPlaces: Place[], likedPool: Place[]): Place[]` (pure, in `backup.ts`) — returns liked, non-weather-dependent places not already weather items, sorted by `kidSuitability` desc.
  - `ItineraryService.createDay(tripId: string, dayIndex: number, baseCity: string): Promise<ItineraryDay>`
  - `ItineraryService.getBoard(tripId: string): Promise<ItineraryDay[]>` (days with items + place included)
  - `ItineraryService.addItem(dayId: string, placeId: string, timeSlot: TimeSlot | null): Promise<ItineraryItem>`
  - `ItineraryService.removeItem(itemId: string): Promise<void>`
  - `ItineraryService.suggestBackups(tripId: string, dayId: string): Promise<Place[]>`
  - REST: `POST /trips/:id/days`, `GET /trips/:id/board`, `POST /days/:dayId/items`, `DELETE /items/:itemId`, `POST /trips/:id/days/:dayId/backups`

- [ ] **Step 1: Failing backup spec**

`apps/api/src/itinerary/backup.spec.ts`:
```ts
import { rankBackups } from "./backup";

const place = (over: Partial<any>) => ({
  id: "x", name: "n", category: "museum", weatherDependent: false, kidSuitability: 3, ...over,
});

describe("rankBackups", () => {
  it("returns indoor liked places sorted by kidSuitability desc, excluding weather items", () => {
    const weatherItems = [place({ id: "hike1", weatherDependent: true })];
    const liked = [
      place({ id: "hike1", weatherDependent: true, kidSuitability: 5 }),   // excluded: in weather items
      place({ id: "beach", weatherDependent: true, kidSuitability: 4 }),   // excluded: weather dependent
      place({ id: "museumA", weatherDependent: false, kidSuitability: 2 }),
      place({ id: "museumB", weatherDependent: false, kidSuitability: 5 }),
    ];
    const out = rankBackups(weatherItems, liked);
    expect(out.map((p) => p.id)).toEqual(["museumB", "museumA"]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter api test backup`
Expected: FAIL — cannot find `./backup`.

- [ ] **Step 3: Implement backup ranking**

`apps/api/src/itinerary/backup.ts`:
```ts
export interface BackupPlace { id: string; weatherDependent: boolean; kidSuitability: number; }

export function rankBackups<T extends BackupPlace>(weatherItemPlaces: T[], likedPool: T[]): T[] {
  const exclude = new Set(weatherItemPlaces.map((p) => p.id));
  return likedPool
    .filter((p) => !p.weatherDependent && !exclude.has(p.id))
    .sort((a, b) => b.kidSuitability - a.kidSuitability);
}
```

- [ ] **Step 4: Run backup spec, verify pass**

Run: `pnpm --filter api test backup`
Expected: PASS.

- [ ] **Step 5: Failing service spec for suggestBackups**

`apps/api/src/itinerary/itinerary.service.spec.ts`:
```ts
import { ItineraryService } from "./itinerary.service";

describe("ItineraryService.suggestBackups", () => {
  it("suggests indoor liked places for a day with weather-dependent items", async () => {
    const prisma = {
      itineraryDay: { findUnique: jest.fn().mockResolvedValue({
        id: "d1", items: [{ place: { id: "hike1", weatherDependent: true, kidSuitability: 5 } }],
      }) },
      place: { findMany: jest.fn().mockResolvedValue([
        { id: "hike1", weatherDependent: true, kidSuitability: 5 },
        { id: "museumB", weatherDependent: false, kidSuitability: 5 },
      ]) },
    };
    const svc = new ItineraryService(prisma as any);
    const out = await svc.suggestBackups("t1", "d1");
    expect(out.map((p: any) => p.id)).toEqual(["museumB"]);
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `pnpm --filter api test itinerary.service`
Expected: FAIL — cannot find `./itinerary.service`.

- [ ] **Step 7: Implement service + controller + module**

`apps/api/src/itinerary/itinerary.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TimeSlot } from "@trip/shared";
import { rankBackups } from "./backup";

@Injectable()
export class ItineraryService {
  constructor(private prisma: PrismaService) {}

  createDay(tripId: string, dayIndex: number, baseCity: string) {
    return this.prisma.itineraryDay.create({ data: { tripId, dayIndex, baseCity } });
  }

  getBoard(tripId: string) {
    return this.prisma.itineraryDay.findMany({
      where: { tripId }, orderBy: { dayIndex: "asc" },
      include: { items: { include: { place: true }, orderBy: { sortOrder: "asc" } } },
    });
  }

  async addItem(dayId: string, placeId: string, timeSlot: TimeSlot | null) {
    const count = await this.prisma.itineraryItem.count({ where: { dayId } });
    return this.prisma.itineraryItem.create({
      data: { dayId, placeId, timeSlot: timeSlot ?? null, sortOrder: count },
    });
  }

  async removeItem(itemId: string) {
    await this.prisma.itineraryItem.delete({ where: { id: itemId } });
  }

  async suggestBackups(tripId: string, dayId: string) {
    const day = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId }, include: { items: { include: { place: true } } },
    });
    const weatherItems = (day?.items ?? [])
      .map((i) => i.place)
      .filter((p) => p.weatherDependent);
    const liked = await this.prisma.place.findMany({ where: { tripId, status: "liked" } });
    return rankBackups(weatherItems as any, liked as any);
  }
}
```

`apps/api/src/itinerary/itinerary.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ItineraryService } from "./itinerary.service";
import { TimeSlot } from "@trip/shared";

@Controller()
export class ItineraryController {
  constructor(private itinerary: ItineraryService) {}

  @Post("trips/:id/days")
  createDay(@Param("id") id: string, @Body() body: { dayIndex: number; baseCity: string }) {
    return this.itinerary.createDay(id, body.dayIndex, body.baseCity ?? "");
  }

  @Get("trips/:id/board") board(@Param("id") id: string) { return this.itinerary.getBoard(id); }

  @Post("days/:dayId/items")
  addItem(@Param("dayId") dayId: string, @Body() body: { placeId: string; timeSlot?: TimeSlot }) {
    return this.itinerary.addItem(dayId, body.placeId, body.timeSlot ?? null);
  }

  @Delete("items/:itemId") remove(@Param("itemId") itemId: string) { return this.itinerary.removeItem(itemId); }

  @Post("trips/:id/days/:dayId/backups")
  backups(@Param("id") id: string, @Param("dayId") dayId: string) {
    return this.itinerary.suggestBackups(id, dayId);
  }
}
```

`apps/api/src/itinerary/itinerary.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ItineraryService } from "./itinerary.service";
import { ItineraryController } from "./itinerary.controller";

@Module({ providers: [ItineraryService], controllers: [ItineraryController] })
export class ItineraryModule {}
```

Register `ItineraryModule` in `app.module.ts`.

- [ ] **Step 8: Run service spec, verify pass**

Run: `pnpm --filter api test itinerary.service`
Expected: PASS.

- [ ] **Step 9: e2e**

`apps/api/test/itinerary.e2e-spec.ts`:
```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetTestDb } from "./utils/test-db";

describe("Itinerary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });

  it("builds a day, adds an item, and suggests a backup", async () => {
    const trip = await prisma.trip.create({ data: { name: "x", destination: "x", daysMin: 1, daysMax: 1, routeType: "open" } });
    const hike = await prisma.place.create({ data: { tripId: trip.id, name: "Hike", category: "hike", weatherDependent: true, kidSuitability: 4, status: "liked" } });
    await prisma.place.create({ data: { tripId: trip.id, name: "Museum", category: "museum", weatherDependent: false, kidSuitability: 5, status: "liked" } });

    const day = await request(app.getHttpServer()).post(`/trips/${trip.id}/days`).send({ dayIndex: 1, baseCity: "Bergen" }).expect(201);
    await request(app.getHttpServer()).post(`/days/${day.body.id}/items`).send({ placeId: hike.id }).expect(201);
    const backups = await request(app.getHttpServer()).post(`/trips/${trip.id}/days/${day.body.id}/backups`).expect(201);
    expect(backups.body[0].name).toBe("Museum");

    const board = await request(app.getHttpServer()).get(`/trips/${trip.id}/board`).expect(200);
    expect(board.body[0].items[0].place.name).toBe("Hike");
  });
});
```

- [ ] **Step 10: Run e2e, verify pass; enable CORS**

In `apps/api/src/main.ts` add `app.enableCors({ origin: "http://localhost:5173" });` before `listen`.
Run: `pnpm --filter api test:e2e itinerary`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(api): itinerary days/items + weather backup suggestions"
```

---

### Task 10: Web — API client, query hooks, trips page

**Files:**
- Create: `apps/web/src/api/client.ts`, `apps/web/src/api/hooks.ts`
- Create: `apps/web/src/test/handlers.ts`, modify `apps/web/src/test/setup.ts`
- Create: `apps/web/src/routes/TripsPage.tsx`, `apps/web/src/App.tsx` (router), `apps/web/src/main.tsx`
- Test: `apps/web/src/routes/TripsPage.test.tsx`

**Interfaces:**
- Consumes: backend REST from Tasks 5–9; types from `@trip/shared`.
- Produces:
  - `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch<T>(path, body)`, `api.del(path)` in `client.ts` (base `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`).
  - hooks: `useTrips()`, `useCreateTrip()`, `useTrip(id)`, `useProfile(id)`, `usePostIntake(id)`, `useRunResearch(id)`, `usePlaces(id, status?)`, `useSetPlaceStatus()`, `useBoard(id)`, `useCreateDay(id)`, `useAddItem()`, `useSuggestBackups(id)`.

- [ ] **Step 1: Install router + failing TripsPage test (MSW)**

```bash
pnpm --filter web add react-router-dom
```

`apps/web/src/test/handlers.ts`:
```ts
import { http, HttpResponse } from "msw";
const base = "http://localhost:3000";
export const handlers = [
  http.get(`${base}/trips`, () => HttpResponse.json([
    { id: "t1", name: "Norway", destination: "Norway", daysMin: 7, daysMax: 10, routeType: "open" },
  ])),
  http.post(`${base}/trips`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ id: "t2", ...body }, { status: 201 });
  }),
];
```

`apps/web/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`apps/web/src/routes/TripsPage.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TripsPage } from "./TripsPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TripsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TripsPage", () => {
  it("renders trips from the API", async () => {
    renderPage();
    expect(await screen.findByText("Norway")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter web test TripsPage`
Expected: FAIL — cannot find `./TripsPage`.

- [ ] **Step 3: Implement client + hooks + page**

`apps/web/src/api/client.ts`:
```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(path: string) => fetch(`${BASE}${path}`).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }).then((r) => handle<T>(r)),
  patch: <T>(path: string, body: unknown) =>
    fetch(`${BASE}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => handle<T>(r)),
  del: (path: string) => fetch(`${BASE}${path}`, { method: "DELETE" }).then((r) => handle<void>(r)),
};
```

`apps/web/src/api/hooks.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CreateTripInput, TravelerProfile, PlaceStatus } from "@trip/shared";

export interface Trip { id: string; name: string; destination: string; daysMin: number; daysMax: number; routeType: string; }
export interface Place { id: string; name: string; category: string; description: string; lat: number | null; lng: number | null; photoUrl: string | null; kidSuitability: number; difficulty: string; weatherDependent: boolean; status: PlaceStatus; }
export interface BoardDay { id: string; dayIndex: number; baseCity: string; items: { id: string; place: Place }[]; }

export const useTrips = () => useQuery({ queryKey: ["trips"], queryFn: () => api.get<Trip[]>("/trips") });
export const useTrip = (id: string) => useQuery({ queryKey: ["trip", id], queryFn: () => api.get<Trip>(`/trips/${id}`) });

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTripInput) => api.post<Trip>("/trips", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export const useProfile = (id: string) =>
  useQuery({ queryKey: ["profile", id], queryFn: () => api.get<TravelerProfile>(`/trips/${id}/profile`) });

export function usePostIntake(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.post<{ reply: string; profile: TravelerProfile }>(`/trips/${id}/intake/messages`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", id] }),
  });
}

export function useRunResearch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ created: number }>(`/trips/${id}/research`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places", id] }),
  });
}

export const usePlaces = (id: string, status?: PlaceStatus) =>
  useQuery({ queryKey: ["places", id, status ?? "all"], queryFn: () => api.get<Place[]>(`/trips/${id}/places${status ? `?status=${status}` : ""}`) });

export function useSetPlaceStatus(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { placeId: string; status: PlaceStatus }) => api.patch<Place>(`/places/${v.placeId}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places", tripId] }),
  });
}

export const useBoard = (id: string) => useQuery({ queryKey: ["board", id], queryFn: () => api.get<BoardDay[]>(`/trips/${id}/board`) });

export function useCreateDay(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { dayIndex: number; baseCity: string }) => api.post<BoardDay>(`/trips/${id}/days`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", id] }),
  });
}

export function useAddItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { dayId: string; placeId: string }) => api.post(`/days/${v.dayId}/items`, { placeId: v.placeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", tripId] }),
  });
}

export const useSuggestBackups = (tripId: string) => {
  return useMutation({ mutationFn: (dayId: string) => api.post<Place[]>(`/trips/${tripId}/days/${dayId}/backups`) });
};
```

`apps/web/src/routes/TripsPage.tsx`:
```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTrips, useCreateTrip } from "../api/hooks";

export function TripsPage() {
  const { data: trips } = useTrips();
  const create = useCreateTrip();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");

  return (
    <div>
      <h1>Trips</h1>
      <ul>
        {trips?.map((t) => (
          <li key={t.id}><Link to={`/trips/${t.id}`}>{t.name}</Link> — {t.destination}</li>
        ))}
      </ul>
      <form onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ name, destination, dateWindowStart: null, dateWindowEnd: null, daysMin: 7, daysMax: 10, routeType: "open", notes: "" });
        setName(""); setDestination("");
      }}>
        <input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Trip name" />
        <input aria-label="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
```

`apps/web/src/App.tsx`:
```tsx
import { Routes, Route } from "react-router-dom";
import { TripsPage } from "./routes/TripsPage";
import { IntakePage } from "./routes/IntakePage";
import { DiscoverPage } from "./routes/DiscoverPage";
import { ItineraryPage } from "./routes/ItineraryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TripsPage />} />
      <Route path="/trips/:id" element={<IntakePage />} />
      <Route path="/trips/:id/discover" element={<DiscoverPage />} />
      <Route path="/trips/:id/itinerary" element={<ItineraryPage />} />
    </Routes>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

Create minimal placeholder route components so the app compiles (they are fully implemented in Tasks 11–12):
`apps/web/src/routes/IntakePage.tsx`, `DiscoverPage.tsx`, `ItineraryPage.tsx` each:
```tsx
export function IntakePage() { return <div>Intake</div>; }
```
(name the export to match each file: `IntakePage`, `DiscoverPage`, `ItineraryPage`.)

- [ ] **Step 4: Run TripsPage test, verify pass**

Run: `pnpm --filter web test TripsPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): api client, query hooks, trips page"
```

---

### Task 11: Web — Intake chat page

**Files:**
- Create: `apps/web/src/components/ChatBox.tsx`, `apps/web/src/components/ProfilePanel.tsx`
- Modify: `apps/web/src/routes/IntakePage.tsx`
- Modify: `apps/web/src/test/handlers.ts`
- Test: `apps/web/src/routes/IntakePage.test.tsx`

**Interfaces:**
- Consumes: `usePostIntake(id)`, `useProfile(id)`, `useRunResearch(id)`.
- Produces: `IntakePage` renders chat history (local state), a `ProfilePanel` reflecting the latest profile, and a "Run research" button (enabled when `profile.completed`) that navigates to `/trips/:id/discover`.

- [ ] **Step 1: Add MSW handlers + failing test**

Append to `apps/web/src/test/handlers.ts`:
```ts
import { http as http2, HttpResponse as R2 } from "msw";
const base2 = "http://localhost:3000";
handlers.push(
  http2.get(`${base2}/trips/:id/profile`, () => R2.json({
    partyAdults: 2, partyKids: 1, kidsAges: [7], maxHikeKm: 5, maxHikeElevationM: 200,
    pace: "moderate", interests: ["beaches"], dislikes: [], completed: false,
  })),
  http2.post(`${base2}/trips/:id/intake/messages`, () => R2.json({
    reply: "How old are your kids?",
    profile: { partyAdults: 2, partyKids: 1, kidsAges: [7], maxHikeKm: 5, maxHikeElevationM: 200,
      pace: "moderate", interests: ["beaches"], dislikes: [], completed: true },
  }, { status: 201 })),
);
```
(Refactor: keep a single `handlers` array exported; this shows the added entries.)

`apps/web/src/routes/IntakePage.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IntakePage } from "./IntakePage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1"]}>
        <Routes><Route path="/trips/:id" element={<IntakePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("IntakePage", () => {
  it("sends a message and shows the assistant reply", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("message"), { target: { value: "family of 3" } });
    fireEvent.click(screen.getByText("Send"));
    expect(await screen.findByText("How old are your kids?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter web test IntakePage`
Expected: FAIL — `IntakePage` is still the placeholder (no "Send" button).

- [ ] **Step 3: Implement components + page**

`apps/web/src/components/ChatBox.tsx`:
```tsx
import { useState } from "react";

export interface ChatMsg { role: "user" | "assistant"; content: string; }

export function ChatBox({ messages, onSend }: { messages: ChatMsg[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <ul>{messages.map((m, i) => <li key={i}><b>{m.role}:</b> {m.content}</li>)}</ul>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text); setText(""); } }}>
        <input aria-label="message" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

`apps/web/src/components/ProfilePanel.tsx`:
```tsx
import type { TravelerProfile } from "@trip/shared";

export function ProfilePanel({ profile }: { profile?: TravelerProfile }) {
  if (!profile) return <div>No profile yet</div>;
  return (
    <aside>
      <h3>Profile {profile.completed ? "✓" : "(in progress)"}</h3>
      <p>Adults: {profile.partyAdults}, Kids: {profile.partyKids} ({profile.kidsAges.join(", ")})</p>
      <p>Max hike: {profile.maxHikeKm ?? "?"} km / {profile.maxHikeElevationM ?? "?"} m</p>
      <p>Pace: {profile.pace ?? "?"}</p>
      <p>Interests: {profile.interests.join(", ")}</p>
    </aside>
  );
}
```

`apps/web/src/routes/IntakePage.tsx`:
```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatBox, ChatMsg } from "../components/ChatBox";
import { ProfilePanel } from "../components/ProfilePanel";
import { useProfile, usePostIntake } from "../api/hooks";
import type { TravelerProfile } from "@trip/shared";

export function IntakePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: initialProfile } = useProfile(id);
  const post = usePostIntake(id);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [profile, setProfile] = useState<TravelerProfile | undefined>();
  const current = profile ?? initialProfile;

  const send = async (text: string) => {
    setMessages((m) => [...m, { role: "user", content: text }]);
    const res = await post.mutateAsync(text);
    setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    setProfile(res.profile);
  };

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h1>Plan your trip</h1>
        <ChatBox messages={messages} onSend={send} />
      </div>
      <div>
        <ProfilePanel profile={current} />
        <button disabled={!current?.completed} onClick={() => navigate(`/trips/${id}/discover`)}>
          Run research
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter web test IntakePage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): intake chat page with live profile panel"
```

---

### Task 12: Web — Discover (map + cards) and Itinerary board

**Files:**
- Create: `apps/web/src/components/PlaceCard.tsx`, `apps/web/src/components/MapView.tsx`, `apps/web/src/components/DayColumn.tsx`
- Modify: `apps/web/src/routes/DiscoverPage.tsx`, `apps/web/src/routes/ItineraryPage.tsx`
- Modify: `apps/web/src/test/handlers.ts`
- Test: `apps/web/src/routes/DiscoverPage.test.tsx`, `apps/web/src/routes/ItineraryPage.test.tsx`

**Interfaces:**
- Consumes: `usePlaces`, `useSetPlaceStatus`, `useRunResearch`, `useBoard`, `useCreateDay`, `useAddItem`, `useSuggestBackups`.
- Produces: `DiscoverPage` (map + cards + like/reject/maybe + "Run research" + link to itinerary); `ItineraryPage` (day columns, add liked place to a day, show weather flag + "Suggest backup"). `MapView` renders Google markers only when an API key is present; tests assert on the card list, not the map canvas.

- [ ] **Step 1: Add handlers + failing Discover test**

Append to `apps/web/src/test/handlers.ts`:
```ts
handlers.push(
  http2.get(`${base2}/trips/:id/places`, () => R2.json([
    { id: "p1", name: "Fløyen", category: "hike", description: "hill", lat: 60.4, lng: 5.3,
      photoUrl: null, kidSuitability: 5, difficulty: "easy", weatherDependent: true, status: "new" },
  ])),
  http2.patch(`${base2}/places/:placeId`, async ({ request }) => {
    const b = (await request.json()) as any;
    return R2.json({ id: "p1", name: "Fløyen", status: b.status });
  }),
  http2.post(`${base2}/trips/:id/research`, () => R2.json({ created: 1 }, { status: 201 })),
);
```

`apps/web/src/routes/DiscoverPage.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DiscoverPage } from "./DiscoverPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/discover"]}>
        <Routes><Route path="/trips/:id/discover" element={<DiscoverPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DiscoverPage", () => {
  it("shows a place card and likes it", async () => {
    renderPage();
    expect(await screen.findByText("Fløyen")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Like")[0]);
    // mutation fires; card still present
    expect(await screen.findByText("Fløyen")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter web test DiscoverPage`
Expected: FAIL — placeholder `DiscoverPage` has no "Fløyen"/"Like".

- [ ] **Step 3: Implement components + DiscoverPage**

`apps/web/src/components/PlaceCard.tsx`:
```tsx
import type { Place } from "../api/hooks";
import type { PlaceStatus } from "@trip/shared";

export function PlaceCard({ place, onStatus }: { place: Place; onStatus: (s: PlaceStatus) => void }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 8, borderRadius: 8 }}>
      {place.photoUrl && <img src={place.photoUrl} alt={place.name} width={120} />}
      <h4>{place.name} {place.weatherDependent ? "🌦" : ""}</h4>
      <p>{place.category} · {place.difficulty} · kids {place.kidSuitability}/5</p>
      <p>{place.description}</p>
      <button onClick={() => onStatus("liked")}>Like</button>
      <button onClick={() => onStatus("maybe")}>Maybe</button>
      <button onClick={() => onStatus("rejected")}>Reject</button>
    </div>
  );
}
```

`apps/web/src/components/MapView.tsx`:
```tsx
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import type { Place } from "../api/hooks";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function MapView({ places }: { places: Place[] }) {
  const pts = places.filter((p) => p.lat != null && p.lng != null);
  if (!KEY) return <div data-testid="map-disabled">Map disabled (no API key)</div>;
  const center = pts[0] ? { lat: pts[0].lat!, lng: pts[0].lng! } : { lat: 60.4, lng: 5.3 };
  return (
    <APIProvider apiKey={KEY}>
      <div style={{ height: 400 }}>
        <Map defaultcenter={center} defaultZoom={7} mapId="trip">
          {pts.map((p) => <AdvancedMarker key={p.id} position={{ lat: p.lat!, lng: p.lng! }} />)}
        </Map>
      </div>
    </APIProvider>
  );
}
```

`apps/web/src/routes/DiscoverPage.tsx`:
```tsx
import { Link, useParams } from "react-router-dom";
import { usePlaces, useSetPlaceStatus, useRunResearch } from "../api/hooks";
import { PlaceCard } from "../components/PlaceCard";
import { MapView } from "../components/MapView";

export function DiscoverPage() {
  const { id = "" } = useParams();
  const { data: places } = usePlaces(id);
  const setStatus = useSetPlaceStatus(id);
  const research = useRunResearch(id);

  return (
    <div>
      <h1>Discover</h1>
      <button onClick={() => research.mutate()} disabled={research.isPending}>Run research</button>
      <Link to={`/trips/${id}/itinerary`} style={{ marginLeft: 12 }}>Go to itinerary →</Link>
      <MapView places={places ?? []} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {places?.map((p) => (
          <PlaceCard key={p.id} place={p} onStatus={(s) => setStatus.mutate({ placeId: p.id, status: s })} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run Discover test, verify pass**

Run: `pnpm --filter web test DiscoverPage`
Expected: PASS (no API key in test env → `MapView` renders the disabled stub, cards still show).

- [ ] **Step 5: Add board handlers + failing Itinerary test**

Append to `apps/web/src/test/handlers.ts`:
```ts
handlers.push(
  http2.get(`${base2}/trips/:id/board`, () => R2.json([
    { id: "d1", dayIndex: 1, baseCity: "Bergen", items: [
      { id: "i1", place: { id: "p1", name: "Fløyen", category: "hike", description: "",
        lat: 60.4, lng: 5.3, photoUrl: null, kidSuitability: 5, difficulty: "easy",
        weatherDependent: true, status: "liked" } },
    ] },
  ])),
  http2.post(`${base2}/trips/:id/days/:dayId/backups`, () => R2.json([
    { id: "p2", name: "Museum", category: "museum", description: "", lat: 60.4, lng: 5.3,
      photoUrl: null, kidSuitability: 5, difficulty: "easy", weatherDependent: false, status: "liked" },
  ])),
);
```

`apps/web/src/routes/ItineraryPage.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ItineraryPage } from "./ItineraryPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/itinerary"]}>
        <Routes><Route path="/trips/:id/itinerary" element={<ItineraryPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ItineraryPage", () => {
  it("shows a day with a weather item and suggests a backup", async () => {
    renderPage();
    expect(await screen.findByText(/Fløyen/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Suggest backup"));
    expect(await screen.findByText(/Museum/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `pnpm --filter web test ItineraryPage`
Expected: FAIL — placeholder page.

- [ ] **Step 7: Implement DayColumn + ItineraryPage**

`apps/web/src/components/DayColumn.tsx`:
```tsx
import { useState } from "react";
import type { BoardDay, Place } from "../api/hooks";

export function DayColumn({ day, onSuggestBackup }: { day: BoardDay; onSuggestBackup: (dayId: string) => Promise<Place[]> }) {
  const [backups, setBackups] = useState<Place[]>([]);
  const hasWeather = day.items.some((i) => i.place.weatherDependent);
  return (
    <div style={{ border: "1px solid #ddd", padding: 8, minWidth: 200 }}>
      <h3>Day {day.dayIndex} — {day.baseCity}</h3>
      <ul>{day.items.map((i) => <li key={i.id}>{i.place.name} {i.place.weatherDependent ? "🌦" : ""}</li>)}</ul>
      {hasWeather && (
        <button onClick={async () => setBackups(await onSuggestBackup(day.id))}>Suggest backup</button>
      )}
      {backups.length > 0 && (
        <div><b>Backups:</b><ul>{backups.map((b) => <li key={b.id}>{b.name}</li>)}</ul></div>
      )}
    </div>
  );
}
```

`apps/web/src/routes/ItineraryPage.tsx`:
```tsx
import { useParams } from "react-router-dom";
import { useBoard, useCreateDay, useSuggestBackups } from "../api/hooks";
import { DayColumn } from "../components/DayColumn";

export function ItineraryPage() {
  const { id = "" } = useParams();
  const { data: board } = useBoard(id);
  const createDay = useCreateDay(id);
  const suggest = useSuggestBackups(id);
  const nextIndex = (board?.length ?? 0) + 1;

  return (
    <div>
      <h1>Itinerary</h1>
      <button onClick={() => createDay.mutate({ dayIndex: nextIndex, baseCity: "" })}>Add day</button>
      <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
        {board?.map((day) => (
          <DayColumn key={day.id} day={day} onSuggestBackup={(dayId) => suggest.mutateAsync(dayId)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run Itinerary test, verify pass; run full suites**

Run:
```bash
pnpm --filter web test
pnpm --filter api test && pnpm --filter api test:e2e
pnpm --filter @trip/shared test
```
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(web): discover map+cards and itinerary board with backups"
```

---

### Task 13: Deploy to Railway

**Files:**
- Create: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`
- Create: `railway.json` (root), `.dockerignore`
- Modify: `apps/api/src/main.ts` (CORS origin from env, listen on `process.env.PORT`)
- Modify: `apps/web/src/api/client.ts` (already reads `VITE_API_URL` — confirm)

**Interfaces:**
- Three Railway services in one project: **Postgres** (Railway plugin), **api** (Docker, NestJS), **web** (Docker, static build via nginx).
- api reads `DATABASE_URL` (Railway injects from Postgres), `PORT`, `GEMINI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `WEB_ORIGIN`.
- web build-time `VITE_API_URL` = api public URL, `VITE_GOOGLE_MAPS_API_KEY`.

Railway has no test cycle; gate is a successful deploy + smoke check of the live URLs.

- [ ] **Step 1: Make api production-ready (PORT + CORS from env)**

`apps/api/src/main.ts`:
```ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000, "0.0.0.0");
}
bootstrap();
```

Add a release step that runs migrations on deploy. `apps/api/package.json` scripts:
```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "start:prod": "prisma migrate deploy && node dist/main.js"
  }
}
```

- [ ] **Step 2: api Dockerfile (monorepo-aware, pnpm)**

`.dockerignore` (root):
```
node_modules
**/node_modules
**/dist
.git
.env
```

`apps/api/Dockerfile`:
```dockerfile
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Install deps using the workspace manifests (api + shared)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# Copy sources and build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

EXPOSE 3000
CMD ["pnpm", "--filter", "api", "start:prod"]
```

- [ ] **Step 3: web Dockerfile (build static, serve via nginx)**

`apps/web/nginx.conf`:
```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  location / { try_files $uri $uri/ /index.html; }
}
```

`apps/web/Dockerfile`:
```dockerfile
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY
RUN pnpm --filter web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
```

Note: Vite inlines `VITE_*` at build time, so these must be passed as Docker build args on Railway (Service → Settings → Build → Build Args), not runtime vars.

- [ ] **Step 4: Provision on Railway**

```bash
npm i -g @railway/cli
railway login
railway init                       # creates project, link repo dir
railway add --plugin postgresql    # provisions Postgres, sets DATABASE_URL
```
Create two services from the repo, each pointing at its Dockerfile:
- **api** → `apps/api/Dockerfile`; reference Postgres `DATABASE_URL`; set `GEMINI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, and `WEB_ORIGIN` (web public URL).
- **web** → `apps/web/Dockerfile`; build args `VITE_API_URL` (api public URL) + `VITE_GOOGLE_MAPS_API_KEY`.

Set api variables:
```bash
railway variables --service api --set GEMINI_API_KEY=... --set BRAVE_API_KEY=... --set GOOGLE_MAPS_API_KEY=... --set WEB_ORIGIN=https://<web>.up.railway.app
```

`railway.json` (root, build defaults):
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE" }
}
```

- [ ] **Step 5: Deploy + smoke check**

```bash
railway up --service api
railway up --service web
```
After both deploy green:
- `curl https://<api>.up.railway.app/trips` → returns `[]` or existing trips (200, JSON).
- Open `https://<web>.up.railway.app` → create a trip, run intake, confirm it talks to the api (network tab hits api URL, CORS ok).
- Confirm `prisma migrate deploy` ran in api logs (tables exist on Railway Postgres).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Dockerfiles and Railway deployment config for api and web"
```

---

## Verification

End-to-end manual check after all tasks:

1. Start Postgres; ensure `trip_planner` migrated (`cd apps/api && pnpm exec prisma migrate deploy`).
2. Fill `.env` with real `GEMINI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`.
3. `pnpm dev:api` (port 3000) and `pnpm dev:web` (port 5173).
4. Browser: create a "Norway" trip → intake chat answers kids ages / hike limits / interests until profile shows ✓ → "Run research" → Discover shows pins on Google Map + cards → Like several, Reject some → Itinerary: add days, see weather-dependent items flagged, "Suggest backup" returns indoor liked places.
5. Repeat for a "Malaga" 5-day trip to sanity-check profile-driven results differ.
6. DB spot-check: `psql trip_planner -c "select name, lat, lng, status from \"Place\" limit 10;"`.
7. Automated: `pnpm test` green across `shared` (Vitest), `api` (Jest unit + Supertest e2e), `web` (Vitest + RTL + MSW). All AI calls in tests are stubbed — no network.
8. Deploy (Task 13): both Railway services green; live `https://<api>…/trips` returns JSON and the live web app drives the full loop against the deployed api.

## Self-Review Notes
- Spec coverage: intake interview (T6), agent auto-search research (T7), curate like/reject (T8), Google Map (T11/T12 `MapView`), day-by-day itinerary (T9/T12), weather backups (T9 `rankBackups` + T12). Trips multi-destination supported via free-text `destination` + `routeType`. ✓
- Out-of-scope items (flights, live weather, on-trip mode, paste-link) intentionally absent. ✓
- Type consistency: `ResearchPlace`, `TravelerProfile`, `Place`, `BoardDay`, `PlaceStatus`, `TimeSlot` names match across api + web + shared. Backup ranking uses `id` exclusion + `kidSuitability` sort in both `backup.ts` and its spec. ✓
