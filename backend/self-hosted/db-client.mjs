import { spawn } from "node:child_process";

const DEFAULT_QUERY_TIMEOUT_MS = 5000;
const MAX_STDIO_BYTES = 64_000;

export class DatabaseConfigError extends Error {
  constructor(message = "DATABASE_URL is not configured.") {
    super(message);
    this.name = "DatabaseConfigError";
    this.publicCode = "database_not_configured";
    this.publicStatus = 503;
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(message = "PostgreSQL is unavailable.") {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.publicCode = "database_unavailable";
    this.publicStatus = 503;
  }
}

function trimStdio(value) {
  const text = String(value || "");
  return text.length > MAX_STDIO_BYTES ? text.slice(0, MAX_STDIO_BYTES) : text;
}

function redactDatabaseText(value) {
  return String(value || "")
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[redacted]@")
    .replace(/password=[^&\s]+/gi, "password=[redacted]");
}

export function databaseUrlToPsqlEnv(databaseUrl) {
  if (!databaseUrl) {
    throw new DatabaseConfigError();
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new DatabaseConfigError("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new DatabaseConfigError("DATABASE_URL must use postgres:// or postgresql://.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !database || !parsed.username) {
    throw new DatabaseConfigError("DATABASE_URL must include host, database, and user.");
  }

  const env = {
    PGHOST: parsed.hostname,
    PGDATABASE: database,
    PGUSER: decodeURIComponent(parsed.username),
    PGPORT: parsed.port || "5432",
  };

  if (parsed.password) {
    env.PGPASSWORD = decodeURIComponent(parsed.password);
  }

  const sslMode = parsed.searchParams.get("sslmode");
  if (sslMode) {
    env.PGSSLMODE = sslMode;
  }

  return env;
}

export function runPsqlJson({
  databaseUrl,
  sql,
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
  spawnImpl = spawn,
}) {
  const pgEnv = databaseUrlToPsqlEnv(databaseUrl);

  return new Promise((resolve, reject) => {
    const child = spawnImpl(
      "psql",
      [
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set",
        "ON_ERROR_STOP=1",
        "--command",
        sql,
      ],
      {
        env: {
          ...process.env,
          ...pgEnv,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new DatabaseUnavailableError("PostgreSQL query timed out."));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout = trimStdio(stdout + chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = trimStdio(stderr + chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const message = error?.code === "ENOENT"
        ? "psql command is not available in the backend runtime."
        : "PostgreSQL query failed before it could start.";
      reject(new DatabaseUnavailableError(message));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const safeStderr = redactDatabaseText(stderr.trim());
        reject(
          new DatabaseUnavailableError(
            safeStderr ? `PostgreSQL query failed: ${safeStderr}` : "PostgreSQL query failed.",
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim() || "null"));
      } catch {
        reject(new DatabaseUnavailableError("PostgreSQL returned invalid JSON."));
      }
    });
  });
}

export function createPostgresClient(config, options = {}) {
  const databaseUrl = config.databaseUrl || "";
  const runner = options.runner || runPsqlJson;
  const timeoutMs = options.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;

  return {
    async checkConnection() {
      await runner({
        databaseUrl,
        timeoutMs,
        sql: "select json_build_object('ok', true)::text;",
      });
      return {
        connected: true,
        detail: "PostgreSQL connection verified",
      };
    },

    async queryJson(sql, queryOptions = {}) {
      return runner({
        databaseUrl,
        sql,
        timeoutMs: queryOptions.timeoutMs ?? timeoutMs,
      });
    },
  };
}
