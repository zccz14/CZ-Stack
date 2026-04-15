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

const toRelativeRequest = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  const target = url.origin === generatedBaseOrigin ? `${url.pathname}${url.search}${url.hash}` : request.url;

  return {
    input: target,
    init: {
      body: request.body,
      cache: request.cache,
      credentials: request.credentials,
      headers: request.headers,
      integrity: request.integrity,
      keepalive: request.keepalive,
      method: request.method,
      mode: request.mode,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      signal: request.signal,
    } satisfies RequestInit,
  };
};

export const createContractClient = ({ fetch: fetchImpl }: ContractClientOptions): ContractClient => {
  const client = createGeneratedClient({
    baseUrl: generatedBaseUrl,
    fetch: async (input, init) => {
      const request = toRelativeRequest(input, init);

      return fetchImpl(request.input, request.init);
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
