// Stage 1D · Unit tests for the audit payload builder.
// No DB. No service role. Validates allow-list, denylist, and size cap.

import { assertEquals } from "jsr:@std/assert@1";
import { buildAuditPayload } from "../audit.ts";

Deno.test("buildAuditPayload includes correlation_id and route", () => {
  const p = buildAuditPayload({
    clinicId: "11111111-1111-1111-1111-111111111111",
    action: "create",
    entity: "patient",
    entityId: "50000000-0000-0000-0000-000000000001",
    correlationId: "cid-1",
    route: "POST /doctor/patients",
  });
  assertEquals(p.correlation_id, "cid-1");
  assertEquals(p.route, "POST /doctor/patients");
});

Deno.test("buildAuditPayload keeps changedFields when present", () => {
  const p = buildAuditPayload({
    clinicId: "c", action: "update", entity: "patient", entityId: "e",
    correlationId: "cid", route: "PATCH /x",
    changedFields: ["fullName", "birthDate"],
  });
  assertEquals(p.changed_fields, ["fullName", "birthDate"]);
});

Deno.test("buildAuditPayload filters denylisted changed_fields names", () => {
  const p = buildAuditPayload({
    clinicId: "c", action: "create", entity: "conclusion", entityId: "e",
    correlationId: "cid", route: "POST /x",
    changedFields: ["doctorText", "patientSafeText", "abcd_freeform_notes", "ok"],
  });
  assertEquals(p.changed_fields, ["ok"]);
});

Deno.test("buildAuditPayload only keeps non-empty parent_ids", () => {
  const p = buildAuditPayload({
    clinicId: "c", action: "create", entity: "visit", entityId: "e",
    correlationId: "cid", route: "POST /x",
    parentIds: { patientId: "p-1", lesionId: undefined, blank: "" },
  });
  assertEquals(p.parent_ids, { patientId: "p-1" });
});

Deno.test("buildAuditPayload drops top-level keys outside allow-list", () => {
  const input = {
    clinicId: "c", action: "create" as const, entity: "patient" as const,
    entityId: "e", correlationId: "cid", route: "POST /x",
  };
  const p = buildAuditPayload(input) as Record<string, unknown>;
  for (const k of Object.keys(p)) {
    if (!["correlation_id","route","changed_fields","prev_state","next_state","parent_ids"].includes(k)) {
      throw new Error(`unexpected key: ${k}`);
    }
  }
});

Deno.test("buildAuditPayload sheds changed_fields when oversized", () => {
  const big = Array.from({ length: 4000 }, (_, i) => `f${i}`);
  const p = buildAuditPayload({
    clinicId: "c", action: "update", entity: "patient", entityId: "e",
    correlationId: "cid", route: "PATCH /x",
    changedFields: big,
  });
  assertEquals(JSON.stringify(p).length <= 4096, true);
});

Deno.test("buildAuditPayload preserves prev/next state strings", () => {
  const p = buildAuditPayload({
    clinicId: "c", action: "finalize", entity: "report_version", entityId: "e",
    correlationId: "cid", route: "PATCH /x",
    nextState: "final",
  });
  assertEquals(p.next_state, "final");
});
