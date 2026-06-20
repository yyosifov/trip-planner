import { MapsProvider } from "./maps.provider";

describe("MapsProvider", () => {
  it("returns null when status is ZERO_RESULTS", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });
    const m = new MapsProvider("KEY", fetchFn as never);
    expect(await m.geocode("nowhere xyz")).toBeNull();
  });

  it("parses lat/lng from OK geocode", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => ({
        status: "OK",
        results: [{ geometry: { location: { lat: 60.4, lng: 5.3 } } }],
      }),
    });
    const m = new MapsProvider("KEY", fetchFn as never);
    expect(await m.geocode("Bergen")).toEqual({ lat: 60.4, lng: 5.3 });
  });
});
