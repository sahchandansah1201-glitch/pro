import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5DChecks, retiredModeReferences } from "./check-stage5d-production-mode-cutover.mjs";

test("Stage 5D guard validates production mode cutover", () => {
  const result = collectStage5DChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 22);
});

test("working runtime must reject reintroduced global demo selectors", () => {
  for (const content of [
    'import { isProductionAppMode } from "@/lib/app-mode";',
    'const mode = import.meta.env.VITE_APP_MODE;',
    'if (isDemoAppMode()) return trainingData;',
    'const value = getAppMode();',
  ]) assert.ok(retiredModeReferences(content).length > 0);
  assert.deepEqual(retiredModeReferences('const session = useSelfHostedApiSession();'), []);
});
