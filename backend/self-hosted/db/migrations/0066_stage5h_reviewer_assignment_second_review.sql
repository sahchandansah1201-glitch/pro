-- Batch BP · Stage 5H reviewer assignment and second-review workflow.
-- Metadata-only reviewer operations for clinical-grade viewer QA. This does
-- not enable medical measurement, diagnosis, dynamic conclusion, patient
-- delivery, protected-image delivery, URLs, tokens, QR, or storage paths.

alter table lesion_comparison_viewer_qa_drafts
  add column if not exists reviewer_assignment_status text not null default 'unassigned',
  add column if not exists reviewer_assignment_reasons jsonb not null default '[]'::jsonb,
  add column if not exists assigned_reviewer_user_id uuid references app_users(id) on delete set null,
  add column if not exists reviewer_assigned_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists reviewer_assigned_at timestamptz,
  add column if not exists second_review_status text not null default 'not_required',
  add column if not exists second_review_reasons jsonb not null default '[]'::jsonb,
  add column if not exists second_reviewer_user_id uuid references app_users(id) on delete set null,
  add column if not exists second_reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists second_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_reviewer_assignment_status_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_reviewer_assignment_status_check
      check (reviewer_assignment_status in (
        'unassigned',
        'assigned',
        'second_review_required',
        'second_review_assigned',
        'second_review_completed',
        'assignment_blocked'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_second_review_status_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_second_review_status_check
      check (second_review_status in (
        'not_required',
        'required',
        'assigned',
        'completed',
        'blocked'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_reviewer_assignment_reasons_json_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_reviewer_assignment_reasons_json_check
      check (jsonb_typeof(reviewer_assignment_reasons) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_second_review_reasons_json_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_second_review_reasons_json_check
      check (jsonb_typeof(second_review_reasons) = 'array');
  end if;
end $$;

alter table lesion_comparison_viewer_qa_drafts
  drop constraint if exists lesion_comparison_viewer_qa_reviewer_assignment_no_protected_keys;

alter table lesion_comparison_viewer_qa_drafts
  add constraint lesion_comparison_viewer_qa_reviewer_assignment_no_protected_keys check (
    not (
      metadata_json ?| array[
        'reviewerName',
        'reviewerEmail',
        'assignedReviewerName',
        'assignedReviewerEmail',
        'secondReviewerName',
        'secondReviewerEmail',
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

create index if not exists lesion_comparison_viewer_qa_reviewer_assignment_idx
  on lesion_comparison_viewer_qa_drafts (clinic_id, reviewer_assignment_status, second_review_status, updated_at desc);

comment on column lesion_comparison_viewer_qa_drafts.reviewer_assignment_status is
  'Batch BP metadata-only reviewer assignment workflow. reviewerIdentityExposed=false; no patient delivery, reviewer identity output, or measurements.';
comment on column lesion_comparison_viewer_qa_drafts.second_review_status is
  'Batch BP metadata-only second-review workflow. Completion is a reviewer gate only, not a clinical conclusion or patient delivery gate.';
