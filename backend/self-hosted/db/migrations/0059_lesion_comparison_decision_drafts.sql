-- Batch AT · Stage 5H lesion comparison decision drafts.
-- Doctor-owned metadata ledger for selected image-pair decisions.
-- No patient delivery, no file paths, no signed URLs, no model/runtime internals.

create table if not exists lesion_comparison_decision_drafts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid not null references visits(id),
  doctor_user_id uuid references app_users(id),
  lesion_id text not null,
  pair_key text not null,
  image_ids text[] not null check (array_length(image_ids, 1) = 2),
  action text not null check (action in ('retake', 'excluded', 'report_limit')),
  comparability text not null check (comparability in ('comparable', 'not_comparable')),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  patient_delivery_allowed boolean not null default false check (patient_delivery_allowed = false),
  protected_fields_exposed boolean not null default false check (protected_fields_exposed = false),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, lesion_id, pair_key),
  constraint lesion_comparison_decision_drafts_metadata_no_protected_keys check (
    not (
      metadata_json ?| array[
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
  )
);

create index if not exists lesion_comparison_decision_drafts_clinic_visit_idx
  on lesion_comparison_decision_drafts (clinic_id, visit_id);

create index if not exists lesion_comparison_decision_drafts_lesion_idx
  on lesion_comparison_decision_drafts (lesion_id);

drop trigger if exists lesion_comparison_decision_drafts_touch_updated_at
  on lesion_comparison_decision_drafts;
create trigger lesion_comparison_decision_drafts_touch_updated_at
  before update on lesion_comparison_decision_drafts
  for each row execute function touch_updated_at();

comment on table lesion_comparison_decision_drafts is
  'Batch AT Stage 5H metadata-only doctor draft for selected lesion image-pair comparison decisions. Patient delivery is always disabled.';
