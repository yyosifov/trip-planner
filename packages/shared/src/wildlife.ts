import { z } from "zod";

export const SpeciesTypeSchema = z.enum([
  "bird", "mammal", "reptile", "insect", "amphibian", "other",
]);
export type SpeciesType = z.infer<typeof SpeciesTypeSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const SpeciesToSpotSchema = z.object({
  name: z.string().min(1),
  type: SpeciesTypeSchema,
  funFact: z.string().default(""),
  kidAppeal: z.number().int().min(1).max(5).default(3),
});
export type SpeciesToSpot = z.infer<typeof SpeciesToSpotSchema>;

export const SafetyItemSchema = z.object({
  animal: z.string().min(1),
  risk: RiskLevelSchema,
  danger: z.string().default(""),
  whatToDo: z.string().default(""),
});
export type SafetyItem = z.infer<typeof SafetyItemSchema>;

export const SeasonalNoteSchema = z.object({
  window: z.string().default(""),
  note: z.string().default(""),
});
export type SeasonalNote = z.infer<typeof SeasonalNoteSchema>;

export const PerPlaceNoteSchema = z.object({
  placeId: z.string().default(""),
  placeName: z.string().default(""),
  species: z.array(SpeciesToSpotSchema).default([]),
  safety: z.array(SafetyItemSchema).default([]),
});
export type PerPlaceNote = z.infer<typeof PerPlaceNoteSchema>;

export const WildlifeDataSchema = z.object({
  summary: z.string().default(""),
  species: z.array(SpeciesToSpotSchema).default([]),
  seasonal: z.array(SeasonalNoteSchema).default([]),
  safety: z.array(SafetyItemSchema).default([]),
  perPlace: z.array(PerPlaceNoteSchema).default([]),
});
export type WildlifeData = z.infer<typeof WildlifeDataSchema>;
