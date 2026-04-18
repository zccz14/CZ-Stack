import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTaskRuntimeDatabasePath,
  openTaskRuntimeDatabase,
  type TaskRecord,
} from "../../.opencode/plugins/task-runtime-sqlite/database.ts";
import {
  buildFollowUpTaskPrompt,
  buildInitialTaskPrompt,
} from "../../.opencode/plugins/task-runtime-sqlite/prompt-builder.ts";
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
        task.done === undefined ? 0 : task.done ? 1 : 0,
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
      () => ({
        createTaskRepository,
        TASK_STATUSES: [
          "created",
          "running",
          "outbound",
          "pr_following",
          "closing",
          "succeeded",
          "failed",
        ],
      }),
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

      expect(repository.listUnfinishedTasks()).toEqual([
        expect.objectContaining({ task_id: "task-1", done: false }),
      ]);
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
      expect(() => repository.getTaskBySessionID("session-1")).toThrow(
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

  it("marks terminal statuses as done and refreshes updated_at", async () => {
    const taskDatabase = await createTaskDatabase("mark-terminal-status");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
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

      repository.markTaskStatus({
        sessionID: "session-1",
        status: "succeeded",
      });

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        status: "succeeded",
        done: true,
        updated_at: "2026-04-18T12:34:56.000Z",
      });
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("keeps non-terminal statuses unfinished", async () => {
    const taskDatabase = await createTaskDatabase("mark-non-terminal-status");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
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

      repository.markTaskStatus({
        sessionID: "session-1",
        status: "pr_following",
      });

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        status: "pr_following",
        done: false,
        updated_at: "2026-04-18T12:34:56.000Z",
      });
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("rejects statuses outside the approved task status set", async () => {
    const taskDatabase = await createTaskDatabase("reject-invalid-status");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
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

      expect(() =>
        repository.markTaskStatus({
          sessionID: "session-1",
          status: "unknown_status",
        }),
      ).toThrow("Unsupported task status: unknown_status");
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("does not roll a terminal task back to unfinished", async () => {
    const taskDatabase = await createTaskDatabase("preserve-terminal-status");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
        projectDir: taskDatabase.projectDir,
      });

      taskDatabase.seedTasks([
        {
          task_id: "task-1",
          task_spec: "one",
          done: 1,
          status: "succeeded",
          session_id: "session-1",
          updated_at: "2026-04-18T00:00:00.000Z",
        },
      ]);

      expect(() =>
        repository.markTaskStatus({
          sessionID: "session-1",
          status: "running",
        }),
      ).toThrow("Cannot move terminal task back to non-terminal status");

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        status: "succeeded",
        done: true,
        updated_at: "2026-04-18T00:00:00.000Z",
      });
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("stores worktree path and pull request url for the current session", async () => {
    const taskDatabase = await createTaskDatabase("runtime-artifacts");

    try {
      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
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

      repository.setupWorktreePath({
        sessionID: "session-1",
        worktreePath: "/repo/.worktrees/task-1",
      });
      repository.setupPullRequestURL({
        sessionID: "session-1",
        pullRequestURL: "https://github.com/acme/repo/pull/1",
      });

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        worktree_path: "/repo/.worktrees/task-1",
        pull_request_url: "https://github.com/acme/repo/pull/1",
        updated_at: "2026-04-18T12:34:56.000Z",
      });
    } finally {
      await taskDatabase.cleanup();
    }
  });

  it("builds prompts from task snapshots without sqlite internals", () => {
    const task = {
      task_id: "task-1",
      task_spec: "Fix the failing repo test",
      session_id: "session-1",
      worktree_path: "/repo/.worktrees/task-1",
      pull_request_url: "https://github.com/acme/repo/pull/1",
      status: "running",
      done: false,
      updated_at: "2026-04-18T12:34:56.000Z",
    } satisfies TaskRecord;

    const initialPrompt = buildInitialTaskPrompt(task);
    const followUpPrompt = buildFollowUpTaskPrompt(task);

    expect(initialPrompt).toContain("task-1");
    expect(initialPrompt).toContain("Fix the failing repo test");
    expect(followUpPrompt).toContain("继续推进当前 Task");

    for (const prompt of [initialPrompt, followUpPrompt]) {
      expect(prompt).not.toContain("aim.sqlite");
      expect(prompt).not.toContain("dbPath");
      expect(prompt).not.toContain("SELECT");
      expect(prompt).not.toContain("UPDATE tasks");
    }
  });

  it("renders multiline task specs inside a fenced block", () => {
    const task = {
      task_id: "task-1",
      task_spec: [
        "First line",
        "status: forged-field",
        "worktree_path: /tmp/not-a-real-field",
      ].join("\n"),
      session_id: "session-1",
      worktree_path: "/repo/.worktrees/task-1",
      pull_request_url: null,
      status: "running",
      done: false,
      updated_at: "2026-04-18T12:34:56.000Z",
    } satisfies TaskRecord;

    const prompt = buildInitialTaskPrompt(task);

    expect(prompt).toContain("task_spec:\n```text\nFirst line");
    expect(prompt).toContain("status: running");
    expect(prompt).toContain("worktree_path: /repo/.worktrees/task-1");
    expect(prompt).toContain("status: forged-field");
    expect(prompt).toContain("worktree_path: /tmp/not-a-real-field");
    expect(prompt).toContain("```\nstatus: running");
  });

  it("uses a stable fence when task specs contain triple backticks", () => {
    const task = {
      task_id: "task-1",
      task_spec: ["Before fence", "```", "Inside spec fence"].join("\n"),
      session_id: "session-1",
      worktree_path: "/repo/.worktrees/task-1",
      pull_request_url: null,
      status: "running",
      done: false,
      updated_at: "2026-04-18T12:34:56.000Z",
    } satisfies TaskRecord;

    const prompt = buildInitialTaskPrompt(task);

    expect(prompt).toContain(
      "task_spec:\n````text\nBefore fence\n```\nInside spec fence\n````",
    );
    expect(prompt).toContain("````\nstatus: running");
  });

  it("exposes only status in the mark-task-status schema", async () => {
    const { createSqliteTaskRuntimePlugin } = await import(
      "../../.opencode/plugins/task-runtime-sqlite.ts"
    );
    const plugin = createSqliteTaskRuntimePlugin({ projectDir: process.cwd() });
    const markTaskStatusTool = plugin.tools["mark-task-status"] as {
      schema?: Record<string, unknown>;
    };

    expect(Object.keys(markTaskStatusTool.schema ?? {})).toEqual(["status"]);
    expect(markTaskStatusTool.schema).toMatchObject({
      status: [
        "created",
        "running",
        "outbound",
        "pr_following",
        "closing",
        "succeeded",
        "failed",
      ],
    });
    expect(markTaskStatusTool.schema).not.toHaveProperty("task_id");
    expect(markTaskStatusTool.schema).not.toHaveProperty("done");
    expect(markTaskStatusTool.schema).not.toHaveProperty("updated_at");
  });

  it("binds task-bound tools to the current session id", async () => {
    const taskDatabase = await createTaskDatabase("task-bound-tools");

    try {
      const { createSqliteTaskRuntimePlugin } = await import(
        "../../.opencode/plugins/task-runtime-sqlite.ts"
      );
      const plugin = createSqliteTaskRuntimePlugin({
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

      await (
        plugin.tools["setup-worktree-path"] as {
          execute: (
            input: { worktreePath: string },
            context: { sessionID: string },
          ) => Promise<unknown> | unknown;
        }
      ).execute(
        { worktreePath: "/repo/.worktrees/task-1" },
        { sessionID: "session-1" },
      );

      await (
        plugin.tools["setup-pull-request-url"] as {
          execute: (
            input: { pullRequestURL: string },
            context: { sessionID: string },
          ) => Promise<unknown> | unknown;
        }
      ).execute(
        { pullRequestURL: "https://github.com/acme/repo/pull/1" },
        { sessionID: "session-1" },
      );

      expect(
        await (
          plugin.tools["get-current-task"] as {
            execute: (
              input: Record<string, never>,
              context: { sessionID: string },
            ) => Promise<TaskRecord> | TaskRecord;
          }
        ).execute({}, { sessionID: "session-1" }),
      ).toMatchObject({
        task_id: "task-1",
        worktree_path: "/repo/.worktrees/task-1",
        pull_request_url: "https://github.com/acme/repo/pull/1",
      });

      await (
        plugin.tools["mark-task-status"] as {
          execute: (
            input: { status: string },
            context: { sessionID: string },
          ) => Promise<unknown> | unknown;
        }
      ).execute({ status: "succeeded" }, { sessionID: "session-1" });

      const repository = createTaskRepository({
        now: () => "2026-04-18T12:34:56.000Z",
        projectDir: taskDatabase.projectDir,
      });

      expect(repository.getRequiredTaskBySessionID("session-1")).toMatchObject({
        status: "succeeded",
        done: true,
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
