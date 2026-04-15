// This file is auto-generated from the /health OpenAPI contract.
export const openApiDocument = {
  "openapi": "3.1.0",
  "info": {
    "title": "CZ-Stack Contract",
    "version": "0.0.0"
  },
  "paths": {
    "/health": {
      "get": {
        "operationId": "getHealth",
        "summary": "Read service health status",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Healthy response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          },
          "503": {
            "description": "Unhealthy response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthError"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    },
    "schemas": {
      "HealthResponse": {
        "type": "object",
        "required": [
          "status"
        ],
        "properties": {
          "status": {
            "type": "string",
            "description": "Health status reported by the service",
            "enum": [
              "ok"
            ]
          }
        }
      },
      "HealthError": {
        "type": "object",
        "required": [
          "code",
          "message"
        ],
        "properties": {
          "code": {
            "type": "string",
            "description": "Stable machine-readable error code",
            "enum": [
              "UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "description": "Human-readable error detail",
            "minLength": 1
          }
        }
      }
    }
  }
} as const;
