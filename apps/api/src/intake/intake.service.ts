import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GEMINI, GeminiPort, ChatMessage } from "../ai/ports";
import { TravelerProfile, TravelerProfileSchema } from "@trip/shared";

export const INTAKE_SYSTEM_PROMPT = `You are a family-trip intake interviewer.
Ask ONE concise question at a time to learn: number of adults and kids, each kid's age,
the max hike distance (km) and elevation gain (m) the group can handle, preferred pace
(relaxed/moderate/packed), interests, and dislikes. When you have all of these, reply with
a short confirmation that starts with the token READY.`;

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    partyAdults: { type: "integer" },
    partyKids: { type: "integer" },
    kidsAges: { type: "array", items: { type: "integer" } },
    maxHikeKm: { type: ["number", "null"] },
    maxHikeElevationM: { type: ["number", "null"] },
    pace: { type: ["string", "null"], enum: ["relaxed", "moderate", "packed", null] },
    interests: { type: "array", items: { type: "string" } },
    dislikes: { type: "array", items: { type: "string" } },
    completed: { type: "boolean" },
  },
  required: ["partyAdults", "partyKids", "kidsAges", "interests", "dislikes", "completed"],
};

@Injectable()
export class IntakeService {
  constructor(
    private prisma: PrismaService,
    @Inject(GEMINI) private gemini: GeminiPort,
  ) {}

  async postMessage(tripId: string, content: string) {
    await this.prisma.intakeMessage.create({ data: { tripId, role: "user", content } });

    const history = await this.prisma.intakeMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
    });

    const messages: ChatMessage[] = [
      { role: "system", content: INTAKE_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const reply = await this.gemini.chat(messages);
    await this.prisma.intakeMessage.create({ data: { tripId, role: "assistant", content: reply } });

    const transcript = history.map((m) => `${m.role}: ${m.content}`).join("\n") + `\nassistant: ${reply}`;
    const raw = await this.gemini.extractJson<unknown>(
      `From this trip-intake conversation, extract the traveler profile as JSON.\n${transcript}`,
      PROFILE_SCHEMA,
    );

    const parsed = TravelerProfileSchema.parse({
      maxHikeKm: null,
      maxHikeElevationM: null,
      pace: null,
      ...(raw as object),
      completed: reply.trimStart().startsWith("READY"),
    });

    const profile = await this.persistProfile(tripId, parsed);
    return { reply, profile };
  }

  private async persistProfile(tripId: string, p: TravelerProfile): Promise<TravelerProfile> {
    const data = {
      partyAdults: p.partyAdults,
      partyKids: p.partyKids,
      kidsAges: p.kidsAges,
      maxHikeKm: p.maxHikeKm,
      maxHikeElevationM: p.maxHikeElevationM,
      pace: p.pace,
      interests: p.interests,
      dislikes: p.dislikes,
      completed: p.completed,
    };
    await this.prisma.travelerProfile.upsert({
      where: { tripId },
      create: { tripId, ...data },
      update: data,
    });
    return p;
  }

  async getProfile(tripId: string): Promise<TravelerProfile> {
    const row = await this.prisma.travelerProfile.findUnique({ where: { tripId } });
    if (!row) {
      return TravelerProfileSchema.parse({
        partyAdults: 0,
        partyKids: 0,
        kidsAges: [],
        maxHikeKm: null,
        maxHikeElevationM: null,
        pace: null,
        interests: [],
        dislikes: [],
        completed: false,
      });
    }
    return TravelerProfileSchema.parse({
      partyAdults: row.partyAdults,
      partyKids: row.partyKids,
      kidsAges: row.kidsAges as number[],
      maxHikeKm: row.maxHikeKm,
      maxHikeElevationM: row.maxHikeElevationM,
      pace: row.pace as "relaxed" | "moderate" | "packed" | null,
      interests: row.interests,
      dislikes: row.dislikes,
      completed: row.completed,
    });
  }

  async getMessages(tripId: string) {
    return this.prisma.intakeMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
  }
}
