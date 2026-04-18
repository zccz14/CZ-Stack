import {
  createTaskRepository,
  TASK_STATUSES,
  type TaskStatus,
} from "./task-runtime-sqlite/task-repository.js";

export type SqliteTaskRuntimePluginOptions = {
  projectDir: string;
};

type ToolContext = {
  sessionID: string;
};

const createTaskBoundTools = (options: SqliteTaskRuntimePluginOptions) => {
  const getRepository = () =>
    createTaskRepository({
      now: () => new Date().toISOString(),
      projectDir: options.projectDir,
    });

  return {
    "dispatch-tasks": {},
    "list-processing-tasks": {
      schema: {},
      execute: () => getRepository().listProcessingTasks(),
    },
    "get-current-task": {
      schema: {},
      execute: (_input: Record<string, never>, context: ToolContext) =>
        getRepository().getRequiredTaskBySessionID(context.sessionID),
    },
    "mark-task-status": {
      schema: { status: [...TASK_STATUSES] },
      execute: (input: { status: TaskStatus }, context: ToolContext) =>
        getRepository().markTaskStatus({
          sessionID: context.sessionID,
          status: input.status,
        }),
    },
    "setup-worktree-path": {
      schema: { worktreePath: true },
      execute: (input: { worktreePath: string }, context: ToolContext) =>
        getRepository().setupWorktreePath({
          sessionID: context.sessionID,
          worktreePath: input.worktreePath,
        }),
    },
    "setup-pull-request-url": {
      schema: { pullRequestURL: true },
      execute: (input: { pullRequestURL: string }, context: ToolContext) =>
        getRepository().setupPullRequestURL({
          sessionID: context.sessionID,
          pullRequestURL: input.pullRequestURL,
        }),
    },
  };
};

export const createSqliteTaskRuntimePlugin = (
  options: SqliteTaskRuntimePluginOptions,
) => ({
  name: "sqlite-task-runtime",
  tools: createTaskBoundTools(options),
});
