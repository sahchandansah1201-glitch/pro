-- Stage 1A · RLS. Deny by default. SELECT-only for non-system roles.
-- No INSERT/UPDATE/DELETE policies for app roles in Stage 1A.

-- ── Enable + force RLS on every Stage 1A table ─────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
      'clinics','profiles','user_roles','patient_user_link',
      'patients','visits','lesions','assets','assessments','conclusions',
      'reports','report_versions','public_signed_links','protected_analysis_links',
      'consents','audit_logs'
  ]) loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- Drop any pre-existing policies (idempotent re-run).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'clinics','profiles','user_roles','patient_user_link',
        'patients','visits','lesions','assets','assessments','conclusions',
        'reports','report_versions','public_signed_links','protected_analysis_links',
        'consents','audit_logs'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I;',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── clinics ────────────────────────────────────────────────────────────────
-- system_admin: read all. Everyone else (authenticated): read only clinics
-- they are bound to via user_roles or patient_user_link→patient.clinic_id.
create policy clinics_sysadmin_select on public.clinics
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));

create policy clinics_member_select on public.clinics
  for select to authenticated
  using (
    exists (select 1 from public.user_roles ur
            where ur.user_id = auth.uid() and ur.clinic_id = clinics.id)
    or exists (select 1 from public.patient_user_link pul
               join public.patients p on p.id = pul.patient_id
               where pul.user_id = auth.uid()
                 and pul.revoked_at is null
                 and p.clinic_id = clinics.id)
  );

-- ── profiles ───────────────────────────────────────────────────────────────
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_sysadmin_select on public.profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));

-- Same-clinic staff can read each other's profiles.
create policy profiles_clinic_select on public.profiles
  for select to authenticated
  using (
    clinic_id is not null
    and public.has_clinic_access(auth.uid(), clinic_id)
  );

-- ── user_roles ─────────────────────────────────────────────────────────────
-- Stage 1A keeps user_roles policies strictly NON-RECURSIVE.
-- Any policy on user_roles that calls has_role() (which itself reads
-- user_roles) causes "infinite recursion detected in policy" because
-- FORCE ROW LEVEL SECURITY is enabled and BYPASSRLS does not apply
-- inside SECURITY DEFINER functions whose owner is forced.
-- Therefore: only a self-select policy. Broader role visibility for
-- system_admin / clinic_admin is intentionally deferred past Stage 1A.
-- has_role() still works correctly when invoked from OTHER tables'
-- policies, because the self-select predicate (user_id = auth.uid())
-- is sufficient for has_role to find the caller's own role rows.
create policy user_roles_self_select on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- ── patient_user_link ──────────────────────────────────────────────────────
create policy pul_self_select on public.patient_user_link
  for select to authenticated using (user_id = auth.uid());

create policy pul_sysadmin_select on public.patient_user_link
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));

create policy pul_clinic_select on public.patient_user_link
  for select to authenticated
  using (exists (
    select 1 from public.patients p
    where p.id = patient_user_link.patient_id
      and public.has_clinic_access(auth.uid(), p.clinic_id)
  ));

-- ── Generic clinic-scoped SELECT policies for clinical tables ──────────────
-- system_admin sees all. Staff see same-clinic. Patient sees own linked rows.
-- operator gets NO direct clinical reads in Stage 1A.

-- patients
create policy patients_sysadmin_select on public.patients
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy patients_clinic_select on public.patients
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
create policy patients_self_select on public.patients
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and public.is_linked_patient(auth.uid(), id)
  );

-- visits
create policy visits_sysadmin_select on public.visits
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy visits_clinic_select on public.visits
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
create policy visits_patient_select on public.visits
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and public.is_linked_patient(auth.uid(), patient_id)
  );

-- lesions
create policy lesions_sysadmin_select on public.lesions
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy lesions_clinic_select on public.lesions
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
create policy lesions_patient_select on public.lesions
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and public.is_linked_patient(auth.uid(), patient_id)
  );

-- assets (image metadata)
create policy assets_sysadmin_select on public.assets
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy assets_clinic_select on public.assets
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
-- Patient does NOT see asset metadata directly in Stage 1A.

-- assessments
create policy assessments_sysadmin_select on public.assessments
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy assessments_clinic_select on public.assessments
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));

-- conclusions
create policy conclusions_sysadmin_select on public.conclusions
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy conclusions_clinic_select on public.conclusions
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));

-- reports
create policy reports_sysadmin_select on public.reports
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy reports_clinic_select on public.reports
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
create policy reports_patient_select on public.reports
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and exists (select 1 from public.visits v
                where v.id = reports.visit_id
                  and public.is_linked_patient(auth.uid(), v.patient_id))
  );

-- report_versions
create policy report_versions_sysadmin_select on public.report_versions
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy report_versions_clinic_select on public.report_versions
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
-- Patient sees only FINAL/AMENDED versions for their reports.
create policy report_versions_patient_select on public.report_versions
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and status in ('final','amended')
    and exists (
      select 1 from public.reports r
      join public.visits v on v.id = r.visit_id
      where r.id = report_versions.report_id
        and public.is_linked_patient(auth.uid(), v.patient_id)
    )
  );

-- public_signed_links
create policy psl_sysadmin_select on public.public_signed_links
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy psl_clinic_select on public.public_signed_links
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));

-- protected_analysis_links
create policy pal_sysadmin_select on public.protected_analysis_links
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy pal_clinic_select on public.protected_analysis_links
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));

-- consents
create policy consents_sysadmin_select on public.consents
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy consents_clinic_select on public.consents
  for select to authenticated
  using (public.has_clinic_access(auth.uid(), clinic_id));
create policy consents_patient_select on public.consents
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'patient')
    and public.is_linked_patient(auth.uid(), patient_id)
  );

-- audit_logs (system_admin + clinic_admin only)
create policy audit_logs_sysadmin_select on public.audit_logs
  for select to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));
create policy audit_logs_clinic_admin_select on public.audit_logs
  for select to authenticated
  using (
    exists (select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role = 'clinic_admin'
              and ur.clinic_id = audit_logs.clinic_id)
  );
