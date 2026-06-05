-- Stage 5H · Batch BV
-- Metadata-only production incident monitoring procedure over real clinical datasets.
-- Stores aggregate procedure status only; no patient delivery, clinical conclusion,
-- pair keys, image IDs, protected storage references, reviewer identity, raw incident payloads, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_incident_procedure_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  procedure_status text not null default 'not_started',
  procedure_reasons jsonb not null default '[]'::jsonb,
  monitoring_status text not null default 'not_started',
  evidence_status text not null default 'not_started',
  sop_status text not null default 'not_started',
  validation_status text not null default 'blocked',
  rollout_status text not null default 'not_approved',
  real_dataset_status text not null default 'missing',
  outcome_sampling_procedure_status text not null default 'missing',
  incident_triage_status text not null default 'missing',
  escalation_path_status text not null default 'missing',
  rollback_decision_status text not null default 'missing',
  owner_review_status text not null default 'missing',
  real_dataset_timeline_count integer not null default 0,
  monitored_timeline_count integer not null default 0,
  sampled_outcome_count integer not null default 0,
  incident_case_count integer not null default 0,
  unresolved_incident_count integer not null default 0,
  escalated_incident_count integer not null default 0,
  rollback_decision_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_status_check
    check (procedure_status in ('not_started', 'in_review', 'ready_for_clinic_monitoring'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_monitoring_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_monitoring_status_check
    check (monitoring_status in ('not_started', 'in_review', 'ready_for_production_rollout'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_evidence_status_check
    check (evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_sop_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_sop_status_check
    check (sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_validation_status_check
    check (validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_checklist_status_check
    check (
      real_dataset_status in ('missing', 'needs_review', 'ready')
      and outcome_sampling_procedure_status in ('missing', 'needs_review', 'ready')
      and incident_triage_status in ('missing', 'needs_review', 'ready')
      and escalation_path_status in ('missing', 'needs_review', 'ready')
      and rollback_decision_status in ('missing', 'needs_review', 'ready')
      and owner_review_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_counts_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_counts_check
    check (
      real_dataset_timeline_count >= 0
      and monitored_timeline_count >= 0
      and sampled_outcome_count >= 0
      and incident_case_count >= 0
      and unresolved_incident_count >= 0
      and escalated_incident_count >= 0
      and rollback_decision_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
    );

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_reasons_array_check
    check (jsonb_typeof(procedure_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_incident_procedure_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_incident_procedure_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_incident_procedure_metadata_no_protected_keys check (
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
        'rawEvidenceLog',
        'rawMonitoringLog',
        'rawOutcomeLog',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_incident_procedure_reviews
  on visit_longitudinal_timeline_rollout_incident_procedure_reviews (clinic_id, procedure_status, updated_at desc);

comment on table visit_longitudinal_timeline_rollout_incident_procedure_reviews is
  'Batch BV metadata-only production incident monitoring procedure over real clinical datasets. Patient delivery, clinical output, protected fields, pair keys, image IDs, patient rows, and raw incident payloads stay disabled.';
