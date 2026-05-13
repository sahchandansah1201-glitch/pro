import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import {
  createPostgresClient,
  databaseUrlToPsqlEnv,
  DatabaseConfigError,
  DatabaseUnavailableError,
  runPsqlJson,
} from "./db-client.mjs";

test("databaseUrlToPsqlEnv parses PostgreSQL URLs without exposing secrets in args", () => {
  const env = databaseUrlToPsqlEnv(
    "postgres://dermatolog:s3cret@postgres:5432/dermatolog_pro?sslmode=require",
  );

  assert.deepEqual(env, {
    PGHOST: "postgres",
    PGDATABASE: "dermatolog_pro",
    PGUSER: "dermatolog",
    PGPORT: "5432",
    PGPASSWORD: "s3cret",
    PGSSLMODE: "require",
  });
});

test("databaseUrlToPsqlEnv rejects missing and non-PostgreSQL URLs", () => {
  assert.throws(() => databaseUrlToPsqlEnv(""), DatabaseConfigError);
  assert.throws(() => databaseUrlToPsqlEnv("https://example.test/db"), DatabaseConfigError);
});

test("runPsqlJson uses env-based connection and parses JSON stdout", async () => {
  let capturedArgs = null;
  let capturedEnv = null;
  const spawnImpl = (_cmd, args, options) => {
    capturedArgs = args;
    capturedEnv = options.env;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => undefined;
    queueMicrotask(() => {
      child.stdout.emit("data", '{"ok":true}');
      child.emit("close", 0);
    });
    return child;
  };

  const result = await runPsqlJson({
    databaseUrl: "postgres://user:secret@localhost:5432/app",
    sql: "select json_build_object('ok', true)::text;",
    timeoutMs: 100,
    spawnImpl,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(capturedEnv.PGPASSWORD, "secret");
  assert.equal(capturedEnv.PGDATABASE, "app");
  assert.doesNotMatch(capturedArgs.join(" "), /secret|postgres:\/\/user/);
});

test("runPsqlJson maps psql failures to safe unavailable errors", async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => undefined;
    queueMicrotask(() => {
      child.stderr.emit(
        "data",
        "psql: error: connection to postgres://user:secret@localhost:5432/app failed",
      );
      child.emit("close", 2);
    });
    return child;
  };

  await assert.rejects(
    () =>
      runPsqlJson({
        databaseUrl: "postgres://user:secret@localhost:5432/app",
        sql: "select 1",
        timeoutMs: 100,
        spawnImpl,
      }),
    (error) => {
      assert.ok(error instanceof DatabaseUnavailableError);
      assert.doesNotMatch(error.message, /secret|postgres:\/\/user/);
      assert.match(error.message, /\[redacted\]/);
      return true;
    },
  );
});

test("createPostgresClient delegates checks and JSON queries through the runner", async () => {
  const calls = [];
  const client = createPostgresClient(
    { databaseUrl: "postgres://user:secret@localhost:5432/app" },
    {
      runner(args) {
        calls.push(args.sql);
        return Promise.resolve(calls.length === 1 ? { ok: true } : [{ id: "p-1" }]);
      },
    },
  );

  const check = await client.checkConnection();
  const rows = await client.queryJson("select 'patients'::text;");

  assert.equal(check.connected, true);
  assert.deepEqual(rows, [{ id: "p-1" }]);
  assert.match(calls[0], /json_build_object/);
  assert.match(calls[1], /patients/);
});
