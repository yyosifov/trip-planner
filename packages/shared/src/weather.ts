import { z } from "zod";

export const DailyWeatherSchema = z.object({
  date: z.string(),
  tMaxC: z.number().nullable(),
  tMinC: z.number().nullable(),
  precipMm: z.number().nullable(),
  windMaxKmh: z.number().nullable(),
});
export type DailyWeather = z.infer<typeof DailyWeatherSchema>;

export const WeatherNormalsSchema = z.object({
  tMaxC: z.number(),
  tMinC: z.number(),
  precipMmAvg: z.number(),
  windMaxKmh: z.number(),
});
export type WeatherNormals = z.infer<typeof WeatherNormalsSchema>;

export const WeatherYearSchema = z.object({
  year: z.number(),
  days: z.array(DailyWeatherSchema),
});
export type WeatherYear = z.infer<typeof WeatherYearSchema>;

export const WeatherResponseSchema = z.object({
  available: z.boolean(),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).optional(),
  window: z.object({ start: z.string(), end: z.string() }).optional(),
  forecast: z.array(DailyWeatherSchema).nullable().optional(),
  normals: WeatherNormalsSchema.optional(),
  years: z.array(WeatherYearSchema).optional(),
});
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
