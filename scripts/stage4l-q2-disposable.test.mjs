import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  analyzeWriterFence,
  buildStage4LQ2Plan,
  parseStage4LQ2Args,
  renderStage4LQ2DryRun,
  runSyntheticWriter,
  validateDisposableInventory,
  verifyRestoredApplication,
} from "./stage4l-q2-disposable.mjs";

const GATE_ID = "skindoctor-q2-20260821-a";

test("Stage 4L Q2 plan binds two unique disposable projects and exact cleanup", () => {
  const options = parseStage4LQ2Args([
    "--dry-run",
    `--gate-id=${GATE_ID}`,
    "--source-port=19121",
    "--source-minio-port=19122",
    "--restore-port=19123",
    "--restore-minio-port=19124",
  ]);
  const plan = buildStage4LQ2Plan(options);
  const out = renderStage4LQ2DryRun(plan);

  assert.equal(plan.sourceProject, `${GATE_ID}-source`);
  assert.equal(plan.restoreProject, `${GATE_ID}-restore`);
  assert.equal(plan.backupDir, `backups/self-hosted/${GATE_ID}`);
  assert.match(out, new RegExp(`${GATE_ID}-source`));
  assert.match(out, new RegExp(`${GATE_ID}-restore`));
  assert.match(out, /concurrent synthetic upload writer/);
  assert.match(out, /quiesced backup and five-counter reconciliation/);
  assert.match(out, /sealed restore and read-only application verification/);
  assert.match(out, /down --volumes --remove-orphans --rmi local/);
  assert.match(out, /zero containers, volumes, networks, backup files/);
  assert.doesNotMatch(out, /dermatolog-pro-production|91\.107\.120\.59|20260819163303/);
});

test("Stage 4L Q2 rejects production-like ids and duplicate ports", () => {
  assert.throws(
    () => parseStage4LQ2Args(["--gate-id=skindoctor-q2-production"]),
    /production-like/i,
  );
  assert.throws(
    () => parseStage4LQ2Args([
      `--gate-id=${GATE_ID}`,
      "--source-port=19121",
      "--restore-port=19121",
    ]),
    /four unique ports/i,
  );
  assert.throws(
    () => parseStage4LQ2Args(["--dry-run", "--execute", `--gate-id=${GATE_ID}`]),
    /mutually exclusive/i,
  );
});

test("Stage 4L Q2 preflight rejects any existing disposable resource collision", () => {
  const plan = buildStage4LQ2Plan(parseStage4LQ2Args([`--gate-id=${GATE_ID}`]));
  assert.throws(
    () => validateDisposableInventory(plan, {
      containers: [{ name: `${plan.sourceProject}-backend-1`, project: plan.sourceProject }],
      volumes: [],
      networks: [],
    }),
    /already exists/i,
  );
  assert.deepEqual(
    validateDisposableInventory(plan, {
      containers: [{ name: "yorso-self-hosted-api-1", project: "yorso-self-hosted" }],
      volumes: ["yorso-self-hosted_yorso-postgres-data"],
      networks: ["yorso-self-hosted_default"],
    }),
    { ok: true },
  );
});

test("Stage 4L Q2 synthetic writer records accepted and fenced attempts without secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage4l-q2-writer-"));
  const resultPath = join(root, "writer.json");
  const responses = [
    new Response(JSON.stringify({ accessToken: "header.secret.signature" }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "patient-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "visit-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ item: { id: "asset-1" } }), { status: 201 }),
    new Response(JSON.stringify({ error: { code: "unavailable" } }), { status: 503 }),
  ];
  const times = [
    "2026-08-21T10:00:00.000Z",
    "2026-08-21T10:00:00.050Z",
    "2026-08-21T10:00:00.100Z",
    "2026-08-21T10:00:00.150Z",
  ];
  try {
    const result = await runSyntheticWriter({
      baseUrl: "http://127.0.0.1:19121",
      resultPath,
      maxAttempts: 2,
      intervalMs: 0,
      fetchImpl: async () => responses.shift(),
      now: () => times.shift(),
      sleep: async () => {},
    });
    assert.equal(result.acceptedCount, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.attempts[0].accepted, true);
    assert.equal(result.attempts[1].accepted, false);
    const saved = await readFile(resultPath, "utf8");
    assert.doesNotMatch(saved, /header\.secret|demo-password|stage4l-q2-writer-0/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Stage 4L Q2 requires accepted-before, rejected-inside, and accepted-after fence evidence", () => {
  const quiescedAt = "2026-08-21T10:00:01.000Z";
  const resumedAt = "2026-08-21T10:00:03.000Z";
  const result = analyzeWriterFence({
    attempts: [
      {
        startedAt: "2026-08-21T10:00:00.000Z",
        finishedAt: "2026-08-21T10:00:00.100Z",
        accepted: true,
      },
      {
        startedAt: "2026-08-21T10:00:01.200Z",
        finishedAt: "2026-08-21T10:00:01.300Z",
        accepted: false,
      },
      {
        startedAt: "2026-08-21T10:00:03.100Z",
        finishedAt: "2026-08-21T10:00:03.200Z",
        accepted: true,
      },
    ],
  }, { quiescedAt, resumedAt });
  assert.deepEqual(result, {
    acceptedBeforeFence: 1,
    rejectedInsideFence: 1,
    acceptedAfterFence: 1,
  });
  assert.throws(
    () => analyzeWriterFence({ attempts: [] }, { quiescedAt, resumedAt }),
    /did not prove/i,
  );
});

test("Stage 4L Q2 verifies the restored app and source seed bytes without writing", async () => {
  const assetId = "11111111-1111-4111-8111-111111111111";
  const bytes = Buffer.from("stage4l-q2-seed", "utf8");
  const expectedSha256 = "c7b3a7f066890c57f70067b6da160da2bdd4e5ce70c612b692913f6a30aacd6c";
  const responses = [
    new Response("ok", { status: 200 }),
    new Response("ready", { status: 200 }),
    new Response(JSON.stringify({ accessToken: "header.secret.signature" }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "patient-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: "visit-1" }] }), { status: 200 }),
    new Response(JSON.stringify({ item: { downloadUrl: `/api/v1/assets/${assetId}/download` } }), { status: 200 }),
    new Response(bytes, { status: 200 }),
  ];
  const result = await verifyRestoredApplication({
    baseUrl: "http://127.0.0.1:19123",
    assetId,
    expectedSha256,
    fetchImpl: async () => responses.shift(),
  });
  assert.deepEqual(result, {
    ok: true,
    healthz: 200,
    readyz: 200,
    assetChecksumMatch: true,
  });
});

test("Stage 4L Q2 CLI defaults to a mutation-free dry run", () => {
  const result = spawnSync(process.execPath, ["scripts/stage4l-q2-disposable.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /disposable synthetic plan/);
  assert.match(result.stdout, /Production names.*forbidden targets/);
});
