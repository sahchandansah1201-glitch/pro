-- Stage 5H · Batch CF
-- Metadata-only long-running production dataset evidence gate on real
-- clinical operations after protected reviewer evidence. Stores aggregate
-- evidence status only; no patient delivery, clinical conclusion,
-- measurement values, pair keys, image IDs, protected storage references,
-- reviewer identity, raw operational logs, or patient copy.

create table if not exists visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  production_dataset_evidence_status text not null default 'not_started',
  production_dataset_evidence_reasons jsonb not null default '[]'::jsonb,
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
  real_clinic_window_status text not null default 'missing',
  dataset_sampling_status text not null default 'missing',
  longitudinal_followup_status text not null default 'missing',
  protected_reviewer_linkage_status text not null default 'missing',
  outcome_observation_status text not null default 'missing',
  incident_linkage_status text not null default 'missing',
  owner_signoff_status text not null default 'missing',
  real_clinic_window_count integer not null default 0,
  monitored_clinic_operation_count integer not null default 0,
  sampled_clinic_operation_count integer not null default 0,
  longitudinal_followup_count integer not null default 0,
  protected_reviewer_linked_count integer not null default 0,
  observed_outcome_count integer not null default 0,
  incident_linked_count integer not null default 0,
  unresolved_production_dataset_evidence_count integer not null default 0,
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

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_status_check
    check (
      production_dataset_evidence_status in (
        'not_started',
        'in_review',
        'ready_for_production_dataset_evidence'
      )
    );

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_validation_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_validation_status_check
    check (
      protected_reviewer_evidence_status in (
        'not_started',
        'in_review',
        'ready_for_protected_reviewer_evidence'
      )
      and protected_reviewer_governance_status in (
        'not_started',
        'in_review',
        'ready_for_protected_reviewer_governance'
      )
      and protected_reviewer_validation_status in (
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

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_checklist_status_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_checklist_status_check
    check (
      real_clinic_window_status in ('missing', 'needs_review', 'ready')
      and dataset_sampling_status in ('missing', 'needs_review', 'ready')
      and longitudinal_followup_status in ('missing', 'needs_review', 'ready')
      and protected_reviewer_linkage_status in ('missing', 'needs_review', 'ready')
      and outcome_observation_status in ('missing', 'needs_review', 'ready')
      and incident_linkage_status in ('missing', 'needs_review', 'ready')
      and owner_signoff_status in ('missing', 'needs_review', 'ready')
    );

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_counts_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_counts_check
    check (
      real_clinic_window_count >= 0
      and monitored_clinic_operation_count >= 0
      and sampled_clinic_operation_count >= 0
      and longitudinal_followup_count >= 0
      and protected_reviewer_linked_count >= 0
      and observed_outcome_count >= 0
      and incident_linked_count >= 0
      and unresolved_production_dataset_evidence_count >= 0
      and blocker_count >= 0
      and lesion_count >= 0
      and ready_timeline_count >= 0
      and blocked_timeline_count >= 0
      and candidate_pair_count >= 0
      and reviewer_workflow_ready_count >= 0
      and monitored_clinic_operation_count <= real_clinic_window_count
      and sampled_clinic_operation_count <= monitored_clinic_operation_count
      and longitudinal_followup_count <= monitored_clinic_operation_count
      and protected_reviewer_linked_count <= monitored_clinic_operation_count
      and observed_outcome_count <= monitored_clinic_operation_count
      and incident_linked_count <= monitored_clinic_operation_count
      and unresolved_production_dataset_evidence_count <= monitored_clinic_operation_count
    );

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_reasons_array_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_reasons_array_check
    check (jsonb_typeof(production_dataset_evidence_reasons) = 'array');

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_boundary_check,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_boundary_check
    check (
      patient_delivery_allowed = false
      and medical_measurement_allowed = false
      and protected_fields_exposed = false
      and clinical_output_generated = false
    );

alter table visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews
  drop constraint if exists visit_longitudinal_timeline_rollout_production_dataset_metadata_no_protected_keys,
  add constraint visit_longitudinal_timeline_rollout_production_dataset_metadata_no_protected_keys check (
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
        'productionDatasetEvidenceUrl',
        'realClinicWindowUrl',
        'datasetSamplingUrl',
        'longitudinalFollowupUrl',
        'protectedReviewerLinkageUrl',
        'outcomeObservationUrl',
        'incidentLinkageUrl',
        'rawProductionDatasetEvidenceLog',
        'rawClinicOperationLog',
        'rawLongitudinalOperationLog',
        'rawProtectedReviewerLinkageLog',
        'rawOutcomeObservationLog',
        'rawIncidentLinkageLog',
        'productionDatasetEvidencePayload',
        'productionDatasetEvidenceDetails',
        'clinicOperationPayload',
        'clinicOperationDetails',
        'longitudinalFollowupPayload',
        'longitudinalFollowupDetails',
        'protectedReviewerLinkagePayload',
        'protectedReviewerLinkageDetails',
        'outcomeObservationPayload',
        'outcomeObservationDetails',
        'incidentLinkagePayload',
        'incidentLinkageDetails',
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

create index if not exists idx_visit_longitudinal_timeline_rollout_production_dataset_evidence_visit
  on visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews (visit_id, updated_at desc);
