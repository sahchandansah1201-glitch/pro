-- Batch BO · Stage 5H measurement policy gate.
-- This records whether a technical viewer QA pair has an approved reviewer policy
-- boundary. It does not enable medical measurement, diagnosis, dynamic conclusion,
-- patient delivery, protected-image delivery, URLs, tokens, QR, or storage paths.

alter table lesion_comparison_viewer_qa_drafts
  add column if not exists measurement_policy_status text not null default 'not_approved',
  add column if not exists measurement_policy_reasons jsonb not null default '[]'::jsonb,
  add column if not exists measurement_policy_reviewed_by_user_id uuid null,
  add column if not exists measurement_policy_reviewed_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_measurement_policy_status_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_measurement_policy_status_check
      check (measurement_policy_status in (
        'not_approved',
        'review_required',
        'approved_for_technical_review'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_measurement_policy_reasons_json_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_measurement_policy_reasons_json_check
      check (jsonb_typeof(measurement_policy_reasons) = 'array');
  end if;
end $$;

alter table lesion_comparison_viewer_qa_drafts
  drop constraint if exists lesion_comparison_viewer_qa_measurement_policy_no_protected_keys;

alter table lesion_comparison_viewer_qa_drafts
  add constraint lesion_comparison_viewer_qa_measurement_policy_no_protected_keys check (
    not (
      metadata_json ?| array[
        'measurementValue',
        'diameterMm',
        'areaMm2',
        'clinicalMeasurement',
        'diagnosis',
        'riskScore',
        'prognosis',
        'treatment',
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
        'patientSafeText'
      ]
    )
  );

create index if not exists lesion_comparison_viewer_qa_measurement_policy_idx
  on lesion_comparison_viewer_qa_drafts (clinic_id, measurement_policy_status, updated_at desc);

comment on column lesion_comparison_viewer_qa_drafts.measurement_policy_status is
  'Batch BO metadata-only measurement policy gate for reviewer operations. Approval never enables medical measurements or patient delivery.';
