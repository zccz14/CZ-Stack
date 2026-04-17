import { getHealthErrorMessage } from "./features/health/queries.js";
import { useHealthQuery } from "./features/health/use-health-query.js";

export const App = () => {
  const healthQuery = useHealthQuery();

  return (
    <main>
      <h1>CZ-Stack Web</h1>
      <p>Contract-driven health check</p>
      {healthQuery.isPending ? <p>Loading health status…</p> : null}
      {healthQuery.isSuccess ? (
        <p>API health: {healthQuery.data.status}</p>
      ) : null}
      {healthQuery.isError ? (
        <p>{getHealthErrorMessage(healthQuery.error)}</p>
      ) : null}
    </main>
  );
};
