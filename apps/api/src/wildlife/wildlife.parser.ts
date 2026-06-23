export interface WildlifePromptInput {
  destination: string;
  dateWindowStart: Date | null;
  dateWindowEnd: Date | null;
  kidsAges: number[];
  places: { id: string; name: string; category: string }[];
}

export function seasonFromDates(start: Date | null, end: Date | null): string {
  const d = start ?? end;
  if (!d) return "unknown season";
  const m = d.getUTCMonth(); // 0 = Jan
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

export function kidToneFromAges(kidsAges: number[]): string {
  if (kidsAges.length === 0) return "Keep it general; no kids are on this trip.";
  return `Explain it in a way that is fun and understandable for kids aged ${kidsAges.join(", ")}.`;
}

export function buildWildlifePrompt(input: WildlifePromptInput): string {
  const season = seasonFromDates(input.dateWindowStart, input.dateWindowEnd);
  const tone = kidToneFromAges(input.kidsAges);
  const placeList = input.places.length
    ? input.places.map((p) => `- ${p.id}: ${p.name} (${p.category})`).join("\n")
    : "(no specific places yet)";
  return (
    `You are a naturalist. Describe the wildlife and fauna common to the hiking and ` +
    `outdoor areas around ${input.destination} during ${season}. ${tone}\n` +
    `Return JSON with: summary (2-3 sentences); species (animals worth spotting, each ` +
    `with name, type, funFact, kidAppeal 1-5); seasonal (notes tied to ${season}); ` +
    `safety (dangerous animals, each with animal, risk low/medium/high, danger, whatToDo); ` +
    `and perPlace notes keyed to these places by their exact id:\n${placeList}\n` +
    `For each perPlace entry set placeId to the exact id shown above. Only include ` +
    `places where wildlife is notable.`
  );
}
