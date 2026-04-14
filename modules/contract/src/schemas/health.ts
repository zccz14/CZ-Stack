import { z } from "zod";

export const healthPath = "/health";

export const healthStatusSchema = z.enum(["ok"]);

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
});

export const healthErrorCodeSchema = z.enum(["UNAVAILABLE"]);

export const healthErrorSchema = z.object({
  code: healthErrorCodeSchema,
  message: z.string().min(1),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthErrorCode = z.infer<typeof healthErrorCodeSchema>;
export type HealthError = z.infer<typeof healthErrorSchema>;
