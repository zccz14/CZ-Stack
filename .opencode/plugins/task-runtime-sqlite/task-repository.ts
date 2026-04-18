import type { TaskRuntimeDatabase } from "./database.js";

export type TaskRepository = {
  database: TaskRuntimeDatabase;
  projectDir: string;
};

export const createTaskRepository = ({
  database,
  projectDir,
}: TaskRepository) => ({
  database,
  projectDir,
});
