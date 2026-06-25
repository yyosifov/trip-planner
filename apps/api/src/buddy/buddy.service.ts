import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ResearchService } from "../research/research.service";
import { PlacesService } from "../places/places.service";
import { SEARCH, SearchPort } from "../ai/ports";
import { invokeAgentWithFallback, buildSystemPrompt, extractActions } from "./buddy.graph";
import {
  makeSearchWebTool,
  makeUpdateProfileTool,
  makeRunResearchTool,
  makeSetPlaceStatusTool,
  makeSetTripDatesTool,
} from "./buddy.tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BuddyAction, BuddySuggestion } from "@trip/shared";

@Injectable()
export class BuddyService {
  constructor(
    private prisma: PrismaService,
    private research: ResearchService,
    private places: PlacesService,
    @Inject(SEARCH) private search: SearchPort,
  ) {}

  async postMessage(tripId: string, content: string): Promise<{ reply: string; actions: BuddyAction[] }> {
    const [trip, profile, recentPlaces, history] = await Promise.all([
      this.prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: { waypoints: { orderBy: { order: "asc" } } },
      }),
      this.prisma.travelerProfile.findUnique({ where: { tripId } }),
      this.prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.buddyMessage.findMany({
        where: { tripId },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
    ]);

    const userMsg = await this.prisma.buddyMessage.create({ data: { tripId, role: "user", content } });

    let reply: string;
    let actions: BuddyAction[];

    try {
      const systemPrompt = buildSystemPrompt(trip, profile, recentPlaces);
      const tools = [
        makeSearchWebTool(this.search),
        makeUpdateProfileTool(this.prisma, tripId),
        makeRunResearchTool(this.research, tripId),
        makeSetPlaceStatusTool(this.places),
        makeSetTripDatesTool(this.prisma, tripId),
      ];

      // Simplified: prior tool call/result messages are omitted — sufficient for single-turn ReAct history
      const lcHistory = history.map((m) =>
        m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content),
      );
      const result = await invokeAgentWithFallback(tools, systemPrompt, [...lcHistory, new HumanMessage(content)]);

      const lastMsg = result.messages.at(-1);
      reply =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? "");
      actions = extractActions(result.messages);
    } catch (e) {
      await this.prisma.buddyMessage.delete({ where: { id: userMsg.id } });
      if (e instanceof Error && (e.message.includes("429") || e.message.includes("quota"))) {
        throw new ServiceUnavailableException("AI quota exceeded — please try again in a minute.");
      }
      throw e;
    }

    await this.prisma.buddyMessage.create({
      data: { tripId, role: "assistant", content: reply, actions: actions as object[] },
    });

    return { reply, actions };
  }

  async getMessages(tripId: string) {
    return this.prisma.buddyMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, actions: true },
    });
  }

  async getSuggestion(tripId: string): Promise<BuddySuggestion> {
    const [places, recentRun] = await Promise.all([
      this.prisma.place.findMany({
        where: { tripId, status: "liked" },
        select: { category: true, status: true },
      }),
      this.prisma.researchRun.findFirst({
        where: { tripId, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      }),
    ]);

    if (recentRun) return { hasSuggestion: false };

    const counts: Record<string, number> = {};
    for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;
    const topEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topEntry || topEntry[1] < 3) return { hasSuggestion: false };

    return {
      hasSuggestion: true,
      preview: `You've liked ${topEntry[1]} ${topEntry[0]} spots — want more?`,
    };
  }
}
