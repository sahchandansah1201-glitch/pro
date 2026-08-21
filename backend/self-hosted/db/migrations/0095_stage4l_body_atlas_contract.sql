-- Stage 4L-Q4 · Versioned atlas source/profile/geometry metadata.
-- Additive: placements written before this contract keep all four fields null.

alter table lesions
  add column if not exists body_atlas_source text,
  add column if not exists body_atlas_profile_id text,
  add column if not exists body_atlas_manifest_sha256 text,
  add column if not exists body_region_map_sha256 text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_atlas_source_check') then
    alter table lesions add constraint lesions_body_atlas_source_check check (
      body_atlas_source is null or body_atlas_source in ('makehuman-cc0', 'daz-hires-local')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_atlas_metadata_complete_check') then
    alter table lesions add constraint lesions_body_atlas_metadata_complete_check check (
      (
        body_atlas_source is null
        and body_atlas_profile_id is null
        and body_atlas_manifest_sha256 is null
        and body_region_map_sha256 is null
      )
      or
      (
        body_region_id is not null
        and body_atlas_source is not null
        and body_atlas_profile_id is not null
        and body_atlas_manifest_sha256 is not null
        and body_region_map_sha256 is not null
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_atlas_profile_check') then
    alter table lesions add constraint lesions_body_atlas_profile_check check (
      body_atlas_profile_id is null or body_atlas_profile_id ~ '^[a-z0-9_]+$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_atlas_manifest_sha256_check') then
    alter table lesions add constraint lesions_body_atlas_manifest_sha256_check check (
      body_atlas_manifest_sha256 is null or body_atlas_manifest_sha256 ~ '^[0-9a-f]{64}$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_body_region_map_sha256_check') then
    alter table lesions add constraint lesions_body_region_map_sha256_check check (
      body_region_map_sha256 is null or body_region_map_sha256 ~ '^[0-9a-f]{64}$'
    );
  end if;
end
$$;

comment on column lesions.body_atlas_source is
  'Server-validated atlas package used for this placement.';
comment on column lesions.body_atlas_profile_id is
  'Server-derived age/sex profile at visit time.';
comment on column lesions.body_atlas_manifest_sha256 is
  'SHA-256 of the server-pinned atlas manifest.';
comment on column lesions.body_region_map_sha256 is
  'SHA-256 of the exact profile/view region map or canonical scalp geometry.';
