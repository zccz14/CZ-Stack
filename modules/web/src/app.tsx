import { ContractClientError, type HealthError } from "@cz-stack/contract";
import { useEffect, useState } from "react";

import { createWebApiClient } from "./lib/api-client.js";

type HealthViewModel =
  | { state: "loading" }
  | { state: "success"; healthStatus: string }
  | { state: "error"; message: string };

const defaultApiClient = createWebApiClient();

const fallbackError: HealthError = {
  code: "UNAVAILABLE",
  message: "unexpected error",
};

export const App = () => {
  const [health, setHealth] = useState<HealthViewModel>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      try {
        const response = await defaultApiClient.getHealth();

        if (cancelled) {
          return;
        }

        setHealth({
          state: "success",
          healthStatus: response.status,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const healthError =
          error instanceof ContractClientError ? error.error : fallbackError;

        setHealth({
          state: "error",
          message: `API unavailable: ${healthError.message}`,
        });
      }
    };

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>CZ-Stack Web</h1>
      <p>Contract-driven health check</p>
      {health.state === "loading" ? <p>Loading health status…</p> : null}
      {health.state === "success" ? (
        <p>API health: {health.healthStatus}</p>
      ) : null}
      {health.state === "error" ? <p>{health.message}</p> : null}
    </main>
  );
};
