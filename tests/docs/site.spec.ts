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

test("serves direct Scalar CLI html without the custom wrapper", async ({ page }) => {
  const runtimeFailures = trackRuntimeFailures(page);

  await page.goto("/");

  await expect(page.getByText("Read service health status").first()).toBeVisible();
  await expect(page.getByText("Current server:")).toHaveCount(0);
  await expect(page.locator("script[src='./runtime/bootstrap.js']")).toHaveCount(0);
  await expect(page.locator("link[href^='./scalar-assets/']")).toHaveCount(0);
  await expect(page.locator("script[src*='cdn.jsdelivr.net']")).toHaveCount(1);
  await expect(page.locator("script[data-proxy-url], #api-reference[data-proxy-url]")).toHaveCount(1);
  await expect(page.locator("script#api-reference")).toHaveCount(1);
  await expect(collectVendoredScalarCssDependencies(page)).resolves.toEqual([]);
  await expect.poll(() => collectExternalScalarRequests(page)).not.toEqual([]);
  await expect.poll(() => runtimeFailures).toEqual([]);
});

test("embeds native OpenAPI servers without custom controls", async ({ page }) => {
  await page.goto("/");

  const inlineConfig = await page.locator("script#api-reference").textContent();

  expect(inlineConfig).toContain('"servers"');
  expect(inlineConfig).toContain('"url":"https://dev.api.cz-stack.local"');
  expect(inlineConfig).toContain('"description":"Development"');
  expect(inlineConfig).toContain('"url":"https://staging.api.cz-stack.local"');
  expect(inlineConfig).toContain('"description":"Staging"');
  expect(inlineConfig).toContain('"url":"https://api.cz-stack.local"');
  expect(inlineConfig).toContain('"description":"Production"');
  await expect(page.getByPlaceholder("https://review.api.cz-stack.local/")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply custom URL" })).toHaveCount(0);
});
