import { describe, it, expect } from "vitest";
import { ResearchPlaceSchema } from "./place";

describe("ResearchPlaceSchema", () => {
  it("parses a research place", () => {
    const r = ResearchPlaceSchema.parse({
      name: "Trolltunga", category: "hike", description: "Iconic cliff hike",
      difficulty: "hard", kidSuitability: 2, estDurationMin: 600,
      weatherDependent: true, sourceUrl: "https://x.com", sourceType: "web", tags: ["cliff"],
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
