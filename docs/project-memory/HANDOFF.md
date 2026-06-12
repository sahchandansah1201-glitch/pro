# HANDOFF

## Scope

This handoff captures the repository state while the External Clinic Operator
Execution Record is being implemented after the Operator Acceptance / Clinic
Go-No-Go checklist. The reconciliation pass is recorded in
`docs/project-memory/PLAN_RECONCILIATION.md`.

## Confirmed state

0. Client journey audit and Russian UI hardening is implemented in the current
   branch:
   - doctor visit assessment/conclusion/report paths use native Russian labels
     and keep diagnosis, measurements, dynamic conclusions, and patient
     delivery disabled;
   - visit workspace QA ledger labels are mapped to human Russian wording and
     guarded by tests;
   - system-admin device service statuses no longer expose unknown raw enum
     values and fall back to `неизвестно`;
   - role guard and status/release/system tests were aligned with native
     Russian visible copy;
   - e2e and a11y routes were executed across desktop/mobile where the local
     demo or mocked self-hosted route is available;
   - production-only self-hosted visit QA and real-auth asset smoke remain
     external-environment gates, not closed repository evidence.

0. External Clinic Operator Execution Record is defined:
   - `deploy/self-hosted/external-clinic-operator-execution-record.json`
     records the external clinic operator execution record template;
   - `docs/project-memory/EXTERNAL_CLINIC_OPERATOR_EXECUTION_RECORD.md`
     records the required external fields, allowed decisions, intake rules,
     and no-go triggers;
   - source checklist: `operator-acceptance-clinic-go-no-go`;
   - repository records the execution record template only;
   - external clinic operator execution outcome is required before real
     go/no-go can be treated as externally decided;
   - automatic next numbered stage remains disabled;
   - Stage 49A-49Z remains undefined;
   - runtime behavior added: false;
   - database migration added: false;
   - OpenAPI contract added: false;
   - frontend workflow added: false;
   - no patient data, secrets, credentials, signed approval artifacts, external
     approval proof, legal sufficiency proof, medical correctness proof, or
     actual go-live decision proof is stored in repository.

0. Operator Acceptance / Clinic Go-No-Go checklist is defined and synced:
   - `deploy/self-hosted/operator-acceptance-clinic-go-no-go.json` records the
     clinic operator go/no-go checklist;
   - `docs/project-memory/OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO.md` records the
     external acceptance template;
   - requires external clinic execution;
   - repository records the checklist template only;
   - automatic next numbered stage remains disabled;
   - Stage 49A-49Z remains undefined;
   - runtime behavior added: false;
   - database migration added: false;
   - OpenAPI contract added: false;
   - frontend workflow added: false;
   - no external approval proof, no legal sufficiency proof, and no medical
     correctness proof.

0. Final backlog / terminal completion criterion is defined:
   - `deploy/self-hosted/final-backlog-terminal-completion-criterion.json`
     records the terminal criterion for the current plan;
   - `docs/project-memory/FINAL_BACKLOG_TERMINAL_COMPLETION.md` records the
     final backlog and stop condition;
   - automatic next numbered stage: disabled;
   - No automatic Stage 49A-49Z exists;
   - future numbered work requires a new explicit plan decision;
   - runtime behavior added: false;
   - database migration added: false;
   - OpenAPI contract added: false;
   - frontend workflow added: false;
   - no external legal approval proof, no external clinical approval proof,
     and no medical correctness proof.

0. Lovable progress reporting rule is active:
   - every future Lovable prompt and response must be summarized as a table;
   - the required ledger is
     `docs/project-memory/LOVABLE_PROGRESS_LEDGER.md`;
   - each row must separate implementation plan, done/verified, future work,
     evidence/checks, and truth boundary.

0. Stage 48A-48Z is defined as a repository scope batch:
   - `deploy/self-hosted/clinical-followup-stage48-scope.stage48a-48z.json`
     records Stage 48A-48Z as ready scope after Stage 47A-47Z;
   - runtime behavior added: false;
   - database migration added: false;
   - OpenAPI contract added: false;
   - Stage 49A-49Z is not defined;
   - next repository action: final backlog / terminal completion criterion;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.

