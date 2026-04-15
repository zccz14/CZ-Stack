import type { HealthError, HealthResponse } from "./schemas/health.js";
import { healthErrorSchema, healthPath, healthResponseSchema } from "./schemas/health.js";

export type ContractFetch = typeof fetch;

export type ContractClientOptions = {
  baseUrl: string;
  fetch?: ContractFetch;
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

const joinUrl = (baseUrl: string, path: string) => new URL(path.replace(/^\//, ""), `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}`).toString();

export const createContractClient = ({ baseUrl, fetch: fetchImpl = fetch }: ContractClientOptions): ContractClient => ({
  async getHealth() {
    const response = await fetchImpl(joinUrl(baseUrl, healthPath), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new ContractClientError(response.status, healthErrorSchema.parse(payload));
    }

    return healthResponseSchema.parse(payload);
  },
});
