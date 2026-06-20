import { z } from "zod";
export const TimeSlotSchema = z.enum(["morning", "afternoon", "evening"]);
export type TimeSlot = z.infer<typeof TimeSlotSchema>;
