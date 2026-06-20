import { z } from "zod";

export const PaceSchema = z.enum(["relaxed", "moderate", "packed"]);

export const TravelerProfileSchema = z.object({
  partyAdults: z.number().int().min(0),
  partyKids: z.number().int().min(0),
  kidsAges: z.array(z.number().int().min(0).max(18)),
  maxHikeKm: z.number().min(0).nullable(),
  maxHikeElevationM: z.number().min(0).nullable(),
  pace: PaceSchema.nullable(),
  interests: z.array(z.string()),
  dislikes: z.array(z.string()),
  completed: z.boolean(),
});
export type TravelerProfile = z.infer<typeof TravelerProfileSchema>;
