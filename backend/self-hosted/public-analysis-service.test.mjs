import assert from "node:assert/strict";
import { test } from "node:test";

import { createPublicAnalysisService } from "./public-analysis-service.mjs";
import { hashPublicAnalysisToken } from "./public-analysis-repository.mjs";

test("Stage 6 public analysis service looks up by token hash only", async () => {
  const calls = [];
  const service = createPublicAnalysisService({
    publicAnalysisRepository: {
      async getByTokenHash(input) {
        calls.push(input);
        return { status: "expired", expiresAt: "2026-07-08T10:00:00.000Z" };
      },
    },
  });

  const result = await service.getPublicAnalysis("secret-public-link-001", {
    nowIso: "2026-07-08T12:00:00.000Z",
  });

  assert.deepEqual(result.analysis, {
    status: "expired",
    expiresAt: "2026-07-08T10:00:00.000Z",
  });
  assert.equal(calls[0].tokenHash, hashPublicAnalysisToken("secret-public-link-001"));
  assert.equal(calls[0].nowIso, "2026-07-08T12:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(calls), /secret-public-link-001/);
});

test("Stage 6 public analysis service rejects malformed tokens as not found", async () => {
  const service = createPublicAnalysisService({
    publicAnalysisRepository: {
      async getByTokenHash() {
        throw new Error("repository must not be called");
      },
    },
  });

  await assert.rejects(
    () => service.getPublicAnalysis("bad"),
    (error) => error.publicCode === "invalid_public_link" && error.publicStatus === 404,
  );
});
