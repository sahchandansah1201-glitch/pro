import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createOpsLogger,
  extractCorrelationId,
  redactOpsText,
  safeRequestPath,
  sanitizeOpsPayload,
} from "./ops-logger.mjs";

test("redacts bearer tokens, url secrets, emails, and storage paths", () => {
  const out = redactOpsText(
    "Authorization: Bearer abc.def.ghi email jane@example.invalid ?access_token=secret&sig=hidden storage_object_path=clinics/a/file.png",
  );

  assert.doesNotMatch(out, /abc\.def\.ghi/);
  assert.doesNotMatch(out, /jane@example\.invalid/);
  assert.doesNotMatch(out, /secret|hidden|clinics\/a/);
  assert.match(out, /Bearer \[redacted\]/);
});

test("sanitizes sensitive payload keys recursively", () => {
  const safe = sanitizeOpsPayload({
    correlationId: "corr-1",
    authorization: "Bearer abc.def",
    nested: {
      patientFullName: "Ivanova Natalia",
      objectKey: "clinic/patient/photo.jpg",
      count: 2,
    },
  });

  assert.equal(safe.correlationId, "corr-1");
  assert.equal(safe.authorization, "[redacted]");
  assert.equal(safe.nested.patientFullName, "[redacted]");
  assert.equal(safe.nested.objectKey, "[redacted]");
  assert.equal(safe.nested.count, 2);
});

test("logger writes structured JSON without sensitive values", () => {
  const lines = [];
  const logger = createOpsLogger({
    service: "test-api",
    now: () => "2026-05-14T00:00:00.000Z",
    sink: {
      write(line) {
        lines.push(line);
      },
    },
  });

  logger.info("http.request", {
    method: "GET",
    path: "/api/v1/patients",
    status: 200,
    correlationId: "corr-1",
    actorEmail: "doctor@example.invalid",
    password: "secret",
  });

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.stage, "4N");
  assert.equal(parsed.event, "http.request");
  assert.equal(parsed.correlationId, "corr-1");
  assert.equal(parsed.password, "[redacted]");
  assert.doesNotMatch(lines[0], /doctor@example|secret/);
});

test("path and correlation helpers avoid query secrets", () => {
  assert.equal(safeRequestPath("/api/v1/assets/1/download?access_token=secret"), "/api/v1/assets/1/download");
  assert.equal(extractCorrelationId({ headers: { "x-correlation-id": "corr-2" } }, "fallback"), "corr-2");
  assert.equal(extractCorrelationId({ body: JSON.stringify({ correlationId: "corr-3" }) }, "fallback"), "corr-3");
});
