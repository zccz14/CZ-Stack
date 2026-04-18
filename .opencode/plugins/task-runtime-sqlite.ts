import { createTaskRuntimeDatabase } from "./task-runtime-sqlite/database.js";
import { createPromptBuilder } from "./task-runtime-sqlite/prompt-builder.js";
import { createSessionRuntime } from "./task-runtime-sqlite/session-runtime.js";
import { createTaskRepository } from "./task-runtime-sqlite/task-repository.js";

export type SqliteTaskRuntimePluginOptions = {
  projectDir: string;
};

export const createSqliteTaskRuntimePlugin = ({
  projectDir,
}: SqliteTaskRuntimePluginOptions) => {
  const database = createTaskRuntimeDatabase(projectDir);
  const repository = createTaskRepository({ database, projectDir });
  const sessionRuntime = createSessionRuntime();
  const promptBuilder = createPromptBuilder();

  return {
    name: "sqlite-task-runtime",
    repository,
    sessionRuntime,
    promptBuilder,
    tools: {
      "dispatch-tasks": {},
      "list-processing-tasks": {},
      "get-current-task": {},
      "mark-task-status": {},
      "setup-worktree-path": {},
      "setup-pull-request-url": {},
    },
  };
};
