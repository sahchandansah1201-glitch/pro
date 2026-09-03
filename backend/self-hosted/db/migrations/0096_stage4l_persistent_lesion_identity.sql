-- Stage 4L-Q5 · Patient-scoped persistent lesion identity.
-- A lesion is owned by one clinic and one patient across visits. lesions.visit_id
-- remains the nullable origin visit; clinical assets from later visits may bind
-- to the same lesion only when clinic and patient ownership match exactly.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_identity_scope_unique' and conrelid = 'public.patients'::regclass) then
    alter table patients add constraint patients_identity_scope_unique
      unique (id, clinic_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visits_identity_scope_unique' and conrelid = 'public.visits'::regclass) then
    alter table visits add constraint visits_identity_scope_unique
      unique (id, clinic_id, patient_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_identity_scope_unique' and conrelid = 'public.lesions'::regclass) then
    alter table lesions add constraint lesions_identity_scope_unique
      unique (id, clinic_id, patient_id);
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visits_patient_scope_fk' and conrelid = 'public.visits'::regclass) then
    alter table visits add constraint visits_patient_scope_fk
      foreign key (patient_id, clinic_id)
      references patients (id, clinic_id)
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_patient_scope_fk' and conrelid = 'public.lesions'::regclass) then
    alter table lesions add constraint lesions_patient_scope_fk
      foreign key (patient_id, clinic_id)
      references patients (id, clinic_id)
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesions_origin_visit_scope_fk' and conrelid = 'public.lesions'::regclass) then
    alter table lesions add constraint lesions_origin_visit_scope_fk
      foreign key (visit_id, clinic_id, patient_id)
      references visits (id, clinic_id, patient_id)
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_assets_patient_scope_fk' and conrelid = 'public.clinical_assets'::regclass) then
    alter table clinical_assets add constraint clinical_assets_patient_scope_fk
      foreign key (patient_id, clinic_id)
      references patients (id, clinic_id)
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_assets_visit_scope_fk' and conrelid = 'public.clinical_assets'::regclass) then
    alter table clinical_assets add constraint clinical_assets_visit_scope_fk
      foreign key (visit_id, clinic_id, patient_id)
      references visits (id, clinic_id, patient_id)
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_assets_lesion_scope_fk' and conrelid = 'public.clinical_assets'::regclass) then
    alter table clinical_assets add constraint clinical_assets_lesion_scope_fk
      foreign key (lesion_id, clinic_id, patient_id)
      references lesions (id, clinic_id, patient_id)
      not valid;
  end if;
end
$$;

alter table visits validate constraint visits_patient_scope_fk;
alter table lesions validate constraint lesions_patient_scope_fk;
alter table lesions validate constraint lesions_origin_visit_scope_fk;
alter table clinical_assets validate constraint clinical_assets_patient_scope_fk;
alter table clinical_assets validate constraint clinical_assets_visit_scope_fk;
alter table clinical_assets validate constraint clinical_assets_lesion_scope_fk;

comment on column lesions.visit_id is
  'Nullable origin visit where the patient-scoped lesion was first recorded; later visits reuse the lesion id.';
comment on constraint clinical_assets_lesion_scope_fk on clinical_assets is
  'Prevents a clinical asset from referencing a lesion owned by another clinic or patient.';
