import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const openApiPath = new URL(
  "../../modules/contract/openapi/openapi.yaml",
  import.meta.url,
);

describe("docs OpenAPI servers", () => {
  it("declares native preset servers for Scalar", async () => {
    const source = await readFile(openApiPath, "utf8");

    expect(source).toContain("servers:");
    expect(source).toContain("url: https://dev.api.cz-stack.local");
    expect(source).toContain("description: Development");
    expect(source).toContain("url: https://staging.api.cz-stack.local");
    expect(source).toContain("description: Staging");
    expect(source).toContain("url: https://api.cz-stack.local");
    expect(source).toContain("description: Production");
  });
});
