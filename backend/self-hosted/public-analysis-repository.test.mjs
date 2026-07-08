import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetPublicAnalysisByTokenHashSql,
  createPublicAnalysisRepository,
  hashPublicAnalysisToken,
} from "./public-analysis-repository.mjs";

test("Stage 6 public analysis hashes tokens and SQL omits raw public secret fields", () => {
  const tokenHash = hashPublicAnalysisToken("public-token-value");
  assert.match(tokenHash, /^[a-f0-9]{64}$/);

  const sql = buildGetPublicAnalysisByTokenHashSql({
    tokenHash,
    nowIso: "2026-07-08T12:00:00.000Z",
  });

  assert.match(sql, /from public_analysis_links pal/);
  assert.match(sql, /reports r/);
  assert.match(sql, /patient_safe_text/);
  assert.doesNotMatch(sql, /physician_text|object_key|object_bucket|storagePath|signedUrl|accessToken|qrToken|sessionId/i);
});

test("Stage 6 public analysis repository normalizes valid and missing rows", async () => {
  const validRepository = createPublicAnalysisRepository({
    async queryJson() {
      return {
        status: "valid",
        safeSummary: "Покажите врачу на контрольном приёме.",
        createdAt: "2026-07-08T10:00:00.000Z",
        clinicName: "Клиника",
        qualityPassed: true,
        expiresAt: "2026-07-09T10:00:00.000Z",
      };
    },
  });

  assert.deepEqual(await validRepository.getByTokenHash({ tokenHash: "a".repeat(64), nowIso: "2026-07-08T12:00:00.000Z" }), {
    status: "valid",
    safeSummary: "Покажите врачу на контрольном приёме.",
    createdAt: "2026-07-08T10:00:00.000Z",
    clinicName: "Клиника",
    qualityPassed: true,
    expiresAt: "2026-07-09T10:00:00.000Z",
  });

  const missingRepository = createPublicAnalysisRepository({ async queryJson() { return null; } });
  assert.deepEqual(await missingRepository.getByTokenHash({ tokenHash: "b".repeat(64), nowIso: "2026-07-08T12:00:00.000Z" }), {
    status: "not_found",
  });
});
