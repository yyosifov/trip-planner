import { describe, it, expect } from "vitest";
import { TravelerProfileSchema } from "./profile";

describe("TravelerProfileSchema", () => {
  it("accepts a complete profile", () => {
    const p = TravelerProfileSchema.parse({
      partyAdults: 2, partyKids: 2, kidsAges: [5, 8],
      maxHikeKm: 6, maxHikeElevationM: 300, pace: "moderate",
      interests: ["hikes", "beaches"], dislikes: ["long drives"], completed: true,
    });
    expect(p.kidsAges).toEqual([5, 8]);
  });

  it("rejects negative party size", () => {
    expect(() => TravelerProfileSchema.parse({
      partyAdults: -1, partyKids: 0, kidsAges: [], maxHikeKm: null,
      maxHikeElevationM: null, pace: null, interests: [], dislikes: [], completed: false,
    })).toThrow();
  });
});
