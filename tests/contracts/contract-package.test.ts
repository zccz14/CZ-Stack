import { access, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

const contractPackageUrl = new URL("../../modules/contract/package.json", import.meta.url);
const contractEntryUrl = new URL("../../modules/contract/dist/index.mjs", import.meta.url);
const contractSourceEntryUrl = new URL("../../modules/contract/src/index.ts", import.meta.url);
const contractClientSourceUrl = new URL("../../modules/contract/src/client.ts", import.meta.url);
const generatedClientUrl = new URL("../../modules/contract/generated/client.ts", import.meta.url);
const generatedTypesUrl = new URL("../../modules/contract/generated/types.ts", import.meta.url);
const generatedZodUrl = new URL("../../modules/contract/generated/zod.ts", import.meta.url);
const rootPackageUrl = new URL("../../package.json", import.meta.url);
const vitestWorkspaceUrl = new URL("../../vitest.workspace.ts", import.meta.url);
const playwrightConfigUrl = new URL("../../playwright.config.ts", import.meta.url);

type ContractPackageManifest = {
  name: string;
  exports: {
    ".": {
      import: string;
      require: string;
      types: string;
    };
  };
  scripts?: Record<string, string>;
};

type RootPackageManifest = {
  scripts: Record<string, string>;
};

type ContractPackageModule = typeof import("../../modules/contract/src/index.js");

let contractPackage: ContractPackageManifest;
let rootPackage: RootPackageManifest;
let contractModule: ContractPackageModule;
let contractSource: string;
let contractClientSource: string;
let playwrightConfigSource: string;

beforeAll(async () => {
  contractPackage = JSON.parse(await readFile(contractPackageUrl, "utf8")) as ContractPackageManifest;
  rootPackage = JSON.parse(await readFile(rootPackageUrl, "utf8")) as RootPackageManifest;
  contractSource = await readFile(contractSourceEntryUrl, "utf8");
  contractClientSource = await readFile(contractClientSourceUrl, "utf8");
  playwrightConfigSource = await readFile(playwrightConfigUrl, "utf8");
  contractModule = (await import(pathToFileURL(fileURLToPath(contractEntryUrl)).href)) as ContractPackageModule;
});

describe("contract package baseline", () => {
  it("publishes unified root validation entrypoints", async () => {
    await expect(access(vitestWorkspaceUrl)).resolves.toBeUndefined();
    await expect(access(playwrightConfigUrl)).resolves.toBeUndefined();
    expect(rootPackage.scripts).toMatchObject({
      "test:unit": expect.any(String),
      "test:integration": expect.any(String),
      "test:e2e": expect.any(String),
      "smoke:cli": expect.any(String),
      validate: expect.stringContaining("pnpm test"),
    });
  });

  it("keeps a minimal browser matrix in the Playwright baseline", () => {
    expect(playwrightConfigSource).toContain('name: "chromium"');
    expect(playwrightConfigSource).toContain('name: "firefox"');
  });

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
      "healthErrorSchema",
      "healthPath",
      "healthResponseSchema",
      "openApiDocument",
    ]);
    expect(contractModule.openApiDocument.paths[contractModule.healthPath]).toBeDefined();
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

  it("moves contract package inputs to the OpenAPI generation pipeline", async () => {
    expect(rootPackage.scripts["openapi:generate"]).toBeDefined();
    expect(rootPackage.scripts["openapi:generate"]).toContain("modules/contract");
    expect(contractPackage.scripts?.generate).toBeDefined();
    await expect(readFile(generatedTypesUrl, "utf8")).resolves.toContain("health");
    await expect(readFile(generatedClientUrl, "utf8")).resolves.toContain("health");
    await expect(readFile(generatedZodUrl, "utf8")).resolves.toContain("health");
  });

  it("keeps the stable root entry free of legacy schema and transport internals", () => {
    expect(contractSource).not.toContain("./schemas/health.js");
    expect(contractClientSource).not.toContain("ContractFetch");
    expect(contractClientSource).not.toContain("baseUrl");
  });

  it("creates a typed health client helper", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = contractModule.createContractClient({
      fetch: fetcher,
    });

    await expect(client.getHealth()).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(Request),
      expect.anything(),
    );

    const [request] = fetcher.mock.calls[0] ?? [];

    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe(contractModule.healthPath);
    expect(request.method).toBe("GET");
    expect(request.headers.get("accept")).toBe("application/json");
  });

  it("throws a typed contract error for non-ok responses through the fetch-only boundary", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "UNAVAILABLE", message: "offline" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = contractModule.createContractClient({
      fetch: fetcher,
    });

    const result = client.getHealth();

    await expect(result).rejects.toBeInstanceOf(contractModule.ContractClientError);
    await expect(result).rejects.toMatchObject({
      status: 503,
      error: { code: "UNAVAILABLE", message: "offline" },
    });

    const [request] = fetcher.mock.calls[0] ?? [];

    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe(contractModule.healthPath);
    expect(request.method).toBe("GET");
  });
});
