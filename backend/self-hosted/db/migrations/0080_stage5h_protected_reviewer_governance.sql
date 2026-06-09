-- Stage 5H · Batch CD
-- Metadata-only reviewer-operations governance over time on real protected
-- assets after protected reviewer validation. Stores aggregate governance
-- status only; no patient delivery, clinical conclusion, measurement values,
-- pair keys, image IDs, protected storage references, reviewer identity, raw
-- reviewer-operation logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  protected_reviewer_governance_status text not null default 'not_started',
  protected_reviewer_governance_reasons jsonb not null default '[]'::jsonb,
  protected_reviewer_validation_status text not null default 'not_started',
  longitudinal_clinical_validation_status text not null default 'not_started',
  outcome_governance_status text not null default 'not_started',
  exception_governance_status text not null default 'not_started',
  observation_governance_status text not null default 'not_started',
  post_validation_monitoring_status text not null default 'not_started',
  clinical_validation_status text not null default 'not_started',
  incident_procedure_status text not null default 'not_started',
  monitoring_status text not null default 'not_started',
  evidence_status text not null default 'not_started',
  sop_status text not null default 'not_started',
  dataset_validation_status text not null default 'blocked',
  rollout_status text not null default 'not_approved',
  reviewer_monitoring_status text not null default 'missing',
  reviewer_exception_status text not null default 'missing',
  reviewer_adjudication_status text not null default 'missing',
  reviewer_followup_status text not null default 'missing',
  reviewer_rollback_status text not null default 'missing',
  reviewer_archive_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  protected_review_window_count integer not null default 0,
  monitored_protected_review_count integer not null default 0,
  escalated_protected_review_count integer not null default 0,
  adjudicated_protected_governance_count integer not null default 0,
  followup_closed_protected_count integer not null default 0,
  rollback_ready_protected_count integer not null default 0,
  archived_protected_review_count integer not null default 0,
  unresolved_governance_review_count integer not null default 0,
  blocker_count integer not null default 0,
  lesion_count integer not null default 0,
  ready_timeline_count integer not null default 0,
  blocked_timeline_count integer not null default 0,
  candidate_pair_count integer not null default 0,
  reviewer_workflow_ready_count integer not null default 0,
  patient_delivery_allowed boolean not null default false,
  medical_measurement_allowed boolean not null default false,
  protected_fields_exposed boolean not null default false,
  clinical_output_generated boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_status_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_status_check
    check (
      protected_reviewer_governance_status in (
        'not_started',
        'in_review',
        'ready_for_protected_reviewer_governance'
      )
    );

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_validation_status_check
    check (
      protected_reviewer_validation_status in (
        'not_started',
        'in_review',
        'ready_for_protected_reviewer_validation'
      )
      and longitudinal_clinical_validation_status in ('not_started', 'in_review', 'ready_for_longitudinal_clinical_validation')
      and outcome_governance_status in ('not_started', 'in_review', 'ready_for_outcome_governance')
      and exception_governance_status in ('not_started', 'in_review', 'ready_for_exception_governance')
      and observation_governance_status in ('not_started', 'in_review', 'ready_for_observation_governance')
      and post_validation_monitoring_status in ('not_started', 'in_review', 'ready_for_post_validation_monitoring')
      and clinical_validation_status in ('not_started', 'in_review', 'ready_for_clinical_validation')
      and incident_procedure_status in ('not_started', 'in_review', 'ready_for_clinic_monitoring')
      and monitoring_status in ('not_started', 'in_review', 'ready_for_production_rollout')
      and evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout')
      and sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout')
      and dataset_validation_status in ('blocked', 'needs_review', 'ready_for_rollout')
      and rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations')
    );

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_checklist_status_check
    check (
      reviewer_monitoring_status in ('missing', 'needs_review', 'ready')
      and reviewer_exception_status in ('missing', 'needs_review', 'ready')
      and reviewer_adjudication_status in ('missing', 'needs_review', 'ready')
      and reviewer_followup_status in ('missing', 'needs_review', 'ready')
      and reviewer_rollback_status in ('missing', 'needs_review', 'ready')
      and reviewer_archive_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_counts_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_counts_check
    check (
      protected_review_window_count >= 0
      and monitored_protected_review_count >= 0
      and escalated_protected_review_count >= 0
      and adjudicated_protected_governance_count >= 0
      and followup_closed_protected_count >= 0
      and rollback_ready_protected_count >= 0
      and archived_protected_review_count >= 0
      and unresolved_governance_review_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and monitored_protected_review_count <= protected_review_window_count
      and escalated_protected_review_count <= monitored_protected_review_count
      and adjudicated_protected_governance_count <= escalated_protected_review_count
      and followup_closed_protected_count <= adjudicated_protected_governance_count
      and rollback_ready_protected_count <= monitored_protected_review_count
      and archived_protected_review_count <= monitored_protected_review_count
      and unresolved_governance_review_count <= monitored_protected_review_count
    );

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_reasons_array_check
    check (jsonb_typeof(protected_reviewer_governance_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_protected_reviewer_governance_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_protected_reviewer_governance_metadata_no_protected_keys check (
    not (
      metadata_json ?| array[
        'pairKey',
        'imageIds',
        'assetIds',
        'patientRows',
        'patientIds',
        'caseIds',
        'objectBucket',
        'objectKey',
        'storagePath',
        'storageObjectPath',
        'signedUrl',
        'sharedLink',
        'reviewerOpsUrl',
        'adjudicationOpsUrl',
        'followupOpsUrl',
        'rollbackOpsUrl',
        'archiveOpsUrl',
        'governanceUrl',
        'rawProtectedReviewLog',
        'rawProtectedReviewerLog',
        'rawReviewerOpsLog',
        'rawAdjudicationOpsLog',
        'rawFollowupOpsLog',
        'rawRollbackOpsLog',
        'rawArchiveOpsLog',
        'protectedReviewerGovernancePayload',
        'protectedReviewerGovernanceDetails',
        'reviewerMonitoringPayload',
        'reviewerOpsPayload',
        'reviewerOpsDetails',
        'adjudicationOpsPayload',
        'adjudicationOpsDetails',
        'followupOpsPayload',
        'followupOpsDetails',
        'rollbackOpsPayload',
        'rollbackOpsDetails',
        'archiveOpsPayload',
        'archiveOpsDetails',
        'protectedReviewerValidationPayload',
        'protectedReviewerValidationDetails',
        'rawProtectedAssetLog',
        'photoRef',
        'heatmapRef',
        'modelVersion',
        'accessToken',
        'qrToken',
        'sessionId',
        'reviewerName',
        'reviewerEmail',
        'validatorName',
        'validatorEmail',
        'assignedReviewerName',
        'assignedReviewerEmail',
        'secondReviewerName',
        'secondReviewerEmail',
        'doctorVersionText',
        'patientSafeText',
        'measurementValue',
        'diameterMm',
        'areaMm2',
        'clinicalMeasurement',
        'diagnosis',
        'riskScore',
        'riskLevel',
        'prognosis',
        'treatment',
        'melanomaProbability',
        'dynamicConclusion',
        'clinicalDynamicConclusion',
        'patientDeliveryPayload'
      ]
    )
  );

create index if not exists idx_visit_longitudinal_timeline_rollout_protected_reviewer_governance_visit
  on visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews (visit_id, updated_at desc);
