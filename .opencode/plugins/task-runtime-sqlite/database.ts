import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type TaskRecord = {
  task_id: string;
  task_spec: string;
  session_id: string | null;
  worktree_path: string | null;
  pull_request_url: string | null;
  status: string | null;
  done: number;
  updated_at: string | null;
};

export type TaskRuntimeDatabase = {
  projectDir: string;
  path: string;
  open(): DatabaseSync;
};

export const getTaskRuntimeDatabasePath = (projectDir: string) =>
  join(projectDir, "aim.sqlite");

export const openTaskRuntimeDatabase = (projectDir: string) =>
  new DatabaseSync(getTaskRuntimeDatabasePath(projectDir));

export const createTaskRuntimeDatabase = (
  projectDir: string,
): TaskRuntimeDatabase => ({
  projectDir,
  path: getTaskRuntimeDatabasePath(projectDir),
  open: () => openTaskRuntimeDatabase(projectDir),
});
