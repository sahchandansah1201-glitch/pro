-- Batch BE · Stage 5H production-safe viewer QA review workflow.
-- Review is a doctor-side technical state over an existing viewer QA draft.
-- It is metadata-only and never enables medical measurements or patient delivery.

alter table lesion_comparison_viewer_qa_drafts
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists review_reasons jsonb not null default '[]'::jsonb,
  add column if not exists reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_drafts_review_status_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_drafts_review_status_check
      check (review_status in ('unreviewed', 'technical_ready', 'needs_recapture', 'not_suitable_for_comparison'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesion_comparison_viewer_qa_drafts_review_reasons_array_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_drafts_review_reasons_array_check
      check (jsonb_typeof(review_reasons) = 'array');
  end if;
end $$;

create index if not exists lesion_comparison_viewer_qa_drafts_review_idx
  on lesion_comparison_viewer_qa_drafts (clinic_id, review_status, updated_at desc);

comment on column lesion_comparison_viewer_qa_drafts.review_status is
  'Batch BE doctor-side technical review status. Not a diagnosis, prognosis, dynamic assessment, or patient-delivery state.';

comment on column lesion_comparison_viewer_qa_drafts.review_reasons is
  'Batch BE technical review reason codes only. No protected fields, clinical claims, or patient-facing text.';
