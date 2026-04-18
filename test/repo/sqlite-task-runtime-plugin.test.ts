import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTaskRuntimeDatabasePath,
  openTaskRuntimeDatabase,
  type TaskRecord,
} from "../../.opencode/plugins/task-runtime-sqlite/database.ts";
import { createTaskRepository } from "../../.opencode/plugins/task-runtime-sqlite/task-repository.ts";

const createTaskDatabase = async (caseName: string) => {
  const projectDir = join(
    process.cwd(),
    "test/repo/.tmp/sqlite-task-runtime-plugin",
    caseName,
  );

  await rm(projectDir, { force: true, recursive: true });
  await mkdir(projectDir, { recursive: true });

  const database = openTaskRuntimeDatabase(projectDir);
  database.exec(`
    CREATE TABLE tasks (
      task_id TEXT NOT NULL,
      task_spec TEXT NOT NULL,
      session_id TEXT,
      worktree_path TEXT,
      pull_request_url TEXT,
      status TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    )
  `);

  const seedTasks = (
    tasks: Array<
      Partial<TaskRecord> & Pick<TaskRecord, "task_id" | "task_spec">
    >,
  ) => {
    const insert = database.prepare(`
      INSERT INTO tasks (
        task_id,
        task_spec,
        session_id,
        worktree_path,
        pull_request_url,
        status,
        done,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const task of tasks) {
      insert.run(
        task.task_id,
        task.task_spec,
        task.session_id ?? null,
        task.worktree_path ?? null,
        task.pull_request_url ?? null,
        task.status ?? null,
        task.done ?? 0,
        task.updated_at ?? null,
      );
    }
  };

  const cleanup = async () => {
    database.close();
    await rm(projectDir, { force: true, recursive: true });
  };

  return { cleanup, projectDir, seedTasks };
};

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

  it("always resolves aim.sqlite under the project directory", () => {
    expect(getTaskRuntimeDatabasePath("/repo/worktree")).toBe(
      "/repo/worktree/aim.sqlite",
    );
  });

  it("lists only unfinished tasks from sqlite", async () => {
    const taskDatabase = await createTaskDatabase("unfinished-tasks");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T00:00:00.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        { task_id: "task-1", task_spec: "one", done: 0, status: "created" },
        {
          task_id: "task-2",
          task_spec: "two",
          done: 1,
          status: "succeeded",
        },
      ]);

      expect(
        repository.listUnfinishedTasks().map((task) => task.task_id),
      ).toEqual(["task-1"]);
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("lists processing task summaries from unfinished tasks", async () => {
    const taskDatabase = await createTaskDatabase("processing-tasks");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T00:00:00.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        {
          task_id: "task-1",
          task_spec: "one",
          session_id: "session-1",
          worktree_path: "/repo/.worktrees/task-1",
          pull_request_url: "https://example.com/pr/1",
          status: "running",
          done: 0,
          updated_at: "2026-04-18T01:00:00.000Z",
        },
        {
          task_id: "task-2",
          task_spec: "two",
          status: "succeeded",
          done: 1,
        },
      ]);

      expect(repository.listProcessingTasks()).toEqual([
        {
          task_id: "task-1",
          session_id: "session-1",
          worktree_path: "/repo/.worktrees/task-1",
          pull_request_url: "https://example.com/pr/1",
          status: "running",
          updated_at: "2026-04-18T01:00:00.000Z",
        },
      ]);
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("resolves exactly one task for the current session id", async () => {
    const taskDatabase = await createTaskDatabase("task-binding");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T00:00:00.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        {
          task_id: "task-1",
          task_spec: "one",
          done: 0,
          status: "running",
          session_id: "session-1",
        },
      ]);

      expect(repository.getTaskBySessionID("session-1")?.task_id).toBe(
        "task-1",
      );
      expect(repository.getTaskBySessionID("missing-session")).toBeUndefined();
      expect(() =>
        repository.getRequiredTaskBySessionID("missing-session"),
      ).toThrow("Current session is not bound to a task");
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("fails when multiple tasks are bound to the same session id", async () => {
    const taskDatabase = await createTaskDatabase("duplicate-session-binding");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T00:00:00.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        {
          task_id: "task-1",
          task_spec: "one",
          done: 0,
          status: "running",
          session_id: "session-1",
        },
        {
          task_id: "task-2",
          task_spec: "two",
          done: 0,
          status: "running",
          session_id: "session-1",
        },
      ]);

      expect(() => repository.getRequiredTaskBySessionID("session-1")).toThrow(
        "Multiple tasks are bound to session session-1",
      );
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("assigns a session id to a task", async () => {
    const taskDatabase = await createTaskDatabase("assign-session");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        { task_id: "task-1", task_spec: "one", done: 0 },
      ]);

      repository.assignSession("task-1", "session-1");

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        session_id: "session-1",
        task_id: "task-1",
        updated_at: "2026-04-18T12:34:56.000Z",
      });
    } finally {
      await taskDatabase.cleanup();
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
