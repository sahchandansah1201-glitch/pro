-- Stage 5H · Batch BW
-- Metadata-only clinical validation readiness over real longitudinal datasets.
-- Stores aggregate validation status only; no patient delivery, clinical conclusion,
-- measurement values, pair keys, image IDs, protected storage references, validator
-- identity, raw validation/adjudication logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_clinical_validation_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  clinical_validation_status text not null default 'not_started',
  clinical_validation_reasons jsonb not null default '[]'::jsonb,
  incident_procedure_status text not null default 'not_started',
  monitoring_status text not null default 'not_started',
  evidence_status text not null default 'not_started',
  sop_status text not null default 'not_started',
  dataset_validation_status text not null default 'blocked',
  rollout_status text not null default 'not_approved',
  real_dataset_lock_status text not null default 'missing',
  validator_training_status text not null default 'missing',
  blinded_sample_status text not null default 'missing',
  adjudication_status text not null default 'missing',
  decision_log_status text not null default 'missing',
  owner_acceptance_status text not null default 'missing',
  real_dataset_timeline_count integer not null default 0,
  validation_sample_count integer not null default 0,
  disagreement_case_count integer not null default 0,
  adjudicated_case_count integer not null default 0,
  followup_window_days integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_status_check
    check (clinical_validation_status in ('not_started', 'in_review', 'ready_for_clinical_validation'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_incident_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_incident_status_check
    check (incident_procedure_status in ('not_started', 'in_review', 'ready_for_clinic_monitoring'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_monitoring_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_monitoring_status_check
    check (monitoring_status in ('not_started', 'in_review', 'ready_for_production_rollout'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_evidence_status_check
    check (evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_sop_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_sop_status_check
    check (sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_validation_status_check
    check (dataset_validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_checklist_status_check
    check (
      real_dataset_lock_status in ('missing', 'needs_review', 'ready')
      and validator_training_status in ('missing', 'needs_review', 'ready')
      and blinded_sample_status in ('missing', 'needs_review', 'ready')
      and adjudication_status in ('missing', 'needs_review', 'ready')
      and decision_log_status in ('missing', 'needs_review', 'ready')
      and owner_acceptance_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_counts_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_counts_check
    check (
      real_dataset_timeline_count >= 0
      and validation_sample_count >= 0
      and disagreement_case_count >= 0
      and adjudicated_case_count >= 0
      and followup_window_days >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and adjudicated_case_count >= disagreement_case_count
    );

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_reasons_array_check
    check (jsonb_typeof(clinical_validation_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_clinical_validation_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_clinical_validation_metadata_no_protected_keys check (
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
        'incidentUrl',
        'validationUrl',
        'adjudicationUrl',
        'rawEvidenceLog',
        'rawMonitoringLog',
        'rawOutcomeLog',
        'rawValidationLog',
        'rawAdjudicationLog',
        'clinicalValidationPayload',
        'validationDetails',
        'adjudicationDetails',
        'incidentPayload',
        'incidentDetails',
        'incidentTimeline',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_clinical_validation_reviews
  on visit_longitudinal_timeline_rollout_clinical_validation_reviews (clinic_id, clinical_validation_status, updated_at desc);

comment on table visit_longitudinal_timeline_rollout_clinical_validation_reviews is
  'Batch BW metadata-only clinical validation readiness over real longitudinal datasets. Patient delivery, clinical output, measurement values, protected fields, pair keys, image IDs, patient rows, raw validation logs, and validator identity stay disabled.';
