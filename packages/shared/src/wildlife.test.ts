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
