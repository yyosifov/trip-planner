# Wildlife & Fauna Info — Design

**Date:** 2026-06-22
**Status:** Approved, ready for implementation planning

## Summary

Add a Wildlife feature to the trip planner: on-demand, AI-generated information about
the animals and fauna common to a trip's hiking areas. Content covers wildlife worth
spotting (the fun angle for kids), seasonal notes tied to the trip dates, and safety
information about dangerous animals. Info is presented both as a trip-level overview and
as per-place notes, on a dedicated "Wildlife" tab.

## Decisions

| Question | Decision |
|---|---|
| Scope | **Both** — trip-level overview + per-place notes |
| Content focus | Wildlife to spot (fun), seasonal notes, safety / dangerous animals |
| Generation | **On-demand** — user clicks a "Generate" button |
| Data source | **Gemini knowledge only** — single structured call, no web search |
| Display | **New "Wildlife" tab** (route `/trips/:id/wildlife`) |

Explicitly out of scope (YAGNI): Brave search / citations, auto-generation during the
research run, lazy per-place fetching, user-editable notes, offline support, best-practice
behavior tips (food storage, leashing, etc.).

## Architecture & Data Flow

```
[Wildlife tab] --click "Generate"--> POST /trips/:id/wildlife
   WildlifeService.generate(tripId):
     load Trip(destination, dateWindowStart/End) + Profile(kidsAges) + Places(id,name,category)
     build prompt (season derived from dates, kid tone from ages, place list)
     gemini.extractJson(prompt, WILDLIFE_SCHEMA)   // Gemini knowledge only
     validate output with WildlifeDataSchema (Zod)
     upsert WildlifeReport { tripId, data, generatedAt }
   GET /trips/:id/wildlife --> WildlifeReport | null
[Wildlife tab] renders overview + per-place sections
```

New backend module `apps/api/src/wildlife/` mirroring `apps/api/src/research/`:
- `wildlife.controller.ts` — `@Controller("trips/:id")`, `@Post("wildlife")` generate, `@Get("wildlife")` fetch.
- `wildlife.service.ts` — orchestration; depends on `PrismaService` and `GeminiPort` (`GEMINI` token from `ai/ports.ts`).
- `wildlife.parser.ts` — small pure helpers: derive season string from date window, build kid-tone string from `kidsAges`, assemble prompt.
- `wildlife.module.ts` — imports AiModule + PrismaModule; registered in `app.module.ts`.

The chosen storage approach is a **single `WildlifeReport` row per trip** (1:1), upserted on
each regenerate. The whole report is rebuilt on every click, so a single row with the full
structured payload is the simplest fit. Per-place notes live inside the JSON payload keyed
by `placeId` (display-only; no FK join needed).

## Data Model

Prisma — new model:

```prisma
model WildlifeReport {
  id          String   @id @default(cuid())
  trip        Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId      String   @unique          // 1:1, upsert on regenerate
  data        Json     @default("{}")   // shape = WildlifeData (validated by Zod)
  generatedAt DateTime @default(now())
}
```

Add `wildlifeReport WildlifeReport?` to the `Trip` model. Requires a new migration.

Shared Zod schema in `packages/shared/src/wildlife.ts` (exported from `index.ts`), used both
to type the web app and to validate Gemini output on write:

```ts
SpeciesToSpot = {
  name: string,
  type: "bird" | "mammal" | "reptile" | "insect" | "amphibian" | "other",
  funFact: string,
  kidAppeal: 1..5,            // int
}
SafetyItem = {
  animal: string,
  risk: "low" | "medium" | "high",
  danger: string,
  whatToDo: string,
}
SeasonalNote = { window: string, note: string }   // e.g. window "spring", note "ticks active"
PerPlaceNote = {
  placeId: string,
  placeName: string,
  species: SpeciesToSpot[],
  safety: SafetyItem[],
}
WildlifeData = {
  summary: string,
  species: SpeciesToSpot[],   // trip overview — what to spot
  seasonal: SeasonalNote[],   // tied to trip dates
  safety: SafetyItem[],       // dangerous animals
  perPlace: PerPlaceNote[],   // only outdoor places (category hike/sight/beach/activity)
}
```

Notes:
- `data` is opaque `Json` in Postgres; validated by `WildlifeDataSchema` on write (defensive
  parse of Gemini output) and typed on read.
- The Gemini JSON schema passed to `extractJson` is a hand-written plain-object schema
  matching this shape (same style as `research`'s `PLACES_SCHEMA`).
- Prompt inputs: `destination`, date window → season string, `kidsAges` → tone hint
  ("explain for kids aged 6, 9"), and the filtered place list (id + name) so
  `perPlace[].placeId` maps back to real Place rows. Places with no returned note render the
  overview only.

## API

- `POST /trips/:id/wildlife` → generates (upserts) and returns the report.
- `GET /trips/:id/wildlife` → returns the stored `WildlifeReport` or `null`.

## Web UI

- `App.tsx`: add `<Route path="/trips/:id/wildlife" element={<WildlifePage />} />`.
- `api/hooks.ts`:
  - `useWildlife(id)` → `GET /trips/:id/wildlife` → `WildlifeData | null`.
  - `useGenerateWildlife(id)` → `POST` mutation; on success invalidate `["wildlife", id]`;
    sonner toast on done/error (matches existing pattern).
- `routes/WildlifePage.tsx`:
  - Header + cross-nav links to Intake / Discover / Itinerary (match existing pages).
  - "Generate wildlife info" button with pending state. Empty state when report is null.
  - **Overview**: summary text → **Spot these** species cards (name, type badge, funFact,
    kid-appeal stars) → **Seasonal** callouts → **Safety** list (animal, risk badge colored
    by low/medium/high, whatToDo).
  - **Per-place**: one section per `perPlace[]` entry (place name heading + its species +
    safety). Skipped when empty.
  - Show `generatedAt` ("Generated 2h ago"). Regenerate re-runs the POST.

## Testing

Mirror existing `research` test patterns:
- `wildlife.service.spec.ts` — mock `GeminiPort.extractJson` returning a fixture; assert the
  prompt includes destination, derived season, kid ages, and the place list; assert upsert
  is called; assert output is Zod-parsed.
- `wildlife.parser.spec.ts` — pure unit tests for season-from-dates and kid-tone string.
- `packages/shared/src/wildlife.test.ts` — Zod schema accepts valid payloads, rejects invalid.
- `apps/api/test/wildlife.e2e-spec.ts` — POST then GET round-trip with mocked Gemini.
- `apps/web/src/routes/WildlifePage.test.tsx` — renders empty state; renders report sections
  from a fixture; button click triggers the mutation.

## Implementation Order (suggested)

1. Shared Zod schema + types (`packages/shared`) + test; rebuild `@trip/shared`.
2. Prisma model + migration.
3. Backend module (parser, service, controller, module wiring) + tests.
4. Web hooks + WildlifePage + route + nav links + tests.
