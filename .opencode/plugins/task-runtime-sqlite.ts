export type SqliteTaskRuntimePluginOptions = {
  projectDir: string;
};

export const createSqliteTaskRuntimePlugin = (
  _options: SqliteTaskRuntimePluginOptions,
) => ({
  name: "sqlite-task-runtime",
  tools: {
    "dispatch-tasks": {},
    "list-processing-tasks": {},
    "get-current-task": {},
    "mark-task-status": {},
    "setup-worktree-path": {},
    "setup-pull-request-url": {},
  },
});
