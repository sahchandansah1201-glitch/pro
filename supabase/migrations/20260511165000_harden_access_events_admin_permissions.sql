-- Stage 3L: harden system-admin access-events view permissions.
--
-- The view itself still owns the row-level role check through
-- public.has_role(auth.uid(), 'system_admin'). These options and grants
-- make that contract explicit at the database boundary.

alter view public.access_events_admin set (security_invoker = true);
alter view public.access_events_admin set (security_barrier = true);

revoke all on table public.access_events_admin from public;
revoke all on table public.access_events_admin from anon;
revoke all on table public.access_events_admin from authenticated;
grant select on table public.access_events_admin to authenticated;

comment on view public.access_events_admin is
  'System-admin-only audit/access-events view with safe clinic, actor, patient, visit, and lesion context. Hardened with security_invoker/security_barrier and explicit grants.';
