# Waypoints & Route-Scoped Research Design

**Date:** 2026-06-23  
**Status:** Approved

## Problem

`Trip.destination` is a free-text string (e.g. "Norway"). Research fires generic country-level queries and returns places scattered across the entire country. A user landing in Oslo who wants to drive to Bergen and back has no way to constrain research to that corridor, and no way to express the route structure at all.

## Goal

Allow a trip to carry an ordered list of waypoint cities and a max-driving-hours-per-day budget. Research uses these to fire per-segment queries and tag each discovered place with the leg it belongs to. The Discover page gains a segment filter so the user can explore each leg independently.

---

## Data Model

### New model: `Waypoint`

```prisma
model Waypoint {
  id     String  @id @default(cuid())
  trip   Trip    @relation(fields: [tripId], references: [id], onDelete: Cascade)
  tripId String
  city   String
  order  Int         // 0-indexed position in the route
  lat    Float?      // populated later via Nominatim geocoding
  lng    Float?
}
```

### Changes to `Trip`

```prisma
waypoints              Waypoint[]
maxDrivingHoursPerDay  Float?
```

`routeType` already exists (`roundtrip / oneway / open`) — no change needed.  
`destination` stays as the region/country label used for display and as fallback when no waypoints exist.

### Changes to `Place`

```prisma
segment  String?   // e.g. "Oslo→Flåm", "Bergen", null for legacy places
```

Null on all existing places — backward compatible.

---

## Trip Creation Form

**New fields added to `TripsPage` form:**

### Route type selector
Dropdown: `Roundtrip | One-way | Open (no fixed route)`.  
When `roundtrip` is selected, the end city input is locked to mirror the start city automatically.

### Waypoints builder
Dynamic ordered list of city text inputs:

```
Start:  [Oslo        ]
Stop 1: [Flåm        ] ✕
Stop 2: [Bergen      ] ✕
End:    [Oslo        ]   ← auto-filled + locked when routeType = roundtrip
        [+ Add stop  ]
```

- "+" adds a new blank stop before the end city
- ✕ removes a stop
- Up/down arrows reorder intermediate stops
- City names are plain strings — no geocoding on entry

### Max driving per day
Optional number input: `[ 3 ] hours/day`. Stored as `maxDrivingHoursPerDay`. Passed as context to Gemini in research prompts and future itinerary planning. Not enforced as a hard filter in this iteration.

### Shared schema changes
`CreateTripInput` (in `packages/shared/src/trip.ts`) gains:

```ts
waypoints: z.array(z.object({ city: z.string(), order: z.number() })).default([]),
maxDrivingHoursPerDay: z.number().nullable().default(null),
```

The `routeType` field already exists in the schema — the UI just needs to expose it.

---

## Research Changes

### `buildSegmentedQueries(waypoints, destination, profile)`

Replaces the flat `buildQueries`. Returns `{ segment: string; queries: string[] }[]`.

**Segment derivation** from `[Oslo, Flåm, Bergen, Oslo]`:

| Segment | Type | Queries example |
|---|---|---|
| `Oslo→Flåm` | leg | "things to do between Oslo and Flåm Norway", "scenic stops Oslo to Flåm drive" |
| `Flåm` | hub stop | "things to do in Flåm Norway", "kid-friendly activities Flåm" |
| `Flåm→Bergen` | leg | "things to do between Flåm and Bergen Norway" |
| `Bergen` | hub stop | "things to do in Bergen Norway", "day hikes Bergen" |
| `Bergen→Oslo` | leg | "scenic stops Bergen to Oslo drive" |

Rules:
- Every consecutive pair of waypoints → one leg segment
- Every **intermediate** waypoint (not the first, not the last) → one hub segment
- For **roundtrip** trips: start/end city also gets a hub segment (user likely has arrival and departure day activities there)
- For **one-way** trips: start city gets a hub segment, end city gets a hub segment
- For **open** trips with no waypoints: fall back to destination-based queries
- Profile interests are appended as additional queries per hub segment (same as today)

**Fallback:** if `waypoints` is empty, call original `buildQueries(destination, profile)` — zero regression.

### `ResearchService.run()` changes

Loop over segments instead of a single query batch:

```
for each { segment, queries } of segmentedQueries:
  fire Brave searches for this segment's queries
  extract places with Gemini
  geocode + create Place records with segment = segment label
```

`Place.segment` is set to the segment string at creation time.

---

## Discover Page Changes

A third filter row added to the left panel, below category and status:

```
Segment: [ all ] [ Oslo→Flåm ] [ Flåm ] [ Flåm→Bergen ] [ Bergen ] [ Bergen→Oslo ]
```

- Populated dynamically from distinct `segment` values on the trip's places
- Works in combination with existing category and status filters
- Segment label appears as an extra small badge on each `PlaceCard`
- Places with `segment = null` (legacy) appear under "all" only, no badge shown
- Hidden entirely when all places have `segment = null` (existing trips unaffected)

---

## What's Out of Scope

- Per-leg transport mode (car vs train vs ferry) — future addition to `Waypoint`
- Hard enforcement of `maxDrivingHoursPerDay` as a place filter — passed as Gemini context only
- Geocoding waypoints at creation time — done lazily at research time via Nominatim
- Reordering waypoints via drag-and-drop — up/down arrows only for now

---

## Migration

Existing `Trip` records have no waypoints and `segment = null` on all places. No data migration needed. Research on existing trips continues to use `destination`-based queries unchanged.

New `Waypoint` table requires a Prisma migration (`pnpm db:migrate`).
