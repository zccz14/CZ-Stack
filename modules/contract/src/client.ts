import { getHealth } from "../generated/client.js";
import { createClient as createGeneratedClient } from "../generated/_client/client/index.js";
import type { GetHealthError, GetHealthResponse, HealthError, HealthResponse } from "../generated/types.js";
import { schemas } from "../generated/zod.js";
import { healthPath } from "./openapi.js";

export type ContractClientOptions = {
  fetch: typeof fetch;
};

export class ContractClientError extends Error {
  readonly status: number;
  readonly error: HealthError;

  constructor(status: number, error: HealthError) {
    super(error.message);
    this.name = "ContractClientError";
    this.status = status;
    this.error = error;
  }
}

export type ContractClient = {
  getHealth(): Promise<HealthResponse>;
};

const generatedBaseUrl = "http://contract.internal";
const healthResponseSchema = schemas.HealthResponse;
const healthErrorSchema = schemas.HealthError;

export const createContractClient = ({ fetch: fetchImpl }: ContractClientOptions): ContractClient => {
  const client = createGeneratedClient({
    baseUrl: generatedBaseUrl,
    fetch: fetchImpl,
  });

  return {
  async getHealth() {
    const result = await getHealth({
      client,
      headers: {
        accept: "application/json",
      },
    });

    if (result.error) {
      throw new ContractClientError(result.response.status, healthErrorSchema.parse(result.error satisfies GetHealthError));
    }

    return healthResponseSchema.parse(result.data satisfies GetHealthResponse) satisfies HealthResponse;
  },
  };
};
