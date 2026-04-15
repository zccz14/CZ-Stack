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

const toAbsoluteRequest = (baseUrl: URL, input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  if (input instanceof Request) {
    return new Request(new URL(input.url, baseUrl), input);
  }

  return new Request(new URL(input instanceof URL ? input.href : String(input), baseUrl), init);
};

export const createWebApiClient = (baseUrl = resolveApiBaseUrl()) => {
  const resolvedBaseUrl = new URL(baseUrl, window.location.origin);
  const contractClient = createContractClient({
    fetch: (input, init) => fetch(toAbsoluteRequest(resolvedBaseUrl, input, init)),
  });

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
