-- Stage 5H · Batch CH
-- Metadata-only production reviewer evidence over time on production assets
-- after production dataset evidence. Stores aggregate reviewer-ops governance
-- status only; no patient delivery, clinical conclusion, measurements,
-- pair keys, image IDs, protected storage references, reviewer identity,
-- raw production reviewer logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  production_reviewer_evidence_status text not null default 'not_started',
  production_reviewer_evidence_reasons jsonb not null default '[]'::jsonb,
  production_dataset_evidence_status text not null default 'not_started',
  production_reviewer_governance_status text not null default 'not_started',
  protected_reviewer_evidence_status text not null default 'not_started',
  protected_reviewer_governance_status text not null default 'not_started',
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
  production_reviewer_assignment_status text not null default 'missing',
  production_second_review_status text not null default 'missing',
  production_adjudication_status text not null default 'missing',
  production_followup_status text not null default 'missing',
  production_exception_status text not null default 'missing',
  production_rollback_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  production_review_window_count integer not null default 0,
  assigned_production_reviewer_count integer not null default 0,
  second_reviewed_production_count integer not null default 0,
  adjudicated_production_review_count integer not null default 0,
  followup_closed_production_count integer not null default 0,
  exception_closed_production_count integer not null default 0,
  rollback_ready_production_count integer not null default 0,
  unresolved_production_reviewer_evidence_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_status_check
    check (
      production_reviewer_evidence_status in (
        'not_started',
        'in_review',
        'ready_for_production_reviewer_evidence'
      )
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_previous_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_previous_status_check
    check (
      production_dataset_evidence_status in ('not_started', 'in_review', 'ready_for_production_dataset_evidence')
      and production_reviewer_governance_status in ('not_started', 'in_review', 'ready_for_production_reviewer_governance')
      and protected_reviewer_evidence_status in ('not_started', 'in_review', 'ready_for_protected_reviewer_evidence')
      and protected_reviewer_governance_status in ('not_started', 'in_review', 'ready_for_protected_reviewer_governance')
      and protected_reviewer_validation_status in ('not_started', 'in_review', 'ready_for_protected_reviewer_validation')
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

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_checklist_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_checklist_check
    check (
      production_reviewer_assignment_status in ('missing', 'needs_review', 'ready')
      and production_second_review_status in ('missing', 'needs_review', 'ready')
      and production_adjudication_status in ('missing', 'needs_review', 'ready')
      and production_followup_status in ('missing', 'needs_review', 'ready')
      and production_exception_status in ('missing', 'needs_review', 'ready')
      and production_rollback_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_counts_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_counts_check
    check (
      production_review_window_count >= 0
      and assigned_production_reviewer_count >= 0
      and second_reviewed_production_count >= 0
      and adjudicated_production_review_count >= 0
      and followup_closed_production_count >= 0
      and exception_closed_production_count >= 0
      and rollback_ready_production_count >= 0
      and unresolved_production_reviewer_evidence_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and assigned_production_reviewer_count <= production_review_window_count
      and second_reviewed_production_count <= assigned_production_reviewer_count
      and adjudicated_production_review_count <= second_reviewed_production_count
      and followup_closed_production_count <= adjudicated_production_review_count
      and exception_closed_production_count <= assigned_production_reviewer_count
      and rollback_ready_production_count <= assigned_production_reviewer_count
      and unresolved_production_reviewer_evidence_count <= assigned_production_reviewer_count
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_reasons_array_check
    check (jsonb_typeof(production_reviewer_evidence_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_evidence_metadata_no_protected_keys check (
    not (
      metadata_json ?| array[
        'pairKey',
        'imageIds',
        'assetIds',
        'patientRows',
        'patientIds',
        'caseIds',
        'clinicOperationIds',
        'longitudinalWindowIds',
        'objectBucket',
        'objectKey',
        'storagePath',
        'storageObjectPath',
        'signedUrl',
        'sharedLink',
        'productionReviewerEvidenceUrl',
        'rawProductionReviewerEvidenceLog',
        'rawProductionReviewerGovernanceLog',
        'rawProductionReviewerAssignmentLog',
        'rawProductionSecondReviewLog',
        'rawProductionAdjudicationLog',
        'rawProductionFollowupLog',
        'rawProductionExceptionLog',
        'rawProductionRollbackLog',
        'productionReviewerEvidencePayload',
        'productionReviewerEvidenceDetails',
        'productionReviewerGovernancePayload',
        'productionReviewerGovernanceDetails',
        'productionReviewerAssignmentPayload',
        'productionReviewerAssignmentDetails',
        'productionSecondReviewPayload',
        'productionSecondReviewDetails',
        'productionAdjudicationPayload',
        'productionAdjudicationDetails',
        'productionFollowupPayload',
        'productionFollowupDetails',
        'productionExceptionPayload',
        'productionExceptionDetails',
        'productionRollbackPayload',
        'productionRollbackDetails',
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

create index if not exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_clinic_status_idx
  on visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews (
    clinic_id,
    production_reviewer_evidence_status,
    updated_at desc
  );

create index if not exists visit_longitudinal_timeline_rollout_production_reviewer_evidence_visit_idx
  on visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews (
    visit_id,
    updated_at desc
  );
