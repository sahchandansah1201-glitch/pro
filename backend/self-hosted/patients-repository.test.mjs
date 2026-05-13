import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListPatientsSql,
  createPatientRepository,
  parsePatientListParams,
} from "./patients-repository.mjs";

test("parsePatientListParams clamps limit, offset, and search", () => {
  const params = new URLSearchParams({
    limit: "999",
    offset: "-3",
    search: "  abc  ",
  });
  assert.deepEqual(parsePatientListParams(params), {
    limit: 200,
    offset: 0,
    search: "abc",
  });
});

test("buildListPatientsSql selects only safe read-list columns and escapes search", () => {
  const sql = buildListPatientsSql({
    limit: 10,
    offset: 5,
    search: "O'Hara",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });

  assert.match(sql, /from patients p/);
  assert.match(sql, /join clinics c/);
  assert.match(sql, /p.deleted_at is null/);
  assert.match(sql, /O''Hara/);
  assert.match(sql, /p\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(sql, /limit 10/);
  assert.match(sql, /offset 5/);
  assert.doesNotMatch(sql, /notes|password_hash|object_key|metadata_json/);
});

test("createPatientRepository normalizes PostgreSQL rows into safe DTOs", async () => {
  let sql = "";
  const repository = createPatientRepository({
    async queryJson(value) {
      sql = value;
      return [
        {
          id: "10000000-0000-4000-8000-000000000201",
          code: "DP-DEMO-0001",
          fullName: "Demo Patient One",
          birthDate: "1984-02-14",
          sex: "female",
          phototype: "II",
          imagingConsent: true,
          clinicSlug: "demo-clinic",
          clinicName: "Dermatolog Pro Demo Clinic",
          createdAt: "2026-05-13T00:00:00.000Z",
          updatedAt: "2026-05-13T00:00:00.000Z",
          notes: "must not leak",
        },
      ];
    },
  });

  const result = await repository.listPatients({
    limit: 1,
    offset: 2,
    search: "Demo",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });

  assert.equal(result.source, "postgres");
  assert.equal(result.count, 1);
  assert.equal(result.limit, 1);
  assert.equal(result.offset, 2);
  assert.equal(result.search, "Demo");
  assert.deepEqual(result.clinicIds, ["10000000-0000-4000-8000-000000000001"]);
  assert.equal(result.allClinics, false);
  assert.equal(result.items[0].clinic.slug, "demo-clinic");
  assert.equal(result.items[0].fullName, "Demo Patient One");
  assert.equal(result.items[0].notes, undefined);
  assert.match(sql, /limit 1/);
});
