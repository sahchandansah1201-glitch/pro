import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildArchivePatientSql,
  buildCreatePatientSql,
  buildGetPatientSql,
  buildListPatientsSql,
  buildUpdatePatientSql,
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

test("patient detail and write SQL are clinic-scoped and use soft archive", () => {
  const scoped = {
    patientId: "10000000-0000-4000-8000-000000000201",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  };
  const getSql = buildGetPatientSql(scoped);
  assert.match(getSql, /where p\.id = '10000000-0000-4000-8000-000000000201'::uuid/);
  assert.match(getSql, /p\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(getSql, /p\.notes as "notes"/);

  const createSql = buildCreatePatientSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
    fullName: "O'Hara Patient",
    birthDate: "1984-02-14",
    sex: "female",
    phototype: "II",
    imagingConsent: true,
    notes: "safe note",
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });
  assert.match(createSql, /insert into patients/);
  assert.match(createSql, /^with inserted as \(\s*insert into patients/i);
  assert.match(createSql, /O''Hara Patient/);
  assert.match(createSql, /gen_random_uuid/);
  assert.doesNotMatch(createSql, /password_hash|object_key|metadata_json/);
  assert.doesNotMatch(createSql, /from\s*\(\s*with\s+inserted\s+as\s*\(/i);

  const updateSql = buildUpdatePatientSql({
    ...scoped,
    changes: { fullName: "Updated Patient", imagingConsent: false },
  });
  assert.match(updateSql, /^with updated as \(\s*update patients p/i);
  assert.match(updateSql, /full_name = 'Updated Patient'/);
  assert.match(updateSql, /imaging_consent = false/);
  assert.match(updateSql, /p\.deleted_at is null/);
  assert.doesNotMatch(updateSql, /from\s*\(\s*with\s+updated\s+as\s*\(/i);

  const archiveSql = buildArchivePatientSql(scoped);
  assert.match(archiveSql, /^with archived as \(\s*update patients p/i);
  assert.match(archiveSql, /set deleted_at = now\(\)/);
  assert.doesNotMatch(archiveSql, /\bdelete\s+from\b/i);
  assert.doesNotMatch(archiveSql, /from\s*\(\s*with\s+archived\s+as\s*\(/i);
});

test("createPatientRepository delegates detail and write methods", async () => {
  const calls = [];
  const repository = createPatientRepository({
    async queryJson(sql) {
      calls.push(sql);
      return [
        {
          id: "10000000-0000-4000-8000-000000000201",
          clinicId: "10000000-0000-4000-8000-000000000001",
          code: "DP-DEMO-0001",
          fullName: "Demo Patient One",
          birthDate: "1984-02-14",
          sex: "female",
          phototype: "II",
          imagingConsent: true,
          notes: "visible only on detail/write responses",
          clinicSlug: "demo-clinic",
          clinicName: "Dermatolog Pro Demo Clinic",
          createdAt: "2026-05-13T00:00:00.000Z",
          updatedAt: "2026-05-13T00:00:00.000Z",
          deletedAt: null,
        },
      ];
    },
  });

  const detail = await repository.getPatient({
    patientId: "10000000-0000-4000-8000-000000000201",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });
  const created = await repository.createPatient({
    clinicId: "10000000-0000-4000-8000-000000000001",
    fullName: "Demo Patient One",
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });
  const updated = await repository.updatePatient({
    patientId: "10000000-0000-4000-8000-000000000201",
    changes: { fullName: "Updated Patient" },
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });
  const archived = await repository.archivePatient({
    patientId: "10000000-0000-4000-8000-000000000201",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });

  assert.equal(detail.notes, "visible only on detail/write responses");
  assert.equal(created.clinic.id, "10000000-0000-4000-8000-000000000001");
  assert.equal(updated.fullName, "Demo Patient One");
  assert.equal(archived.deletedAt, null);
  assert.equal(calls.length, 4);
  assert.match(calls[1], /insert into patients/);
  assert.match(calls[2], /update patients p/);
  assert.match(calls[3], /deleted_at = now/);
});
