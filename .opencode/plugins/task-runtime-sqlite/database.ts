import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
