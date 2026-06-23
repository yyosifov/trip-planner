import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GEMINI, GeminiPort } from "../ai/ports";
import { WildlifeData, WildlifeDataSchema } from "@trip/shared";
import { buildWildlifePrompt } from "./wildlife.parser";

const OUTDOOR_CATEGORIES = ["hike", "sight", "beach", "activity"];

const SPECIES_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: ["bird", "mammal", "reptile", "insect", "amphibian", "other"] },
    funFact: { type: "string" },
    kidAppeal: { type: "integer" },
  },
  required: ["name", "type"],
};
const SAFETY_SCHEMA = {
  type: "object",
  properties: {
    animal: { type: "string" },
    risk: { type: "string", enum: ["low", "medium", "high"] },
    danger: { type: "string" },
    whatToDo: { type: "string" },
  },
  required: ["animal", "risk"],
};

export const WILDLIFE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    species: { type: "array", items: SPECIES_SCHEMA },
    seasonal: {
      type: "array",
      items: {
        type: "object",
        properties: { window: { type: "string" }, note: { type: "string" } },
      },
    },
    safety: { type: "array", items: SAFETY_SCHEMA },
    perPlace: {
      type: "array",
      items: {
        type: "object",
        properties: {
          placeId: { type: "string" },
          placeName: { type: "string" },
          species: { type: "array", items: SPECIES_SCHEMA },
          safety: { type: "array", items: SAFETY_SCHEMA },
        },
      },
    },
  },
  required: ["summary"],
};

@Injectable()
export class WildlifeService {
  constructor(
    private prisma: PrismaService,
    @Inject(GEMINI) private gemini: GeminiPort,
  ) {}

  async generate(tripId: string) {
    const [trip, places, profile] = await Promise.all([
      this.prisma.trip.findUnique({ where: { id: tripId } }),
      this.prisma.place.findMany({
        where: { tripId, category: { in: OUTDOOR_CATEGORIES } },
        select: { id: true, name: true, category: true },
      }),
      this.prisma.travelerProfile.findUnique({ where: { tripId } }),
    ]);

    const prompt = buildWildlifePrompt({
      destination: trip?.destination ?? "",
      dateWindowStart: trip?.dateWindowStart ?? null,
      dateWindowEnd: trip?.dateWindowEnd ?? null,
      kidsAges: (profile?.kidsAges as number[]) ?? [],
      places,
    });

    const raw = await this.gemini.extractJson<unknown>(prompt, WILDLIFE_SCHEMA);
    const parsed = WildlifeDataSchema.safeParse(raw);
    const data: WildlifeData = parsed.success ? parsed.data : WildlifeDataSchema.parse({});

    return this.prisma.wildlifeReport.upsert({
      where: { tripId },
      create: { tripId, data: data as object, generatedAt: new Date() },
      update: { data: data as object, generatedAt: new Date() },
    });
  }

  async get(tripId: string) {
    return this.prisma.wildlifeReport.findUnique({ where: { tripId } });
  }
}
