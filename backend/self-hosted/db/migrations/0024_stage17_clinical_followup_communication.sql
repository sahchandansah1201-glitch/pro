-- Stage 17A-17Z · Clinical follow-up and patient communication loop.
-- Self-hosted PostgreSQL only. No managed notification provider is required.

create table if not exists clinical_follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid references visits(id),
  created_by_user_id uuid references app_users(id),
  assigned_user_id uuid references app_users(id),
  due_at timestamptz not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'sent', 'acknowledged', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  reason text not null,
  patient_summary text,
  internal_note text,
  last_message_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinical_follow_up_messages (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid references visits(id),
  sender_user_id uuid references app_users(id),
  sender_role text not null check (sender_role in ('doctor', 'clinic', 'patient')),
  direction text not null check (direction in ('clinic_to_patient', 'patient_to_clinic')),
  channel text not null default 'portal' check (channel in ('portal', 'phone', 'email', 'none')),
  delivery_state text not null default 'local_only'
    check (delivery_state in ('local_only', 'posted', 'read', 'archived')),
  patient_visible boolean not null default true,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists clinical_follow_up_tasks_clinic_due_idx
  on clinical_follow_up_tasks(clinic_id, due_at, status);

create index if not exists clinical_follow_up_tasks_patient_due_idx
  on clinical_follow_up_tasks(patient_id, due_at);

create index if not exists clinical_follow_up_tasks_visit_idx
  on clinical_follow_up_tasks(visit_id)
  where visit_id is not null;

create index if not exists clinical_follow_up_messages_follow_up_idx
  on clinical_follow_up_messages(follow_up_id, created_at);

create index if not exists clinical_follow_up_messages_patient_visible_idx
  on clinical_follow_up_messages(patient_id, created_at)
  where patient_visible is true;

drop trigger if exists clinical_follow_up_tasks_touch_updated_at on clinical_follow_up_tasks;
create trigger clinical_follow_up_tasks_touch_updated_at
before update on clinical_follow_up_tasks
for each row execute function touch_updated_at();

comment on table clinical_follow_up_tasks is
  'Stage 17 self-hosted clinical follow-up task queue. Stored locally in PostgreSQL.';

comment on table clinical_follow_up_messages is
  'Stage 17 self-hosted patient communication messages. Delivery is represented locally; no managed provider is coupled to runtime.';
