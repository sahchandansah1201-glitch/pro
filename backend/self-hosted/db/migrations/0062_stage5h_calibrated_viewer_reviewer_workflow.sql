-- Stage 5H · Batch BH calibrated production viewer QA reviewer workflow.
-- Metadata-only workflow gate. It does not create diagnosis, dynamic conclusion,
-- medical measurement, protected-image delivery, URLs, tokens, QR, or storage paths.

alter table lesion_comparison_viewer_qa_drafts
  add column if not exists reviewer_workflow_status text not null default 'technical_gate_blocked',
  add column if not exists reviewer_workflow_reasons jsonb not null default '[]'::jsonb,
  add column if not exists reviewer_workflow_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists reviewer_workflow_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesion_comparison_viewer_qa_reviewer_workflow_status_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_reviewer_workflow_status_check
      check (
        reviewer_workflow_status in (
          'technical_gate_blocked',
          'ready_for_reviewer',
          'reviewer_accepted',
          'reviewer_rejected'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesion_comparison_viewer_qa_reviewer_workflow_reasons_json_check'
  ) then
    alter table lesion_comparison_viewer_qa_drafts
      add constraint lesion_comparison_viewer_qa_reviewer_workflow_reasons_json_check
      check (jsonb_typeof(reviewer_workflow_reasons) = 'array');
  end if;
end $$;

create index if not exists lesion_comparison_viewer_qa_reviewer_workflow_idx
  on lesion_comparison_viewer_qa_drafts (clinic_id, reviewer_workflow_status, updated_at desc);

comment on column lesion_comparison_viewer_qa_drafts.reviewer_workflow_status is
  'Batch BH metadata-only calibrated reviewer workflow gate; not diagnosis, dynamic conclusion, measurement, or patient delivery.';
comment on column lesion_comparison_viewer_qa_drafts.reviewer_workflow_reasons is
  'Technical reviewer workflow reasons only. Protected fields, patient-facing text, and clinical claims are not allowed.';
