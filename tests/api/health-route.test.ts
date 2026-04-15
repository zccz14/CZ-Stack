import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const apiPackageUrl = new URL("../../modules/api/package.json", import.meta.url);
const apiEntryUrl = new URL("../../modules/api/dist/app.mjs", import.meta.url);
const contractEntryUrl = new URL("../../modules/contract/dist/index.mjs", import.meta.url);
const honoEntryUrl = new URL("../../modules/api/node_modules/hono/dist/index.js", import.meta.url);

type ApiPackageManifest = {
  name: string;
  exports: {
    ".": {
      import: string;
      require: string;
      types: string;
    };
  };
};

type ApiPackageModule = typeof import("../../modules/api/src/app.js");
type ContractPackageModule = typeof import("../../modules/contract/src/index.js");
type HonoModule = typeof import("../../modules/api/node_modules/hono/dist/index.js");

let apiPackage: ApiPackageManifest;
let apiModule: ApiPackageModule;
let contractModule: ContractPackageModule;
let honoModule: HonoModule;

beforeAll(async () => {
  apiPackage = JSON.parse(await readFile(apiPackageUrl, "utf8")) as ApiPackageManifest;
  apiModule = (await import(pathToFileURL(fileURLToPath(apiEntryUrl)).href)) as ApiPackageModule;
  contractModule = (await import(pathToFileURL(fileURLToPath(contractEntryUrl)).href)) as ContractPackageModule;
  honoModule = (await import(pathToFileURL(fileURLToPath(honoEntryUrl)).href)) as HonoModule;
});

describe("api package baseline", () => {
  it("publishes the expected api package boundary", () => {
    expect(apiPackage.name).toBe("@cz-stack/api");
    expect(apiPackage.exports["."]).toEqual({
      import: "./dist/app.mjs",
      require: "./dist/app.cjs",
      types: "./dist/app.d.mts",
    });
    expect(Object.keys(apiModule).sort()).toEqual(["createApp"]);
  });

  it("returns a healthy response from the contract", async () => {
    const app = apiModule.createApp();

    const response = await app.request(contractModule.healthPath);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("keeps the health payload valid against the shared contract schema", async () => {
    const app = apiModule.createApp();

    const payload = await (await app.request(contractModule.healthPath)).json();

    expect(payload).toEqual({ status: "ok" });
    expect(contractModule.healthResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("exposes the shared OpenAPI document", async () => {
    const app = apiModule.createApp();

    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload).toEqual(contractModule.openApiDocument);
    expect(payload.paths[contractModule.healthPath]).toEqual(contractModule.openApiDocument.paths[contractModule.healthPath]);
  });

  it("serves a rendered docs entrypoint wired to the OpenAPI document", async () => {
    const app = apiModule.createApp();

    const response = await app.request("/docs");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();

    expect(html).toContain("/openapi.json");
    expect(html).toContain("SwaggerUIBundle");
  });

  it("renders docs with a prefix-aware OpenAPI url when mounted under a subpath", async () => {
    const root = new honoModule.Hono();

    root.route("/api", apiModule.createApp());

    const response = await root.request("http://example.test/api/docs");

    expect(response.status).toBe(200);

    const html = await response.text();

    expect(html).toContain("/api/openapi.json");
  });
});
