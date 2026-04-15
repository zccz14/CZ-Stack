import { describe, expect, it, vi } from "vitest";

import { runChangesetCheck } from "../../scripts/changeset-check.mjs";

describe("changeset check", () => {
  it("passes the configured base ref through to changeset status", () => {
    const execFileSync = vi.fn((command: string, args: string[]) => {
      if (command === "git") {
        expect(args).toEqual(["diff", "--name-only", "origin/main...HEAD"]);
        return "modules/api/src/app.ts\n";
      }

      return "";
    });

    runChangesetCheck({
      cwd: "/repo",
      env: { CHANGESET_BASE_REF: "origin/main" },
      execFileSync,
      existsSync: (path) => path === "/repo/modules" || path === "/repo/modules/api/package.json",
      readdirSync: () => [{ isDirectory: () => true, name: "api" }],
      log: vi.fn(),
    });

    expect(execFileSync).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["exec", "changeset", "status", "--since", "origin/main"],
      { stdio: "inherit" },
    );
  });
});
