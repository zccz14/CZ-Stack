import { join } from "node:path";

export type TaskRuntimeDatabase = {
  projectDir: string;
  path: string;
};

export const getTaskRuntimeDatabasePath = (projectDir: string) =>
  join(projectDir, "aim.sqlite");

export const createTaskRuntimeDatabase = (
  projectDir: string,
): TaskRuntimeDatabase => ({
  projectDir,
  path: getTaskRuntimeDatabasePath(projectDir),
});
