import { openApiDocument } from "@cz-stack/contract";
import { Hono } from "hono";

import { registerHealthRoute } from "./routes/health.js";

const docsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CZ-Stack API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
      });
    </script>
  </body>
</html>`;

export const createApp = () => {
  const app = new Hono();

  registerHealthRoute(app);

  app.get("/openapi.json", (context) => context.json(openApiDocument, 200));
  app.get("/docs", (context) => context.html(docsHtml, 200));

  return app;
};
