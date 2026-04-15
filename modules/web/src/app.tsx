import { useEffect, useState } from "react";

import { createWebApiClient } from "./lib/api-client.js";

type HealthViewModel =
  | { state: "loading" }
  | { state: "success"; healthStatus: string }
  | { state: "error"; message: string };

const defaultApiClient = createWebApiClient();

export const App = () => {
  const [health, setHealth] = useState<HealthViewModel>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      const result = await defaultApiClient.getHealth();

      if (cancelled) {
        return;
      }

      if (result.status === "success") {
        setHealth({
          state: "success",
          healthStatus: result.response.status,
        });
        return;
      }

      setHealth({
        state: "error",
        message: `API unavailable: ${result.error.message}`,
      });
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
      {health.state === "success" ? <p>API health: {health.healthStatus}</p> : null}
      {health.state === "error" ? <p>{health.message}</p> : null}
    </main>
  );
};
