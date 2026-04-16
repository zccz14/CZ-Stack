import { describe, expect, it } from "vitest";

import {
  DEFAULT_SERVER_ID,
  DOCS_SERVER_STORAGE_KEY,
  presetServers,
} from "../../modules/docs/src/config/servers.js";
import {
  isValidCustomBaseUrl,
  resolveSelection,
  toActiveBaseUrl,
} from "../../modules/docs/src/runtime/state.js";

describe("docs runtime state", () => {
  it("falls back to the default preset when storage is empty", () => {
    expect(resolveSelection(null)).toEqual({ kind: "preset", presetId: "dev" });
  });

  it("restores a persisted preset selection", () => {
    const selection = resolveSelection(
      JSON.stringify({ kind: "preset", presetId: "staging" }),
    );

    expect(selection).toEqual({ kind: "preset", presetId: "staging" });
    expect(toActiveBaseUrl(selection)).toBe(
      "https://staging.api.cz-stack.local",
    );
  });

  it("accepts a persisted custom https url", () => {
    expect(
      resolveSelection(
        JSON.stringify({
          kind: "custom",
          baseUrl: "https://review.api.cz-stack.local/",
        }),
      ),
    ).toEqual({
      kind: "custom",
      baseUrl: "https://review.api.cz-stack.local/",
    });
  });

  it("accepts an absolute http origin as a custom base url", () => {
    expect(isValidCustomBaseUrl("http://review.api.cz-stack.local/")).toBe(
      true,
    );
  });

  it("accepts an absolute https origin without an explicit trailing slash", () => {
    expect(isValidCustomBaseUrl("https://review.api.cz-stack.local")).toBe(
      true,
    );
  });

  it("rejects custom urls without protocol", () => {
    expect(isValidCustomBaseUrl("review.api.cz-stack.local")).toBe(false);
  });

  it("rejects custom urls with query strings", () => {
    expect(isValidCustomBaseUrl("https://review.api.cz-stack.local/?x=1")).toBe(
      false,
    );
  });

  it("rejects custom urls with hash fragments", () => {
    expect(isValidCustomBaseUrl("https://review.api.cz-stack.local/#x")).toBe(
      false,
    );
  });

  it("falls back to the default preset for invalid persisted custom urls", () => {
    expect(
      resolveSelection(
        JSON.stringify({
          kind: "custom",
          baseUrl: "review.api.cz-stack.local",
        }),
      ),
    ).toEqual({
      kind: "preset",
      presetId: DEFAULT_SERVER_ID,
    });
  });

  it("drops unknown preset ids", () => {
    expect(
      resolveSelection(JSON.stringify({ kind: "preset", presetId: "qa" })),
    ).toEqual({ kind: "preset", presetId: "dev" });
  });

  it("falls back to the default preset for malformed persisted state", () => {
    expect(resolveSelection("{")).toEqual({
      kind: "preset",
      presetId: DEFAULT_SERVER_ID,
    });
  });

  it("keeps preset metadata stable for runtime wiring", () => {
    expect(DOCS_SERVER_STORAGE_KEY).toBe("cz-stack.scalar.server");
    expect(presetServers).toEqual([
      {
        id: "dev",
        label: "Development",
        baseUrl: "https://dev.api.cz-stack.local",
      },
      {
        id: "staging",
        label: "Staging",
        baseUrl: "https://staging.api.cz-stack.local",
      },
      {
        id: "prod",
        label: "Production",
        baseUrl: "https://api.cz-stack.local",
      },
    ]);
  });
});
