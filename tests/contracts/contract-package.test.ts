import { describe, expect, it, vi } from "vitest";

import {
  ContractClientError,
  createContractClient,
  healthErrorSchema,
  healthPath,
  healthResponseSchema,
  openApiDocument,
} from "../../modules/contract/src/index.ts";

describe("contract package baseline", () => {
  it("exports health schemas from a single contract source", () => {
    expect(healthPath).toBe("/health");
    expect(healthResponseSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
    expect(healthErrorSchema.parse({ code: "UNAVAILABLE", message: "offline" })).toEqual({
      code: "UNAVAILABLE",
      message: "offline",
    });
  });

  it("publishes a minimal health OpenAPI document", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.paths[healthPath]?.get?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/HealthResponse",
    });
    expect(openApiDocument.components.schemas.HealthError).toMatchObject({
      type: "object",
      required: ["code", "message"],
    });
  });

  it("creates a typed health client helper", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = createContractClient({
      baseUrl: "https://example.test/api/",
      fetch: fetcher,
    });

    await expect(client.getHealth()).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/api/health", expect.objectContaining({
      method: "GET",
      headers: { accept: "application/json" },
    }));
  });

  it("throws a typed contract error for non-ok responses", async () => {
    const client = createContractClient({
      baseUrl: "https://example.test",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "UNAVAILABLE", message: "offline" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    });

    const result = client.getHealth();

    await expect(result).rejects.toBeInstanceOf(ContractClientError);
    await expect(result).rejects.toMatchObject({
      status: 503,
      error: { code: "UNAVAILABLE", message: "offline" },
    });
  });
});
