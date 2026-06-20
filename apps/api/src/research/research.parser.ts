import { ResearchPlace, TravelerProfile } from "@trip/shared";

export function buildQueries(destination: string, profile: TravelerProfile): string[] {
  const kidWord = profile.partyKids > 0 ? "family kid-friendly" : "best";
  const base = [
    `${kidWord} things to do in ${destination}`,
    `${kidWord} day hikes in ${destination}`,
    `top museums and attractions in ${destination} with kids`,
    `best beaches in ${destination}`,
  ];
  for (const interest of profile.interests) {
    base.push(`${kidWord} ${interest} in ${destination}`);
  }
  return [...new Set(base)];
}

export function dedupePlaces(
  existing: { name: string; lat: number | null; lng: number | null }[],
  incoming: ResearchPlace[],
): ResearchPlace[] {
  const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));
  const out: ResearchPlace[] = [];
  for (const p of incoming) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
