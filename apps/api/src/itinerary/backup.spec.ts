import { rankBackups } from "./backup";

const place = (over: Partial<{ id: string; weatherDependent: boolean; kidSuitability: number }>) => ({
  id: "x", weatherDependent: false, kidSuitability: 3, ...over,
});

describe("rankBackups", () => {
  it("returns indoor liked places sorted by kidSuitability desc, excluding weather items", () => {
    const weatherItems = [place({ id: "hike1", weatherDependent: true })];
    const liked = [
      place({ id: "hike1", weatherDependent: true, kidSuitability: 5 }),
      place({ id: "beach", weatherDependent: true, kidSuitability: 4 }),
      place({ id: "museumA", weatherDependent: false, kidSuitability: 2 }),
      place({ id: "museumB", weatherDependent: false, kidSuitability: 5 }),
    ];
    const out = rankBackups(weatherItems, liked);
    expect(out.map((p) => p.id)).toEqual(["museumB", "museumA"]);
  });
});
