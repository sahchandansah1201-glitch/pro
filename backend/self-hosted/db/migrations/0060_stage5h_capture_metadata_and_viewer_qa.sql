-- Batch BC/BD · Stage 5H production capture metadata and viewer QA drafts.
-- Capture metadata is asset-scoped technical metadata. Viewer QA drafts are
-- doctor-owned comparison state. Both are metadata-only and never enable
-- patient delivery, storage paths, signed URLs, raw image bytes, or diagnosis.

create table if not exists clinical_asset_capture_metadata (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid references visits(id),
  lesion_id uuid references lesions(id) on delete set null,
  asset_id uuid not null references clinical_assets(id) on delete cascade,
  captured_by_user_id uuid references app_users(id) on delete set null,
  capture_source text not null default 'unknown'
    check (capture_source in ('phone', 'device_bridge', 'file_import', 'camera', 'local_transfer', 'unknown')),
  device_id uuid references medical_devices(id) on delete set null,
  frame_width integer check (frame_width is null or (frame_width > 0 and frame_width <= 20000)),
  frame_height integer check (frame_height is null or (frame_height > 0 and frame_height <= 20000)),
  quality_score numeric(5,2) check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  quality_issues text[] not null default array[]::text[],
  scale_marker_detected boolean not null default false,
  millimeters_available boolean not null default false check (
    millimeters_available = false or scale_marker_detected = true
  ),
  metadata_json jsonb not null default '{}'::jsonb,
  patient_delivery_allowed boolean not null default false check (patient_delivery_allowed = false),
  protected_fields_exposed boolean not null default false check (protected_fields_exposed = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id),
  constraint clinical_asset_capture_metadata_no_protected_keys check (
    not (
      metadata_json ?| array[
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
  )
);

create index if not exists clinical_asset_capture_metadata_lesion_idx
  on clinical_asset_capture_metadata (clinic_id, lesion_id, created_at desc)
  where lesion_id is not null;

create index if not exists clinical_asset_capture_metadata_visit_idx
  on clinical_asset_capture_metadata (clinic_id, visit_id, created_at desc)
  where visit_id is not null;

drop trigger if exists clinical_asset_capture_metadata_touch_updated_at
  on clinical_asset_capture_metadata;
create trigger clinical_asset_capture_metadata_touch_updated_at
  before update on clinical_asset_capture_metadata
  for each row execute function touch_updated_at();

comment on table clinical_asset_capture_metadata is
  'Batch BC Stage 5H production capture metadata for clinical assets. Metadata-only: no image bytes, storage paths, signed URLs, or patient delivery.';

create table if not exists lesion_comparison_viewer_qa_drafts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid not null references visits(id),
  doctor_user_id uuid references app_users(id) on delete set null,
  lesion_id text not null,
  pair_key text not null,
  image_ids text[] not null check (array_length(image_ids, 1) = 2),
  technical_markers jsonb not null default '[]'::jsonb check (jsonb_typeof(technical_markers) = 'array'),
  calibration_status text not null default 'not_ready' check (calibration_status in ('ready', 'not_ready', 'limited')),
  calibration_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(calibration_reasons) = 'array'),
  capture_metadata_status text not null default 'needs_review'
    check (capture_metadata_status in ('ready', 'needs_review', 'missing')),
  medical_measurement_allowed boolean not null default false check (medical_measurement_allowed = false),
  patient_delivery_allowed boolean not null default false check (patient_delivery_allowed = false),
  protected_fields_exposed boolean not null default false check (protected_fields_exposed = false),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, lesion_id, pair_key),
  constraint lesion_comparison_viewer_qa_drafts_no_protected_keys check (
    not (
      metadata_json ?| array[
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
  )
);

create index if not exists lesion_comparison_viewer_qa_drafts_clinic_visit_idx
  on lesion_comparison_viewer_qa_drafts (clinic_id, visit_id, updated_at desc);

create index if not exists lesion_comparison_viewer_qa_drafts_lesion_idx
  on lesion_comparison_viewer_qa_drafts (lesion_id, updated_at desc);

drop trigger if exists lesion_comparison_viewer_qa_drafts_touch_updated_at
  on lesion_comparison_viewer_qa_drafts;
create trigger lesion_comparison_viewer_qa_drafts_touch_updated_at
  before update on lesion_comparison_viewer_qa_drafts
  for each row execute function touch_updated_at();

comment on table lesion_comparison_viewer_qa_drafts is
  'Batch BD Stage 5H metadata-only doctor viewer QA drafts for technical markers and calibration limits. Patient delivery and medical measurement are always disabled.';
