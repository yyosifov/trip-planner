import { z } from "zod";

export const BuddyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("research_run"), placesAdded: z.number() }),
  z.object({ type: z.literal("profile_updated"), changes: z.record(z.unknown()) }),
  z.object({ type: z.literal("place_status_changed"), placeId: z.string(), status: z.string() }),
  z.object({ type: z.literal("dates_updated"), start: z.string(), end: z.string() }),
  z.object({ type: z.literal("web_search"), query: z.string() }),
]);
export type BuddyAction = z.infer<typeof BuddyActionSchema>;

export const BuddyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  actions: z.array(BuddyActionSchema).optional(),
});
export type BuddyMessage = z.infer<typeof BuddyMessageSchema>;

export const BuddySuggestionSchema = z.object({
  hasSuggestion: z.boolean(),
  preview: z.string().optional(),
});
export type BuddySuggestion = z.infer<typeof BuddySuggestionSchema>;