0. Stage 47A-47Z is merged to main as SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt:
   - PostgreSQL Stage 47 archive readiness closure receipt handoff receipt reconciliation closure receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage47_recon_closure_receipt_events`;
   - backend sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt summary/update routes;
   - doctor live workspace Recon archive handoff receipt reconciliation closure receipt ready / Needs recon archive handoff receipt reconciliation closure receipt / Received recon archive handoff receipt reconciliation closure receipts summary tiles and Receive recon archive handoff receipt reconciliation closure receipt / Recon archive handoff receipt reconciliation closure receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt.

0. Stage 46A-46Z is merged to main as SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure:
   - PostgreSQL Stage 46 archive readiness closure receipt handoff receipt reconciliation closure fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage46_handoff_receipt_recon_closure_events`;
   - backend sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure summary/update routes;
   - doctor live workspace Recon archive handoff receipt reconciliation closure ready / Needs recon archive handoff receipt reconciliation closure / Closed recon archive handoff receipt reconciliation closures summary tiles and Close recon archive handoff receipt reconciliation / Recon archive handoff receipt reconciliation closure rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure.

0. Stage 45A-45Z is implemented in the current branch as SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation:
   - PostgreSQL Stage 45 archive readiness closure receipt handoff receipt reconciliation fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage45_handoff_receipt_recon_events`;
   - backend sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation summary/update routes;
   - doctor live workspace Recon archive handoff receipt reconciliation ready / Needs recon archive handoff receipt reconciliation / Reconciled recon archive handoff receipts summary tiles and Reconcile recon archive handoff receipt / Recon archive handoff receipt reconciliation rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation.

0. Stage 44A-44Z is implemented in the current branch as SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt:
   - PostgreSQL Stage 44 archive readiness closure receipt handoff receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage44_archive_handoff_receipt_events`;
   - backend sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt summary/update routes;
   - doctor live workspace Recon archive handoff receipt ready / Needs recon archive handoff receipt / Received recon archive handoff receipts summary tiles and Receive recon archive handoff receipt / Recon archive handoff receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt.

0. Stage 43A-43Z is implemented in the current branch as SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff:
   - PostgreSQL Stage 43 archive readiness closure receipt handoff fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage43_archive_receipt_handoff_events`;
   - backend sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff summary/update routes;
   - doctor live workspace Recon archive closure receipt handoff ready / Needs recon archive closure receipt handoff / Handed off recon archive closure receipt handoffs summary tiles and Hand off recon archive receipt / Recon archive receipt handoff rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff.


0. Stage 42A-42Z is implemented in the current branch as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt:
   - PostgreSQL Stage 42 archive closure receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage42_archive_closure_receipt_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt summary/update routes;
   - doctor live workspace Recon archive closure receipt ready / Needs recon
     archive closure receipt / Received recon archive closure receipts summary
     tiles and Receive recon archive closure / Recon archive closure receipt
     rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt.

0. Stage 41A-41Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure:
   - PostgreSQL Stage 41 archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage41_archive_readiness_closure_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure summary/update routes;
   - doctor live workspace Recon receipt archive closure ready / Needs recon
     receipt archive closure / Closed recon receipt archives summary tiles and
     Close recon receipt archive / Recon receipt archive closure rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure.

0. Stage 40A-40Z is implemented in the current branch as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness:
   - PostgreSQL Stage 40 archive closure receipt handoff receipt reconciliation closure receipt archive readiness fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation closure receipt archive readiness summary/update routes;
   - doctor live workspace Recon receipt archive ready / Needs recon receipt archive
     / Archived recon receipts summary tiles and Archive recon receipt /
     Recon receipt archive rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness.

0. Stage 39A-39Z is implemented in the current branch as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt:
   - PostgreSQL Stage 39 archive closure receipt handoff receipt reconciliation closure receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage39_archive_handoff_receipt_reconciliation_closure_receipt_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation closure receipt summary/update routes;
   - doctor live workspace Recon closure receipt ready / Needs closure receipt
     / Received recon closures summary tiles and Receive recon closure /
     Recon closure receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt.

0. Stage 38A-38Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure:
   - PostgreSQL Stage 38 archive closure receipt handoff receipt reconciliation closure fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage38_archive_handoff_receipt_reconciliation_closure_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation closure summary/update routes;
   - doctor live workspace Receipt recon closure ready / Needs receipt recon
     closure / Closed receipt recons summary tiles and Close receipt recon /
     Receipt recon closure rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure.

0. Stage 37A-37Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation:
   - PostgreSQL Stage 37 archive closure receipt handoff receipt reconciliation fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage37_archive_handoff_receipt_reconciliation_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt reconciliation summary/update routes;
   - doctor live workspace Handoff receipt recon ready / Needs receipt recon /
     Reconciled handoff receipts summary tiles and Reconcile handoff receipt /
     Receipt recon rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation.

0. Stage 36A-36Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff receipt:
   - PostgreSQL Stage 36 archive closure receipt handoff receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage36_archive_handoff_receipt_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff receipt summary/update routes;
   - doctor live workspace Receipt handoff ready / Needs receipt handoff /
     Received handoff receipts summary tiles and Receive handoff receipt /
     Handoff receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt.

0. Stage 35A-35Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt handoff:
   - PostgreSQL Stage 35 archive closure receipt handoff fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage35_archive_receipt_handoff_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt handoff summary/update routes;
   - doctor live workspace Handoff ready / Needs handoff / Handed off receipts
     summary tiles and Handoff archive receipt / Handoff rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff.

0. Stage 34A-34Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure receipt:
   - PostgreSQL Stage 34 archive closure receipt fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_stage34_archive_closure_receipt_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure receipt summary/update routes;
   - doctor live workspace Receipt ready / Needs receipt / Received archive receipts
     summary tiles and Receive archive receipt / Archive receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure receipt.

0. Stage 33A-33Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive closure:
   - PostgreSQL SOP policy governance evidence reconciliation closure receipt
     archive closure fields on `clinical_follow_up_tasks`;
   - append-only
     `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive closure summary/update routes;
   - doctor live workspace Closure ready / Needs closure / Closed archives
     summary tiles and Close archive / Archive closure rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive closure.

