import { WildlifeService } from "./wildlife.service";

const prismaMock = {
  trip: { findUnique: jest.fn() },
  place: { findMany: jest.fn() },
  travelerProfile: { findUnique: jest.fn() },
  wildlifeReport: { upsert: jest.fn(), findUnique: jest.fn() },
};
const geminiMock = { chat: jest.fn(), extractJson: jest.fn() };

describe("WildlifeService", () => {
  let svc: WildlifeService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new WildlifeService(prismaMock as never, geminiMock as never);
    prismaMock.trip.findUnique.mockResolvedValue({
      id: "t1", destination: "Bergen",
      dateWindowStart: new Date(Date.UTC(2026, 6, 1)), dateWindowEnd: null,
    });
    prismaMock.place.findMany.mockResolvedValue([{ id: "p1", name: "Fløyen", category: "hike" }]);
    prismaMock.travelerProfile.findUnique.mockResolvedValue({ kidsAges: [7] });
    prismaMock.wildlifeReport.upsert.mockImplementation(({ create, update }: never) =>
      Promise.resolve({ id: "w1", tripId: "t1", ...(create ?? update) }),
    );
  });

  it("builds a prompt with destination and season, then upserts the validated report", async () => {
    geminiMock.extractJson.mockResolvedValue({
      summary: "Alpine fauna",
      species: [{ name: "Golden eagle", type: "bird", funFact: "big", kidAppeal: 5 }],
      seasonal: [], safety: [], perPlace: [],
    });
    const report = await svc.generate("t1");
    const [prompt, schema] = geminiMock.extractJson.mock.calls[0];
    expect(prompt).toContain("Bergen");
    expect(prompt).toContain("summer");
    expect(schema).toHaveProperty("type", "object");
    expect(prismaMock.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: "t1", category: { in: ["hike", "sight", "beach", "activity"] } } }),
    );
    expect(report.data.species[0].name).toBe("Golden eagle");
    expect(prismaMock.wildlifeReport.upsert).toHaveBeenCalled();
  });

  it("falls back to an empty report when Gemini returns junk", async () => {
    geminiMock.extractJson.mockResolvedValue({ species: [{ type: "bird" }] }); // missing required name
    const report = await svc.generate("t1");
    expect(report.data.species).toEqual([]);
    expect(report.data.summary).toBe("");
  });

  it("get() reads the stored report", async () => {
    prismaMock.wildlifeReport.findUnique.mockResolvedValue({ id: "w1", tripId: "t1", data: {} });
    const r = await svc.get("t1");
    expect(r?.id).toBe("w1");
    expect(prismaMock.wildlifeReport.findUnique).toHaveBeenCalledWith({ where: { tripId: "t1" } });
  });
});
