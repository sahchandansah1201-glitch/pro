-- Stage 1E-A · Clinical assets — controlled write RLS, write-guard,
-- private Storage bucket and storage.objects policies.
--
-- Additive only. Does NOT mutate any Stage 1A / 1C / 1D source file.
-- The only Stage-1D object replaced is the body of the immutable helper
-- public._stage1d_allowed_entities() (via CREATE OR REPLACE) so the
-- log_clinical_write RPC accepts the new 'asset' entity. Signature, search_path,
-- volatility and grants are preserved exactly.
--
-- Design:
--   * Column-level INSERT/UPDATE grants on public.assets (no broad GRANT).
--     Server-controlled columns (clinic_id, created_at) are NEVER granted.
--   * INSERT/UPDATE RLS policies for `doctor` / `private_doctor` only.
--   * No DELETE grant, no DELETE policy.
--   * BEFORE INSERT/UPDATE write-guard forces clinic_id from the parent visit
--     and enforces immutability of identity / capture / source columns. Only
--     lesion_id, quality_score, quality_issues, exif, device_id are mutable.
--   * Private Storage bucket `clinical-assets` + storage.objects RLS:
--       path layout: clinic/{clinic_id}/visit/{visit_id}/{asset_id}[.ext]
--       SELECT/INSERT scoped via has_clinic_access() on segment 2.
--       No UPDATE/DELETE policies — those operations remain blocked under RLS.
--   * No service role usage anywhere. All policies authorise the caller JWT.

-- ── 1. Audit allow-list extension (replace helper body only) ───────────────
-- Stage 1D's log_clinical_write checks `_entity = any (_stage1d_allowed_entities())`.
-- Replacing the helper body adds 'asset' without touching the RPC or its file.
create or replace function public._stage1d_allowed_entities()
returns text[] language sql immutable as $$
  select array['patient','visit','lesion','assessment','conclusion',
               'report','report_version','asset']
$$;

-- ── 2. Column-level write grants on public.assets ─────────────────────────
-- IMPORTANT: clinic_id, created_at are intentionally OMITTED from the grants
-- so the caller cannot mention them in INSERT/UPDATE (42501 if attempted).
grant insert (visit_id, lesion_id, kind, source, storage_object_path,
              captured_at, device_id, quality_score, quality_issues, exif)
  on public.assets to authenticated;

grant update (lesion_id, quality_score, quality_issues, exif, device_id)
  on public.assets to authenticated;

-- ── 3. Write RLS policies (doctor + private_doctor only) ──────────────────
-- Stage 1A SELECT policies on public.assets are preserved.
-- Patient role intentionally has no write access (and no SELECT in Stage 1A).
drop policy if exists assets_doctor_insert on public.assets;
create policy assets_doctor_insert on public.assets
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));

drop policy if exists assets_doctor_update on public.assets;
create policy assets_doctor_update on public.assets
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- No DELETE policy. No DELETE grant. DELETE remains denied (42501).

-- ── 4. Write-guard trigger ────────────────────────────────────────────────
create or replace function public.tg_assets_write_guard()
returns trigger language plpgsql as $$
declare
  _v_clinic uuid;
  _v_patient uuid;
  _l_clinic uuid;
  _l_patient uuid;
