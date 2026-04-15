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
const generatedBaseOrigin = new URL(generatedBaseUrl).origin;
const healthResponseSchema = schemas.HealthResponse;
const healthErrorSchema = schemas.HealthError;

const rewriteRequestUrl = (request: Request, url: string) => {
  Object.defineProperty(request, "url", {
    configurable: true,
    value: url,
  });

  return request;
};

export const adaptGeneratedRequestForPublicFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): [Parameters<typeof fetch>[0], Parameters<typeof fetch>[1]?] => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);

  if (url.origin !== generatedBaseOrigin) {
    return [input, init];
  }

  return [rewriteRequestUrl(request.clone(), `${url.pathname}${url.search}${url.hash}`)];
};

export const createContractClient = ({ fetch: fetchImpl }: ContractClientOptions): ContractClient => {
  const client = createGeneratedClient({
    baseUrl: generatedBaseUrl,
    fetch: async (input, init) => {
      return fetchImpl(...adaptGeneratedRequestForPublicFetch(input, init));
    },
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