0. Stage 32A-32Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt archive readiness:
   - PostgreSQL SOP policy governance evidence reconciliation closure receipt
     archive readiness fields on `clinical_follow_up_tasks`;
   - append-only
     `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     archive readiness summary/update routes;
   - doctor live workspace Archive ready / Needs archive / Archived local
     summary tiles and Archive ready / Archive rework row actions;
   - no managed notification provider dependency, no external governance proof,
     no legal archive sufficiency proof, and no medical correctness proof.
   - recovery marker: SOP policy governance evidence reconciliation closure receipt archive readiness.

0. Stage 31A-31Z is merged to main as SOP policy governance
   evidence reconciliation closure receipt:
   - PostgreSQL SOP policy governance evidence reconciliation closure receipt
     fields on `clinical_follow_up_tasks`;
   - append-only
     `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events`;
   - backend SOP policy governance evidence reconciliation closure receipt
     summary/update routes;
   - doctor live workspace Receipt ready / Needs receipt / Received receipt
     summary tiles and Receive receipt / Receipt rework row actions;
   - no managed notification provider dependency, no external governance proof,
     and no medical correctness proof.

0. Stage 30A-30Z is merged to main as SOP policy governance
   evidence reconciliation closure:
   - PostgreSQL SOP policy governance evidence reconciliation closure fields on
     `clinical_follow_up_tasks`;
   - append-only
     `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events`;
   - backend SOP policy governance evidence reconciliation closure summary/update
     routes;
   - doctor live workspace Recon close ready / Needs recon close / Closed recon
     summary tiles and Close recon / Closure rework row actions;
   - no managed notification provider dependency, no external governance proof,
     and no medical correctness proof.

0. Stage 29A-29Z is merged to main as SOP policy governance
   evidence reconciliation:
   - PostgreSQL SOP policy governance evidence reconciliation fields on
     `clinical_follow_up_tasks`;
   - append-only
     `clinical_follow_up_sop_policy_governance_evidence_reconciliation_events`;
   - backend SOP policy governance evidence reconciliation summary/update
     routes;
   - doctor live workspace Recon ready / Needs recon / Reconciled summary
     tiles and Reconcile evidence / Recon mismatch row actions;
   - no managed notification provider dependency, no external governance proof,
     and no medical correctness proof.

0. Stage 28A-28Z is implemented in the current branch as SOP policy governance
   evidence export:
   - PostgreSQL SOP policy governance evidence fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_governance_evidence_events`;
   - backend SOP policy governance evidence summary/update routes;
   - doctor live workspace Evidence ready / Needs evidence / Exported local
     summary tiles and Export evidence / Evidence follow-up row actions;
   - no managed notification provider dependency, no external governance proof,
     and no medical correctness proof.

0. Stage 27A-27Z is merged to main as SOP policy governance
   closure:
   - PostgreSQL SOP policy governance closure fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_governance_closure_events`;
   - backend SOP policy governance closure summary/update routes;
   - doctor live workspace Close governance and Closure follow-up row actions;
   - no managed notification provider dependency and no external governance proof.

0. Stage 26A-26Z is merged to main as SOP policy governance
   readiness:
   - PostgreSQL SOP policy governance readiness fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_governance_events`;
   - backend SOP policy governance readiness summary/update routes;
   - doctor live workspace Governance reviewed and Governance follow-up row actions;
   - no managed notification provider dependency and no external governance proof.