begin
  if auth.uid() is null then
    return NEW;
  end if;
  if not public.has_stage1c_write_role(auth.uid()) then
    raise exception 'stage1e_doctor_role_required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- Force clinic_id from the parent visit; never trust client.
    select v.clinic_id, v.patient_id into _v_clinic, _v_patient
      from public.visits v where v.id = NEW.visit_id;
    if _v_clinic is null then
      raise exception 'visit_not_found' using errcode = 'P0001';
    end if;
    NEW.clinic_id := _v_clinic;

    -- If lesion_id is supplied, verify it belongs to the same clinic + patient.
    if NEW.lesion_id is not null then
      select l.clinic_id, l.patient_id into _l_clinic, _l_patient
        from public.lesions l where l.id = NEW.lesion_id;
      if _l_clinic is null then
        raise exception 'lesion_not_found' using errcode = 'P0001';
      end if;
      if _l_clinic is distinct from _v_clinic then
        raise exception 'assets.lesion_clinic_mismatch' using errcode = 'P0001';
      end if;
      if _l_patient is distinct from _v_patient then
        raise exception 'assets.lesion_patient_mismatch' using errcode = 'P0001';
      end if;
    end if;

    if NEW.storage_object_path is null
       or length(btrim(NEW.storage_object_path)) = 0 then
      raise exception 'assets.storage_object_path_required' using errcode = 'P0001';
    end if;

  elsif tg_op = 'UPDATE' then
    if NEW.id                  is distinct from OLD.id                  then raise exception 'assets.id_immutable'                  using errcode = 'P0001'; end if;
    if NEW.clinic_id           is distinct from OLD.clinic_id           then raise exception 'assets.clinic_id_immutable'           using errcode = 'P0001'; end if;
    if NEW.visit_id            is distinct from OLD.visit_id            then raise exception 'assets.visit_id_immutable'            using errcode = 'P0001'; end if;
    if NEW.kind                is distinct from OLD.kind                then raise exception 'assets.kind_immutable'                using errcode = 'P0001'; end if;
    if NEW.source              is distinct from OLD.source              then raise exception 'assets.source_immutable'              using errcode = 'P0001'; end if;
    if NEW.storage_object_path is distinct from OLD.storage_object_path then raise exception 'assets.storage_object_path_immutable' using errcode = 'P0001'; end if;
    if NEW.captured_at         is distinct from OLD.captured_at         then raise exception 'assets.captured_at_immutable'         using errcode = 'P0001'; end if;
    if NEW.created_at          is distinct from OLD.created_at          then raise exception 'assets.created_at_immutable'          using errcode = 'P0001'; end if;

    -- If lesion_id changed (and is not null), re-validate against the visit.
    if NEW.lesion_id is not null
       and NEW.lesion_id is distinct from OLD.lesion_id then
      select v.clinic_id, v.patient_id into _v_clinic, _v_patient
        from public.visits v where v.id = NEW.visit_id;
      select l.clinic_id, l.patient_id into _l_clinic, _l_patient
        from public.lesions l where l.id = NEW.lesion_id;
      if _l_clinic is null then
        raise exception 'lesion_not_found' using errcode = 'P0001';
      end if;
      if _l_clinic is distinct from _v_clinic then
        raise exception 'assets.lesion_clinic_mismatch' using errcode = 'P0001';
      end if;
      if _l_patient is distinct from _v_patient then
        raise exception 'assets.lesion_patient_mismatch' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_assets_write_guard on public.assets;
drop trigger if exists tg_00_stage1e_assets_write_guard on public.assets;
create trigger tg_00_stage1e_assets_write_guard
  before insert or update on public.assets
  for each row execute function public.tg_assets_write_guard();

-- ── 5. Private Storage bucket ──────────────────────────────────────────────
-- Idempotent. `public = false` means objects are NOT served to anon URLs;
-- access is gated by storage.objects RLS below.
insert into storage.buckets (id, name, public)
values ('clinical-assets', 'clinical-assets', false)
on conflict (id) do update set public = false;

-- ── 6. storage.objects RLS for the clinical-assets bucket ─────────────────
-- Path layout (enforced by api-write later, asserted here by regex):
--   clinic/{clinic_id}/visit/{visit_id}/{asset_id}[.ext]
-- segment 1 = 'clinic', segment 2 = clinic_id (uuid), segment 3 = 'visit',
-- segment 4 = visit_id (uuid), segment 5 = {asset_id}[.ext].
--
-- We never trust the path on its own — we additionally require the caller
-- to be a doctor/private_doctor of the clinic encoded in segment 2.

drop policy if exists "clinical-assets sysadmin select"     on storage.objects;
drop policy if exists "clinical-assets clinic doctor select" on storage.objects;
drop policy if exists "clinical-assets clinic doctor insert" on storage.objects;

create policy "clinical-assets sysadmin select"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinical-assets'
    and public.has_role(auth.uid(), 'system_admin')
  );

create policy "clinical-assets clinic doctor select"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinical-assets'
    and name ~ '^clinic/[0-9a-fA-F-]{36}/visit/[0-9a-fA-F-]{36}/.+$'
    and public.is_clinic_doctor(
      auth.uid(),
      nullif(split_part(name, '/', 2), '')::uuid
    )
  );

create policy "clinical-assets clinic doctor insert"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clinical-assets'
    and name ~ '^clinic/[0-9a-fA-F-]{36}/visit/[0-9a-fA-F-]{36}/.+$'
    and public.is_clinic_doctor(
      auth.uid(),
      nullif(split_part(name, '/', 2), '')::uuid
    )
  );

-- No UPDATE / DELETE policies on storage.objects for this bucket: those
-- operations remain denied for the bucket under RLS.
