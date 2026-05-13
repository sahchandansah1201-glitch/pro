import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStage4KPlan,
  parseStage4KArgs,
  renderStage4KDryRun,
  runStage4KSmoke,
} from "./stage4k-self-hosted-compose-smoke.mjs";

test("Stage 4K dry run lists compose, health, auth, visit, asset, and cleanup steps", () => {
  const out = renderStage4KDryRun({ appPort: "19090", skipBuild: true });
  assert.match(out, /docker compose -f deploy\/self-hosted\/docker-compose\.stage4a\.yml/);
  assert.match(out, /http:\/\/127\.0\.0\.1:19090\/healthz/);
  assert.match(out, /\/api\/v1\/auth\/login/);
  assert.match(out, /\/api\/v1\/patients\/\{id\}\/visits/);
  assert.match(out, /\/api\/v1\/visits\/\{id\}\/assets/);
  assert.match(out, /\/api\/v1\/assets\/\{id\}\/download/);
  assert.match(out, /down -v/);
  assert.doesNotMatch(out, /demo-password|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4K argument parser validates ports and supports summary path", () => {
  const parsed = parseStage4KArgs([
    "--skip-build",
    "--keep-up-on-fail",
    "--app-port=19091",
    "--summary",
    "test-results/custom.md",
  ]);
  assert.equal(parsed.skipBuild, true);
  assert.equal(parsed.keepUpOnFail, true);
  assert.equal(parsed.appPort, "19091");
  assert.equal(parsed.summaryPath, "test-results/custom.md");
  assert.throws(() => parseStage4KArgs(["--app-port=abc"]), /numeric/);
});

test("Stage 4K plan includes npm build unless skipped", () => {
  assert.equal(buildStage4KPlan({ skipBuild: false }).steps[0][0], "npm");
  assert.equal(buildStage4KPlan({ skipBuild: true }).steps[0][0], "docker");
});

test("Stage 4K smoke success checks login, patients, visits, asset upload, download, and cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage4k-smoke-test-"));
  const summaryPath = join(root, "summary.md");
  const commands = [];
  const responses = [
    new Response("{}", { status: 200 }),
    new Response("{}", { status: 200 }),
    new Response(JSON.stringify({ error: { code: "auth_required" } }), { status: 401 }),
    new Response(JSON.stringify({ accessToken: "header.payload.signature" }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "patient-empty" }, { id: "patient-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ items: [] }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "visit-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ item: { id: "asset-1" } }), { status: 201 }),
    new Response(JSON.stringify({ item: { downloadUrl: "/api/v1/assets/asset-1/download" } }), { status: 200 }),
    new Response(Buffer.from("stage4k-smoke-asset"), { status: 200 }),
  ];
  try {
    const result = await runStage4KSmoke({
      options: parseStage4KArgs(["--skip-build", "--summary", summaryPath]),
      spawn: (cmd, args) => {
        commands.push(`${cmd} ${args.join(" ")}`);
        return { status: 0, stdout: "", stderr: "" };
      },
      fetchImpl: async () => responses.shift(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.patientId, "patient-1");
    assert.equal(result.visitId, "visit-1");
    assert.equal(result.assetId, "asset-1");
    assert.ok(commands.some((cmd) => cmd.includes("up -d --build")));
    assert.ok(commands.some((cmd) => cmd.includes("down -v")));
    const summary = await readFile(summaryPath, "utf8");
    assert.match(summary, /Status: `ok`/);
    assert.doesNotMatch(summary, /header\.payload|demo-password|stage4k-smoke-asset/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Stage 4K smoke keeps compose up on failure when requested", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage4k-smoke-fail-"));
  const summaryPath = join(root, "summary.md");
  const commands = [];
  const responses = [
    new Response("{}", { status: 200 }),
    new Response("{}", { status: 200 }),
    new Response("{}", { status: 500 }),
  ];
  try {
    const result = await runStage4KSmoke({
      options: parseStage4KArgs(["--skip-build", "--keep-up-on-fail", "--summary", summaryPath]),
      spawn: (cmd, args) => {
        commands.push(`${cmd} ${args.join(" ")}`);
        return { status: 0, stdout: "", stderr: "" };
      },
      fetchImpl: async () => responses.shift(),
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /expected 401/);
    assert.ok(commands.some((cmd) => cmd.includes("up -d --build")));
    assert.ok(!commands.some((cmd) => cmd.includes("down -v")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