0. Stage 25A-25Z is merged to main as local SOP policy audit
   rollup:
   - PostgreSQL SOP policy audit fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_audit_events`;
   - backend SOP policy audit rollup summary/update routes;
   - doctor live workspace Audit reviewed and Audit follow-up row actions;
   - no managed notification provider dependency and no external SOP proof.

0. Stage 24A-24Z is merged to main as local SOP policy
   exception closure:
   - PostgreSQL SOP policy exception closure fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_exception_events`;
   - backend SOP policy exception summary/update routes;
   - doctor live workspace Open exception and Close exception row actions;
   - no managed notification provider dependency and no external SOP proof.

0. Stage 23A-23Z is merged to main as local SOP policy
   application and drift review:
   - PostgreSQL SOP policy application fields on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_policy_application_events`;
   - backend SOP policy application summary/update routes;
   - doctor live workspace Apply policy and Drift review row actions;
   - no managed notification provider dependency and no external SOP proof.

0. Stage 22A-22Z is merged to main as configurable local
   clinic SOP policy templates:
   - PostgreSQL `clinical_follow_up_sop_policy_templates`;
   - append-only `clinical_follow_up_sop_policy_template_events`;
   - backend SOP policy template summary/list/create/update routes;
   - doctor live workspace SOP policy template panel;
   - no managed notification provider dependency and no external SOP proof.

0. Stage 21A-21Z is merged to main as clinic-specific
   follow-up SOP validation:
   - PostgreSQL SOP validation state on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_sop_validation_events`;
   - backend SOP validation summary and update routes;
   - doctor live workspace SOP validation panel;
   - no managed notification provider dependency.

