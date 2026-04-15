import { expect, test } from "@playwright/test";

test.describe("web app", () => {
  test("keeps API base-url binding in the web layer", async () => {
    const { readFile } = await import("node:fs/promises");
    const apiClientSource = await readFile(`${process.cwd()}/modules/web/src/lib/api-client.ts`, "utf8");

    expect(apiClientSource).toContain('from "@cz-stack/contract"');
    expect(apiClientSource).not.toContain('from "@cz-stack/contract/generated/');
    expect(apiClientSource).not.toContain("modules/contract/generated/");
    expect(apiClientSource).toContain("createContractClient({");
    expect(apiClientSource).toContain("fetch:");
    expect(apiClientSource).not.toContain("baseUrl:");
  });

  test("loads the health status from the contract-driven client", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API health: ok")).toBeVisible();
  });

  test("shows the shared error state when the health request fails", async ({ page }) => {
    const requests: string[] = [];

    await page.route("**/api/health", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "UNAVAILABLE", message: "offline" }),
      });
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API unavailable: offline")).toBeVisible();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((requestUrl) => requestUrl.endsWith("/api/health"))).toBe(true);
  });
});
