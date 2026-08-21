-- Stage 4L-Q3 · Precise body-map placement persistence.
-- Additive and backward-compatible: historical lesions remain valid with a
-- null placement and revision 0. New body-map writes are validated by backend.

alter table lesions
  add column if not exists body_map_view text,
  add column if not exists body_map_x numeric(8, 7),
  add column if not exists body_map_y numeric(8, 7),
  add column if not exists body_region_id text,
  add column if not exists body_region_detail_id text,
  add column if not exists placement_revision integer not null default 0,
  add column if not exists creation_idempotency_key text,
  add column if not exists creation_request_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_map_view_check') then
    alter table lesions add constraint lesions_body_map_view_check
      check (body_map_view is null or body_map_view in ('front', 'back', 'left', 'right', 'scalp'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_map_x_check') then
    alter table lesions add constraint lesions_body_map_x_check
      check (body_map_x is null or body_map_x between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_map_y_check') then
    alter table lesions add constraint lesions_body_map_y_check
      check (body_map_y is null or body_map_y between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_map_complete_check') then
    alter table lesions add constraint lesions_body_map_complete_check check (
      (body_map_view is null and body_map_x is null and body_map_y is null and body_region_id is null)
      or
      (body_map_view is not null and body_map_x is not null and body_map_y is not null and body_region_id is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_map_detail_check') then
    alter table lesions add constraint lesions_body_map_detail_check check (
      body_region_detail_id is null or body_region_id is not null
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_placement_revision_check') then
    alter table lesions add constraint lesions_placement_revision_check check (placement_revision >= 0);
  end if;
end
$$;

create unique index if not exists lesions_creation_idempotency_idx
  on lesions (clinic_id, visit_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

create index if not exists lesions_body_region_idx
  on lesions (clinic_id, body_region_id)
  where deleted_at is null and body_region_id is not null;

comment on column lesions.body_region_id is
  'Stable region id from public/clinical-body-atlas-regions/manifest.json; backend validates the id and view.';
comment on column lesions.body_region_detail_id is
  'Optional doctor-confirmed anatomical detail, currently digit-1 through digit-5 for supported hand/foot regions.';
comment on column lesions.placement_revision is
  'Optimistic-concurrency revision for body-map placement corrections; 0 means no confirmed placement.';
comment on column lesions.creation_idempotency_key is
  'Request replay key for safe body-map lesion creation. Never contains patient text or credentials.';
