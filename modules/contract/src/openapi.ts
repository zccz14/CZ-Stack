import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
  };
};

export const healthPath = "/health";

const openapiSource = readFileSync(fileURLToPath(new URL("../openapi/openapi.yaml", import.meta.url)), "utf8");

export const openApiDocument = parse(openapiSource) as OpenApiDocument;
