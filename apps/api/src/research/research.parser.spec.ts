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
