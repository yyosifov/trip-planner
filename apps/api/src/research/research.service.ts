import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntakeService } from "../intake/intake.service";
import { GEMINI, SEARCH, MAPS, GeminiPort, SearchPort, MapsPort } from "../ai/ports";
import { ResearchPlace, ResearchPlaceSchema } from "@trip/shared";
import { buildQueries, dedupePlaces } from "./research.parser";

const PLACES_SCHEMA = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["hike", "activity", "museum", "beach", "food", "sight", "other"] },
          description: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "moderate", "hard"] },
          kidSuitability: { type: "integer" },
          estDurationMin: { type: "integer" },
          weatherDependent: { type: "boolean" },
          sourceUrl: { type: ["string", "null"] },
          sourceType: { type: "string", enum: ["web", "article", "video", "social"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "category", "difficulty", "kidSuitability", "weatherDependent"],
      },
    },
  },
  required: ["places"],
};

@Injectable()
export class ResearchService {
  constructor(
    private prisma: PrismaService,
    private intake: IntakeService,
    @Inject(SEARCH) private search: SearchPort,
    @Inject(GEMINI) private gemini: GeminiPort,
    @Inject(MAPS) private maps: MapsPort,
  ) {}

  async run(tripId: string) {
    const profile = await this.intake.getProfile(tripId);
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    const destination = trip?.destination ?? "";
    const queries = buildQueries(destination, profile);

    const run = await this.prisma.researchRun.create({
      data: { tripId, queries, status: "running" },
    });

    try {
      const rawResults = await Promise.all(queries.map((q) => this.search.search(q, 6)));
      const results = rawResults.flat();

      const snippet = results
        .slice(0, 30)
        .map((r) => `- ${r.title} (${r.url}): ${r.description}`)
        .join("\n");

      const prompt =
        `From these search results about ${destination}, extract distinct real places to visit ` +
        `for a family (${profile.partyKids} kids, ages ${profile.kidsAges.join(",")}, ` +
        `max hike ${profile.maxHikeKm ?? "?"}km). ` +
        `Set weatherDependent true for outdoor places. Return JSON.\n${snippet}`;

      const extracted = await this.gemini.extractJson<{ places: unknown[] }>(prompt, PLACES_SCHEMA);

      const incoming: ResearchPlace[] = (extracted.places ?? [])
        .map((p) => ResearchPlaceSchema.safeParse(p))
        .filter((r) => r.success)
        .map((r) => (r as { success: true; data: ResearchPlace }).data);

      const existing = await this.prisma.place.findMany({
        where: { tripId },
        select: { name: true, lat: true, lng: true },
      });

      const fresh = dedupePlaces(existing, incoming);
      const created = [];

      for (const p of fresh) {
        const geo = await this.maps.geocode(`${p.name}, ${destination}`);
        const photoUrl = await this.maps.photoUrl(`${p.name}, ${destination}`);
        created.push(
          await this.prisma.place.create({
            data: {
              tripId,
              name: p.name,
              category: p.category,
              description: p.description,
              lat: geo?.lat ?? null,
              lng: geo?.lng ?? null,
              photoUrl,
              sourceUrl: p.sourceUrl,
              sourceType: p.sourceType,
              estDurationMin: p.estDurationMin,
              difficulty: p.difficulty,
              kidSuitability: p.kidSuitability,
              weatherDependent: p.weatherDependent,
              tags: p.tags,
              raw: p as object,
              status: "new",
            },
          }),
        );
      }

      await this.prisma.researchRun.update({
        where: { id: run.id },
        data: { status: "done", stats: { created: created.length } },
      });

      return { runId: run.id, created: created.length, places: created };
    } catch (e) {
      await this.prisma.researchRun.update({
        where: { id: run.id },
        data: { status: "error", error: String((e as Error)?.message ?? e) },
      });
      throw e;
    }
  }
}
