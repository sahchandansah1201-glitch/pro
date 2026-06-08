-- Stage 5H · Batch CB
-- Metadata-only real clinical longitudinal validation over time after
-- longitudinal outcome governance. Stores aggregate validation status only; no
-- patient delivery, clinical conclusion, measurement values, pair keys, image
-- IDs, protected storage references, reviewer/validator identity, raw
-- longitudinal outcome logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  longitudinal_clinical_validation_status text not null default 'not_started',
  longitudinal_clinical_validation_reasons jsonb not null default '[]'::jsonb,
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
  outcome_window_status text not null default 'missing',
  clinician_coverage_status text not null default 'missing',
  adjudication_status text not null default 'missing',
  consensus_review_status text not null default 'missing',
  followup_validation_status text not null default 'missing',
  governance_cadence_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  real_outcome_window_count integer not null default 0,
  clinically_validated_window_count integer not null default 0,
  adjudicated_window_count integer not null default 0,
  followup_validated_window_count integer not null default 0,
  consensus_review_count integer not null default 0,
  unresolved_consensus_case_count integer not null default 0,
  governance_review_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_status_check
    check (
      longitudinal_clinical_validation_status in (
        'not_started',
        'in_review',
        'ready_for_longitudinal_clinical_validation'
      )
    );

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_outcome_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_outcome_status_check
    check (outcome_governance_status in ('not_started', 'in_review', 'ready_for_outcome_governance'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_exception_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_exception_status_check
    check (exception_governance_status in ('not_started', 'in_review', 'ready_for_exception_governance'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_observation_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_observation_status_check
    check (observation_governance_status in ('not_started', 'in_review', 'ready_for_observation_governance'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_post_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_post_validation_status_check
    check (post_validation_monitoring_status in ('not_started', 'in_review', 'ready_for_post_validation_monitoring'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_clinical_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_clinical_status_check
    check (clinical_validation_status in ('not_started', 'in_review', 'ready_for_clinical_validation'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_incident_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_incident_status_check
    check (incident_procedure_status in ('not_started', 'in_review', 'ready_for_clinic_monitoring'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_monitoring_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_monitoring_status_check
    check (monitoring_status in ('not_started', 'in_review', 'ready_for_production_rollout'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_evidence_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_evidence_status_check
    check (evidence_status in ('not_started', 'in_review', 'ready_for_monitored_rollout'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_sop_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_sop_status_check
    check (sop_status in ('not_started', 'in_review', 'ready_for_operational_rollout'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_validation_status_check
    check (dataset_validation_status in ('blocked', 'needs_review', 'ready_for_rollout'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_rollout_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_rollout_status_check
    check (rollout_status in ('not_approved', 'review_required', 'approved_for_clinical_operations'));

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_checklist_status_check
    check (
      outcome_window_status in ('missing', 'needs_review', 'ready')
      and clinician_coverage_status in ('missing', 'needs_review', 'ready')
      and adjudication_status in ('missing', 'needs_review', 'ready')
      and consensus_review_status in ('missing', 'needs_review', 'ready')
      and followup_validation_status in ('missing', 'needs_review', 'ready')
      and governance_cadence_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_counts_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_counts_check
    check (
      real_outcome_window_count >= 0
      and clinically_validated_window_count >= 0
      and adjudicated_window_count >= 0
      and followup_validated_window_count >= 0
      and consensus_review_count >= 0
      and unresolved_consensus_case_count >= 0
      and governance_review_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and clinically_validated_window_count <= real_outcome_window_count
      and adjudicated_window_count <= clinically_validated_window_count
      and followup_validated_window_count <= clinically_validated_window_count
      and unresolved_consensus_case_count <= consensus_review_count
    );

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reasons_array_check
    check (jsonb_typeof(longitudinal_clinical_validation_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_metadata_no_protected_keys check (
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
        'exceptionUrl',
        'recurrenceUrl',
        'rollbackUrl',
        'longitudinalOutcomeUrl',
        'longitudinalClinicalValidationUrl',
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
        'rawExceptionLog',
        'rawRecurrenceLog',
        'rawRollbackLog',
        'rawLongitudinalOutcomeLog',
        'rawLongitudinalClinicalValidationLog',
        'clinicalValidationPayload',
        'postValidationPayload',
        'observationPayload',
        'outcomeReviewPayload',
        'incidentOutcomePayload',
        'governancePayload',
        'exceptionPayload',
        'recurrencePayload',
        'rollbackPayload',
        'longitudinalOutcomePayload',
        'longitudinalClinicalValidationPayload',
        'validationDetails',
        'monitoringDetails',
        'driftDetails',
        'followupDetails',
        'outcomeDetails',
        'incidentOutcomeDetails',
        'governanceDetails',
        'exceptionDetails',
        'recurrenceDetails',
        'rollbackDetails',
        'longitudinalOutcomeDetails',
        'longitudinalClinicalValidationDetails',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews_visit
  on visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews (visit_id, reviewed_at desc);

create index if not exists idx_visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews_clinic
  on visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews (clinic_id, reviewed_at desc);
