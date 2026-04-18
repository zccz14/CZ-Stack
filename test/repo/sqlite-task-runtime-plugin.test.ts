import { access, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getTaskRuntimeDatabasePath,
  openTaskRuntimeDatabase,
} from "../../.opencode/plugins/task-runtime-sqlite/database.ts";
import { createSqliteTaskRuntimePlugin } from "../../.opencode/plugins/task-runtime-sqlite.ts";

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

  it("opens aim.sqlite under the project directory", async () => {
    const projectDir = join(
      process.cwd(),
      "test/repo/.tmp/sqlite-task-runtime-plugin/database-helper",
    );

    await rm(projectDir, { force: true, recursive: true });
    await mkdir(projectDir, { recursive: true });

    try {
      const database = openTaskRuntimeDatabase(projectDir);
      database.close();

      await expect(
        access(getTaskRuntimeDatabasePath(projectDir)),
      ).resolves.toBeUndefined();
    } finally {
      await rm(projectDir, { force: true, recursive: true });
    }
  });

  it("keeps only name and tools on the plugin public surface", () => {
    const plugin = createSqliteTaskRuntimePlugin({ projectDir: process.cwd() });

    expect(Object.keys(plugin)).toEqual(["name", "tools"]);
  });
});
