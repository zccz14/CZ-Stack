import { openApiDocument } from "@cz-stack/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { registerHealthRoute } from "./routes/health.js";

export const createApp = () => {
  const app = new Hono();

  // CORS only handles browser compatibility. Do not treat it as backend access control.
  app.use("*", cors({ origin: "*" }));

  registerHealthRoute(app);

  app.get("/openapi.json", (context) => context.json(openApiDocument, 200));

  return app;
};
