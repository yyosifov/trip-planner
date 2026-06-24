import { http, HttpResponse } from "msw";

const BASE = "http://localhost:3000";

export const handlers = [
  http.get(`${BASE}/trips`, () =>
    HttpResponse.json([
      { id: "t1", name: "Norway", destination: "Norway", daysMin: 7, daysMax: 10, routeType: "open" },
    ]),
  ),
  http.post(`${BASE}/trips`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: "t2", ...body }, { status: 201 });
  }),
  http.get(`${BASE}/trips/:id`, ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Norway", destination: "Norway", daysMin: 7, daysMax: 10, routeType: "open" }),
  ),
  http.get(`${BASE}/trips/:id/intake/messages`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE}/trips/:id/profile`, () =>
    HttpResponse.json({
      partyAdults: 2, partyKids: 1, kidsAges: [7], maxHikeKm: 5, maxHikeElevationM: 200,
      pace: "moderate", interests: ["beaches"], dislikes: [], completed: false,
    }),
  ),
  http.post(`${BASE}/trips/:id/intake/messages`, () =>
    HttpResponse.json({
      reply: "How old are your kids?",
      profile: {
        partyAdults: 2, partyKids: 1, kidsAges: [7], maxHikeKm: 5, maxHikeElevationM: 200,
        pace: "moderate", interests: ["beaches"], dislikes: [], completed: true,
      },
    }, { status: 201 }),
  ),
  http.post(`${BASE}/trips/:id/research`, () =>
    HttpResponse.json({ created: 1 }, { status: 201 }),
  ),
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
  http.get(`${BASE}/trips/:id/places`, () =>
    HttpResponse.json([
      {
        id: "p1", name: "Fløyen", category: "hike", description: "funicular hill",
        lat: 60.4, lng: 5.3, photoUrl: null, kidSuitability: 5, difficulty: "easy",
        weatherDependent: true, status: "new",
      },
    ]),
  ),
  http.patch(`${BASE}/places/:placeId`, async ({ request }) => {
    const b = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: "p1", name: "Fløyen", status: b.status });
  }),
  http.get(`${BASE}/trips/:id/board`, () =>
    HttpResponse.json([
      {
        id: "d1", dayIndex: 1, baseCity: "Bergen",
        items: [{
          id: "i1",
          place: {
            id: "p1", name: "Fløyen", category: "hike", description: "",
            lat: 60.4, lng: 5.3, photoUrl: null, kidSuitability: 5,
            difficulty: "easy", weatherDependent: true, status: "liked",
          },
        }],
      },
    ]),
  ),
  http.post(`${BASE}/trips/:id/days`, async ({ request }) => {
    const b = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: "d2", dayIndex: b.dayIndex, baseCity: b.baseCity, items: [] }, { status: 201 });
  }),
  http.post(`${BASE}/days/:dayId/items`, async ({ request }) => {
    const b = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: "i2", placeId: b.placeId }, { status: 201 });
  }),
  http.post(`${BASE}/trips/:id/days/:dayId/backups`, () =>
    HttpResponse.json([
      {
        id: "p2", name: "Museum", category: "museum", description: "",
        lat: 60.4, lng: 5.3, photoUrl: null, kidSuitability: 5,
        difficulty: "easy", weatherDependent: false, status: "liked",
      },
    ]),
  ),
  http.get(`${BASE}/trips/:id/weather`, () =>
    HttpResponse.json({
      available: true,
      location: { name: "Bergen, Norway", lat: 60.39, lng: 5.32 },
      window: { start: "2027-08-10", end: "2027-08-12" },
      forecast: null,
      normals: { tMaxC: 22.3, tMinC: 14.1, precipMmAvg: 2.0, windMaxKmh: 14.5 },
      years: [
        {
          year: 2025,
          days: [
            { date: "2025-08-10", tMaxC: 23, tMinC: 15, precipMm: 0, windMaxKmh: 14 },
            { date: "2025-08-11", tMaxC: 21, tMinC: 14, precipMm: 1.2, windMaxKmh: 16 },
            { date: "2025-08-12", tMaxC: 20, tMinC: 13, precipMm: 3.0, windMaxKmh: 20 },
          ],
        },
        { year: 2024, days: [
            { date: "2024-08-10", tMaxC: 22, tMinC: 14, precipMm: 0, windMaxKmh: 12 },
            { date: "2024-08-11", tMaxC: 20, tMinC: 13, precipMm: 0.5, windMaxKmh: 10 },
            { date: "2024-08-12", tMaxC: 19, tMinC: 12, precipMm: 2.0, windMaxKmh: 11 },
          ],
        },
      ],
    }),
  ),
];
