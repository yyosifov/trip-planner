import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PlacesService } from "../places/places.service";
import { ResearchService } from "../research/research.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchPort } from "../ai/ports";
import { PlaceStatus } from "@trip/shared";

export const makeSearchWebTool = (search: SearchPort) =>
  tool(
    async ({ query }: { query: string }) => {
      const results = await search.search(query, 5);
      return results.map((r) => `${r.title}: ${r.description}`).join("\n\n");
    },
    {
      name: "searchWeb",
      description:
        "Search the web for travel info, destination advice, weather patterns, packing tips, or anything the user asks about.",
      schema: z.object({ query: z.string().describe("search query") }),
    },
  );

export const makeUpdateProfileTool = (prisma: PrismaService, tripId: string) =>
  tool(
    async ({ changes }: { changes: {
      maxHikeKm?: number;
      maxHikeElevationM?: number;
      pace?: string;
      interests?: string[];
      dislikes?: string[];
      extra?: Record<string, unknown>;
    } }) => {
      const profile = await prisma.travelerProfile.findUnique({ where: { tripId } });
      const currentExtra = (profile?.extra ?? {}) as Record<string, unknown>;
      const { extra, ...typedChanges } = changes;
      await prisma.travelerProfile.updateMany({
        where: { tripId },
        data: {
          ...typedChanges,
          extra: { ...currentExtra, ...(extra ?? {}) },
        },
      });
      return "Profile updated.";
    },
    {
      name: "updateProfile",
      description:
        "Update traveler profile when user expresses preferences or constraints. Use `extra` for anything without a dedicated field.",
      schema: z.object({
        changes: z.object({
          maxHikeKm: z.number().optional(),
          maxHikeElevationM: z.number().optional(),
          pace: z.string().optional(),
          interests: z.array(z.string()).optional(),
          dislikes: z.array(z.string()).optional(),
          extra: z.record(z.unknown()).optional(),
        }),
      }),
    },
  );

export const makeRunResearchTool = (research: ResearchService, tripId: string) =>
  tool(
    async () => {
      const result = await research.run(tripId);
      return `Research complete. Added ${result.created} new places.`;
    },
    {
      name: "runResearch",
      description:
        "Run a new web research pass to find more places matching the traveler profile. Use when the user wants more options or after updating preferences.",
      schema: z.object({}),
    },
  );

export const makeSetPlaceStatusTool = (places: PlacesService) =>
  tool(
    async ({ placeId, status }: { placeId: string; status: string }) => {
      await places.setStatus(placeId, status as PlaceStatus);
      return `Place ${placeId} marked as ${status}.`;
    },
    {
      name: "setPlaceStatus",
      description: "Mark a place as liked, maybe, rejected, or new when the user expresses a preference.",
      schema: z.object({
        placeId: z.string().describe("The place ID"),
        status: z.enum(["liked", "maybe", "rejected", "new"]),
      }),
    },
  );

export const makeSetTripDatesTool = (prisma: PrismaService, tripId: string) =>
  tool(
    async ({ start, end }: { start: string; end: string }) => {
      await prisma.trip.update({
        where: { id: tripId },
        data: { dateWindowStart: new Date(start), dateWindowEnd: new Date(end) },
      });
      return `Trip dates set to ${start} → ${end}.`;
    },
    {
      name: "setTripDates",
      description: "Set or update the trip date window when the user mentions travel dates.",
      schema: z.object({
        start: z.string().describe("ISO date string YYYY-MM-DD"),
        end: z.string().describe("ISO date string YYYY-MM-DD"),
      }),
    },
  );
