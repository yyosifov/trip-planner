import { MapsPort } from "./ports";

type FetchFn = typeof fetch;

export class MapsProvider implements MapsPort {
  constructor(
    private key = process.env.GOOGLE_MAPS_API_KEY ?? "",
    private fetchFn: FetchFn = fetch,
  ) {}

  async geocode(query: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.key}`;
    const res = await this.fetchFn(url);
    const body = (await res.json()) as { status: string; results: { geometry: { location: { lat: number; lng: number } } }[] };
    if (body.status !== "OK" || !body.results?.length) return null;
    const loc = body.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }

  async photoUrl(query: string) {
    const find = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos&key=${this.key}`;
    const res = await this.fetchFn(find);
    const body = (await res.json()) as { candidates?: { photos?: { photo_reference: string }[] }[] };
    const ref = body.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${ref}&key=${this.key}`;
  }
}
