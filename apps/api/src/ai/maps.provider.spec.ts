import { MapsProvider } from "./maps.provider";

describe("MapsProvider", () => {
  it("returns null when Nominatim returns empty array", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => [],
    });
    const m = new MapsProvider("KEY", fetchFn as never);
    expect(await m.geocode("nowhere xyz")).toBeNull();
  });

  it("parses lat/lng from Nominatim geocode result", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      json: async () => [{ lat: "60.4", lon: "5.3" }],
    });
    const m = new MapsProvider("KEY", fetchFn as never);
    expect(await m.geocode("Bergen")).toEqual({ lat: 60.4, lng: 5.3 });
  });
});
