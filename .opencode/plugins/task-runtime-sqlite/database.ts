import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const INCOMPATIBLE_TASKS_TABLE_ERROR =
  "Existing tasks table schema is incompatible with sqlite task runtime";

const REQUIRED_TASK_COLUMNS = [
  ["task_id", "TEXT"],
  ["task_spec", "TEXT"],
  ["session_id", "TEXT"],
  ["worktree_path", "TEXT"],
  ["pull_request_url", "TEXT"],
  ["status", "TEXT"],
  ["done", "INTEGER"],
  ["updated_at", "TEXT"],
] as const;

type TableInfoRow = {
  name: string;
  type: string;
};

const createTasksTable = (database: DatabaseSync) => {
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
};

const assertTasksTableSchema = (database: DatabaseSync) => {
  const columns = database
    .prepare(`PRAGMA table_info('tasks')`)
    .all()
    .map((row) => ({
      name: String((row as Record<string, unknown>).name),
      type: String((row as Record<string, unknown>).type).toUpperCase(),
    })) satisfies TableInfoRow[];

  if (columns.length === 0) {
    createTasksTable(database);
    return;
  }

  const columnTypes = new Map(columns.map((column) => [column.name, column.type]));

  for (const [name, type] of REQUIRED_TASK_COLUMNS) {
    if (columnTypes.get(name) !== type) {
      throw new Error(INCOMPATIBLE_TASKS_TABLE_ERROR);
    }
  }
};

export type TaskRecord = {
  task_id: string;
  task_spec: string;
  session_id: string | null;
  worktree_path: string | null;
  pull_request_url: string | null;
  status: string | null;
  done: boolean;
  updated_at: string | null;
};

export type TaskRuntimeDatabase = {
  projectDir: string;
  path: string;
  open(): DatabaseSync;
};

export const getTaskRuntimeDatabasePath = (projectDir: string) =>
  join(projectDir, "aim.sqlite");

export const openTaskRuntimeDatabase = (projectDir: string) => {
  const database = new DatabaseSync(getTaskRuntimeDatabasePath(projectDir));

  try {
    assertTasksTableSchema(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};

export const createTaskRuntimeDatabase = (
  projectDir: string,
): TaskRuntimeDatabase => ({
  projectDir,
  path: getTaskRuntimeDatabasePath(projectDir),
  open: () => openTaskRuntimeDatabase(projectDir),
});