0. Stage 20A-20Z is implemented in the current branch as follow-up retention and
   clinic review readiness:
   - PostgreSQL retention and clinic review state on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_retention_review_events`;
   - backend clinic-review summary and review update routes;
   - doctor live workspace retention and clinic-review panel;
   - no managed notification provider dependency.

0. Stage 19A-19Z is implemented in the current branch as follow-up outcome and
   quality review:
   - PostgreSQL outcome and quality review state on `clinical_follow_up_tasks`;
   - append-only `clinical_follow_up_quality_events`;
   - backend outcome summary and quality update routes;
   - doctor live workspace quality closure panel;
   - no managed notification provider dependency.

0. Stage 18A-18Z is implemented in the current branch as follow-up operations
   hardening:
   - PostgreSQL SLA, triage, escalation, delivery evidence, and append-only
     operations events;
   - backend operations queue, summary, and update routes;
   - doctor live workspace operations panel;
   - no managed notification provider dependency.

1. Stage 6A-6Z and Stage 7A-7I are present on the current branch base.
2. Stage 7A-7C is the development workflow contract.
3. Stage 7D-7F is the batch automation contract and Lovable prompt gate.
4. Stage 7G-7I is the confirmed batch verification loop:
   - readiness reporter;
   - Lovable sync verification manifest;
   - drift guard.
5. Stage 7J-7L adds a product roadmap control layer only:
   - Stage 7J: product gap register.
   - Stage 7K: next product batch planner.
   - Stage 7L: product roadmap drift guard.
6. Stage 8A-8C implements the CRM inbound adapter layer:
   - Stage 8A: CRM inbound adapter contract.
   - Stage 8B: CRM export normalization into Stage 5Q import payloads.
   - Stage 8C: safe import audit flow.
7. Stage 8A-8C product boundary:
   - no backend route changes;
   - no database migrations;
   - no frontend runtime pages;
   - no managed runtime or managed database dependency;
   - no browser/backend runtime calls to CRM or advertising systems.
8. Stage 8D-8F implements the appointment availability sync layer:
   - Stage 8D: local availability sync snapshot contract;
   - Stage 8E: conflict/readiness detection for stale, duplicate,
     overlapping, unmatched, and rejected import states;
   - Stage 8F: booking confirmation readiness that maps local request refs to
     local slot refs for the existing Stage 5S confirmation flow.
9. Stage 8D-8F product boundary:
   - no CRM/ad runtime calls;
   - no managed runtime or managed database dependency;
   - no raw patient identity, token, external URL, signed URL, or storage path
     output in reports or UI;
   - operator UI reads already-loaded self-hosted Stage 5P/5R/5T data.
10. Stage 8G-8I implements Clinical reporting completion:
   - Stage 8G: self-hosted `GET /api/v1/visits/{visitId}/report-package`;
   - Stage 8H: readiness gates for assessment, conclusion, report, lesion,
     and asset completeness;
   - Stage 8I: production report-tab summary in `VisitWorkspacePage`.
11. Stage 8G-8I product boundary:
   - no managed runtime or managed database dependency;
   - no external CRM/ad/scheduling runtime calls;
   - no browser hardware API coupling;
   - no raw patient report body, signed URL, object storage path, or token
     output in the report package.
11a. Batch Q extends Stage 8G-8I with SD-MF-046 `patientPhotoProtocol`:
   - doctor-selected patient photo/protocol metadata is represented as counts,
     consent/readiness blockers, and delivery-boundary booleans only;
   - patient photo delivery remains blocked until self-hosted file proxy,
     release audit, revoke, identity check, retention, and approved medical-copy
     gates exist;
   - no raw files, storage paths, signed URLs, tokens, or physician-only text
     are exposed.
11b. Batch R extends Stage 8G-8I with a patient photo/protocol release ledger:
   - creates `patient_photo_protocol_releases` for prepare/revoke metadata;
   - adds doctor-write endpoints for prepare and revoke under `/api/v1/visits`;
   - records `patient_photo_protocol.release.prepare` and
     `patient_photo_protocol.release.revoke` audit actions;
   - patient delivery remains blocked: no files, links, storage paths, tokens,
     or physician-only text are exposed.
12. Stage 8J-8O implements Device Bridge production readiness and the server
    operations handbook:
   - Stage 8J: self-hosted `GET /api/v1/device-bridge-worker/production-readiness`;
   - Stage 8K: production readiness panel in `/sys/devices`;
   - Stage 8L: drift guard, OpenAPI, workflow and preflight;
   - Stage 8M: server operations handbook manifest;
   - Stage 8N: handbook renderer and Lovable sync prompt;
   - Stage 8O: handbook guard and project-memory update.
13. Stage 8J-8O product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in the readiness report or handbook.
14. Stage 8P-9A implements Device Bridge operations continuity:
   - Stage 8P: incident drill register;
   - Stage 8Q: telemetry retention register;
   - Stage 8R: continuity checklist;
   - Stage 8S: self-hosted `GET /api/v1/device-bridge-worker/operations-continuity`;
   - Stage 8T: OpenAPI and nginx publishing;
   - Stage 8U: frontend continuity adapter;
   - Stage 8V: `/sys/devices` continuity UI;
   - Stage 8W: safe export preview;
   - Stage 8X: drift guard;
   - Stage 8Y: workflow gate;
   - Stage 8Z: project-memory refresh;
   - Stage 9A: next batch handoff.
15. Stage 8P-9A product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in continuity reports.
16. Stage 9B-9M implements Device Bridge fleet reliability:
   - Stage 9B: fleet reliability register;
   - Stage 9C: worker SLO policy;
   - Stage 9D: command queue SLO policy;
   - Stage 9E: self-hosted `GET /api/v1/device-bridge-worker/fleet-reliability`;
   - Stage 9F: OpenAPI and nginx publishing;
   - Stage 9G: frontend reliability adapter;
   - Stage 9H: `/sys/devices` fleet reliability UI;
   - Stage 9I: safe reliability export preview;
   - Stage 9J: drift guard;
   - Stage 9K: workflow gate;
   - Stage 9L: project-memory refresh;
   - Stage 9M: next batch handoff.
17. Stage 9B-9M product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in reliability reports.
18. Stage 9N-9Z implements Device Bridge lifecycle assurance:
   - Stage 9N: lifecycle assurance register;
   - Stage 9O: maintenance window policy;
   - Stage 9P: worker upgrade posture;
   - Stage 9Q: audit retention closure;
   - Stage 9R: self-hosted `GET /api/v1/device-bridge-worker/lifecycle-assurance`;
   - Stage 9S: OpenAPI and nginx publishing;
   - Stage 9T: frontend assurance adapter;
   - Stage 9U: `/sys/devices` lifecycle assurance UI;
   - Stage 9V: safe closure export preview;
   - Stage 9W: drift guard;
   - Stage 9X: workflow gate;
   - Stage 9Y: project-memory refresh;
   - Stage 9Z: next batch handoff.
19. Stage 9N-9Z product boundary:
   - no managed runtime or managed database dependency;
   - local PostgreSQL and local self-hosted object store only;
   - no browser hardware API coupling;
   - no raw worker payload, raw result payload, signed URL, storage path,
     token, or raw patient name output in lifecycle assurance reports.
20. Stage 10A-10Z implements error prevention and x2 batch quality gates:
   - Stage 10A: error taxonomy register;
   - Stage 10B: pre-implementation repository state gate;
   - Stage 10C: batch size compliance gate;
   - Stage 10D: manifest-to-docs alignment gate;
   - Stage 10E: package script alignment gate;
   - Stage 10F: preflight-all alignment gate;
   - Stage 10G: project-memory post-merge wording gate;
   - Stage 10H: Lovable prompt timing gate;
   - Stage 10I: temporary artifact detection gate;
   - Stage 10J: lockfile integrity gate;
   - Stage 10K: boundary marker guard;
   - Stage 10L: typecheck before PR gate;
   - Stage 10M: stage-specific preflight gate;
   - Stage 10N: previous-batch regression gate;
   - Stage 10O: UI fetch-count drift gate;
   - Stage 10P: shared UI type drift gate;
   - Stage 10Q: dry-run output hygiene gate;
   - Stage 10R: GitHub check wait gate;
   - Stage 10S: post-merge local main verification gate;
   - Stage 10T: Lovable sync mismatch diagnostic gate;
   - Stage 10U: failure-to-prevention worklog gate;
   - Stage 10V: mandatory command bundle;
   - Stage 10W: Pull request evidence bundle;
   - Stage 10X: CI workflow gate;
   - Stage 10Y: project-memory refresh;
   - Stage 10Z: next x2 batch handoff.
21. Stage 10A-10Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository metadata only.
22. Stage 11A-11Z implements development quality ledger:
   - Stage 11A: batch intake ledger;
   - Stage 11B: repository evidence ledger;
   - Stage 11C: scope-to-file ownership ledger;
   - Stage 11D: required check matrix;
   - Stage 11E: previous-batch regression matrix;
   - Stage 11F: defect capture ledger;
   - Stage 11G: prevention verification ledger;
   - Stage 11H: temporary artifact quarantine ledger;
   - Stage 11I: lockfile integrity ledger;
   - Stage 11J: typecheck and shared type ledger;
   - Stage 11K: UI endpoint drift ledger;
   - Stage 11L: OpenAPI and route alignment ledger;
   - Stage 11M: workflow and CI alignment ledger;
   - Stage 11N: project-memory confirmation ledger;
   - Stage 11O: historical guard compatibility ledger;
   - Stage 11P: Lovable prompt sequencing ledger;
   - Stage 11Q: GitHub checks waiting ledger;
   - Stage 11R: post-merge local main ledger;
   - Stage 11S: sync mismatch recovery ledger;
   - Stage 11T: batch volume metrics ledger;
   - Stage 11U: risk and uncertainty ledger;
   - Stage 11V: artifact link ledger;
   - Stage 11W: boundary and privacy ledger;
   - Stage 11X: Pull request evidence ledger;
   - Stage 11Y: Lovable verification manifest ledger;
   - Stage 11Z: next x2 batch handoff ledger.
23. Stage 11A-11Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository quality metadata only.
24. Stage 12A-12Z implements the execution evidence bundle:
   - Stage 12A: evidence bundle schema;
   - Stage 12B: repository baseline evidence;
   - Stage 12C: branch and commit evidence;
   - Stage 12D: scope ownership evidence;
   - Stage 12E: command bundle evidence;
   - Stage 12F: previous-batch regression evidence;
   - Stage 12G: defect recurrence evidence;
   - Stage 12H: prevention proof evidence;
   - Stage 12I: preflight-all alignment evidence;
   - Stage 12J: project-memory alignment evidence;
   - Stage 12K: typecheck evidence;
   - Stage 12L: lockfile and temp artifact evidence;
   - Stage 12M: boundary scan evidence;
   - Stage 12N: privacy scan evidence;
   - Stage 12O: workflow and CI evidence;
   - Stage 12P: GitHub check-run evidence;
   - Stage 12Q: GitHub API fallback evidence;
   - Stage 12R: Pull request evidence;
   - Stage 12S: merge evidence;
   - Stage 12T: post-merge local main evidence;
   - Stage 12U: Lovable prompt evidence;
   - Stage 12V: Lovable confirmation evidence;
   - Stage 12W: sync mismatch recovery evidence;
   - Stage 12X: risk roll-forward evidence;
   - Stage 12Y: batch volume evidence;
   - Stage 12Z: next x2 execution handoff evidence.
25. Stage 12A-12Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository execution evidence only.
26. Stage 13A-13Z implements the execution evidence closure:
   - Stage 13A: closure schema;
   - Stage 13B: Stage 12 evidence regression;
   - Stage 13C: closure rule register;
   - Stage 13D: prompt sequencing closure;
   - Stage 13E: Pull request lifecycle closure;
   - Stage 13F: Lovable sync closure;
   - Stage 13G: sync mismatch diagnostic closure;
   - Stage 13H: artifact hygiene closure;
   - Stage 13I: project-memory closure;
   - Stage 13J: working contract closure;
   - Stage 13K: batch template closure;
   - Stage 13L: preflight-all closure;
   - Stage 13M: typecheck closure;
   - Stage 13N: no-lock-file closure;
   - Stage 13O: diff hygiene closure;
   - Stage 13P: guard coverage closure;
   - Stage 13Q: workflow closure;
   - Stage 13R: report output closure;
   - Stage 13S: self-hosted boundary closure;
   - Stage 13T: privacy closure;
   - Stage 13U: command repeatability closure;
   - Stage 13V: defect-prevention closure;
   - Stage 13W: post-merge verification closure;
   - Stage 13X: Lovable prompt source closure;
   - Stage 13Y: batch volume closure;
   - Stage 13Z: next x2 handoff closure.
27. Stage 13A-13Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository closure evidence only.
28. Stage 14A-14Z implements the sync confirmation ledger:
   - Stage 14A: sync ledger schema;
   - Stage 14B: Lovable confirmation evidence;
   - Stage 14C: merged main evidence;
   - Stage 14D: Pull request lifecycle ledger;
   - Stage 14E: GitHub checks ledger;
   - Stage 14F: command outcome ledger;
   - Stage 14G: sync mismatch decision tree;
   - Stage 14H: branch visibility diagnostic;
   - Stage 14I: artifact hygiene ledger;
   - Stage 14J: project-memory confirmation;
   - Stage 14K: working contract enforcement;
   - Stage 14L: batch template enforcement;
   - Stage 14M: previous batch regression;
   - Stage 14N: preflight-all alignment;
   - Stage 14O: typecheck and lockfile alignment;
   - Stage 14P: package-lock immutability;
   - Stage 14Q: prompt release gate;
   - Stage 14R: Lovable response gate;
   - Stage 14S: self-hosted boundary ledger;
   - Stage 14T: privacy marker ledger;
   - Stage 14U: duplicate CI run handling;
   - Stage 14V: long gate handling;
   - Stage 14W: risk rollback ledger;
   - Stage 14X: next batch readiness;
   - Stage 14Y: handoff packet;
   - Stage 14Z: Stage 15 hypothesis.
29. Stage 14A-14Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository sync evidence only.
30. Stage 15A-15Z implements the post-sync handoff readiness packet:
   - Stage 15A: previous sync confirmation intake;
   - Stage 15B: merged main replay evidence;
   - Stage 15C: Lovable prompt replay evidence;
   - Stage 15D: Pull request merge audit;
   - Stage 15E: GitHub checks replay audit;
   - Stage 15F: duplicate CI resolution rule;
   - Stage 15G: long gate wait policy;
   - Stage 15H: sync mismatch classifier;
   - Stage 15I: repository remote alignment;
   - Stage 15J: Lovable project alignment;
   - Stage 15K: artifact path normalization;
   - Stage 15L: project-memory handoff refresh;
   - Stage 15M: working contract refresh;
   - Stage 15N: batch template replay;
   - Stage 15O: Stage 14 regression gate;
   - Stage 15P: command bundle freeze;
   - Stage 15Q: preflight-all readiness check;
   - Stage 15R: typecheck baseline confirmation;
   - Stage 15S: no-lock-file hygiene;
   - Stage 15T: package-lock immutability;
   - Stage 15U: privacy marker scan;
   - Stage 15V: self-hosted boundary assertion;
   - Stage 15W: prompt release checklist;
   - Stage 15X: Lovable response checklist;
   - Stage 15Y: defect recurrence ledger;
   - Stage 15Z: Stage 16 hypothesis handoff.
31. Stage 15A-15Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository post-sync handoff evidence only.
32. Stage 16A-16Z implements product cycle readiness:
   - Stage 16A: post-sync baseline intake;
   - Stage 16B: product surface inventory;
   - Stage 16C: process-only batch stop rule;
   - Stage 16D: product candidate scoring;
   - Stage 16E: recommended product candidate:
     `Clinical follow-up and patient communication loop`;
   - Stage 16F: acceptance criteria outline;
   - Stage 16G: Lovable prompt gate;
   - Stage 16H-16M: verification, boundary, and project-memory alignment;
   - Stage 16N-16Z: Product-cycle handoff and Stage 17A-17Z hypothesis.
33. Stage 16A-16Z product boundary:
   - no runtime behavior change;
   - no backend routes or frontend product pages;
   - no database migrations;
   - no managed runtime or managed database dependency;
   - repository product cycle readiness only.

## Important operational fact

The Lovable sync prompt remains valid only after the Pull request is merged
into `main` and local `main` is verified. A prompt for an open PR branch is
expected to produce a false "missing files" result because Lovable follows
`main` unless branch switching is explicitly enabled.

## Hypothesis

- Any future numbered batch after the final backlog / terminal completion
  criterion remains a hypothesis until a new repository plan defines it.
- A terminal stage count is not defined in repository files. Stage 48A-48Z and
  the final backlog criterion do not define Stage 49A-49Z.
- `Stage 33A-33Z` is the next hypothesis after Stage 32A-32Z until repository
  files define it.
- `Stage 32A-32Z` closes the previous hypothesis with local SOP policy
  governance evidence reconciliation closure receipt archive readiness.
- `Stage 31A-31Z` closes the previous hypothesis with local SOP policy
  governance evidence reconciliation closure receipt.
- `Stage 30A-30Z` closes the previous hypothesis with local SOP policy
  governance evidence reconciliation closure.
- `Stage 29A-29Z` closes the previous hypothesis with local SOP policy
  governance evidence reconciliation.
- `Stage 28A-28Z` closes the previous hypothesis with local SOP policy
  governance evidence export.
- `Stage 27A-27Z` closes the previous hypothesis with SOP policy governance
  closure.
- `Stage 26A-26Z` closes the previous hypothesis with SOP policy governance
  readiness.
- `Stage 10A-10Z` is the confirmed process batch after Stage 9N-9Z.
- `Stage 15A-15Z` is the confirmed post-sync handoff readiness batch after Stage 14A-14Z.
- `Stage 16A-16Z` is the current product cycle readiness batch after Stage 15A-15Z.
- `Stage 17A-17Z` is the next product-facing hypothesis after Stage 16A-16Z.
- Historical marker: `Stage 10A-10L` was the original next hypothesis after
  Stage 9N-9Z before the x2 batch expanded into Stage 10A-10Z.
- Historical marker: `Stage 8P-8R` was the original next hypothesis after
  Stage 8J-8O before the x2 batch expanded into Stage 8P-9A.
- Historical marker: `Stage 9B-9D` was the original next hypothesis after
  Stage 8P-9A before this x2 batch expanded into Stage 9B-9M.
- Historical marker: `Stage 8J-8L` was the original roadmap hypothesis after
  Stage 8G-8I before the batch-size increase combined it with Stage 8M-8O.

## Immediate continuation recommendation

1. Verify local `main` after final backlog / terminal completion criterion is
   merged.
2. Run or verify:
   - `npm run preflight:final-backlog`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Send the final backlog / terminal completion criterion Lovable sync prompt
   only after the Pull request is merged to `main` and local `main` is verified.
4. Do not treat Stage 49A-49Z as approved scope unless a future repository plan
   explicitly defines it.

## Stage 17A-17Z confirmed product cycle

Stage 17A-17Z implements the clinical follow-up and patient communication loop selected by Stage 16A-16Z:

- doctors create visit follow-up tasks through `VisitWorkspaceLiveActions`;
- the self-hosted backend stores follow-up tasks and messages in PostgreSQL;
- staff use RBAC-protected `/api/v1/clinical/follow-ups` contracts;
- patients use `/api/v1/me/follow-ups` and patient-safe replies through the portal;
- patient-facing responses hide internal notes, object storage paths, signed URLs, and raw infrastructure values.

Product boundary: self-hosted Node backend, self-hosted PostgreSQL, no managed runtime, no managed database, and no managed notification provider dependency.

## Stage 17A-17Z verification

- `npm run test:stage17a-17z`
- `npm run check:stage17a-17z`
- `npm run preflight:stage17a-17z`

## Stage 18A-18Z hypothesis

Stage 18A-18Z is the next hypothesis after Stage 17A-17Z. The exact scope is not confirmed until repository files define it.
