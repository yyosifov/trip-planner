# Wildlife & Fauna Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand, AI-generated Wildlife tab that shows the animals/fauna common to a trip's hiking areas — what to spot (fun), seasonal notes, and safety info — at both trip and per-place level.

**Architecture:** A new NestJS `wildlife` module (controller + service + pure prompt parser) calls the existing `GeminiPort.extractJson` with Gemini knowledge only, validates the result with a shared Zod schema, and upserts a single 1:1 `WildlifeReport` row per trip. The React app gets a new `/trips/:id/wildlife` route with a Generate button that POSTs, then renders the stored report.

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), Zod 3, React + react-router-dom, @tanstack/react-query, MSW + Vitest (web), Jest + ts-jest (api).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-22-wildlife-fauna-info-design.md`. Every task implicitly inherits its decisions.
- Storage: a single `WildlifeReport` row per trip (1:1), upserted on each generate. Per-place notes live inside the JSON payload, keyed by `placeId`. No FK from notes to Place.
- Data source: Gemini knowledge only — no Brave search, no web fetch.
- Shared types live in `packages/shared/src/`, exported from `index.ts`, consumed as `@trip/shared`. Jest (api) and Vite (web) alias `@trip/shared` to the package **source**, so a rebuild is not required for tests — but Prisma client must be regenerated after the schema change.
- Outdoor place categories for per-place notes: `hike`, `sight`, `beach`, `activity`.
- Follow existing patterns exactly: `research` module (backend), shared `place.ts` schema, `api/hooks.ts` + MSW handlers + route page tests (web).
- Commit after every task.

---

### Task 1: Shared Zod schema + types

**Files:**
- Create: `packages/shared/src/wildlife.ts`
- Create: `packages/shared/src/wildlife.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `WildlifeDataSchema` (Zod), and types `WildlifeData`, `SpeciesToSpot`, `SafetyItem`, `SeasonalNote`, `PerPlaceNote`, `SpeciesType`, `RiskLevel`. `WildlifeDataSchema.parse({})` returns a fully-defaulted empty report (summary `""`, all arrays `[]`). Item schemas require a non-empty `name`/`animal`; all other fields default.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/wildlife.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WildlifeDataSchema, SpeciesToSpotSchema } from "./wildlife";

