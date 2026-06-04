-- Stage 5H · Batch BQ
-- Production analysis policy gate for lesion comparison viewer QA.
-- Metadata-only: no clinical conclusion, no measurement values, no patient delivery.

alter table lesion_comparison_viewer_qa_drafts
  add column if not exists production_analysis_policy_status text not null default 'not_approved',
  add column if not exists production_analysis_policy_reasons jsonb not null default '[]'::jsonb,
  add column if not exists production_analysis_policy_reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists production_analysis_policy_reviewed_at timestamptz;

alter table lesion_comparison_viewer_qa_drafts
  drop constraint if exists lesion_comparison_viewer_qa_production_analysis_policy_status_check,
  add constraint lesion_comparison_viewer_qa_production_analysis_policy_status_check
    check (production_analysis_policy_status in ('not_approved', 'review_required', 'approved_for_production_analysis'));

alter table lesion_comparison_viewer_qa_drafts
  drop constraint if exists lesion_comparison_viewer_qa_production_analysis_policy_reasons_array_check,
  add constraint lesion_comparison_viewer_qa_production_analysis_policy_reasons_array_check
    check (jsonb_typeof(production_analysis_policy_reasons) = 'array');

alter table lesion_comparison_viewer_qa_drafts
  drop constraint if exists lesion_comparison_viewer_qa_production_analysis_no_protected_keys,
  drop constraint if exists lesion_comparison_viewer_qa_production_analysis_policy_no_protected_keys,
  add constraint lesion_comparison_viewer_qa_production_analysis_policy_no_protected_keys
    check (
      not (
        metadata_json ?| array[
          'diagnosis',
          'riskScore',
          'riskLevel',
          'prognosis',
          'treatment',
          'melanomaProbability',
          'dynamicConclusion',
          'clinicalDynamicConclusion',
          'lesionGrowth',
          'measurementValue',
          'diameterMm',
          'areaMm2',
          'clinicalMeasurement',
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
          'rawToken',
          'qrToken',
          'sessionId',
          'doctorVersionText',
          'patientSafeText',
          'patientDeliveryPayload'
        ]
      )
    );

create index if not exists idx_lesion_comparison_viewer_qa_production_analysis_policy
  on lesion_comparison_viewer_qa_drafts (clinic_id, production_analysis_policy_status, updated_at desc);
