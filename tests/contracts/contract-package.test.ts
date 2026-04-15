import { access, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { adaptGeneratedRequestForPublicFetch } from "../../modules/contract/src/client.js";

const contractPackageUrl = new URL("../../modules/contract/package.json", import.meta.url);
const contractEntryUrl = new URL("../../modules/contract/dist/index.mjs", import.meta.url);
const contractOpenApiSourceUrl = new URL("../../modules/contract/src/openapi.ts", import.meta.url);
const contractIndexSourceUrl = new URL("../../modules/contract/src/index.ts", import.meta.url);
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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type RootPackageManifest = {
  scripts: Record<string, string>;
};

type ContractPackageModule = typeof import("../../modules/contract/src/index.js");

let contractPackage: ContractPackageManifest;
let rootPackage: RootPackageManifest;
let contractModule: ContractPackageModule;
let playwrightConfigSource: string;

beforeAll(async () => {
  contractPackage = JSON.parse(await readFile(contractPackageUrl, "utf8")) as ContractPackageManifest;
  rootPackage = JSON.parse(await readFile(rootPackageUrl, "utf8")) as RootPackageManifest;
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
    expect(rootPackage.scripts["openapi:check"]).toContain("generate:check");
    expect(contractPackage.scripts?.generate).toBeDefined();
    expect(contractPackage.scripts?.build).toContain("pnpm run generate");
    expect(contractPackage.dependencies?.yaml).toBe("^2.8.3");
    expect(contractPackage.devDependencies?.yaml).toBeUndefined();
    expect(contractPackage.scripts?.["generate:zod"]).not.toContain("node_modules");
    await expect(readFile(generatedTypesUrl, "utf8")).resolves.toContain("health");
    await expect(readFile(generatedClientUrl, "utf8")).resolves.toContain("health");
    await expect(readFile(generatedZodUrl, "utf8")).resolves.toContain("HealthResponse");
  });

  it("keeps generated zod artifacts free of undeclared runtime imports", async () => {
    const generatedZodSource = await readFile(generatedZodUrl, "utf8");

    expect(generatedZodSource).not.toContain("@zodios/core");
  });

  it("keeps the public root boundary free of generated leaks and runtime-only OpenAPI loaders", async () => {
    const [entrySource, openApiSource] = await Promise.all([
      readFile(contractIndexSourceUrl, "utf8"),
      readFile(contractOpenApiSourceUrl, "utf8"),
    ]);

    expect(entrySource).not.toContain("export * from \"../generated");
    expect(entrySource).not.toContain("ContractFetch");
    expect(openApiSource).not.toContain("node:fs");
    expect(openApiSource).not.toContain("node:url");
    expect(openApiSource).not.toContain('from "yaml"');
    expect(openApiSource).toContain("../generated/openapi");
  });

  const getRequestedPath = (input: unknown) => {
    const target = input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
    return new URL(target, "http://contract.test").pathname;
  };

  const getAcceptHeader = (input: unknown, init: unknown) => {
    if (input instanceof Request) {
      return input.headers.get("accept");
    }

    const headers = init && typeof init === "object" && "headers" in init ? init.headers : undefined;

    return new Headers(headers as HeadersInit | undefined).get("accept");
  };

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
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [input, init] = fetcher.mock.calls[0] ?? [];
    const request = input instanceof Request ? input : undefined;
    const rawTarget = input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);

    expect(getRequestedPath(input)).toBe(contractModule.healthPath);
    expect(rawTarget).toBe(contractModule.healthPath);
    expect(request?.method ?? "GET").toBe("GET");
    expect(getAcceptHeader(input, init)).toBe("application/json");
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

    expect(fetcher).toHaveBeenCalledTimes(1);

    const [input] = fetcher.mock.calls[0] ?? [];
    const request = input instanceof Request ? input : undefined;

    expect(getRequestedPath(input)).toBe(contractModule.healthPath);
    expect(request?.method ?? "GET").toBe("GET");
  });

  it("adapts body-bearing generated requests to relative fetch args that survive downstream forwarding", async () => {
    const sourceRequest = new Request("http://contract.internal/widgets?draft=true", {
      body: JSON.stringify({ name: "widget" }),
      duplex: "half",
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    const [input, init] = adaptGeneratedRequestForPublicFetch(sourceRequest);
    const downstreamFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const callerFetch = (forwardedInput: Parameters<typeof fetch>[0], forwardedInit?: Parameters<typeof fetch>[1]) =>
      downstreamFetch(forwardedInput, forwardedInit);

    await callerFetch(input, init);

    const [downstreamInput, downstreamInit] = downstreamFetch.mock.calls[0] ?? [];
    const request = new Request(new URL(String(downstreamInput), "http://downstream.test"), downstreamInit);

    expect(String(downstreamInput)).toBe("/widgets?draft=true");
    expect(request.method).toBe("POST");
    expect(downstreamInit?.duplex).toBe("half");
    await expect(request.text()).resolves.toBe('{"name":"widget"}');
  });
});
