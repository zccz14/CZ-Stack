import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const HealthResponse = z.object({ status: z.literal("ok") }).passthrough();
const HealthError = z
  .object({ code: z.literal("UNAVAILABLE"), message: z.string().min(1) })
  .passthrough();

export const schemas = {
  HealthResponse,
  HealthError,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/health",
    alias: "getHealth",
    requestFormat: "json",
    response: HealthResponse,
    errors: [
      {
        status: 503,
        description: `Unhealthy response`,
        schema: HealthError,
      },
    ],
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
