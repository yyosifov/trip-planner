import { ItineraryService } from "./itinerary.service";

describe("ItineraryService.suggestBackups", () => {
  it("suggests indoor liked places for a day with weather-dependent items", async () => {
    const prismaMock = {
      itineraryDay: {
        findUnique: jest.fn().mockResolvedValue({
          id: "d1",
          items: [{ place: { id: "hike1", weatherDependent: true, kidSuitability: 5 } }],
        }),
      },
      place: {
        findMany: jest.fn().mockResolvedValue([
          { id: "hike1", weatherDependent: true, kidSuitability: 5 },
          { id: "museumB", weatherDependent: false, kidSuitability: 5 },
        ]),
      },
    };
    const svc = new ItineraryService(prismaMock as never);
    const out = await svc.suggestBackups("t1", "d1");
    expect(out.map((p) => p.id)).toEqual(["museumB"]);
  });
});
