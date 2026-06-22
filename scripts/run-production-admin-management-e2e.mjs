import { spawn } from "node:child_process";
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = "8080";
const BASE_URL = `http://${HOST}:${PORT}`;
const TIMEOUT_MS = 60_000;

function command(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function waitForUrl(url, timeoutMs = TIMEOUT_MS) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on("error", retry);
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 500);
    };

    poll();
  });
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, options);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${commandName} exited by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

function stopServer(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process may already be gone.
    }
  }
}

const env = {
  ...process.env,
  VITE_APP_MODE: "production",
  VITE_SELF_HOSTED_API_BASE_URL: BASE_URL,
};

const server = spawn(
  command("npm"),
  ["run", "dev", "--", "--host", HOST, "--port", PORT],
  {
    cwd: process.cwd(),
    detached: true,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  },
);

const serverErrors = [];
server.stderr.on("data", (chunk) => {
  const text = String(chunk);
  serverErrors.push(text);
  if (serverErrors.join("").length > 8_000) serverErrors.shift();
});

try {
  await waitForUrl(`${BASE_URL}/login`);
  const code = await run(
    command("npx"),
    ["playwright", "test", "e2e/production-admin-management.pw.ts", "--project=chromium"],
    { cwd: process.cwd(), env, stdio: "inherit" },
  );
  process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  const stderr = serverErrors.join("").trim();
  if (stderr) console.error(stderr);
  process.exitCode = 1;
} finally {
  stopServer(server);
}
