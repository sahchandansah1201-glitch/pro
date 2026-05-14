import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SELF_HOSTED_PRODUCT_OPENAPI,
  buildSelfHostedProductReadiness,
} from "./product-readiness.mjs";

test("builds a safe self-hosted product readiness manifest", () => {
  const readiness = buildSelfHostedProductReadiness({
    config: {
      deploymentMode: "self-hosted",
      publicBaseUrl: "https://clinic.example",
    },
    generatedAt: "2026-05-14T00:00:00.000Z",
    correlationId: "corr-product",
  });

  assert.equal(readiness.stage, "4Z");
  assert.equal(readiness.status, "ready_for_server_deploy");
  assert.equal(readiness.productBoundary.managedRuntime, "none");
  assert.equal(readiness.productBoundary.managedDatabase, "none");
  assert.equal(readiness.productBoundary.supabaseRuntimeCoupling, false);
  assert.equal(readiness.productBoundary.browserHardwareApis, false);
  assert.ok(readiness.capabilities.some((item) => item.key === "device_bridge"));
  assert.ok(readiness.gates.some((item) => item.command === "npm run preflight:all"));
  assert.ok(readiness.openapi.includes("/openapi.stage4z.json"));
  assert.deepEqual(readiness.openapi, SELF_HOSTED_PRODUCT_OPENAPI);
  assert.doesNotMatch(
    JSON.stringify(readiness),
    /SUPABASE_|access_token|storage_object_path|patient_full_name|signed_url|navigator\./i,
  );
});
