import { expect, test } from "@playwright/test";

const trackRuntimeFailures = (page: import("@playwright/test").Page) => {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    failures.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  return failures;
};

const collectExternalScalarRequests = async (
  page: import("@playwright/test").Page,
) => {
  return await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter(
        (url) =>
          url.includes("cdn.jsdelivr.net") ||
          url.includes("proxy.scalar.com") ||
          url.includes("fonts.scalar.com"),
      ),
  );
};

const collectVendoredScalarCssDependencies = async (
  page: import("@playwright/test").Page,
) => {
  return await page.evaluate(async () => {
    const scalarStylesheets = Array.from(
      document.querySelectorAll("link[href*='./scalar-assets/']"),
    );
    const cssSources = await Promise.all(
      scalarStylesheets.map(async (stylesheet) => {
        const href = stylesheet.getAttribute("href");

        if (!href) {
          return "";
        }

        const response = await fetch(href);
        return await response.text();
      }),
    );

    return cssSources.flatMap((source) => {
      return [
        "cdn.jsdelivr.net",
        "proxy.scalar.com",
        "fonts.scalar.com",
      ].filter((host) => source.includes(host));
    });
  });
};

test("serves the scalar docs shell from static files", async ({ page }) => {
  const runtimeFailures = trackRuntimeFailures(page);

  await page.goto("/");

  await expect(page.getByText("Current server:")).toBeVisible();
  await expect(page.getByText("Read service health status").first()).toBeVisible();
  await expect(
    page.locator("script[src='./runtime/bootstrap.js']"),
  ).toHaveCount(1);
  await expect(page.locator("link[href^='./scalar-assets/']")).toHaveCount(1);
  await expect(page.locator("script[src*='cdn.jsdelivr.net']")).toHaveCount(0);
  await expect(
    page.locator("script[data-proxy-url], #api-reference[data-proxy-url]"),
  ).toHaveCount(0);
  await expect(page.getByText("404")).toHaveCount(0);
  await expect
    .poll(() => collectVendoredScalarCssDependencies(page))
    .toEqual([]);
  await expect.poll(() => collectExternalScalarRequests(page)).toEqual([]);
  await expect.poll(() => runtimeFailures).toEqual([]);
});

test("switches between preset environments and restores the last valid choice", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText("Current server: https://dev.api.cz-stack.local"),
  ).toBeVisible();

  await page.getByRole("combobox").selectOption("staging");
  await expect(
    page.getByText("Current server: https://staging.api.cz-stack.local"),
  ).toBeVisible();

  await page.getByRole("combobox").selectOption("prod");
  await expect(
    page.getByText("Current server: https://api.cz-stack.local"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("Current server: https://api.cz-stack.local"),
  ).toBeVisible();
  await expect
    .poll(() => collectVendoredScalarCssDependencies(page))
    .toEqual([]);
  await expect.poll(() => collectExternalScalarRequests(page)).toEqual([]);
});

test("accepts a valid custom url and ignores invalid input", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("combobox").selectOption("prod");
  await expect(
    page.getByText("Current server: https://api.cz-stack.local"),
  ).toBeVisible();

  const customInput = page.getByPlaceholder(
    "https://review.api.cz-stack.local/",
  );
  await customInput.fill("review.api.cz-stack.local");
  await page.getByRole("button", { name: "Apply custom URL" }).click();
  await expect(
    page.getByText("Current server: https://api.cz-stack.local"),
  ).toBeVisible();
  await expect(
    page.evaluate(() => localStorage.getItem("cz-stack.scalar.server")),
  ).resolves.toBe(JSON.stringify({ kind: "preset", presetId: "prod" }));

  await customInput.fill("https://review.api.cz-stack.local/");
  await page.getByRole("button", { name: "Apply custom URL" }).click();
  await expect(
    page.getByText("Current server: https://review.api.cz-stack.local/"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("Current server: https://review.api.cz-stack.local/"),
  ).toBeVisible();
  await expect
    .poll(() => collectVendoredScalarCssDependencies(page))
    .toEqual([]);
  await expect.poll(() => collectExternalScalarRequests(page)).toEqual([]);
});
