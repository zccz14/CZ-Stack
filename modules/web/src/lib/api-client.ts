import {
  ContractClientError,
  createContractClient,
  type HealthError,
  type HealthResponse,
} from "@cz-stack/contract";

export type WebHealthResult =
  | { status: "success"; response: HealthResponse }
  | { status: "error"; error: HealthError };

const fallbackError: HealthError = {
  code: "UNAVAILABLE",
  message: "unexpected error",
};

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return "/api";
};

export const createWebApiClient = (baseUrl = resolveApiBaseUrl()) => {
  const resolvedBaseUrl = new URL(baseUrl, window.location.origin).toString();
  const contractClient = createContractClient({ baseUrl: resolvedBaseUrl });

  return {
    async getHealth(): Promise<WebHealthResult> {
      try {
        const response = await contractClient.getHealth();

        return {
          status: "success",
          response,
        };
      } catch (error) {
        if (error instanceof ContractClientError) {
          return {
            status: "error",
            error: error.error,
          };
        }

        return {
          status: "error",
          error: fallbackError,
        };
      }
    },
  };
};
