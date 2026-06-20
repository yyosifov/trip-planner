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
];
