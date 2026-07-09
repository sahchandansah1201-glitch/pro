import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  parseLiveAuthSessionE2EArgs,
  runLiveAuthSessionE2E,
} from "./run-production-auth-session-live-e2e.mjs";

test("live auth/session parser accepts the read-only production journey", () => {
  const parsed = parseLiveAuthSessionE2EArgs([
    "--base-url",
    "https://pro.example.test/",
    "--credentials-file",
    "/root/credentials.txt",
  ], {});

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.baseUrl, "https://pro.example.test/");
  assert.equal(parsed.credentialsFile, "/root/credentials.txt");
});

test("live auth/session runner blocks a Stage 4M receipt from another HEAD", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-session-live-"));
  try {
    const credentialsFile = join(root, "credentials.txt");
    const deployStatusFile = join(root, "status.json");
    writeFileSync(credentialsFile, "Email: admin@example.test\nPassword: secret\n");
    writeFileSync(deployStatusFile, JSON.stringify({
      status: "ok",
      runId: "run-old",
      git: { after: { head: "aaaaaaa" } },
    }));

    const code = runLiveAuthSessionE2E([
      "--base-url",
      "https://pro.example.test",
      "--credentials-file",
      credentialsFile,
      "--deploy-status-json",
      deployStatusFile,
    ], {
      cwd: root,
      currentHead: () => "bbbbbbb",
      hasPlaywright: () => true,
      spawn: () => {
        throw new Error("spawn must not run for a stale deployed HEAD");
      },
    });

    assert.equal(code, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("live auth/session runner targets its Playwright spec after an ok matching deploy", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-session-live-"));
  try {
    const credentialsFile = join(root, "credentials.txt");
    const deployStatusFile = join(root, "status.json");
    writeFileSync(credentialsFile, "Email: admin@example.test\nPassword: secret\n");
    writeFileSync(deployStatusFile, JSON.stringify({
      status: "ok",
      runId: "run-current",
      git: { after: { head: "bbbbbbb" } },
    }));
    let spawned = null;

    const code = runLiveAuthSessionE2E([
      "--base-url",
      "https://pro.example.test",
      "--credentials-file",
      credentialsFile,
      "--deploy-status-json",
      deployStatusFile,
    ], {
      cwd: root,
      currentHead: () => "bbbbbbb",
      hasPlaywright: () => true,
      spawn: (command, args, options) => {
        spawned = { command, args, options };
        return { status: 0 };
      },
    });

    assert.equal(code, 0);
    assert.ok(spawned);
    assert.ok(spawned.args.includes("e2e/production-auth-session-live.pw.ts"));
    assert.equal(spawned.options.env.STAGE4M_LIVE_AUTH_BASE_URL, "https://pro.example.test");
    assert.equal(spawned.options.env.STAGE4M_AUTH_CREDENTIALS_FILE, credentialsFile);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
