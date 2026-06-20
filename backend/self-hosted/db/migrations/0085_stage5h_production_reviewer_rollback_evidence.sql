-- Stage 5H · Batch 52
-- Metadata-only production reviewer rollback evidence for production assets
-- before production reviewer governance. Stores aggregate rollback readiness
-- status only; no patient delivery, clinical conclusion, measurements,
-- pair keys, image IDs, protected storage references, reviewer identity,
-- raw rollback logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  production_reviewer_rollback_evidence_status text not null default 'not_started',
  production_reviewer_rollback_evidence_reasons jsonb not null default '[]'::jsonb,
  production_dataset_evidence_status text not null default 'not_started',
  rollback_drill_status text not null default 'missing',
  rollback_owner_status text not null default 'missing',
  rollback_window_status text not null default 'missing',
  rollback_exception_status text not null default 'missing',
  rollback_archive_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  production_review_window_count integer not null default 0,
  rollback_drill_production_count integer not null default 0,
  rollback_ready_production_count integer not null default 0,
  rollback_exception_count integer not null default 0,
  unresolved_rollback_evidence_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_status_check
    check (
      production_reviewer_rollback_evidence_status in (
        'not_started',
        'in_review',
        'ready_for_production_reviewer_rollback_evidence'
      )
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_previous_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_previous_status_check
    check (
      production_dataset_evidence_status in ('not_started', 'in_review', 'ready_for_production_dataset_evidence')
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_checklist_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_checklist_check
    check (
      rollback_drill_status in ('missing', 'needs_review', 'ready')
      and rollback_owner_status in ('missing', 'needs_review', 'ready')
      and rollback_window_status in ('missing', 'needs_review', 'ready')
      and rollback_exception_status in ('missing', 'needs_review', 'ready')
      and rollback_archive_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_counts_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_counts_check
    check (
      production_review_window_count >= 0
      and rollback_drill_production_count >= 0
      and rollback_ready_production_count >= 0
      and rollback_exception_count >= 0
      and unresolved_rollback_evidence_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and rollback_drill_production_count <= production_review_window_count
      and rollback_ready_production_count <= production_review_window_count
      and rollback_exception_count <= production_review_window_count
      and unresolved_rollback_evidence_count <= production_review_window_count
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reasons_array_check
    check (jsonb_typeof(production_reviewer_rollback_evidence_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_metadata_no_protected_keys check (
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
        'productionReviewerRollbackEvidenceUrl',
        'rawProductionReviewerRollbackEvidenceLog',
        'rawProductionRollbackLog',
        'rawProductionReviewerGovernanceLog',
        'rawProductionReviewerEvidenceLog',
        'productionReviewerRollbackEvidencePayload',
        'productionReviewerRollbackEvidenceDetails',
        'productionRollbackPayload',
        'productionRollbackDetails',
        'photoRef',
        'heatmapRef',
        'modelVersion',
        'accessToken',
        'qrToken',
        'sessionId',
        'credential',
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

create index if not exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_clinic_status_idx
  on visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews (
    clinic_id,
    production_reviewer_rollback_evidence_status,
    updated_at desc
  );

create index if not exists visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_visit_idx
  on visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_reviews (
    visit_id,
    updated_at desc
  );
