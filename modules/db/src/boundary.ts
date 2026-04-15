export type DbPrimitive = string | number | bigint | Uint8Array | null;

export type DbStatementBindings = readonly DbPrimitive[];

export type DbRow = Record<string, unknown>;

export type DbCommandResult = {
  changes: number;
  lastInsertRowId: number | null;
};

export type DbConnectionConfig = {
  filename: string;
  readonly?: boolean;
  foreignKeys?: boolean;
  timeoutMs?: number;
};

export interface DbQueryable {
  query<TRow extends DbRow = DbRow>(sql: string, bindings?: DbStatementBindings): Promise<TRow[]>;
  execute(sql: string, bindings?: DbStatementBindings): Promise<DbCommandResult>;
}

export interface DbTransaction extends DbQueryable {}

export interface DbAdapter extends DbQueryable {
  readonly kind: string;
  readonly config: Readonly<DbConnectionConfig>;
  transaction<TResult>(callback: (transaction: DbTransaction) => Promise<TResult> | TResult): Promise<TResult>;
  close(): Promise<void>;
}

export interface DbRepository<TRecord, TKey = string> {
  findById(id: TKey): Promise<TRecord | null>;
  save(record: TRecord): Promise<TRecord>;
  delete(id: TKey): Promise<boolean>;
}
