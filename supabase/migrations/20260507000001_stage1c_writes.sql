-- Stage 1C · Controlled write API + hardened write RLS.
-- Additive only. Does NOT mutate any Stage 1A object.
--
-- Design:
--   * Column-level INSERT/UPDATE grants only (no broad GRANT INSERT ON TABLE).
--   * Server-controlled columns (clinic_id, created_by, doctor_id, decided_*,
--     version, signed_*) are NEVER granted — clients cannot mention them in
--     INSERT/UPDATE; PostgREST/api-write must omit them or get 42501.
--   * BEFORE INSERT/UPDATE triggers force server-controlled values from
--     auth.uid() and parent rows, enforce immutability, validate invariants
--     (assistant same-clinic, assessment lesion belongs to visit patient,
--     report_versions state machine, reports.current_version_id guard).
--   * INSERT/UPDATE RLS policies for `doctor` and `private_doctor` only.
--   * No DELETE grants. No service role usage. No audit-log writes here.
--   * Allowed report_version transitions: draft→final, final→amended.
--     `amended` is terminal. Any transition to/from `revoked` is rejected.

set search_path = public;

-- ── Helpers ────────────────────────────────────────────────────────────────

-- Doctor or private_doctor membership in the given clinic.
create or replace function public.is_clinic_doctor(_user_id uuid, _clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and clinic_id = _clinic_id
      and role in ('doctor','private_doctor')
  )
$$;

-- Same-clinic staff membership (for assistant_id validation). SECURITY DEFINER
-- because the calling doctor cannot read another user's user_roles row under
-- Stage 1A self-only RLS.
create or replace function public.is_clinic_staff(_user_id uuid, _clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and clinic_id = _clinic_id
      and role in ('assistant','doctor','private_doctor','clinic_admin')
  )
$$;

revoke all on function public.is_clinic_doctor(uuid, uuid) from public;
revoke all on function public.is_clinic_staff(uuid, uuid)  from public;
grant execute on function public.is_clinic_doctor(uuid, uuid) to authenticated;
grant execute on function public.is_clinic_staff(uuid, uuid)  to authenticated;

-- ── Column-level grants (writes) ───────────────────────────────────────────
-- IMPORTANT: server-controlled columns are intentionally omitted.

grant insert (code, full_name, birth_date, sex, phototype, risk_factors)
  on public.patients to authenticated;
grant update (full_name, birth_date, sex, phototype, risk_factors)
  on public.patients to authenticated;

grant insert (patient_id, started_at, complaint, assistant_id)
  on public.visits to authenticated;
grant update (status, closed_at, complaint, assistant_id)
  on public.visits to authenticated;

grant insert (patient_id, body_zone, map_view, map_x, map_y, label, first_seen_at, status)
  on public.lesions to authenticated;
grant update (body_zone, map_view, map_x, map_y, label, status)
  on public.lesions to authenticated;

grant insert (visit_id, lesion_id, abcd, seven_point,
              ai_risk, ai_confidence, ai_features, ai_uncertainty_notes, ai_xai_notes)
  on public.assessments to authenticated;
-- assessments: append-only, no UPDATE grants.

grant insert (visit_id, doctor_text, follow_up_plan)
  on public.conclusions to authenticated;
-- conclusions: append-only.

grant insert (visit_id) on public.reports to authenticated;
grant update (current_version_id) on public.reports to authenticated;

grant insert (report_id, patient_safe_text, doctor_text)
  on public.report_versions to authenticated;
grant update (status, patient_safe_text, doctor_text)
  on public.report_versions to authenticated;

-- ── INSERT/UPDATE RLS policies (doctor + private_doctor only) ──────────────
-- Note: select policies remain Stage 1A's. We only add WRITE policies here.

-- patients
create policy patients_doctor_insert on public.patients
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
create policy patients_doctor_update on public.patients
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- visits
create policy visits_doctor_insert on public.visits
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
create policy visits_doctor_update on public.visits
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- lesions
create policy lesions_doctor_insert on public.lesions
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
create policy lesions_doctor_update on public.lesions
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- assessments (insert-only)
create policy assessments_doctor_insert on public.assessments
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));

-- conclusions (insert-only)
create policy conclusions_doctor_insert on public.conclusions
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));

