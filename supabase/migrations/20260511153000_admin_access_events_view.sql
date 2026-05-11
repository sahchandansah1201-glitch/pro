-- Admin access-events view.
--
-- The current role enum uses `system_admin` for global admins. This view is
-- intentionally restricted to that existing role with an explicit predicate,
-- then granted only to authenticated callers.

drop view if exists public.access_events_admin;

create or replace view public.access_events_admin
with (security_invoker = true)
as
select
  al.id,
  al.created_at,
  al.clinic_id,
  c.name as clinic_name,
  al.actor_id,
  actor.full_name as actor_full_name,
  actor.email as actor_email,
  al.action,
  al.entity,
  al.entity_id,
  context_patient.id as patient_id,
  context_patient.code as patient_code,
  context_patient.full_name as patient_full_name,
  context_visit.id as visit_id,
  context_lesion.id as lesion_id,
  context_lesion.label as lesion_label,
  al.payload
from public.audit_logs al
join public.clinics c
  on c.id = al.clinic_id
left join public.profiles actor
  on actor.id = al.actor_id
left join public.patients entity_patient
  on al.entity = 'patient'
 and entity_patient.id = al.entity_id
 and entity_patient.clinic_id = al.clinic_id
left join public.visits entity_visit
  on al.entity = 'visit'
 and entity_visit.id = al.entity_id
 and entity_visit.clinic_id = al.clinic_id
left join public.lesions entity_lesion
  on al.entity = 'lesion'
 and entity_lesion.id = al.entity_id
 and entity_lesion.clinic_id = al.clinic_id
left join public.assessments entity_assessment
  on al.entity = 'assessment'
 and entity_assessment.id = al.entity_id
 and entity_assessment.clinic_id = al.clinic_id
left join public.conclusions entity_conclusion
  on al.entity = 'conclusion'
 and entity_conclusion.id = al.entity_id
 and entity_conclusion.clinic_id = al.clinic_id
left join public.reports entity_report
  on al.entity = 'report'
 and entity_report.id = al.entity_id
 and entity_report.clinic_id = al.clinic_id
left join public.report_versions entity_report_version
  on al.entity = 'report_version'
 and entity_report_version.id = al.entity_id
 and entity_report_version.clinic_id = al.clinic_id
left join public.reports report_from_version
  on report_from_version.id = entity_report_version.report_id
 and report_from_version.clinic_id = al.clinic_id
left join public.visits context_visit
  on context_visit.id = coalesce(
    entity_visit.id,
    entity_assessment.visit_id,
    entity_conclusion.visit_id,
    entity_report.visit_id,
    report_from_version.visit_id
  )
 and context_visit.clinic_id = al.clinic_id
left join public.lesions context_lesion
  on context_lesion.id = coalesce(entity_lesion.id, entity_assessment.lesion_id)
 and context_lesion.clinic_id = al.clinic_id
left join public.patients context_patient
  on context_patient.id = coalesce(
    entity_patient.id,
    context_visit.patient_id,
    entity_lesion.patient_id
  )
 and context_patient.clinic_id = al.clinic_id
where public.has_role(auth.uid(), 'system_admin');

revoke all on table public.access_events_admin from public;
grant select on table public.access_events_admin to authenticated;

comment on view public.access_events_admin is
  'System-admin-only audit/access-events view with clinic, actor, patient, visit, and lesion context.';
