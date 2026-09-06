import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/e2e-smoke.yml", import.meta.url);
const workflow = readFileSync(workflowPath, "utf8");

function occurrences(needle) {
  return workflow.split(needle).length - 1;
}

test("e2e smoke owns the exact Vite port before accepting readiness", () => {
  assert.doesNotMatch(
    workflow,
    /npm run dev -- --host 127\.0\.0\.1 --port 8080/,
    "npm wrapper PID cannot prove ownership of the child Vite process",
  );
  assert.equal(
    occurrences(
      "./node_modules/.bin/vite --host 127.0.0.1 --port 8080 --strictPort",
    ),
    2,
    "both development and production-mode starts must fail closed on an occupied port",
  );
  assert.equal(
    occurrences('if ! kill -0 "$vite_pid" 2>/dev/null; then'),
    2,
    "each readiness loop must prove that its newly started Vite process is alive",
  );
  assert.equal(
    occurrences(
      String.raw`vite_url_pattern=$'http://127\.0\.0\.1:(\033\[[0-9;]*m)*8080(\033\[[0-9;]*m)*/'`,
    ),
    2,
    "both starts must accept only ANSI SGR sequences around the exact Vite port",
  );
  assert.equal(
    occurrences('grep -Eq "$vite_url_pattern" "$vite_log" >/dev/null'),
    2,
    "readiness must match the exact ANSI-safe URL in each new process startup log",
  );
  assert.match(
    workflow,
    /Port 8080 is still served after stopping previous Vite/,
    "restart must reject a stale HTTP server before starting production mode",
  );
  assert.match(
    workflow,
    /name: Verify e2e smoke workflow contract\s+run: node --test scripts\/e2e-smoke-workflow\.test\.mjs/,
    "the workflow must run its orchestration contract before browser tests",
  );
});

test("e2e smoke readiness accepts plain and ANSI-colored exact Vite URLs", () => {
  const sgrSequence = "\u001b\\[[0-9;]*m";
  const viteUrlPattern = `http://127\\.0\\.0\\.1:(${sgrSequence})*8080(${sgrSequence})*/`;
  const logs = [
    "Local: http://127.0.0.1:8080/\n",
    "Local: \u001b[36mhttp://127.0.0.1:\u001b[1m8080\u001b[22m/\u001b[39m\n",
  ];

  for (const log of logs) {
    const result = spawnSync("grep", ["-Eq", viteUrlPattern], {
      encoding: "utf8",
      input: log,
    });
    assert.equal(result.status, 0, `exact Vite URL was not recognized in ${JSON.stringify(log)}`);
  }

  const wrongPort = spawnSync("grep", ["-Eq", viteUrlPattern], {
    encoding: "utf8",
    input: "Local: \u001b[36mhttp://127.0.0.1:\u001b[1m8081\u001b[22m/\u001b[39m\n",
  });
  assert.equal(wrongPort.status, 1, "ANSI-safe readiness must still reject a different port");
});
