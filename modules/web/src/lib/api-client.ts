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

const normalizeBaseUrl = (baseUrl: URL) => {
  const normalizedBaseUrl = new URL(baseUrl);

  if (!normalizedBaseUrl.pathname.endsWith("/")) {
    normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname}/`;
  }

  return normalizedBaseUrl;
};

const resolveContractUrl = (baseUrl: URL, input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = input instanceof Request ? new URL(input.url) : new URL(input instanceof URL ? input.href : String(input), baseUrl);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (url.pathname.startsWith(normalizedBaseUrl.pathname)) {
    return url;
  }

  return new URL(`${url.pathname.slice(1)}${url.search}${url.hash}`, normalizedBaseUrl);
};

const toAbsoluteRequest = (baseUrl: URL, input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const resolvedUrl = resolveContractUrl(baseUrl, input, init);

  if (input instanceof Request) {
    return new Request(resolvedUrl, input);
  }

  return new Request(resolvedUrl, init);
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