-- reports
create policy reports_doctor_insert on public.reports
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
create policy reports_doctor_update on public.reports
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- report_versions
create policy report_versions_doctor_insert on public.report_versions
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
create policy report_versions_doctor_update on public.report_versions
  for update to authenticated
  using       (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check  (public.is_clinic_doctor(auth.uid(), clinic_id));

-- ── Write-guard triggers ──────────────────────────────────────────────────

-- patients
create or replace function public.tg_patients_write_guard()
returns trigger language plpgsql as $$
declare _caller_clinic uuid;
begin
  if tg_op = 'INSERT' then
    select p.clinic_id into _caller_clinic
      from public.profiles p where p.id = auth.uid();
    if _caller_clinic is null then
      raise exception 'caller_has_no_clinic' using errcode = 'P0001';
    end if;
    NEW.clinic_id  := _caller_clinic;
    NEW.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    if NEW.code        is distinct from OLD.code        then raise exception 'patients.code_immutable'        using errcode = 'P0001'; end if;
    if NEW.clinic_id   is distinct from OLD.clinic_id   then raise exception 'patients.clinic_id_immutable'   using errcode = 'P0001'; end if;
    if NEW.created_by  is distinct from OLD.created_by  then raise exception 'patients.created_by_immutable'  using errcode = 'P0001'; end if;
    if NEW.created_at  is distinct from OLD.created_at  then raise exception 'patients.created_at_immutable'  using errcode = 'P0001'; end if;
    NEW.id := OLD.id;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_patients_write_guard on public.patients;
create trigger tg_patients_write_guard
  before insert or update on public.patients
  for each row execute function public.tg_patients_write_guard();

-- visits
create or replace function public.tg_visits_write_guard()
returns trigger language plpgsql as $$
declare _patient_clinic uuid;
begin
  if tg_op = 'INSERT' then
    select pa.clinic_id into _patient_clinic
      from public.patients pa where pa.id = NEW.patient_id;
    if _patient_clinic is null then
      raise exception 'patient_not_found' using errcode = 'P0001';
    end if;
    NEW.clinic_id := _patient_clinic;
    NEW.doctor_id := auth.uid();
    if NEW.status is null then NEW.status := 'scheduled'; end if;
  elsif tg_op = 'UPDATE' then
    if NEW.clinic_id  is distinct from OLD.clinic_id  then raise exception 'visits.clinic_id_immutable'  using errcode = 'P0001'; end if;
    if NEW.patient_id is distinct from OLD.patient_id then raise exception 'visits.patient_id_immutable' using errcode = 'P0001'; end if;
    if NEW.doctor_id  is distinct from OLD.doctor_id  then raise exception 'visits.doctor_id_immutable'  using errcode = 'P0001'; end if;
    if NEW.started_at is distinct from OLD.started_at then raise exception 'visits.started_at_immutable' using errcode = 'P0001'; end if;
    if NEW.created_at is distinct from OLD.created_at then raise exception 'visits.created_at_immutable' using errcode = 'P0001'; end if;
    -- transitions: scheduled→in_progress→closed, *→cancelled (from non-closed).
    if NEW.status is distinct from OLD.status then
      if OLD.status = 'closed' then
        raise exception 'visits.illegal_transition_from_closed' using errcode = 'P0001';
      end if;
      if not (
        (OLD.status = 'scheduled'   and NEW.status in ('in_progress','closed','cancelled'))
        or (OLD.status = 'in_progress' and NEW.status in ('closed','cancelled'))
        or (OLD.status = 'cancelled'   and false)
      ) then
        raise exception 'visits.illegal_transition' using errcode = 'P0001';
      end if;
    end if;
    if NEW.status = 'closed' and NEW.closed_at is null then
      raise exception 'visits.closed_requires_closed_at' using errcode = 'P0001';
    end if;
    if NEW.status <> 'closed' and NEW.closed_at is not null then
      raise exception 'visits.closed_at_only_for_closed' using errcode = 'P0001';
    end if;
    NEW.id := OLD.id;
  end if;

  -- Assistant must be same-clinic staff.
  if NEW.assistant_id is not null then
    if not public.is_clinic_staff(NEW.assistant_id, NEW.clinic_id) then
      raise exception 'visits.assistant_not_in_clinic' using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end $$;

drop trigger if exists tg_visits_write_guard on public.visits;
create trigger tg_visits_write_guard
  before insert or update on public.visits
  for each row execute function public.tg_visits_write_guard();

-- lesions
create or replace function public.tg_lesions_write_guard()
returns trigger language plpgsql as $$
declare _patient_clinic uuid;
begin
  if tg_op = 'INSERT' then
    select pa.clinic_id into _patient_clinic
      from public.patients pa where pa.id = NEW.patient_id;
    if _patient_clinic is null then
      raise exception 'patient_not_found' using errcode = 'P0001';
    end if;
    NEW.clinic_id := _patient_clinic;
    if NEW.status is null then NEW.status := 'active'; end if;
  elsif tg_op = 'UPDATE' then
    if NEW.clinic_id     is distinct from OLD.clinic_id     then raise exception 'lesions.clinic_id_immutable'     using errcode = 'P0001'; end if;
    if NEW.patient_id    is distinct from OLD.patient_id    then raise exception 'lesions.patient_id_immutable'    using errcode = 'P0001'; end if;
    if NEW.first_seen_at is distinct from OLD.first_seen_at then raise exception 'lesions.first_seen_at_immutable' using errcode = 'P0001'; end if;
    if NEW.created_at    is distinct from OLD.created_at    then raise exception 'lesions.created_at_immutable'    using errcode = 'P0001'; end if;
    NEW.id := OLD.id;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_lesions_write_guard on public.lesions;
create trigger tg_lesions_write_guard
  before insert or update on public.lesions
  for each row execute function public.tg_lesions_write_guard();

-- assessments (append-only)
create or replace function public.tg_assessments_write_guard()
returns trigger language plpgsql as $$
declare _v_clinic uuid; _v_patient uuid; _l_clinic uuid; _l_patient uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'assessments.append_only' using errcode = 'P0001';
  end if;
  -- INSERT
  select v.clinic_id, v.patient_id into _v_clinic, _v_patient
    from public.visits v where v.id = NEW.visit_id;
  if _v_clinic is null then
    raise exception 'visit_not_found' using errcode = 'P0001';
  end if;
  select l.clinic_id, l.patient_id into _l_clinic, _l_patient
    from public.lesions l where l.id = NEW.lesion_id;
  if _l_clinic is null then
    raise exception 'lesion_not_found' using errcode = 'P0001';
  end if;
  if _l_patient is distinct from _v_patient then
    raise exception 'assessments.lesion_patient_mismatch' using errcode = 'P0001';
  end if;
  if _l_clinic is distinct from _v_clinic then
    raise exception 'assessments.lesion_clinic_mismatch' using errcode = 'P0001';
  end if;
  NEW.clinic_id  := _v_clinic;
  NEW.decided_by := auth.uid();
  NEW.decided_at := now();
  return NEW;
end $$;

drop trigger if exists tg_assessments_write_guard on public.assessments;
create trigger tg_assessments_write_guard
  before insert or update on public.assessments
  for each row execute function public.tg_assessments_write_guard();

-- conclusions (append-only)
create or replace function public.tg_conclusions_write_guard()
returns trigger language plpgsql as $$
declare _v_clinic uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'conclusions.append_only' using errcode = 'P0001';
  end if;
  select v.clinic_id into _v_clinic from public.visits v where v.id = NEW.visit_id;
  if _v_clinic is null then
    raise exception 'visit_not_found' using errcode = 'P0001';
  end if;
  NEW.clinic_id  := _v_clinic;
  NEW.decided_by := auth.uid();
  NEW.decided_at := now();
  return NEW;
end $$;

drop trigger if exists tg_conclusions_write_guard on public.conclusions;
create trigger tg_conclusions_write_guard
  before insert or update on public.conclusions
  for each row execute function public.tg_conclusions_write_guard();

-- reports
create or replace function public.tg_reports_write_guard()
returns trigger language plpgsql as $$
declare _v_clinic uuid; _ver_report uuid; _ver_clinic uuid; _ver_status report_version_status;
begin
  if tg_op = 'INSERT' then
    select v.clinic_id into _v_clinic from public.visits v where v.id = NEW.visit_id;
    if _v_clinic is null then
      raise exception 'visit_not_found' using errcode = 'P0001';
    end if;
    NEW.clinic_id := _v_clinic;
    NEW.current_version_id := null;
  elsif tg_op = 'UPDATE' then
    if NEW.clinic_id  is distinct from OLD.clinic_id  then raise exception 'reports.clinic_id_immutable'  using errcode = 'P0001'; end if;
    if NEW.visit_id   is distinct from OLD.visit_id   then raise exception 'reports.visit_id_immutable'   using errcode = 'P0001'; end if;
    if NEW.created_at is distinct from OLD.created_at then raise exception 'reports.created_at_immutable' using errcode = 'P0001'; end if;
    NEW.id := OLD.id;
    if NEW.current_version_id is distinct from OLD.current_version_id
       and NEW.current_version_id is not null then
      select rv.report_id, rv.clinic_id, rv.status
        into _ver_report, _ver_clinic, _ver_status
        from public.report_versions rv where rv.id = NEW.current_version_id;
      if _ver_report is null then
        raise exception 'reports.current_version_not_found' using errcode = 'P0001';
      end if;
      if _ver_report is distinct from NEW.id then
        raise exception 'reports.current_version_wrong_report' using errcode = 'P0001';
      end if;
      if _ver_clinic is distinct from NEW.clinic_id then
        raise exception 'reports.current_version_wrong_clinic' using errcode = 'P0001';
      end if;
      if _ver_status not in ('final','amended') then
        raise exception 'reports.current_version_not_final_or_amended' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_reports_write_guard on public.reports;
create trigger tg_reports_write_guard
  before insert or update on public.reports
  for each row execute function public.tg_reports_write_guard();

-- report_versions
create or replace function public.tg_report_versions_write_guard()
returns trigger language plpgsql as $$
declare _r_clinic uuid; _next_version int;
begin
  if tg_op = 'INSERT' then
    select r.clinic_id into _r_clinic from public.reports r where r.id = NEW.report_id;
    if _r_clinic is null then
      raise exception 'report_not_found' using errcode = 'P0001';
    end if;
    NEW.clinic_id  := _r_clinic;
    NEW.created_by := auth.uid();
    NEW.status     := 'draft';
    NEW.signed_by  := null;
    NEW.signed_at  := null;
    select coalesce(max(version), 0) + 1 into _next_version
      from public.report_versions where report_id = NEW.report_id;
    NEW.version := _next_version;
  elsif tg_op = 'UPDATE' then
    if NEW.clinic_id  is distinct from OLD.clinic_id  then raise exception 'report_versions.clinic_id_immutable'  using errcode = 'P0001'; end if;
    if NEW.report_id  is distinct from OLD.report_id  then raise exception 'report_versions.report_id_immutable'  using errcode = 'P0001'; end if;
    if NEW.version    is distinct from OLD.version    then raise exception 'report_versions.version_immutable'    using errcode = 'P0001'; end if;
    if NEW.created_by is distinct from OLD.created_by then raise exception 'report_versions.created_by_immutable' using errcode = 'P0001'; end if;
    if NEW.created_at is distinct from OLD.created_at then raise exception 'report_versions.created_at_immutable' using errcode = 'P0001'; end if;
    NEW.id := OLD.id;

    -- `revoked` is out of scope in Stage 1C; reject any transition to/from it.
    if NEW.status = 'revoked' or OLD.status = 'revoked' then
      raise exception 'report_versions.revoked_not_allowed_in_stage_1c' using errcode = 'P0001';
    end if;

    if NEW.status is distinct from OLD.status then
      -- Allowed: draft→final, final→amended.
      if not (
        (OLD.status = 'draft' and NEW.status = 'final')
        or (OLD.status = 'final' and NEW.status = 'amended')
      ) then
        raise exception 'report_versions.illegal_transition' using errcode = 'P0001';
      end if;
      -- Transitions stamp signature.
      NEW.signed_by := auth.uid();
      NEW.signed_at := now();
    else
      -- No status change: text edits only allowed while still draft.
      if OLD.status <> 'draft' then
        if NEW.patient_safe_text is distinct from OLD.patient_safe_text
           or NEW.doctor_text    is distinct from OLD.doctor_text then
          raise exception 'report_versions.text_locked_after_finalization' using errcode = 'P0001';
        end if;
      end if;
      if NEW.signed_by is distinct from OLD.signed_by then raise exception 'report_versions.signed_by_immutable' using errcode = 'P0001'; end if;
      if NEW.signed_at is distinct from OLD.signed_at then raise exception 'report_versions.signed_at_immutable' using errcode = 'P0001'; end if;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_report_versions_write_guard on public.report_versions;
create trigger tg_report_versions_write_guard
  before insert or update on public.report_versions
  for each row execute function public.tg_report_versions_write_guard();
