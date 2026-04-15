import type { infer as Infer } from "zod";

import { schemas } from "../generated/zod.js";

export { healthPath, openApiDocument } from "./openapi.js";
export type { OpenApiDocument } from "./openapi.js";

export const healthResponseSchema = schemas.HealthResponse;
export const healthErrorSchema = schemas.HealthError;

export type {
  GetHealthError,
  GetHealthResponse,
  HealthError,
  HealthResponse,
} from "../generated/types.js";
export type HealthResponseSchema = typeof healthResponseSchema;
export type HealthErrorSchema = typeof healthErrorSchema;
export type ParsedHealthResponse = Infer<typeof healthResponseSchema>;
export type ParsedHealthError = Infer<typeof healthErrorSchema>;

export { ContractClientError, createContractClient } from "./client.js";
export type { ContractClient, ContractClientOptions } from "./client.js";
