import { z } from "zod";

export const PlaceCategorySchema = z.enum([
  "hike", "activity", "museum", "beach", "food", "sight", "other",
]);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

export const PlaceStatusSchema = z.enum(["new", "liked", "maybe", "rejected"]);
export type PlaceStatus = z.infer<typeof PlaceStatusSchema>;

export const PlaceDifficultySchema = z.enum(["easy", "moderate", "hard"]);
export type PlaceDifficulty = z.infer<typeof PlaceDifficultySchema>;

export const SourceTypeSchema = z.enum(["web", "article", "video", "social"]);

export const ResearchPlaceSchema = z.object({
  name: z.string().min(1),
  category: PlaceCategorySchema,
  description: z.string(),
  difficulty: PlaceDifficultySchema,
  kidSuitability: z.number().int().min(1).max(5),
  estDurationMin: z.number().int().min(0),
  weatherDependent: z.boolean(),
  sourceUrl: z.string().url().nullable(),
  sourceType: SourceTypeSchema,
  tags: z.array(z.string()),
});
export type ResearchPlace = z.infer<typeof ResearchPlaceSchema>;
