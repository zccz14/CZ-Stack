import { expect, test } from "@playwright/test";

test.describe("web app", () => {
  test("loads the health status from the contract-driven client", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API health: ok")).toBeVisible();
  });

  test("shows the shared error state when the health request fails", async ({ page }) => {
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "UNAVAILABLE", message: "offline" }),
      });
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API unavailable: offline")).toBeVisible();
  });
});
