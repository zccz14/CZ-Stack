import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("sqlite task runtime plugin", () => {
  it("registers the approved six tools", async () => {
    const pluginSource = await readFile(
      `${process.cwd()}/.opencode/plugins/task-runtime-sqlite.ts`,
      "utf8",
    );

    const registeredTools = [...pluginSource.matchAll(/"([^"]+)":\s*\{/g)].map(
      ([, toolName]) => toolName,
    );

    expect(registeredTools).toEqual([
      "dispatch-tasks",
      "list-processing-tasks",
      "get-current-task",
      "mark-task-status",
      "setup-worktree-path",
      "setup-pull-request-url",
    ]);
  });
});
