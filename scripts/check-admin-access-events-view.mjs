#!/usr/bin/env node
import { readFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20260511153000_admin_access_events_view.sql";
const HARDENING = "supabase/migrations/20260511165000_harden_access_events_admin_permissions.sql";
const LIMITS = "supabase/migrations/20260511172000_access_events_admin_query_limits.sql";
const TYPES = "src/integrations/supabase/types.ts";

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    console.error(`[check-admin-access-events-view] Missing ${path}`);
    throw error;
  }
}

function assertContains(text, needle, label) {
  if (!text.includes(needle)) {
    console.error(`[check-admin-access-events-view] Missing ${label}: ${needle}`);
    process.exit(1);
  }
}

const migration = read(MIGRATION);
const hardening = read(HARDENING);
const limits = read(LIMITS);
const types = read(TYPES);

for (const [needle, label] of [
  ["create or replace view public.access_events_admin", "admin view definition"],
  ["with (security_invoker = true)", "security invoker setting"],
  ["from public.audit_logs al", "audit log source"],
  ["join public.clinics c", "clinic context join"],
  ["left join public.profiles actor", "actor context join"],
  ["left join public.patients context_patient", "patient context join"],
  ["left join public.visits context_visit", "visit context join"],
  ["left join public.lesions context_lesion", "lesion context join"],
  ["where public.has_role(auth.uid(), 'system_admin')", "system admin filter"],
  ["revoke all on table public.access_events_admin from public", "public revoke"],
  ["grant select on table public.access_events_admin to authenticated", "authenticated grant"],
]) {
  assertContains(migration, needle, label);
}

for (const [needle, label] of [
  ["alter view public.access_events_admin set (security_invoker = true)", "hardened security invoker"],
  ["alter view public.access_events_admin set (security_barrier = true)", "security barrier setting"],
  ["revoke all on table public.access_events_admin from public", "hardened public revoke"],
  ["revoke all on table public.access_events_admin from anon", "anon revoke"],
  ["revoke all on table public.access_events_admin from authenticated", "authenticated revoke before grant"],
  ["grant select on table public.access_events_admin to authenticated", "authenticated select grant"],
]) {
  assertContains(hardening, needle, label);
}

for (const [needle, label] of [
  ["create table if not exists public.access_events_admin_requests", "query log table"],
  ["create or replace function public.list_access_events_admin", "capped access-events RPC"],
  ["_safe_limit int := least(greatest(coalesce(_limit, 50), 1), 200)", "server-side limit cap"],
  ["r.requested_at > now() - interval '1 minute'", "rate-limit window"],
  ["if _recent_count >= 30 then", "rate-limit threshold"],
  ["raise exception 'rate_limit_exceeded'", "rate-limit exception"],
  ["grant execute on function public.list_access_events_admin(int, int) to authenticated", "RPC execute grant"],
]) {
  assertContains(limits, needle, label);
}

for (const [needle, label] of [
  ["access_events_admin", "generated view type"],
  ["actor_email: string | null", "actor context type"],
  ["patient_code: string | null", "patient context type"],
  ["visit_id: string | null", "visit context type"],
  ['| "system_admin"', "system admin enum"],
]) {
  assertContains(types, needle, label);
}

if (types.includes('| "admin"')) {
  console.error("[check-admin-access-events-view] Unexpected admin enum; repo uses system_admin.");
  process.exit(1);
}

console.log("[check-admin-access-events-view] OK");
