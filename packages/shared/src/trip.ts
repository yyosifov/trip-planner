import { z } from "zod";

export const RouteTypeSchema = z.enum(["roundtrip", "oneway", "open"]);

export const CreateTripSchema = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  dateWindowStart: z.string().nullable(),
  dateWindowEnd: z.string().nullable(),
  daysMin: z.number().int().min(1),
  daysMax: z.number().int().min(1),
  routeType: RouteTypeSchema,
  notes: z.string().default(""),
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
