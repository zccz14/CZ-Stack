import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const dbPackageUrl = new URL("../../modules/db/package.json", import.meta.url);
const dbEntryUrl = new URL("../../modules/db/dist/index.mjs", import.meta.url);

type DbPackageManifest = {
  name: string;
  exports: {
    ".": {
      import: string;
      require: string;
      types: string;
    };
  };
};

type DbBoundaryModule = typeof import("../../modules/db/src/index.js");

let dbPackage: DbPackageManifest;
let dbModule: DbBoundaryModule;

beforeAll(async () => {
  dbPackage = JSON.parse(await readFile(dbPackageUrl, "utf8")) as DbPackageManifest;
  dbModule = (await import(pathToFileURL(fileURLToPath(dbEntryUrl)).href)) as DbBoundaryModule;
});

describe("db boundary package", () => {
  it("publishes the expected package export contract", () => {
    expect(dbPackage.name).toBe("@cz-stack/db");
    expect(dbPackage.exports["."]).toEqual({
      import: "./dist/index.mjs",
      require: "./dist/index.cjs",
      types: "./dist/index.d.mts",
    });
    expect(Object.keys(dbModule).sort()).toEqual([
      "SqliteAdapterError",
      "createSqliteAdapter",
      "defaultSqliteConnectionConfig",
    ]);
  });

  it("keeps the adapter boundary replaceable for repositories", async () => {
    type NoteRecord = {
      id: string;
      value: string;
    };

    const storage = new Map<string, NoteRecord>();

    const fakeAdapter: dbModule.DbAdapter = {
      kind: "fake",
      config: { filename: ":memory:" },
      async execute(sql, bindings) {
        if (sql === "insert-note") {
          const [id, value] = bindings as readonly [string, string];
          storage.set(id, { id, value });
          return { changes: 1, lastInsertRowId: null };
        }

        if (sql === "delete-note") {
          const [id] = bindings as readonly [string];
          const deleted = storage.delete(id);
          return { changes: deleted ? 1 : 0, lastInsertRowId: null };
        }

        throw new Error(`unexpected sql: ${sql}`);
      },
      async query(sql, bindings) {
        if (sql !== "select-note") {
          throw new Error(`unexpected sql: ${sql}`);
        }

        const [id] = bindings as readonly [string];
        const record = storage.get(id);
        return record ? [record] : [];
      },
      async transaction(callback) {
        return callback(this);
      },
      async close() {
        storage.clear();
      },
    };

    const repository: dbModule.DbRepository<NoteRecord, string> = {
      async findById(id) {
        const [record] = await fakeAdapter.query<NoteRecord>("select-note", [id]);
        return record ?? null;
      },
      async save(record) {
        await fakeAdapter.execute("insert-note", [record.id, record.value]);
        return record;
      },
      async delete(id) {
        const result = await fakeAdapter.execute("delete-note", [id]);
        return result.changes > 0;
      },
    };

    await expect(repository.save({ id: "note-1", value: "hello" })).resolves.toEqual({
      id: "note-1",
      value: "hello",
    });
    await expect(repository.findById("note-1")).resolves.toEqual({ id: "note-1", value: "hello" });
    await expect(repository.delete("note-1")).resolves.toBe(true);
    await expect(repository.findById("note-1")).resolves.toBeNull();
  });

  it("provides a sqlite-first adapter with minimal query and transaction support", async () => {
    const adapter = dbModule.createSqliteAdapter();

    try {
      await adapter.execute(
        "create table notes (id text primary key, value text not null)",
      );

      await adapter.transaction(async (tx) => {
        await tx.execute("insert into notes (id, value) values (?, ?)", ["note-1", "hello"]);
        await tx.execute("insert into notes (id, value) values (?, ?)", ["note-2", "world"]);
      });

      await expect(
        adapter.query<{ id: string; value: string }>(
          "select id, value from notes where id = ?",
          ["note-1"],
        ),
      ).resolves.toEqual([{ id: "note-1", value: "hello" }]);

      await expect(
        adapter.query<{ count: number }>("select count(*) as count from notes"),
      ).resolves.toEqual([{ count: 2 }]);
    } finally {
      await adapter.close();
    }
  });
});
