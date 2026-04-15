import { healthErrorSchema, healthPath, healthResponseSchema } from "./schemas/health.js";

type OpenApiSchema = {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, OpenApiSchema | { $ref: string }>;
  required?: string[];
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
};

const healthResponseProperties = healthResponseSchema.shape;
const healthErrorProperties = healthErrorSchema.shape;

export const openApiDocument: OpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "CZ-Stack Contract",
    version: "0.0.0",
  },
  paths: {
    [healthPath]: {
      get: {
        operationId: "getHealth",
        summary: "Read service health status",
        responses: {
          "200": {
            description: "Healthy response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
          "503": {
            description: "Unhealthy response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthError" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        required: Object.keys(healthResponseProperties),
        properties: {
          status: {
            type: "string",
            enum: [...healthResponseProperties.status.options],
            description: "Health status reported by the service",
          },
        },
      },
      HealthError: {
        type: "object",
        required: Object.keys(healthErrorProperties),
        properties: {
          code: {
            type: "string",
            enum: [...healthErrorProperties.code.options],
            description: "Stable machine-readable error code",
          },
          message: {
            type: "string",
            description: "Human-readable error detail",
          },
        },
      },
    },
  },
};
