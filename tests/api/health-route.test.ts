import { describe, expect, it } from "vitest";

import { healthPath, healthResponseSchema, openApiDocument } from "../../modules/contract/src/index.js";
import { createApp } from "../../modules/api/src/app.js";

describe("api health route", () => {
  it("returns a healthy response from the contract", async () => {
    const app = createApp();

    const response = await app.request(healthPath);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("keeps the health payload valid against the shared contract schema", async () => {
    const app = createApp();

    const payload = await (await app.request(healthPath)).json();

    expect(healthResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("exposes the shared OpenAPI document", async () => {
    const app = createApp();

    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(openApiDocument);
  });
});
