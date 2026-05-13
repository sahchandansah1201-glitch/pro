-- Stage 4I · self-hosted clinical asset write contract.
-- The table is created in Stage 4A. This migration adds lookup indexes used
-- by metadata registration and backend-owned download-url issuance.

create index if not exists clinical_assets_lesion_idx
  on clinical_assets (lesion_id, created_at desc)
  where lesion_id is not null;

create index if not exists clinical_assets_patient_created_idx
  on clinical_assets (patient_id, created_at desc);

create index if not exists clinical_assets_uploaded_by_idx
  on clinical_assets (uploaded_by, created_at desc)
  where uploaded_by is not null;
