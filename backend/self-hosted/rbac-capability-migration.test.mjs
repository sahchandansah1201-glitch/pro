import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const EXPECTED_CALLS = {
  "asset-write-service.mjs": { clinicalMediaReadScope: 2 },
  "clinical-followup-service.mjs": {
    clinicalRecordReadScope: 2,
    clinicOperationsReadScope: 1,
    clinicGovernanceReadScope: 30,
  },
  "clinical-report-package-service.mjs": { clinicalRecordReadScope: 1 },
  "clinical-workspace-service.mjs": {
    clinicalRecordReadScope: 4,
    clinicalMediaReadScope: 5,
  },
  "doctor-dashboard-service.mjs": { clinicalRecordReadScope: 1 },
  "patient-photo-protocol-release-service.mjs": {
    clinicalRecordReadScope: 1,
    clinicGovernanceReadScope: 1,
  },
  "routes.mjs": { clinicalRecordReadScope: 3, clinicalMediaReadScope: 1 },
  "visit-schedule-service.mjs": { clinicalRecordReadScope: 1 },
};

test("all 53 legacy visit-read consumers use an explicit capability scope", () => {
  const totals = {};
  for (const [file, expected] of Object.entries(EXPECTED_CALLS)) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /visitReadScope\s*\(\s*authContext\s*\)/, file);
    const explicitCalls = source.match(/(?:clinicalRecordReadScope|clinicalMediaReadScope|clinicOperationsReadScope|clinicGovernanceReadScope)\s*\(\s*authContext\s*\)/g)?.length || 0;
    assert.equal(explicitCalls, Object.values(expected).reduce((sum, count) => sum + count, 0), `${file}: total`);
    for (const [scope, count] of Object.entries(expected)) {
      const actual = source.match(new RegExp(`${scope}\\s*\\(\\s*authContext\\s*\\)`, "g"))?.length || 0;
      assert.equal(actual, count, `${file}: ${scope}`);
      totals[scope] = (totals[scope] || 0) + actual;
    }
  }

  assert.deepEqual(totals, {
    clinicalMediaReadScope: 8,
    clinicalRecordReadScope: 13,
    clinicOperationsReadScope: 1,
    clinicGovernanceReadScope: 31,
  });
  assert.equal(Object.values(totals).reduce((sum, count) => sum + count, 0), 53);
});
