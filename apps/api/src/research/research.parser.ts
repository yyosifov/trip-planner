import { ResearchPlace, TravelerProfile } from "@trip/shared";

export type SegmentQueries = { segment: string; queries: string[] };

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

function buildHubQueries(city: string, destination: string, profile: TravelerProfile): string[] {
  const kidWord = profile.partyKids > 0 ? "family kid-friendly" : "best";
  const base = [
    `${kidWord} things to do in ${city} ${destination}`,
    `${kidWord} day hikes near ${city}`,
  ];
  for (const interest of profile.interests.slice(0, 2)) {
    base.push(`${kidWord} ${interest} in ${city}`);
  }
  return [...new Set(base)];
}

function buildLegQueries(from: string, to: string, destination: string): string[] {
  return [
    `things to do between ${from} and ${to} ${destination}`,
    `scenic stops ${from} to ${to} drive`,
    `day trips along ${from} to ${to} route`,
  ];
}

export function buildSegmentedQueries(
  waypoints: { city: string; order: number }[],
  destination: string,
  profile: TravelerProfile,
): SegmentQueries[] {
  if (waypoints.length === 0) {
    return [{ segment: destination, queries: buildQueries(destination, profile) }];
  }

  const sorted = [...waypoints].sort((a, b) => a.order - b.order);
  const result: SegmentQueries[] = [];
  const startCity = sorted[0].city;

  result.push({ segment: startCity, queries: buildHubQueries(startCity, destination, profile) });

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i].city;
    const to = sorted[i + 1].city;

    result.push({ segment: `${from}→${to}`, queries: buildLegQueries(from, to, destination) });

    const isLast = i === sorted.length - 2;
    if (!isLast) {
      result.push({ segment: to, queries: buildHubQueries(to, destination, profile) });
    } else if (to !== startCity) {
      result.push({ segment: to, queries: buildHubQueries(to, destination, profile) });
    }
  }

  return result;
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
