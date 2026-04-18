import { openTaskRuntimeDatabase, type TaskRecord } from "./database.js";

type ProcessingTaskRecord = Pick<
  TaskRecord,
  | "task_id"
  | "session_id"
  | "worktree_path"
  | "pull_request_url"
  | "status"
  | "updated_at"
>;

type CreateTaskRepositoryOptions = {
  projectDir: string;
  now: () => string;
};

export type TaskRepository = {
  listUnfinishedTasks(): TaskRecord[];
  listProcessingTasks(): ProcessingTaskRecord[];
  getTaskBySessionID(sessionID: string): TaskRecord | undefined;
  getRequiredTaskBySessionID(sessionID: string): TaskRecord;
  assignSession(taskID: string, sessionID: string): void;
};

const mapTaskRecord = (row: Record<string, unknown>): TaskRecord => ({
  task_id: String(row.task_id),
  task_spec: String(row.task_spec),
  session_id: row.session_id === null ? null : String(row.session_id),
  worktree_path: row.worktree_path === null ? null : String(row.worktree_path),
  pull_request_url:
    row.pull_request_url === null ? null : String(row.pull_request_url),
  status: row.status === null ? null : String(row.status),
  done: Number(row.done),
  updated_at: row.updated_at === null ? null : String(row.updated_at),
});

const mapProcessingTaskRecord = (
  row: Record<string, unknown>,
): ProcessingTaskRecord => ({
  task_id: String(row.task_id),
  session_id: row.session_id === null ? null : String(row.session_id),
  worktree_path: row.worktree_path === null ? null : String(row.worktree_path),
  pull_request_url:
    row.pull_request_url === null ? null : String(row.pull_request_url),
  status: row.status === null ? null : String(row.status),
  updated_at: row.updated_at === null ? null : String(row.updated_at),
});

const getTasksBySessionID = (
  projectDir: string,
  sessionID: string,
): TaskRecord[] => {
  const database = openTaskRuntimeDatabase(projectDir);

  try {
    const statement = database.prepare(
      `
        SELECT
          task_id,
          task_spec,
          session_id,
          worktree_path,
          pull_request_url,
          status,
          done,
          updated_at
        FROM tasks
        WHERE session_id = ?
      `,
    );

    return statement
      .all(sessionID)
      .map((row) => mapTaskRecord(row as Record<string, unknown>));
  } finally {
    database.close();
  }
};

export const createTaskRepository = ({
  projectDir,
  now,
}: CreateTaskRepositoryOptions): TaskRepository => ({
  listUnfinishedTasks() {
    const database = openTaskRuntimeDatabase(projectDir);

    try {
      const statement = database.prepare(
        `
          SELECT
            task_id,
            task_spec,
            session_id,
            worktree_path,
            pull_request_url,
            status,
            done,
            updated_at
          FROM tasks
          WHERE done = 0
          ORDER BY task_id
        `,
      );

      return statement
        .all()
        .map((row) => mapTaskRecord(row as Record<string, unknown>));
    } finally {
      database.close();
    }
  },

  listProcessingTasks() {
    const database = openTaskRuntimeDatabase(projectDir);

    try {
      const statement = database.prepare(
        `
          SELECT
            task_id,
            session_id,
            worktree_path,
            pull_request_url,
            status,
            updated_at
          FROM tasks
          WHERE done = 0
          ORDER BY task_id
        `,
      );

      return statement
        .all()
        .map((row) => mapProcessingTaskRecord(row as Record<string, unknown>));
    } finally {
      database.close();
    }
  },

  getTaskBySessionID(sessionID) {
    const matches = getTasksBySessionID(projectDir, sessionID);

    if (matches.length > 1) {
      throw new Error(`Multiple tasks are bound to session ${sessionID}`);
    }

    return matches[0];
  },

  getRequiredTaskBySessionID(sessionID) {
    const matches = getTasksBySessionID(projectDir, sessionID);

    if (matches.length === 0) {
      throw new Error("Current session is not bound to a task");
    }

    if (matches.length > 1) {
      throw new Error(`Multiple tasks are bound to session ${sessionID}`);
    }

    return matches[0];
  },

  assignSession(taskID, sessionID) {
    const database = openTaskRuntimeDatabase(projectDir);

    try {
      const statement = database.prepare(
        `
          UPDATE tasks
          SET session_id = ?, updated_at = ?
          WHERE task_id = ?
        `,
      );

      statement.run(sessionID, now(), taskID);
    } finally {
      database.close();
    }
  },
});
