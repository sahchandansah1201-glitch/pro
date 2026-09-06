import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
      'grep -F "http://127.0.0.1:8080/" "$vite_log" >/dev/null',
    ),
    2,
    "readiness must be backed by the startup log of the newly started process",
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
