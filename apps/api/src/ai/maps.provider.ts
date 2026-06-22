import { MapsPort } from "./ports";

type FetchFn = typeof fetch;

export class MapsProvider implements MapsPort {
  constructor(
    private key = process.env.GOOGLE_MAPS_API_KEY ?? "",
    private fetchFn: FetchFn = fetch,
  ) {}

  async geocode(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await this.fetchFn(url, { headers: { "User-Agent": "trip-planner-app/1.0" } });
    const body = (await res.json()) as { lat: string; lon: string }[];
    if (!body.length) return null;
    return { lat: parseFloat(body[0].lat), lng: parseFloat(body[0].lon) };
  }

  async photoUrl(_query: string) {
    // Google Places Photo API requires billing — skipped for now
    return null;
  }
}
