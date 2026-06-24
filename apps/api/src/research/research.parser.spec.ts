import { buildQueries, buildSegmentedQueries, dedupePlaces } from "./research.parser";

const PROFILE_KIDS = {
  partyAdults: 2, partyKids: 2, kidsAges: [5, 8], maxHikeKm: 6, maxHikeElevationM: 300,
  pace: "moderate" as const, interests: ["hikes", "waterfalls"], dislikes: [], completed: true,
};
const PROFILE_ADULT = {
  partyAdults: 2, partyKids: 0, kidsAges: [], maxHikeKm: 15, maxHikeElevationM: 1000,
  pace: "packed" as const, interests: ["photography"], dislikes: [], completed: true,
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
    expect(result[0].segment).toBeNull();
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
