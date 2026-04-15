import { DatabaseSync } from "node:sqlite";

import type { DbAdapter, DbCommandResult, DbConnectionConfig, DbRow, DbStatementBindings, DbTransaction } from "./boundary.js";

export const defaultSqliteConnectionConfig = Object.freeze({
  filename: ":memory:",
  foreignKeys: true,
  timeoutMs: 5_000,
} satisfies DbConnectionConfig);

export class SqliteAdapterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SqliteAdapterError";
  }
}

type SqliteAdapterOptions = {
  config?: DbConnectionConfig;
};

class SqliteAdapter implements DbAdapter {
  readonly kind = "sqlite";
  readonly config: Readonly<DbConnectionConfig>;

  #database: DatabaseSync | null;
  #transactionScope: DbTransaction;

  constructor(options: SqliteAdapterOptions = {}) {
    this.config = Object.freeze({
      ...defaultSqliteConnectionConfig,
      ...options.config,
    });
    this.#database = new DatabaseSync(this.config.filename, {
      open: true,
      readOnly: this.config.readonly ?? false,
      timeout: this.config.timeoutMs,
    });
    if (this.config.foreignKeys ?? true) {
      this.#database.exec("pragma foreign_keys = on");
    }
    this.#transactionScope = {
      execute: (sql, bindings) => this.execute(sql, bindings),
      query: (sql, bindings) => this.query(sql, bindings),
    };
  }

  async query<TRow extends DbRow = DbRow>(sql: string, bindings: DbStatementBindings = []): Promise<TRow[]> {
    const statement = this.#getDatabase().prepare(sql);
    return statement.all(...bindings) as TRow[];
  }

  async execute(sql: string, bindings: DbStatementBindings = []): Promise<DbCommandResult> {
    const statement = this.#getDatabase().prepare(sql);
    const result = statement.run(...bindings);

    return {
      changes: Number(result.changes),
      lastInsertRowId: typeof result.lastInsertRowid === "bigint" ? Number(result.lastInsertRowid) : null,
    };
  }

  async transaction<TResult>(callback: (transaction: DbTransaction) => Promise<TResult> | TResult): Promise<TResult> {
    const database = this.#getDatabase();
    database.exec("begin");

    try {
      const result = await callback(this.#transactionScope);
      database.exec("commit");
      return result;
    } catch (error) {
      database.exec("rollback");
      throw new SqliteAdapterError("SQLite transaction failed.", { cause: error });
    }
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = null;
  }

  #getDatabase(): DatabaseSync {
    if (this.#database === null) {
      throw new SqliteAdapterError("SQLite adapter is closed.");
    }

    return this.#database;
  }
}

export const createSqliteAdapter = (options?: SqliteAdapterOptions): DbAdapter => new SqliteAdapter(options);

export type { SqliteAdapterOptions };
