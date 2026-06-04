-- Stage 5H · Batch BR
-- Metadata-only visit timeline rollout governance.
-- Stores aggregate readiness snapshots only; no clinical conclusion, patient delivery,
-- pair keys, image IDs, protected storage references, reviewer identity, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  rollout_status text not null default 'not_approved',
  rollout_reasons jsonb not null default '[]'::jsonb,
  validation_status text not null default 'blocked',
  lesion_count integer not null default 0,
  ready_timeline_count integer not null default 0,
  needs_review_timeline_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_validation_status_check
    check (validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_reasons_array_check
    check (jsonb_typeof(rollout_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_reviews_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_reviews_metadata_no_protected_keys check (
    not (
      metadata_json ?| array[
        'pairKey',
        'imageIds',
        'objectBucket',
        'objectKey',
        'storagePath',
        'storageObjectPath',
        'signedUrl',
        'sharedLink',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_reviews
  on visit_longitudinal_timeline_rollout_reviews (clinic_id, rollout_status, updated_at desc);

comment on table visit_longitudinal_timeline_rollout_reviews is
  'Batch BR metadata-only timeline rollout governance. Patient delivery, clinical output, protected fields, pair keys, and image IDs stay disabled.';
