#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";

import { collectProjectMemoryChecks } from "./check-project-memory.mjs";

function makeRoot() {
  const root = join(tmpdir(), `project-memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(root, "docs/project-memory"), { recursive: true });
  mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
  mkdirSync(join(root, "deploy/self-hosted/integrations"), { recursive: true });
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "src/lib"), { recursive: true });
  mkdirSync(join(root, "src/pages/operator"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  for (const file of [
    "deploy/self-hosted/acceptance-baseline.stage6a.json",
    "deploy/self-hosted/server-install-package.stage6b.json",
    "deploy/self-hosted/install-verification.stage6c.json",
    "deploy/self-hosted/live-install-evidence.stage6d.json",
    "deploy/self-hosted/go-live-handoff.stage6e.json",
    "deploy/self-hosted/go-live-decision-record.stage6f.json",
    "deploy/self-hosted/post-go-live-observation.stage6g.json",
    "deploy/self-hosted/release-memory-closure.stage6h.json",
    "deploy/self-hosted/release-archive-index.stage6i.json",
    "deploy/self-hosted/release-archive-handoff-receipt.stage6j.json",
    "deploy/self-hosted/release-archive-reconciliation.stage6k.json",
    "deploy/self-hosted/release-archive-reconciliation-receipt.stage6l.json",
    "deploy/self-hosted/release-archive-final-closure.stage6m.json",
    "deploy/self-hosted/release-archive-final-closure-receipt.stage6n.json",
    "deploy/self-hosted/release-archive-retention-register.stage6o.json",
    "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json",
    "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json",
    "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json",
    "deploy/self-hosted/release-archive-retention-cycle-closure.stage6s.json",
    "deploy/self-hosted/release-archive-retention-cycle-closure-receipt.stage6t.json",
    "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json",
    "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json",
    "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation.stage6w.json",
    "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation-receipt.stage6x.json",
    "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json",
    "deploy/self-hosted/release-archive-retention-next-cycle-register-receipt.stage6z.json",
    "deploy/self-hosted/development-workflow-contract.stage7a-7c.json",
    "deploy/self-hosted/batch-automation-contract.stage7d-7f.json",
    "deploy/self-hosted/batch-verification-loop.stage7g-7i.json",
    "deploy/self-hosted/product-roadmap.stage7j-7l.json",
    "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json",
    "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json",
    "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json",
    "deploy/self-hosted/integrations/booking-import.stage8b.example.json",
    "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json",
    "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json",
    "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json",
    "docs/backend/stage-7a-7c-development-workflow-contract.md",
    "docs/backend/stage-7d-7f-batch-automation-contract.md",
    "docs/backend/stage-7g-7i-batch-verification-loop.md",
    "docs/backend/stage-7j-7l-product-roadmap.md",
    "docs/backend/stage-8a-8c-crm-inbound-adapter.md",
    "docs/backend/stage-8d-8f-availability-sync.md",
    "scripts/check-stage7a-7c-development-workflow-contract.mjs",
    "scripts/check-stage7a-7c-development-workflow-contract.test.mjs",
    "scripts/stage7d-7f-batch-handoff.mjs",
    "scripts/stage7d-7f-batch-handoff.test.mjs",
    "scripts/check-stage7d-7f-batch-automation-contract.mjs",
    "scripts/check-stage7d-7f-batch-automation-contract.test.mjs",
    "scripts/stage7g-7i-batch-readiness.mjs",
    "scripts/stage7g-7i-batch-readiness.test.mjs",
    "scripts/check-stage7g-7i-batch-verification-loop.mjs",
    "scripts/check-stage7g-7i-batch-verification-loop.test.mjs",
    "scripts/stage7j-7l-product-roadmap.mjs",
    "scripts/stage7j-7l-product-roadmap.test.mjs",
    "scripts/check-stage7j-7l-product-roadmap.mjs",
    "scripts/check-stage7j-7l-product-roadmap.test.mjs",
    "scripts/stage8a-8c-crm-inbound-adapter.mjs",
    "scripts/stage8a-8c-crm-inbound-adapter.test.mjs",
    "scripts/check-stage8a-8c-crm-inbound-adapter.mjs",
    "scripts/check-stage8a-8c-crm-inbound-adapter.test.mjs",
    "scripts/stage8d-8f-availability-sync.mjs",
    "scripts/stage8d-8f-availability-sync.test.mjs",
    "scripts/check-stage8d-8f-availability-sync.mjs",
    "scripts/check-stage8d-8f-availability-sync.test.mjs",
    "src/lib/self-hosted-availability-sync.ts",
    "src/lib/self-hosted-availability-sync.test.ts",
    "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
    "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
    ".github/workflows/stage7a-7c-development-workflow-contract.yml",
    ".github/workflows/stage7d-7f-batch-automation-contract.yml",
    ".github/workflows/stage7g-7i-batch-verification-loop.yml",
    ".github/workflows/stage7j-7l-product-roadmap.yml",
    ".github/workflows/stage8a-8c-crm-inbound-adapter.yml",
    ".github/workflows/stage8d-8f-availability-sync.yml",
    "docs/backend/stage-6a-production-acceptance-baseline.md",
    "docs/backend/stage-6b-server-install-package.md",
    "docs/backend/stage-6c-production-install-verification.md",
    "docs/backend/stage-6d-live-install-evidence-receipt.md",
    "docs/backend/stage-6e-production-go-live-handoff.md",
    "docs/backend/stage-6f-production-go-live-decision-record.md",
    "docs/backend/stage-6g-production-post-go-live-observation.md",
    "docs/backend/stage-6h-production-release-memory-closure.md",
    "docs/backend/stage-6i-production-release-archive-index.md",
    "docs/backend/stage-6j-production-release-archive-handoff-receipt.md",
    "docs/backend/stage-6k-production-release-archive-reconciliation.md",
    "docs/backend/stage-6l-production-release-archive-reconciliation-receipt.md",
    "docs/backend/stage-6m-production-release-archive-final-closure.md",
    "docs/backend/stage-6n-production-release-archive-final-closure-receipt.md",
    "docs/backend/stage-6o-production-release-archive-retention-register.md",
    "docs/backend/stage-6p-production-release-archive-retention-register-receipt.md",
    "docs/backend/stage-6q-production-release-archive-retention-cycle-index.md",
    "docs/backend/stage-6r-production-release-archive-retention-cycle-index-receipt.md",
    "docs/backend/stage-6s-production-release-archive-retention-cycle-closure.md",
    "docs/backend/stage-6t-production-release-archive-retention-cycle-closure-receipt.md",
    "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md",
    "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md",
    "docs/backend/stage-6w-production-release-archive-retention-cycle-final-closure-reconciliation.md",
    "docs/backend/stage-6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.md",
    "docs/backend/stage-6y-production-release-archive-retention-next-cycle-register.md",
    "docs/backend/stage-6z-production-release-archive-retention-next-cycle-register-receipt.md",
    ".github/workflows/stage6a-production-acceptance-baseline.yml",
    ".github/workflows/stage6b-server-install-package.yml",
    ".github/workflows/stage6c-production-install-verification.yml",
    ".github/workflows/stage6d-live-install-evidence-receipt.yml",
    ".github/workflows/stage6e-production-go-live-handoff.yml",
    ".github/workflows/stage6f-production-go-live-decision-record.yml",
    ".github/workflows/stage6g-production-post-go-live-observation.yml",
    ".github/workflows/stage6h-production-release-memory-closure.yml",
    ".github/workflows/stage6i-production-release-archive-index.yml",
    ".github/workflows/stage6j-production-release-archive-handoff-receipt.yml",
    ".github/workflows/stage6k-production-release-archive-reconciliation.yml",
    ".github/workflows/stage6l-production-release-archive-reconciliation-receipt.yml",
    ".github/workflows/stage6m-production-release-archive-final-closure.yml",
    ".github/workflows/stage6n-production-release-archive-final-closure-receipt.yml",
    ".github/workflows/stage6o-production-release-archive-retention-register.yml",
    ".github/workflows/stage6p-production-release-archive-retention-register-receipt.yml",
    ".github/workflows/stage6q-production-release-archive-retention-cycle-index.yml",
    ".github/workflows/stage6r-production-release-archive-retention-cycle-index-receipt.yml",
    ".github/workflows/stage6s-production-release-archive-retention-cycle-closure.yml",
    ".github/workflows/stage6t-production-release-archive-retention-cycle-closure-receipt.yml",
    ".github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml",
    ".github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml",
    ".github/workflows/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.yml",
    ".github/workflows/stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.yml",
    ".github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml",
    ".github/workflows/stage6z-production-release-archive-retention-next-cycle-register-receipt.yml",
  ]) {
    writeFileSync(join(root, file), "ok\n");
  }
  return root;
}

function writeMemory(root, overrides = {}) {
  const memory = {
    "PROJECT_STATE.yaml": `generated_at: "2026-05-17T21:12:48+03:00"
project: "Dermatolog Pro"
repository:
  path: "${root}/pro"
  branch: "main"
  head_sha: "ca00a2ecc354c645e2e496157437b1a636d14ad1"
  head_commit: "Refresh project memory after Stage 6E"
  working_tree: "clean"
  upstream: "origin/main"
verification:
  deno_lock_guard:
    command: "node scripts/check-no-deno-locks.mjs"
    status: "ok"
  stage6e_preflight:
    command: "npm run preflight:stage6e"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6e_report_status: "ready"
      live_server_go_live_verified_by_report: false
  stage6f_preflight:
    command: "npm run preflight:stage6f"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6f_report_status: "ready"
      final_go_live_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6g_preflight:
    command: "npm run preflight:stage6g"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6g_report_status: "ready"
      observation_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6h_preflight:
    command: "npm run preflight:stage6h"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6h_report_status: "ready"
      closure_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6i_preflight:
    command: "npm run preflight:stage6i"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6i_report_status: "ready"
      archive_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6j_preflight:
    command: "npm run preflight:stage6j"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6j_report_status: "ready"
      archive_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6k_preflight:
    command: "npm run preflight:stage6k"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6k_report_status: "ready"
      archive_reconciliation_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6l_preflight:
    command: "npm run preflight:stage6l"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6l_report_status: "ready"
      archive_reconciliation_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6m_preflight:
    command: "npm run preflight:stage6m"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6m_report_status: "ready"
      archive_final_closure_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6n_preflight:
    command: "npm run preflight:stage6n"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6n_report_status: "ready"
      archive_final_closure_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6o_preflight:
    command: "npm run preflight:stage6o"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6o_report_status: "ready"
      archive_retention_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6p_preflight:
    command: "npm run preflight:stage6p"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6p_report_status: "ready"
      archive_retention_register_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6q_preflight:
    command: "npm run preflight:stage6q"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 7
      leak_findings: 0
      stage6q_report_status: "ready"
      archive_retention_cycle_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6r_preflight:
    command: "npm run preflight:stage6r"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6r_report_status: "ready"
      archive_retention_cycle_index_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6s_preflight:
    command: "npm run preflight:stage6s"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6s_report_status: "ready"
      archive_retention_cycle_closure_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6t_preflight:
    command: "npm run preflight:stage6t"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6t_report_status: "ready"
      archive_retention_cycle_closure_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6u_preflight:
    command: "npm run preflight:stage6u"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6u_report_status: "ready"
      stage6t_retention_cycle_closure_receipt_generated_at: "2026-05-19T14:30:00.000Z"
      stage6t_missing_required_inputs: 0
      stage6t_leak_findings: 0
      ready_for_external_release_archive_retention_cycle_final_closure: true
      external_archive_retention_cycle_final_closure_records_stored_outside_git: true
      archive_retention_cycle_final_closure_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6v_preflight:
    command: "npm run preflight:stage6v"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6v_report_status: "ready"
      ready_for_external_release_archive_retention_cycle_final_closure_receipt: true
      external_archive_retention_cycle_final_closure_receipt_stored_outside_git: true
      archive_retention_cycle_final_closure_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6w_preflight:
    command: "npm run preflight:stage6w"
    status: "ok"
    key_facts:
      tests_passed: 14
      guard_files_checked: 7
      leak_findings: 0
      stage6w_report_status: "ready"
      ready_for_external_release_archive_retention_cycle_final_closure_reconciliation: true
      external_archive_retention_cycle_final_closure_reconciliation_stored_outside_git: true
      archive_retention_cycle_final_closure_reconciliation_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6x_preflight:
    command: "npm run preflight:stage6x"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6x_report_status: "ready"
      ready_for_external_release_archive_retention_cycle_final_closure_reconciliation_receipt: true
      external_archive_retention_cycle_final_closure_reconciliation_receipt_stored_outside_git: true
      archive_retention_cycle_final_closure_reconciliation_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6y_preflight:
    command: "npm run preflight:stage6y"
    status: "ok"
    key_facts:
      tests_passed: 10
      guard_files_checked: 7
      leak_findings: 0
      stage6y_report_status: "ready"
      ready_for_external_release_archive_retention_next_cycle_register: true
      external_archive_retention_next_cycle_records_stored_outside_git: true
      archive_retention_next_cycle_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage6z_preflight:
    command: "npm run preflight:stage6z"
    status: "ok"
    key_facts:
      tests_passed: 13
      guard_files_checked: 7
      leak_findings: 0
      stage6z_report_status: "ready"
      ready_for_external_release_archive_retention_next_cycle_register_receipt: true
      external_archive_retention_next_cycle_register_receipt_stored_outside_git: true
      archive_retention_next_cycle_register_receipt_outcome_known_to_repository: false
      live_server_go_live_verified_by_report: false
  stage7a_7c_preflight:
    command: "npm run preflight:stage7a-7c"
    status: "ok"
    key_facts:
      tests_passed: 4
      guard_files_checked: 7
      leak_findings: 0
      development_workflow_contract_confirmed: true
      minimum_related_stages_per_batch: 3
  stage7d_7f_preflight:
    command: "npm run preflight:stage7d-7f"
    status: "ok"
    key_facts:
      tests_passed: 10
      guard_files_checked: 9
      leak_findings: 0
      batch_automation_contract_confirmed: true
      lovable_prompt_gate_confirmed: true
      project_memory_refresh_confirmed: true
      minimum_related_stages_per_batch: 3
  stage7g_7i_preflight:
    command: "npm run preflight:stage7g-7i"
    status: "ok"
    key_facts:
      tests_passed: 9
      guard_files_checked: 7
      leak_findings: 0
      batch_readiness_reporter_confirmed: true
      lovable_sync_verification_manifest_confirmed: true
      batch_drift_guard_confirmed: true
      minimum_related_stages_per_batch: 3
  stage7j_7l_preflight:
    command: "npm run preflight:stage7j-7l"
    status: "ok"
    key_facts:
      tests_passed: 11
      guard_files_checked: 7
      leak_findings: 0
      product_gap_register_confirmed: true
      next_product_batch_planner_confirmed: true
      product_roadmap_drift_guard_confirmed: true
      minimum_related_stages_per_batch: 3
  stage8a_8c_preflight:
    command: "npm run preflight:stage8a-8c"
    status: "ok"
    key_facts:
      tests_passed: 7
      guard_files_checked: 10
      leak_findings: 0
      crm_inbound_adapter_contract_confirmed: true
      crm_export_normalization_confirmed: true
      safe_import_audit_flow_confirmed: true
      minimum_related_stages_per_batch: 3
  stage8d_8f_preflight:
    command: "npm run preflight:stage8d-8f"
    status: "ok"
    key_facts:
      tests_passed: 12
      guard_files_checked: 13
      leak_findings: 0
      availability_sync_snapshot_confirmed: true
      conflict_handling_confirmed: true
      booking_confirmation_readiness_confirmed: true
      minimum_related_stages_per_batch: 3
stage_evidence:
  latest_commits:
    - "ca00a2e Harden Stage 6 handoff path resolution"
    - "c5417d5 Add Stage 6E production go-live handoff"
  documented_stages_present:
    - "docs/backend/stage-6e-production-go-live-handoff.md"
    - "docs/backend/stage-6i-production-release-archive-index.md"
    - "docs/backend/stage-6j-production-release-archive-handoff-receipt.md"
    - "docs/backend/stage-6k-production-release-archive-reconciliation.md"
    - "docs/backend/stage-6l-production-release-archive-reconciliation-receipt.md"
    - "docs/backend/stage-6m-production-release-archive-final-closure.md"
    - "docs/backend/stage-6n-production-release-archive-final-closure-receipt.md"
    - "docs/backend/stage-6o-production-release-archive-retention-register.md"
    - "docs/backend/stage-6r-production-release-archive-retention-cycle-index-receipt.md"
    - "docs/backend/stage-6s-production-release-archive-retention-cycle-closure.md"
    - "docs/backend/stage-6t-production-release-archive-retention-cycle-closure-receipt.md"
    - "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md"
    - "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md"
  workflows_present:
    - ".github/workflows/stage6e-production-go-live-handoff.yml"
    - ".github/workflows/stage6i-production-release-archive-index.yml"
    - ".github/workflows/stage6j-production-release-archive-handoff-receipt.yml"
    - ".github/workflows/stage6k-production-release-archive-reconciliation.yml"
    - ".github/workflows/stage6l-production-release-archive-reconciliation-receipt.yml"
    - ".github/workflows/stage6m-production-release-archive-final-closure.yml"
    - ".github/workflows/stage6n-production-release-archive-final-closure-receipt.yml"
    - ".github/workflows/stage6o-production-release-archive-retention-register.yml"
    - ".github/workflows/stage6r-production-release-archive-retention-cycle-index-receipt.yml"
    - ".github/workflows/stage6s-production-release-archive-retention-cycle-closure.yml"
    - ".github/workflows/stage6t-production-release-archive-retention-cycle-closure-receipt.yml"
    - ".github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml"
    - ".github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml"
    - ".github/workflows/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.yml"
    - ".github/workflows/stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.yml"
    - ".github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml"
    - ".github/workflows/stage6z-production-release-archive-retention-next-cycle-register-receipt.yml"
    - ".github/workflows/stage7a-7c-development-workflow-contract.yml"
    - ".github/workflows/stage7d-7f-batch-automation-contract.yml"
    - ".github/workflows/stage7g-7i-batch-verification-loop.yml"
hypotheses:
    - "Next logical stage after Stage 7G-7I is Stage 7J."
sources:
  commands:
    - "git status -sb"
  files:
    - "deploy/self-hosted/acceptance-baseline.stage6a.json"
    - "deploy/self-hosted/server-install-package.stage6b.json"
    - "deploy/self-hosted/install-verification.stage6c.json"
    - "deploy/self-hosted/live-install-evidence.stage6d.json"
    - "deploy/self-hosted/go-live-handoff.stage6e.json"
    - "deploy/self-hosted/go-live-decision-record.stage6f.json"
    - "deploy/self-hosted/post-go-live-observation.stage6g.json"
    - "deploy/self-hosted/release-memory-closure.stage6h.json"
    - "deploy/self-hosted/release-archive-index.stage6i.json"
    - "deploy/self-hosted/release-archive-handoff-receipt.stage6j.json"
    - "deploy/self-hosted/release-archive-reconciliation.stage6k.json"
    - "deploy/self-hosted/release-archive-reconciliation-receipt.stage6l.json"
    - "deploy/self-hosted/release-archive-final-closure.stage6m.json"
    - "deploy/self-hosted/release-archive-final-closure-receipt.stage6n.json"
    - "deploy/self-hosted/release-archive-retention-register.stage6o.json"
    - "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json"
    - "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json"
    - "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json"
    - "deploy/self-hosted/release-archive-retention-cycle-closure.stage6s.json"
    - "deploy/self-hosted/release-archive-retention-cycle-closure-receipt.stage6t.json"
    - "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json"
    - "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json"
    - "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation.stage6w.json"
    - "deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation-receipt.stage6x.json"
    - "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json"
    - "deploy/self-hosted/release-archive-retention-next-cycle-register-receipt.stage6z.json"
    - "deploy/self-hosted/development-workflow-contract.stage7a-7c.json"
    - "deploy/self-hosted/batch-automation-contract.stage7d-7f.json"
    - "deploy/self-hosted/batch-verification-loop.stage7g-7i.json"
    - "deploy/self-hosted/product-roadmap.stage7j-7l.json"
    - "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json"
    - "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json"
    - "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json"
    - "deploy/self-hosted/integrations/booking-import.stage8b.example.json"
    - "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json"
    - "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json"
    - "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json"
    - "docs/backend/stage-7a-7c-development-workflow-contract.md"
    - "docs/backend/stage-7d-7f-batch-automation-contract.md"
    - "docs/backend/stage-7g-7i-batch-verification-loop.md"
    - "docs/backend/stage-7j-7l-product-roadmap.md"
    - "scripts/check-stage7a-7c-development-workflow-contract.mjs"
    - "scripts/stage7d-7f-batch-handoff.mjs"
    - "scripts/check-stage7d-7f-batch-automation-contract.mjs"
    - "scripts/stage7g-7i-batch-readiness.mjs"
    - "scripts/check-stage7g-7i-batch-verification-loop.mjs"
    - "scripts/stage7j-7l-product-roadmap.mjs"
    - "scripts/check-stage7j-7l-product-roadmap.mjs"
    - "scripts/stage8a-8c-crm-inbound-adapter.mjs"
    - "scripts/check-stage8a-8c-crm-inbound-adapter.mjs"
    - "scripts/stage8d-8f-availability-sync.mjs"
    - "scripts/check-stage8d-8f-availability-sync.mjs"
    - "src/lib/self-hosted-availability-sync.ts"
    - "src/pages/operator/OperatorBookingRequestsPageLive.tsx"
`,
    "HANDOFF.md": "# HANDOFF\n\n## Confirmed state\n\nStage 7D-7F confirmed. Stage 7G-7I confirmed as batch verification loop. Stage 7J-7L confirmed as product roadmap. Stage 8A-8C confirmed as CRM inbound adapter. Stage 8D-8F confirmed as availability sync and booking confirmation readiness.\n\n## Hypothesis\n\nStage 8G-8I is likely next hypothesis.\n",
    "WORKLOG.md": "# WORKLOG\n\n## 2026-05-17\n\n- Создан project-memory черный ящик.\n- Неподтвержденная история помечена как гипотеза.\n",
    "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\n## Highest-confidence next step\n\nStage 8D-8F complete. Future work uses minimum three related stages. Stage 8G-8I is the next hypothesis. Stage 7D-7F remains confirmed. Stage 8A-8C remains the historical roadmap anchor.\n",
    "RISKS.md": "# RISKS\n\n## Confirmed risks\n\nGo-live approval is external. micro-PR relapse and early Lovable sync prompt remain risks. Stage 7G-7I reduces drift risk. Stage 7J-7L reduces product-roadmap drift risk. Stage 8A-8C reduces CRM inbound adapter drift risk. Stage 8D-8F reduces availability-sync drift risk.\n\n## Hypotheses\n\nStage 8G-8I is next hypothesis. Earlier Stage 7G hypothesis is resolved.\n",
    "ARTIFACTS.md": `# ARTIFACTS

## Stage 6 manifests

- [acceptance](../../deploy/self-hosted/acceptance-baseline.stage6a.json)
- [stage7d-7f](../../deploy/self-hosted/batch-automation-contract.stage7d-7f.json)
- [stage7g-7i](../../deploy/self-hosted/batch-verification-loop.stage7g-7i.json)
- [stage7j-7l](../../deploy/self-hosted/product-roadmap.stage7j-7l.json)
- [stage8a-8c](../../deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json)
- [stage8d-8f](../../deploy/self-hosted/integrations/availability-sync.stage8d-8f.json)

## Verification outputs

- test output captured
`,
  };
  for (const [file, content] of Object.entries({ ...memory, ...overrides })) {
    writeFileSync(join(root, "docs/project-memory", file), content);
  }
}

test("project memory guard passes for complete black-box files", () => {
  const root = makeRoot();
  writeMemory(root);
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 6);
});

test("project memory guard accepts absolute artifact links when present", () => {
  const root = makeRoot();
  writeMemory(root, {
    "ARTIFACTS.md": `# ARTIFACTS

## Stage 6 manifests

- [acceptance](${join(root, "deploy/self-hosted/acceptance-baseline.stage6a.json")})

## Verification outputs

- output
`,
  });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("project memory guard rejects missing required files", () => {
  const root = makeRoot();
  writeMemory(root, { "RISKS.md": "" });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /RISKS\.md/);
});

test("project memory guard requires Stage 8G uncertainty to be marked as hypothesis", () => {
  const root = makeRoot();
  writeMemory(root, { "NEXT_ACTIONS.md": "# NEXT_ACTIONS\n\nStage 8G-8I is next.\n" });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /without marking it as a hypothesis/);
});

test("project memory guard rejects missing artifact links", () => {
  const root = makeRoot();
  writeMemory(root, {
    "ARTIFACTS.md": "# ARTIFACTS\n\n## Stage 6 manifests\n\n- [missing](/tmp/not-present-project-memory-file)\n\n## Verification outputs\n\n- output\n",
  });
  const result = collectProjectMemoryChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing artifact/);
});
