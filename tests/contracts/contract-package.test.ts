import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

const contractPackageUrl = new URL("../../modules/contract/package.json", import.meta.url);
const contractEntryUrl = new URL("../../modules/contract/dist/index.mjs", import.meta.url);

type ContractPackageManifest = {
  name: string;
  exports: {
    ".": {
      import: string;
      require: string;
      types: string;
    };
  };
};

type ContractPackageModule = typeof import("../../modules/contract/src/index.js");

let contractPackage: ContractPackageManifest;
let contractModule: ContractPackageModule;

beforeAll(async () => {
  contractPackage = JSON.parse(await readFile(contractPackageUrl, "utf8")) as ContractPackageManifest;
  contractModule = (await import(pathToFileURL(fileURLToPath(contractEntryUrl)).href)) as ContractPackageModule;
});

describe("contract package baseline", () => {
  it("publishes the expected package export contract", () => {
    expect(contractPackage.name).toBe("@cz-stack/contract");
    expect(contractPackage.exports["."]).toEqual({
      import: "./dist/index.mjs",
      require: "./dist/index.cjs",
      types: "./dist/index.d.mts",
    });
    expect(Object.keys(contractModule).sort()).toEqual([
      "ContractClientError",
      "createContractClient",
      "healthErrorCodeSchema",
      "healthErrorSchema",
      "healthPath",
      "healthResponseSchema",
      "healthStatusSchema",
      "openApiDocument",
    ]);
  });

  it("exports health schemas from the built package boundary", () => {
    expect(contractModule.healthPath).toBe("/health");
    expect(contractModule.healthResponseSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
    expect(contractModule.healthErrorSchema.parse({ code: "UNAVAILABLE", message: "offline" })).toEqual({
      code: "UNAVAILABLE",
      message: "offline",
    });
  });

  it("publishes a minimal health OpenAPI document", () => {
    expect(contractModule.openApiDocument.openapi).toBe("3.1.0");
    expect(contractModule.openApiDocument.paths[contractModule.healthPath]?.get?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/HealthResponse",
    });
    expect(contractModule.openApiDocument.components.schemas.HealthError).toMatchObject({
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

    const client = contractModule.createContractClient({
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
    const client = contractModule.createContractClient({
      baseUrl: "https://example.test",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "UNAVAILABLE", message: "offline" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    });

    const result = client.getHealth();

    await expect(result).rejects.toBeInstanceOf(contractModule.ContractClientError);
    await expect(result).rejects.toMatchObject({
      status: 503,
      error: { code: "UNAVAILABLE", message: "offline" },
    });
  });
});