describe("WildlifeDataSchema", () => {
  it("parses empty object into a defaulted empty report", () => {
    const r = WildlifeDataSchema.parse({});
    expect(r.summary).toBe("");
    expect(r.species).toEqual([]);
    expect(r.seasonal).toEqual([]);
    expect(r.safety).toEqual([]);
    expect(r.perPlace).toEqual([]);
  });

  it("parses a full report", () => {
    const r = WildlifeDataSchema.parse({
      summary: "Alpine fauna",
      species: [{ name: "Golden eagle", type: "bird", funFact: "Huge wingspan", kidAppeal: 5 }],
      seasonal: [{ window: "spring", note: "ticks active" }],
      safety: [{ animal: "Adder", risk: "medium", danger: "venomous bite", whatToDo: "keep distance" }],
      perPlace: [{ placeId: "p1", placeName: "Trail", species: [], safety: [] }],
    });
    expect(r.species[0].type).toBe("bird");
    expect(r.safety[0].risk).toBe("medium");
    expect(r.perPlace[0].placeId).toBe("p1");
  });

  it("defaults optional species fields", () => {
    const s = SpeciesToSpotSchema.parse({ name: "Fox", type: "mammal" });
    expect(s.funFact).toBe("");
    expect(s.kidAppeal).toBe(3);
  });

  it("rejects a species with empty name", () => {
    expect(() => SpeciesToSpotSchema.parse({ name: "", type: "mammal" })).toThrow();
  });

  it("rejects an invalid risk level", () => {
    expect(() =>
      WildlifeDataSchema.parse({ safety: [{ animal: "X", risk: "extreme" }] }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @trip/shared exec vitest run src/wildlife.test.ts`
Expected: FAIL — cannot resolve `./wildlife`.

- [ ] **Step 3: Write the schema**

Create `packages/shared/src/wildlife.ts`:

```ts
import { z } from "zod";

export const SpeciesTypeSchema = z.enum([
  "bird", "mammal", "reptile", "insect", "amphibian", "other",
]);
export type SpeciesType = z.infer<typeof SpeciesTypeSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const SpeciesToSpotSchema = z.object({
  name: z.string().min(1),
  type: SpeciesTypeSchema,
  funFact: z.string().default(""),
  kidAppeal: z.number().int().min(1).max(5).default(3),
});
export type SpeciesToSpot = z.infer<typeof SpeciesToSpotSchema>;

export const SafetyItemSchema = z.object({
  animal: z.string().min(1),
  risk: RiskLevelSchema,
  danger: z.string().default(""),
  whatToDo: z.string().default(""),
});
export type SafetyItem = z.infer<typeof SafetyItemSchema>;

export const SeasonalNoteSchema = z.object({
  window: z.string().default(""),
  note: z.string().default(""),
});
export type SeasonalNote = z.infer<typeof SeasonalNoteSchema>;

export const PerPlaceNoteSchema = z.object({
  placeId: z.string().default(""),
  placeName: z.string().default(""),
  species: z.array(SpeciesToSpotSchema).default([]),
  safety: z.array(SafetyItemSchema).default([]),
});
export type PerPlaceNote = z.infer<typeof PerPlaceNoteSchema>;

export const WildlifeDataSchema = z.object({
  summary: z.string().default(""),
  species: z.array(SpeciesToSpotSchema).default([]),
  seasonal: z.array(SeasonalNoteSchema).default([]),
  safety: z.array(SafetyItemSchema).default([]),
  perPlace: z.array(PerPlaceNoteSchema).default([]),
});
export type WildlifeData = z.infer<typeof WildlifeDataSchema>;
```

- [ ] **Step 4: Export from the package index**

Modify `packages/shared/src/index.ts` — add this line after the existing `export * from "./itinerary";`:

```ts
export * from "./wildlife";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @trip/shared exec vitest run src/wildlife.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Rebuild the shared package (keeps dist in sync for any consumer that reads it)**

Run: `pnpm --filter @trip/shared build`
Expected: exits 0, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/wildlife.ts packages/shared/src/wildlife.test.ts packages/shared/src/index.ts packages/shared/dist
git commit -m "feat(shared): add wildlife data zod schema and types"
```

---

### Task 2: Prisma model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<generated>/migration.sql` (created by the migrate command)

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma model `WildlifeReport { id, tripId @unique, data Json, generatedAt }` and `Trip.wildlifeReport`. Generated client exposes `prisma.wildlifeReport.upsert/findUnique`.

- [ ] **Step 1: Add the relation field to Trip**

Modify `apps/api/prisma/schema.prisma` — inside `model Trip`, add this line after `researchRuns    ResearchRun[]`:

```prisma
  wildlifeReport  WildlifeReport?
```

- [ ] **Step 2: Add the new model**

Modify `apps/api/prisma/schema.prisma` — append at the end of the file:

```prisma
model WildlifeReport {
  id          String   @id @default(cuid())
  trip        Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId      String   @unique
  data        Json     @default("{}")
  generatedAt DateTime @default(now())
}
```

- [ ] **Step 3: Create and apply the migration (dev DB)**

Run from repo root: `pnpm db:migrate -- --name add_wildlife_report`
Expected: creates `apps/api/prisma/migrations/<timestamp>_add_wildlife_report/migration.sql` containing `CREATE TABLE "WildlifeReport"`, applies it, and regenerates the Prisma client. If it prompts for a name, it was already supplied via `--name`.

- [ ] **Step 4: Verify the client regenerated**

Run: `pnpm --filter api exec prisma generate`
Expected: "Generated Prisma Client" — `prisma.wildlifeReport` now exists in types.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add WildlifeReport prisma model and migration"
```

---

### Task 3: Wildlife prompt parser (pure helpers)

**Files:**
- Create: `apps/api/src/wildlife/wildlife.parser.ts`
- Create: `apps/api/src/wildlife/wildlife.parser.spec.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces:
  - `seasonFromDates(start: Date | null, end: Date | null): string` → `"winter" | "spring" | "summer" | "autumn" | "unknown season"`.
  - `kidToneFromAges(kidsAges: number[]): string`.
  - `interface WildlifePromptInput { destination: string; dateWindowStart: Date | null; dateWindowEnd: Date | null; kidsAges: number[]; places: { id: string; name: string; category: string }[]; }`
  - `buildWildlifePrompt(input: WildlifePromptInput): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/wildlife/wildlife.parser.spec.ts`:

```ts
import { seasonFromDates, kidToneFromAges, buildWildlifePrompt } from "./wildlife.parser";

describe("seasonFromDates", () => {
  it("maps months to seasons (northern hemisphere)", () => {
    expect(seasonFromDates(new Date(Date.UTC(2026, 0, 15)), null)).toBe("winter");
    expect(seasonFromDates(new Date(Date.UTC(2026, 3, 15)), null)).toBe("spring");
    expect(seasonFromDates(new Date(Date.UTC(2026, 6, 15)), null)).toBe("summer");
    expect(seasonFromDates(new Date(Date.UTC(2026, 9, 15)), null)).toBe("autumn");
  });
  it("falls back to end date when start is null", () => {
    expect(seasonFromDates(null, new Date(Date.UTC(2026, 6, 1)))).toBe("summer");
  });
  it("returns unknown when no dates", () => {
    expect(seasonFromDates(null, null)).toBe("unknown season");
  });
});

describe("kidToneFromAges", () => {
  it("mentions kid ages when present", () => {
    expect(kidToneFromAges([6, 9])).toContain("6, 9");
  });
  it("handles no kids", () => {
    expect(kidToneFromAges([]).toLowerCase()).toContain("no kids");
  });
});

describe("buildWildlifePrompt", () => {
  it("includes destination, season and place ids", () => {
    const p = buildWildlifePrompt({
      destination: "Bergen",
      dateWindowStart: new Date(Date.UTC(2026, 6, 1)),
      dateWindowEnd: null,
      kidsAges: [7],
      places: [{ id: "p1", name: "Fløyen", category: "hike" }],
    });
    expect(p).toContain("Bergen");
    expect(p).toContain("summer");
    expect(p).toContain("p1");
    expect(p).toContain("Fløyen");
  });
  it("handles no places", () => {
    const p = buildWildlifePrompt({
      destination: "Bergen", dateWindowStart: null, dateWindowEnd: null,
      kidsAges: [], places: [],
    });
    expect(p).toContain("no specific places");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api exec jest src/wildlife/wildlife.parser.spec.ts`
Expected: FAIL — cannot find module `./wildlife.parser`.

- [ ] **Step 3: Write the parser**

Create `apps/api/src/wildlife/wildlife.parser.ts`:

```ts
export interface WildlifePromptInput {
  destination: string;
  dateWindowStart: Date | null;
  dateWindowEnd: Date | null;
  kidsAges: number[];
  places: { id: string; name: string; category: string }[];
}

export function seasonFromDates(start: Date | null, end: Date | null): string {
  const d = start ?? end;
  if (!d) return "unknown season";
  const m = d.getUTCMonth(); // 0 = Jan
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

export function kidToneFromAges(kidsAges: number[]): string {
  if (kidsAges.length === 0) return "Keep it general; no kids are on this trip.";
  return `Explain it in a way that is fun and understandable for kids aged ${kidsAges.join(", ")}.`;
}

export function buildWildlifePrompt(input: WildlifePromptInput): string {
  const season = seasonFromDates(input.dateWindowStart, input.dateWindowEnd);
  const tone = kidToneFromAges(input.kidsAges);
  const placeList = input.places.length
    ? input.places.map((p) => `- ${p.id}: ${p.name} (${p.category})`).join("\n")
    : "(no specific places yet)";
  return (
    `You are a naturalist. Describe the wildlife and fauna common to the hiking and ` +
    `outdoor areas around ${input.destination} during ${season}. ${tone}\n` +
    `Return JSON with: summary (2-3 sentences); species (animals worth spotting, each ` +
    `with name, type, funFact, kidAppeal 1-5); seasonal (notes tied to ${season}); ` +
    `safety (dangerous animals, each with animal, risk low/medium/high, danger, whatToDo); ` +
    `and perPlace notes keyed to these places by their exact id:\n${placeList}\n` +
    `For each perPlace entry set placeId to the exact id shown above. Only include ` +
    `places where wildlife is notable.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api exec jest src/wildlife/wildlife.parser.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wildlife/wildlife.parser.ts apps/api/src/wildlife/wildlife.parser.spec.ts
git commit -m "feat(api): add wildlife prompt parser helpers"
```

---

### Task 4: Wildlife service

**Files:**
- Create: `apps/api/src/wildlife/wildlife.service.ts`
- Create: `apps/api/src/wildlife/wildlife.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `GeminiPort` (token `GEMINI` from `../ai/ports`), `buildWildlifePrompt` (Task 3), `WildlifeDataSchema`/`WildlifeData` (Task 1), `prisma.wildlifeReport` (Task 2).
- Produces:
  - `WildlifeService.generate(tripId: string): Promise<WildlifeReport row>` — loads trip + outdoor places + profile, builds prompt, calls `gemini.extractJson(prompt, WILDLIFE_SCHEMA)`, validates via `WildlifeDataSchema.safeParse` (empty-report fallback), upserts the row.
  - `WildlifeService.get(tripId: string): Promise<WildlifeReport row | null>`.
  - Exported `WILDLIFE_SCHEMA` (plain object schema passed to Gemini).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/wildlife/wildlife.service.spec.ts`:

```ts
import { WildlifeService } from "./wildlife.service";

const prismaMock = {
  trip: { findUnique: jest.fn() },
  place: { findMany: jest.fn() },
  travelerProfile: { findUnique: jest.fn() },
  wildlifeReport: { upsert: jest.fn(), findUnique: jest.fn() },
};
const geminiMock = { chat: jest.fn(), extractJson: jest.fn() };

describe("WildlifeService", () => {
  let svc: WildlifeService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new WildlifeService(prismaMock as never, geminiMock as never);
    prismaMock.trip.findUnique.mockResolvedValue({
      id: "t1", destination: "Bergen",
      dateWindowStart: new Date(Date.UTC(2026, 6, 1)), dateWindowEnd: null,
    });
    prismaMock.place.findMany.mockResolvedValue([{ id: "p1", name: "Fløyen", category: "hike" }]);
    prismaMock.travelerProfile.findUnique.mockResolvedValue({ kidsAges: [7] });
    prismaMock.wildlifeReport.upsert.mockImplementation(({ create, update }: never) =>
      Promise.resolve({ id: "w1", tripId: "t1", ...(create ?? update) }),
    );
  });

  it("builds a prompt with destination and season, then upserts the validated report", async () => {
    geminiMock.extractJson.mockResolvedValue({
      summary: "Alpine fauna",
      species: [{ name: "Golden eagle", type: "bird", funFact: "big", kidAppeal: 5 }],
      seasonal: [], safety: [], perPlace: [],
    });
    const report = await svc.generate("t1");
    const [prompt, schema] = geminiMock.extractJson.mock.calls[0];
    expect(prompt).toContain("Bergen");
    expect(prompt).toContain("summer");
    expect(schema).toHaveProperty("type", "object");
    expect(prismaMock.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: "t1", category: { in: ["hike", "sight", "beach", "activity"] } } }),
    );
    expect(report.data.species[0].name).toBe("Golden eagle");
    expect(prismaMock.wildlifeReport.upsert).toHaveBeenCalled();
  });

  it("falls back to an empty report when Gemini returns junk", async () => {
    geminiMock.extractJson.mockResolvedValue({ species: [{ type: "bird" }] }); // missing required name
    const report = await svc.generate("t1");
    expect(report.data.species).toEqual([]);
    expect(report.data.summary).toBe("");
  });

  it("get() reads the stored report", async () => {
    prismaMock.wildlifeReport.findUnique.mockResolvedValue({ id: "w1", tripId: "t1", data: {} });
    const r = await svc.get("t1");
    expect(r?.id).toBe("w1");
    expect(prismaMock.wildlifeReport.findUnique).toHaveBeenCalledWith({ where: { tripId: "t1" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api exec jest src/wildlife/wildlife.service.spec.ts`
Expected: FAIL — cannot find module `./wildlife.service`.

- [ ] **Step 3: Write the service**

Create `apps/api/src/wildlife/wildlife.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GEMINI, GeminiPort } from "../ai/ports";
import { WildlifeData, WildlifeDataSchema } from "@trip/shared";
import { buildWildlifePrompt } from "./wildlife.parser";

const OUTDOOR_CATEGORIES = ["hike", "sight", "beach", "activity"];

const SPECIES_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: ["bird", "mammal", "reptile", "insect", "amphibian", "other"] },
    funFact: { type: "string" },
    kidAppeal: { type: "integer" },
  },
  required: ["name", "type"],
};
const SAFETY_SCHEMA = {
  type: "object",
  properties: {
    animal: { type: "string" },
    risk: { type: "string", enum: ["low", "medium", "high"] },
    danger: { type: "string" },
    whatToDo: { type: "string" },
  },
  required: ["animal", "risk"],
};

export const WILDLIFE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    species: { type: "array", items: SPECIES_SCHEMA },
    seasonal: {
      type: "array",
      items: {
        type: "object",
        properties: { window: { type: "string" }, note: { type: "string" } },
      },
    },
    safety: { type: "array", items: SAFETY_SCHEMA },
    perPlace: {
      type: "array",
      items: {
        type: "object",
        properties: {
          placeId: { type: "string" },
          placeName: { type: "string" },
          species: { type: "array", items: SPECIES_SCHEMA },
          safety: { type: "array", items: SAFETY_SCHEMA },
        },
      },
    },
  },
  required: ["summary"],
};

@Injectable()
export class WildlifeService {
  constructor(
    private prisma: PrismaService,
    @Inject(GEMINI) private gemini: GeminiPort,
  ) {}

  async generate(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    const places = await this.prisma.place.findMany({
      where: { tripId, category: { in: OUTDOOR_CATEGORIES } },
      select: { id: true, name: true, category: true },
    });
    const profile = await this.prisma.travelerProfile.findUnique({ where: { tripId } });

    const prompt = buildWildlifePrompt({
      destination: trip?.destination ?? "",
      dateWindowStart: trip?.dateWindowStart ?? null,
      dateWindowEnd: trip?.dateWindowEnd ?? null,
      kidsAges: (profile?.kidsAges as number[]) ?? [],
      places,
    });

    const raw = await this.gemini.extractJson<unknown>(prompt, WILDLIFE_SCHEMA);
    const parsed = WildlifeDataSchema.safeParse(raw);
    const data: WildlifeData = parsed.success ? parsed.data : WildlifeDataSchema.parse({});

    return this.prisma.wildlifeReport.upsert({
      where: { tripId },
      create: { tripId, data: data as object, generatedAt: new Date() },
      update: { data: data as object, generatedAt: new Date() },
    });
  }

  async get(tripId: string) {
    return this.prisma.wildlifeReport.findUnique({ where: { tripId } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api exec jest src/wildlife/wildlife.service.spec.ts`
Expected: PASS (3 tests).

Note: the upsert mock returns `{ ...create }`, so `report.data` is the parsed `WildlifeData` object (not stringified) — the assertions read `report.data.species` directly.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wildlife/wildlife.service.ts apps/api/src/wildlife/wildlife.service.spec.ts
git commit -m "feat(api): add wildlife service with gemini generation and validation"
```

---

### Task 5: Wildlife controller + module wiring + e2e

**Files:**
- Create: `apps/api/src/wildlife/wildlife.controller.ts`
- Create: `apps/api/src/wildlife/wildlife.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/wildlife.e2e-spec.ts`

**Interfaces:**
- Consumes: `WildlifeService` (Task 4).
- Produces: HTTP `POST /trips/:id/wildlife` (generate → report) and `GET /trips/:id/wildlife` (report | null). `WildlifeModule` registered in `AppModule`.

- [ ] **Step 1: Write the controller**

Create `apps/api/src/wildlife/wildlife.controller.ts`:

```ts
import { Controller, Get, Param, Post } from "@nestjs/common";
import { WildlifeService } from "./wildlife.service";

@Controller("trips/:id")
export class WildlifeController {
  constructor(private wildlife: WildlifeService) {}

  @Post("wildlife")
  generate(@Param("id") id: string) {
    return this.wildlife.generate(id);
  }

  @Get("wildlife")
  get(@Param("id") id: string) {
    return this.wildlife.get(id);
  }
}
```

- [ ] **Step 2: Write the module**

Create `apps/api/src/wildlife/wildlife.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { WildlifeService } from "./wildlife.service";
import { WildlifeController } from "./wildlife.controller";

@Module({
  providers: [WildlifeService],
  controllers: [WildlifeController],
})
export class WildlifeModule {}
```

(`PrismaModule` and `AiModule` are `@Global()`, so no imports are needed here — same as other modules that use them.)

- [ ] **Step 3: Register the module in AppModule**

Modify `apps/api/src/app.module.ts`:

1. Add an import near the other module imports (after the `ItineraryModule` import line):

```ts
import { WildlifeModule } from './wildlife/wildlife.module';
```

2. Add `WildlifeModule,` to the `imports` array, after `ItineraryModule,`.

- [ ] **Step 4: Write the e2e test**

Create `apps/api/test/wildlife.e2e-spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AiModule } from "../src/ai/ai.module";
import { StubAiModule } from "./utils/stub-ai.module";
import { resetTestDb } from "./utils/test-db";

describe("Wildlife (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetTestDb();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(AiModule)
      .useModule(StubAiModule)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it("POST then GET /trips/:id/wildlife round-trips an (empty) report", async () => {
    const trip = await request(app.getHttpServer())
      .post("/trips")
      .send({
        name: "Norway", destination: "Norway", dateWindowStart: null,
        dateWindowEnd: null, daysMin: 7, daysMax: 10, routeType: "open", notes: "",
      })
      .expect(201);
    const id = trip.body.id;

    await request(app.getHttpServer())
      .post(`/trips/${id}/wildlife`)
      .expect(201)
      .expect((r) => {
        expect(r.body.tripId).toBe(id);
        expect(r.body.data.summary).toBe("");
        expect(r.body.data.species).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/trips/${id}/wildlife`)
      .expect(200)
      .expect((r) => expect(r.body.tripId).toBe(id));
  });

  it("GET returns null for a trip with no report", async () => {
    const trip = await request(app.getHttpServer())
      .post("/trips")
      .send({
        name: "Empty", destination: "Empty", dateWindowStart: null,
        dateWindowEnd: null, daysMin: 1, daysMax: 2, routeType: "open", notes: "",
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/trips/${trip.body.id}/wildlife`)
      .expect(200)
      .expect((r) => expect(r.body).toEqual({}));
  });
});
```

(The stub `extractJson` returns `{}`, which `WildlifeDataSchema.safeParse` turns into a fully-defaulted empty report. A `null` body serializes to an empty `200` body, asserted as `{}`.)

- [ ] **Step 5: Run unit + e2e tests**

Run: `pnpm --filter api exec jest src/wildlife`
Expected: PASS (parser + service specs).

Run: `pnpm --filter api test:e2e wildlife`
Expected: PASS (2 e2e cases). Requires the test DB to exist and migrations to apply (handled by `resetTestDb`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/wildlife/wildlife.controller.ts apps/api/src/wildlife/wildlife.module.ts apps/api/src/app.module.ts apps/api/test/wildlife.e2e-spec.ts
git commit -m "feat(api): add wildlife controller, module wiring and e2e"
```

---

### Task 6: Web data hooks + MSW handlers

**Files:**
- Modify: `apps/web/src/api/hooks.ts`
- Modify: `apps/web/src/test/handlers.ts`

**Interfaces:**
- Consumes: `WildlifeData` type from `@trip/shared` (Task 1); `api` client; React Query.
- Produces:
  - `interface WildlifeReport { id: string; tripId: string; data: WildlifeData; generatedAt: string; }`
  - `useWildlife(id: string)` → query key `["wildlife", id]`, GET `/trips/:id/wildlife` → `WildlifeReport | null`.
  - `useGenerateWildlife(id: string)` → mutation, POST `/trips/:id/wildlife`, invalidates `["wildlife", id]`.

- [ ] **Step 1: Add the type import**

Modify `apps/web/src/api/hooks.ts` — change the existing shared import line:

```ts
import type { CreateTripInput, TravelerProfile, PlaceStatus } from "@trip/shared";
```

to:

```ts
import type { CreateTripInput, TravelerProfile, PlaceStatus, WildlifeData } from "@trip/shared";
```

- [ ] **Step 2: Add the hooks**

Modify `apps/web/src/api/hooks.ts` — append at the end of the file:

```ts
export interface WildlifeReport {
  id: string;
  tripId: string;
  data: WildlifeData;
  generatedAt: string;
}

export const useWildlife = (id: string) =>
  useQuery({
    queryKey: ["wildlife", id],
    queryFn: () => api.get<WildlifeReport | null>(`/trips/${id}/wildlife`),
  });

export function useGenerateWildlife(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<WildlifeReport>(`/trips/${id}/wildlife`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wildlife", id] }),
  });
}
```

- [ ] **Step 3: Add MSW handlers**

The web test server is configured with `onUnhandledRequest: "error"`, so both wildlife endpoints need handlers or the page tests fail. Modify `apps/web/src/test/handlers.ts` — add these two handlers inside the `handlers` array (e.g. after the existing `http.post(\`${BASE}/trips/:id/research\`, ...)` handler):

```ts
  http.get(`${BASE}/trips/:id/wildlife`, () =>
    HttpResponse.json({
      id: "w1",
      tripId: "t1",
      generatedAt: "2026-06-22T10:00:00.000Z",
      data: {
        summary: "Coastal Norwegian fauna with seabirds and the occasional moose.",
        species: [
          { name: "White-tailed eagle", type: "bird", funFact: "Europe's largest eagle", kidAppeal: 5 },
        ],
        seasonal: [{ window: "summer", note: "Puffins nest on the cliffs" }],
        safety: [{ animal: "Tick", risk: "medium", danger: "can carry disease", whatToDo: "check skin after hikes" }],
        perPlace: [
          { placeId: "p1", placeName: "Fløyen", species: [
            { name: "Red squirrel", type: "mammal", funFact: "tufted ears", kidAppeal: 4 },
          ], safety: [] },
        ],
      },
    }),
  ),
  http.post(`${BASE}/trips/:id/wildlife`, () =>
    HttpResponse.json({
      id: "w1", tripId: "t1", generatedAt: "2026-06-22T10:00:00.000Z",
      data: { summary: "Generated.", species: [], seasonal: [], safety: [], perPlace: [] },
    }, { status: 201 }),
  ),
```

- [ ] **Step 4: Type-check the web package**

Run: `pnpm --filter web exec tsc -b --noEmit` (or `pnpm --filter web build` if the project has no standalone typecheck script)
Expected: no type errors. (No behavior to unit-test yet — exercised by Task 7's page test.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/hooks.ts apps/web/src/test/handlers.ts
git commit -m "feat(web): add wildlife query/mutation hooks and msw handlers"
```

---

### Task 7: Wildlife page + route + nav links

**Files:**
- Create: `apps/web/src/routes/WildlifePage.tsx`
- Create: `apps/web/src/routes/WildlifePage.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `useWildlife`, `useGenerateWildlife`, `WildlifeReport` (Task 6); `WildlifeData` sub-types from `@trip/shared`.
- Produces: route `/trips/:id/wildlife` rendering `<WildlifePage />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/WildlifePage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WildlifePage } from "./WildlifePage";

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/trips/t1/wildlife"]}>
        <Routes>
          <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WildlifePage", () => {
  it("renders the trip-level report from the API", async () => {
    wrap();
    expect(await screen.findByText(/White-tailed eagle/)).toBeTruthy();
    expect(screen.getByText(/Puffins nest/)).toBeTruthy();
    expect(screen.getByText(/Tick/)).toBeTruthy();
  });

  it("renders per-place sections", async () => {
    wrap();
    expect(await screen.findByText(/Red squirrel/)).toBeTruthy();
    expect(screen.getByText(/Fløyen/)).toBeTruthy();
  });

  it("has a generate button", async () => {
    wrap();
    const btn = await screen.findByRole("button", { name: /generate|regenerate/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText(/White-tailed eagle/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/routes/WildlifePage.test.tsx`
Expected: FAIL — cannot resolve `./WildlifePage`.

- [ ] **Step 3: Write the page**

Create `apps/web/src/routes/WildlifePage.tsx`:

```tsx
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useWildlife, useGenerateWildlife } from "../api/hooks";
import type { SpeciesToSpot, SafetyItem, PerPlaceNote } from "@trip/shared";

const TYPE_ICON: Record<string, string> = {
  bird: "🐦", mammal: "🦊", reptile: "🦎", insect: "🐛", amphibian: "🐸", other: "🐾",
};
const RISK_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#ef4444",
};

function SpeciesCard({ s }: { s: SpeciesToSpot }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
      <div style={{ fontWeight: 600 }}>
        {TYPE_ICON[s.type] ?? "🐾"} {s.name}{" "}
        <span title={`Kid appeal: ${s.kidAppeal}/5`}>{"★".repeat(s.kidAppeal)}{"☆".repeat(5 - s.kidAppeal)}</span>
      </div>
      {s.funFact && <div style={{ fontSize: 13, color: "#555" }}>{s.funFact}</div>}
    </div>
  );
}

function SafetyRow({ s }: { s: SafetyItem }) {
  return (
    <li style={{ marginBottom: 4 }}>
      <span style={{ fontWeight: 600 }}>{s.animal}</span>{" "}
      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, color: "#fff", background: RISK_COLOR[s.risk] ?? "#6b7280" }}>
        {s.risk}
      </span>
      {s.danger && <span> — {s.danger}</span>}
      {s.whatToDo && <span style={{ color: "#555" }}> ({s.whatToDo})</span>}
    </li>
  );
}

function PerPlace({ note }: { note: PerPlaceNote }) {
  if (note.species.length === 0 && note.safety.length === 0) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <h3>{note.placeName}</h3>
      {note.species.map((s, i) => <SpeciesCard key={i} s={s} />)}
      {note.safety.length > 0 && <ul>{note.safety.map((s, i) => <SafetyRow key={i} s={s} />)}</ul>}
    </section>
  );
}

export function WildlifePage() {
  const { id = "" } = useParams();
  const { data: report, isLoading } = useWildlife(id);
  const gen = useGenerateWildlife(id);

  const onGenerate = () =>
    gen.mutate(undefined, {
      onSuccess: () => toast.success("Wildlife info generated"),
      onError: (e) => toast.error(String((e as Error)?.message ?? e)),
    });

  const data = report?.data;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 14 }}>
        <Link to={`/trips/${id}`}>Intake</Link>
        <Link to={`/trips/${id}/discover`}>Discover</Link>
        <Link to={`/trips/${id}/itinerary`}>Itinerary</Link>
        <span style={{ fontWeight: 600 }}>Wildlife</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>🦌 Wildlife & Fauna</h1>
        <button onClick={onGenerate} disabled={gen.isPending}>
          {gen.isPending ? "Generating…" : report ? "Regenerate" : "Generate wildlife info"}
        </button>
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && !report && <p>No wildlife info yet. Click “Generate wildlife info”.</p>}

      {data && (
        <>
          {data.summary && <p>{data.summary}</p>}

          {data.species.length > 0 && (
            <section>
              <h2>Spot these</h2>
              {data.species.map((s, i) => <SpeciesCard key={i} s={s} />)}
            </section>
          )}

          {data.seasonal.length > 0 && (
            <section>
              <h2>Seasonal notes</h2>
              <ul>{data.seasonal.map((n, i) => <li key={i}><b>{n.window}:</b> {n.note}</li>)}</ul>
            </section>
          )}

          {data.safety.length > 0 && (
            <section>
              <h2>⚠️ Safety</h2>
              <ul>{data.safety.map((s, i) => <SafetyRow key={i} s={s} />)}</ul>
            </section>
          )}

          {data.perPlace.length > 0 && (
            <section>
              <h2>By place</h2>
              {data.perPlace.map((n, i) => <PerPlace key={i} note={n} />)}
            </section>
          )}

          {report?.generatedAt && (
            <p style={{ fontSize: 12, color: "#888", marginTop: 24 }}>
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the route**

Modify `apps/web/src/App.tsx`:

1. Add the import after the other route imports:

```ts
import { WildlifePage } from "./routes/WildlifePage";
```

2. Add the route inside `<Routes>`, after the itinerary route:

```tsx
        <Route path="/trips/:id/wildlife" element={<WildlifePage />} />
```

- [ ] **Step 5: Run the page test**

Run: `pnpm --filter web exec vitest run src/routes/WildlifePage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Add a nav link from the Discover page**

So users can reach the new tab, modify `apps/web/src/routes/DiscoverPage.tsx` — find the existing nav/header area with `<Link>` elements (the page already imports `Link` from `react-router-dom`) and add, alongside the other trip links:

```tsx
<Link to={`/trips/${id}/wildlife`}>Wildlife</Link>
```

Use the same `id` variable the page already derives from `useParams`. Match the surrounding link styling. If the page has no existing trip-level nav links, add the link near the top header instead.

- [ ] **Step 7: Run the full web test suite to confirm nothing broke**

Run: `pnpm --filter web test`
Expected: PASS (all existing tests + the new WildlifePage tests).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/WildlifePage.tsx apps/web/src/routes/WildlifePage.test.tsx apps/web/src/App.tsx apps/web/src/routes/DiscoverPage.tsx
git commit -m "feat(web): add wildlife page, route and nav link"
```

---

## Final Verification

- [ ] Run all api tests: `pnpm --filter api test` → PASS.
- [ ] Run api e2e: `pnpm --filter api test:e2e` → PASS.
- [ ] Run all web tests: `pnpm --filter web test` → PASS.
- [ ] Manual smoke (optional): `pnpm dev`, open a trip, visit the Wildlife tab, click Generate, confirm species/seasonal/safety/per-place render.

## Self-Review Notes

- **Spec coverage:** scope both trip + per-place (Task 1 schema `species`/`safety` + `perPlace`; Task 7 renders both) ✓; content spot-fun (`species` + `kidAppeal`) + seasonal (`seasonal`) + safety (`safety`) ✓; on-demand button (Task 7 Generate) ✓; Gemini-only (Task 4 service, no SearchPort) ✓; new Wildlife tab (Task 7 route + nav) ✓; storage model A single `WildlifeReport` (Task 2) ✓; testing across shared/parser/service/e2e/page ✓.
- **Type consistency:** `WildlifeData` field names (`summary`, `species`, `seasonal`, `safety`, `perPlace`) and item field names (`name`/`type`/`funFact`/`kidAppeal`, `animal`/`risk`/`danger`/`whatToDo`, `window`/`note`, `placeId`/`placeName`) are identical across Task 1 schema, Task 4 Gemini schema + service, Task 6 hooks, Task 7 page. `useWildlife`/`useGenerateWildlife`/`WildlifeReport` names match between Task 6 and Task 7.
- **Outdoor categories** `["hike", "sight", "beach", "activity"]` match between the global constraints and Task 4 service + test.
