-- Stage 5H · Batch BY
-- Metadata-only ongoing production outcome observation and post-validation
-- incident/outcome review governance.
-- Stores aggregate governance status only; no patient delivery, clinical
-- conclusion, measurement values, pair keys, image IDs, protected storage
-- references, reviewer/validator identity, raw observation/outcome/incident
-- logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_observation_governance_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  observation_governance_status text not null default 'not_started',
  observation_governance_reasons jsonb not null default '[]'::jsonb,
  post_validation_monitoring_status text not null default 'not_started',
  clinical_validation_status text not null default 'not_started',
  incident_procedure_status text not null default 'not_started',
  monitoring_status text not null default 'not_started',
  evidence_status text not null default 'not_started',
  sop_status text not null default 'not_started',
  dataset_validation_status text not null default 'blocked',
  rollout_status text not null default 'not_approved',
  observation_window_status text not null default 'missing',
  outcome_observation_status text not null default 'missing',
  drift_signal_review_status text not null default 'missing',
  incident_outcome_review_status text not null default 'missing',
  followup_closure_status text not null default 'missing',
  governance_review_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  real_dataset_timeline_count integer not null default 0,
  post_validation_sample_count integer not null default 0,
  observed_timeline_count integer not null default 0,
  expected_followup_count integer not null default 0,
  completed_followup_count integer not null default 0,
  drift_signal_count integer not null default 0,
  unresolved_drift_signal_count integer not null default 0,
  incident_outcome_count integer not null default 0,
  unresolved_incident_outcome_count integer not null default 0,
  governance_exception_count integer not null default 0,
  unresolved_governance_exception_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_status_check
    check (observation_governance_status in ('not_started', 'in_review', 'ready_for_observation_governance'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_post_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_post_validation_status_check
    check (post_validation_monitoring_status in ('not_started', 'in_review', 'ready_for_post_validation_monitoring'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_clinical_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_clinical_status_check
    check (clinical_validation_status in ('not_started', 'in_review', 'ready_for_clinical_validation'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_incident_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_incident_status_check
    check (incident_procedure_status in ('not_started', 'in_review', 'ready_for_clinic_monitoring'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_monitoring_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_monitoring_status_check
    check (monitoring_status in ('not_started', 'in_review', 'ready_for_production_rollout'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_evidence_status_check
    check (evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_sop_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_sop_status_check
    check (sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_validation_status_check
    check (dataset_validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_checklist_status_check
    check (
      observation_window_status in ('missing', 'needs_review', 'ready')
      and outcome_observation_status in ('missing', 'needs_review', 'ready')
      and drift_signal_review_status in ('missing', 'needs_review', 'ready')
      and incident_outcome_review_status in ('missing', 'needs_review', 'ready')
      and followup_closure_status in ('missing', 'needs_review', 'ready')
      and governance_review_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_counts_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_counts_check
    check (
      real_dataset_timeline_count >= 0
      and post_validation_sample_count >= 0
      and observed_timeline_count >= 0
      and expected_followup_count >= 0
      and completed_followup_count >= 0
      and drift_signal_count >= 0
      and unresolved_drift_signal_count >= 0
      and incident_outcome_count >= 0
      and unresolved_incident_outcome_count >= 0
      and governance_exception_count >= 0
      and unresolved_governance_exception_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and completed_followup_count <= expected_followup_count
      and unresolved_drift_signal_count <= drift_signal_count
      and unresolved_incident_outcome_count <= incident_outcome_count
      and unresolved_governance_exception_count <= governance_exception_count
    );

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_reasons_array_check
    check (jsonb_typeof(observation_governance_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_observation_governance_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_observation_governance_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_observation_governance_metadata_no_protected_keys check (
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
        'monitoringUrl',
        'driftUrl',
        'followupUrl',
        'outcomeUrl',
        'governanceUrl',
        'adjudicationUrl',
        'rawEvidenceLog',
        'rawMonitoringLog',
        'rawOutcomeLog',
        'rawValidationLog',
        'rawAdjudicationLog',
        'rawDriftLog',
        'rawFollowupLog',
        'rawObservationLog',
        'rawOutcomeReviewLog',
        'rawIncidentOutcomeLog',
        'clinicalValidationPayload',
        'postValidationPayload',
        'observationPayload',
        'outcomeReviewPayload',
        'incidentOutcomePayload',
        'governancePayload',
        'validationDetails',
        'monitoringDetails',
        'driftDetails',
        'followupDetails',
        'outcomeDetails',
        'incidentOutcomeDetails',
        'governanceDetails',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_observation_governance_reviews
  on visit_longitudinal_timeline_rollout_observation_governance_reviews (
    clinic_id,
    observation_governance_status,
    updated_at desc
  );

comment on table visit_longitudinal_timeline_rollout_observation_governance_reviews is
  'Batch BY metadata-only ongoing production outcome observation and post-validation incident/outcome review governance. Patient delivery, clinical output, measurement values, protected fields, pair keys, image IDs, patient rows, raw observation/outcome/incident logs, and reviewer identity stay disabled.';
