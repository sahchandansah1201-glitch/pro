-- Stage 5H · Batch BT
-- Metadata-only timeline rollout monitoring evidence receipt.
-- Stores aggregate rollout evidence only; no patient delivery, clinical conclusion,
-- pair keys, image IDs, protected storage references, reviewer identity, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  evidence_status text not null default 'not_started',
  evidence_reasons jsonb not null default '[]'::jsonb,
  sop_status text not null default 'not_started',
  validation_status text not null default 'blocked',
  rollout_status text not null default 'not_approved',
  monitoring_evidence_status text not null default 'missing',
  sample_audit_status text not null default 'missing',
  exception_log_status text not null default 'missing',
  rollback_drill_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  monitoring_window_days integer not null default 0,
  sampled_timeline_count integer not null default 0,
  exception_count integer not null default 0,
  rollback_drill_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_status_check
    check (evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout'));

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_sop_status_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_sop_status_check
    check (sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout'));

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_validation_status_check
    check (validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_checklist_status_check
    check (
      monitoring_evidence_status in ('missing', 'needs_review', 'ready')
      and sample_audit_status in ('missing', 'needs_review', 'ready')
      and exception_log_status in ('missing', 'needs_review', 'ready')
      and rollback_drill_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_counts_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_counts_check
    check (
      monitoring_window_days >= 0
      and sampled_timeline_count >= 0
      and exception_count >= 0
      and rollback_drill_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
    );

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_reasons_array_check
    check (jsonb_typeof(evidence_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_evidence_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_evidence_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_evidence_metadata_no_protected_keys check (
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
        'evidenceUrl',
        'rawEvidenceLog',
        'photoRef',
        'heatmapRef',
        'modelVersion',
        'accessToken',
        'qrToken',
        'sessionId',
        'reviewerName',
        'reviewerEmail',
        'assignedReviewerName',
        'assignedReviewerEmail',
        'secondReviewerName',
        'secondReviewerEmail',
        'doctorVersionText',
        'patientSafeText',
        'patientDeliveryPayload',
        'measurementValue',
        'diameterMm',
        'areaMm2',
        'clinicalMeasurement',
        'dynamicConclusion',
        'clinicalDynamicConclusion',
        'diagnosis',
        'riskScore',
        'prognosis',
        'treatment'
      ]
    )
  );

create index if not exists idx_visit_longitudinal_timeline_rollout_evidence_reviews
  on visit_longitudinal_timeline_rollout_evidence_reviews (clinic_id, evidence_status, updated_at desc);

comment on table visit_longitudinal_timeline_rollout_evidence_reviews is
  'Batch BT metadata-only timeline rollout monitoring evidence receipt. Patient delivery, clinical output, protected fields, pair keys, image IDs, and patient rows stay disabled.';
