import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createClinicalBodyAtlasContract } from "./clinical-body-region-contract.mjs";
import {
  createVisitWorkspaceWriteService,
  normalizeCreateLesionPayload,
  normalizeUpdateLesionPayload,
  normalizeUpdateReportPayload,
  normalizeUpdateVisitPayload,
  VisitWorkspaceValidationError,
} from "./visit-workspace-write-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const VISIT_CONTEXT = {
  id: VISIT_ID,
  startedAt: "2026-08-21T12:00:00.000Z",
  createdAt: "2026-08-21T11:00:00.000Z",
  patient: {
    id: "10000000-0000-4000-8000-000000000201",
    sex: "female",
    birthDate: "1990-01-01",
  },
  clinic: { id: CLINIC_ID },
};
const BODY_MAP = {
  atlasSource: "makehuman-cc0",
  atlasProfileId: "adult_female_30",
  view: "front",
  x: 0.35,
  y: 0.96,
  regionId: "front-right-toes",
  detailId: "digit-5",
};
const NORMALIZE_CONTEXT = {
  clinicalBodyAtlasContract: createClinicalBodyAtlasContract(),
  visitContext: VISIT_CONTEXT,
};

const authContext = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function createService({ auditEvents = [], repo = {} } = {}) {
  const defaults = {
    async updateVisit() {
      return { id: VISIT_ID, clinicId: CLINIC_ID, status: "in_progress", chiefComplaint: "контроль" };
    },
    async createLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, label: "L1" };
    },
    async updateLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, label: "L2" };
    },
    async archiveLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, status: "archived" };
    },
    async upsertReport() {
      return { id: "10000000-0000-4000-8000-000000000501", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "draft" };
    },
  };
  return createVisitWorkspaceWriteService({
    visitWorkspaceRepository: {
      async getVisit() {
        return VISIT_CONTEXT;
      },
      async getLesionContext() {
        return VISIT_CONTEXT;
      },
    },
    visitWorkspaceWriteRepository: { ...defaults, ...repo },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("payload normalizers reject empty or invalid visit workspace writes", () => {
  assert.throws(() => normalizeUpdateVisitPayload({}), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateVisitPayload({ status: "closed" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeCreateLesionPayload({ label: "" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeCreateLesionPayload({ label: "L1", riskLevel: "diagnosis" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateReportPayload({ status: "published" }), VisitWorkspaceValidationError);
});

test("body-map payload is canonicalized from the registered region and keeps five-decimal coordinates", () => {
  assert.deepEqual(
    normalizeCreateLesionPayload({
      label: "Очаг на мизинце",
      bodyZone: "произвольный текст клиента",
      bodyMap: {
        atlasSource: "makehuman-cc0",
        atlasProfileId: "adult_female_30",
        view: "front",
        x: 0.3508319,
        y: 0.960014,
        regionId: "front-right-toes",
        detailId: "digit-5",
      },
    }, NORMALIZE_CONTEXT),
    {
      label: "Очаг на мизинце",
      bodyZone: "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
      bodySurface: "anterior",
      status: "active",
      riskLevel: null,
      bodyMap: {
        atlasSource: "makehuman-cc0",
        atlasProfileId: "adult_female_30",
        atlasManifestSha256: "cf6838d134b41b6f6862e2d86a54daaeb54b87da5952aa9e3c66c36a22099da6",
        bodyRegionMapSha256: "7ca70b005832ff347c6eab0a8d6359af1b54ee232951b027d7e8f36e92e4a11c",
        view: "front",
        x: 0.35083,
        y: 0.96001,
        regionId: "front-right-toes",
        detailId: "digit-5",
      },
    },
  );
  assert.throws(
    () => normalizeUpdateLesionPayload({ bodyMap: BODY_MAP }, NORMALIZE_CONTEXT),
    (error) => error instanceof VisitWorkspaceValidationError
      && error.publicDetails.some((detail) => detail.field === "expectedPlacementRevision"),
  );
  assert.equal(
    normalizeUpdateLesionPayload({
      expectedPlacementRevision: 0,
      bodyMap: BODY_MAP,
    }, NORMALIZE_CONTEXT).expectedPlacementRevision,
    0,
  );
});

test("body-map create requires an idempotency key and audits only a new placement", async () => {
  const auditEvents = [];
  const calls = [];
  const service = createService({
    auditEvents,
    repo: {
      async createLesion(input) {
        calls.push(input);
        return {
          lesion: {
            id: LESION_ID,
            clinicId: CLINIC_ID,
            visitId: VISIT_ID,
            label: input.label,
            bodyRegionId: input.bodyMap.regionId,
            placementRevision: 1,
          },
          replayed: false,
        };
      },
    },
  });
  const bodyMap = BODY_MAP;

  await assert.rejects(
    () => service.createLesion(VISIT_ID, { label: "L1", bodyMap }, authContext, { correlationId: "c-map" }),
    (error) => error instanceof VisitWorkspaceValidationError
      && error.publicDetails.some((detail) => detail.field === "Idempotency-Key"),
  );
  const result = await service.createLesion(
    VISIT_ID,
    { label: "L1", bodyMap },
    authContext,
    { correlationId: "c-map", idempotencyKey: "019ffbca-f316-7f81-80db-9e1792daa4d5" },
  );

  assert.equal(result.lesion.bodyRegionId, "front-right-toes");
  assert.equal(result.replayed, false);
  assert.equal(calls[0].idempotencyKey, "019ffbca-f316-7f81-80db-9e1792daa4d5");
  assert.match(calls[0].requestHash, /^[a-f0-9]{64}$/);
  assert.equal(calls[0].bodyMap.atlasProfileId, "adult_female_30");
  assert.match(calls[0].bodyMap.atlasManifestSha256, /^[a-f0-9]{64}$/);
  assert.match(calls[0].bodyMap.bodyRegionMapSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    changedFields: ["label", "bodyZone", "bodySurface", "status", "riskLevel", "bodyMap"],
    bodyRegionId: "front-right-toes",
    bodyMapView: "front",
    atlasSource: "makehuman-cc0",
    atlasProfileId: "adult_female_30",
    placementRevision: 1,
  });
});

test("body-map service rejects source/profile/geometry mismatch before repository mutation", async () => {
  let writes = 0;
  const service = createService({
    repo: {
      async createLesion() {
        writes += 1;
        return null;
      },
    },
  });
  const options = { correlationId: "c-map", idempotencyKey: "019ffbca-f316-7f81-80db-9e1792daa4d5" };

  await assert.rejects(
    () => service.createLesion(VISIT_ID, { label: "L1", bodyMap: { ...BODY_MAP, atlasSource: "daz-hires-local" } }, authContext, options),
    (error) => error instanceof VisitWorkspaceValidationError
      && error.publicDetails.some((detail) => detail.field === "bodyMap.atlasSource"),
  );
  await assert.rejects(
    () => service.createLesion(VISIT_ID, { label: "L1", bodyMap: { ...BODY_MAP, atlasProfileId: "adult_male_30" } }, authContext, options),
    (error) => error instanceof VisitWorkspaceValidationError
      && error.publicDetails.some((detail) => detail.field === "bodyMap.atlasProfileId"),
  );
  await assert.rejects(
    () => service.createLesion(VISIT_ID, { label: "L1", bodyMap: { ...BODY_MAP, y: 0.5 } }, authContext, options),
    (error) => error instanceof VisitWorkspaceValidationError
      && error.publicDetails.some((detail) => detail.field === "bodyMap.regionId"),
  );
  assert.equal(writes, 0);
});

test("body-map correction revalidates the lesion visit context and forwards server-derived hashes", async () => {
  const calls = [];
  const service = createService({
    repo: {
      async updateLesion(input) {
        calls.push(input);
        return {
          lesion: {
            id: LESION_ID,
            clinicId: CLINIC_ID,
            visitId: VISIT_ID,
            bodyRegionId: input.changes.bodyMap.regionId,
            placementRevision: 2,
          },
          auditPersisted: true,
        };
      },
    },
  });
  const result = await service.updateLesion(
    LESION_ID,
    { bodyMap: BODY_MAP, expectedPlacementRevision: 1 },
    authContext,
    { correlationId: "c-correct" },
  );

  assert.equal(result.lesion.placementRevision, 2);
  assert.equal(calls[0].changes.bodyMap.atlasProfileId, "adult_female_30");
  assert.match(calls[0].changes.bodyMap.atlasManifestSha256, /^[a-f0-9]{64}$/);
  assert.match(calls[0].changes.bodyMap.bodyRegionMapSha256, /^[a-f0-9]{64}$/);
});

test("service updates visit, lesion, archive and report with audit events", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const visit = await service.updateVisit(VISIT_ID, { chiefComplaint: "контроль" }, authContext, { correlationId: "c1" });
  const created = await service.createLesion(VISIT_ID, { label: "L1" }, authContext, { correlationId: "c2" });
  const updated = await service.updateLesion(LESION_ID, { label: "L2" }, authContext, { correlationId: "c3" });
  const archived = await service.archiveLesion(LESION_ID, authContext, { correlationId: "c4" });
  const report = await service.updateReport(VISIT_ID, { physicianText: "для врача" }, authContext, { correlationId: "c5" });

  assert.equal(visit.visit.id, VISIT_ID);
  assert.equal(created.lesion.label, "L1");
  assert.equal(updated.lesion.label, "L2");
  assert.equal(archived.lesion.status, "archived");
  assert.equal(report.report.visitId, VISIT_ID);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["visit.update", "lesion.create", "lesion.update", "lesion.archive", "report.update"],
  );
});

test("service denies roles without visit write scope", async () => {
  const service = createService();
  await assert.rejects(
    () => service.updateVisit(VISIT_ID, { chiefComplaint: "x" }, { userId: "u", roles: ["clinic_admin"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});
