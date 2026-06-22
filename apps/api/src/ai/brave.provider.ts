import { SearchPort, SearchResult } from "./ports";

type FetchFn = typeof fetch;

export class BraveProvider implements SearchPort {
  constructor(
    private key = process.env.BRAVE_API_KEY ?? "",
    private fetchFn: FetchFn = fetch,
  ) {}

  async search(query: string, count: number): Promise<SearchResult[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = await this.fetchFn(url, {
      headers: { "X-Subscription-Token": this.key, Accept: "application/json" },
    });
    const body = (await res.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
    return (body.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? "",
    }));
  }
}
