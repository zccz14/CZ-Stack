import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTaskRuntimeDatabasePath,
  openTaskRuntimeDatabase,
} from "../../.opencode/plugins/task-runtime-sqlite/database.ts";

describe("sqlite task runtime plugin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("../../.opencode/plugins/task-runtime-sqlite/database.ts");
    vi.doUnmock(
      "../../.opencode/plugins/task-runtime-sqlite/task-repository.ts",
    );
    vi.doUnmock(
      "../../.opencode/plugins/task-runtime-sqlite/session-runtime.ts",
    );
    vi.doUnmock(
      "../../.opencode/plugins/task-runtime-sqlite/prompt-builder.ts",
    );
  });

  it("registers the approved six tools on the plugin entrypoint", async () => {
    const { createSqliteTaskRuntimePlugin } = await import(
      "../../.opencode/plugins/task-runtime-sqlite.ts"
    );
    const plugin = createSqliteTaskRuntimePlugin({ projectDir: process.cwd() });

    const registeredTools = Object.keys(plugin.tools);

    expect(registeredTools).toEqual([
      "dispatch-tasks",
      "list-processing-tasks",
      "get-current-task",
      "mark-task-status",
      "setup-worktree-path",
      "setup-pull-request-url",
    ]);
  });

  it("does not eagerly initialize task runtime collaborators", async () => {
    const createTaskRuntimeDatabase = vi.fn(() => {
      throw new Error("should not initialize database for scaffold");
    });
    const createTaskRepository = vi.fn(() => {
      throw new Error("should not initialize repository for scaffold");
    });
    const createSessionRuntime = vi.fn(() => {
      throw new Error("should not initialize session runtime for scaffold");
    });
    const createPromptBuilder = vi.fn(() => {
      throw new Error("should not initialize prompt builder for scaffold");
    });

    vi.doMock(
      "../../.opencode/plugins/task-runtime-sqlite/database.ts",
      () => ({
        createTaskRuntimeDatabase,
      }),
    );
    vi.doMock(
      "../../.opencode/plugins/task-runtime-sqlite/task-repository.ts",
      () => ({ createTaskRepository }),
    );
    vi.doMock(
      "../../.opencode/plugins/task-runtime-sqlite/session-runtime.ts",
      () => ({ createSessionRuntime }),
    );
    vi.doMock(
      "../../.opencode/plugins/task-runtime-sqlite/prompt-builder.ts",
      () => ({ createPromptBuilder }),
    );

    const { createSqliteTaskRuntimePlugin } = await import(
      "../../.opencode/plugins/task-runtime-sqlite.ts"
    );

    expect(() =>
      createSqliteTaskRuntimePlugin({ projectDir: process.cwd() }),
    ).not.toThrow();
    expect(createTaskRuntimeDatabase).not.toHaveBeenCalled();
    expect(createTaskRepository).not.toHaveBeenCalled();
    expect(createSessionRuntime).not.toHaveBeenCalled();
    expect(createPromptBuilder).not.toHaveBeenCalled();
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

  it("keeps only name and tools on the plugin public surface", async () => {
    const { createSqliteTaskRuntimePlugin } = await import(
      "../../.opencode/plugins/task-runtime-sqlite.ts"
    );
    const plugin = createSqliteTaskRuntimePlugin({ projectDir: process.cwd() });

    expect(Object.keys(plugin)).toEqual(["name", "tools"]);
  });
});
