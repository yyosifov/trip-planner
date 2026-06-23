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
