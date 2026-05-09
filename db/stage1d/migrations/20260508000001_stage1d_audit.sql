-- Stage 1D · Clinical-write audit logging.
-- Additive only. Does NOT mutate any Stage 1A or Stage 1C object.
--
-- Adds ONE SECURITY DEFINER RPC: public.log_clinical_write(...).
-- The api-write Edge Function calls this RPC after each successful clinical
-- write. No GRANT INSERT on public.audit_logs is added; direct INSERTs by
-- authenticated users remain rejected by Stage 1A RLS.
--
-- Defence in depth:
--   * Allow-listed _action and _entity.
--   * Caller must be is_clinic_doctor(auth.uid(), _clinic_id).
--   * _payload top-level keys must not match the clinical-text denylist.
--   * octet_length(_payload::text) <= 4096 bytes.
--   * search_path is pinned.

-- ── Allow-lists / denylist (immutable helpers) ─────────────────────────────

create or replace function public._stage1d_allowed_actions()
returns text[] language sql immutable as $$
  select array['create','update','finalize','amend','set_current_version']
$$;

create or replace function public._stage1d_allowed_entities()
returns text[] language sql immutable as $$
  select array['patient','visit','lesion','assessment','conclusion',
               'report','report_version']
$$;

-- Denylisted top-level payload keys. Any key matching one of these literals
-- or any key containing the substring 'freeform' / 'dictation' / 'raw_text'
-- is rejected. Keeps clinical free text out of audit payloads.
create or replace function public._stage1d_denied_payload_keys()
returns text[] language sql immutable as $$
  select array[
    'patient_safe_text','patientSafeText',
    'doctor_text','doctorText',
    'patient_text','patientText',
    'notes','summary','complaint',
    'recommendation_text','recommendationText',
    'follow_up_plan','followUpPlan',
    'ai_xai_notes','aiXaiNotes',
    'ai_uncertainty_notes','aiUncertaintyNotes',
    'raw_text','rawText'
  ]
$$;

revoke all on function public._stage1d_allowed_actions()       from public;
revoke all on function public._stage1d_allowed_entities()      from public;
revoke all on function public._stage1d_denied_payload_keys()   from public;
grant execute on function public._stage1d_allowed_actions()    to authenticated;
grant execute on function public._stage1d_allowed_entities()   to authenticated;
grant execute on function public._stage1d_denied_payload_keys() to authenticated;

-- ── The RPC ────────────────────────────────────────────────────────────────

create or replace function public.log_clinical_write(
  _clinic_id  uuid,
  _action     text,
  _entity     text,
  _entity_id  uuid,
  _payload    jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid       uuid := auth.uid();
  _new_id    uuid;
  _key       text;
  _denied    text[] := public._stage1d_denied_payload_keys();
  _payload_n jsonb := coalesce(_payload, '{}'::jsonb);
begin
  if _uid is null then
    raise exception 'stage1d_unauthenticated' using errcode = '42501';
  end if;

  if _clinic_id is null then
    raise exception 'stage1d_clinic_required' using errcode = '22023';
  end if;

  if _action is null or not (_action = any (public._stage1d_allowed_actions())) then
    raise exception 'stage1d_action_not_allowed: %', coalesce(_action,'<null>')
      using errcode = '22023';
  end if;

  if _entity is null or not (_entity = any (public._stage1d_allowed_entities())) then
    raise exception 'stage1d_entity_not_allowed: %', coalesce(_entity,'<null>')
      using errcode = '22023';
  end if;

  if not public.is_clinic_doctor(_uid, _clinic_id) then
    raise exception 'stage1d_not_clinic_doctor' using errcode = '42501';
  end if;

  if jsonb_typeof(_payload_n) <> 'object' then
    raise exception 'stage1d_payload_must_be_object' using errcode = '22023';
  end if;

  if octet_length(_payload_n::text) > 4096 then
    raise exception 'stage1d_payload_too_large' using errcode = '22023';
  end if;

  for _key in select jsonb_object_keys(_payload_n) loop
    if _key = any (_denied)
       or _key ilike '%freeform%'
       or _key ilike '%dictation%'
       or _key ilike '%raw_text%'
    then
      raise exception 'stage1d_payload_key_denied: %', _key
        using errcode = 'P0001';
    end if;
  end loop;

  insert into public.audit_logs (clinic_id, actor_id, action, entity, entity_id, payload)
  values (_clinic_id, _uid, _action, _entity, _entity_id, _payload_n)
  returning id into _new_id;

  return _new_id;
end
$$;

revoke all on function public.log_clinical_write(uuid, text, text, uuid, jsonb)
  from public;
grant execute on function public.log_clinical_write(uuid, text, text, uuid, jsonb)
  to authenticated;
