# Stage 1D · Clinical-write audit logging

This stage adds **only** a `SECURITY DEFINER` RPC `public.log_clinical_write(...)`
that the `api-write` Edge Function calls after each successful clinical write.

Design constraints:

- Additive only. Stage 1A and Stage 1C migrations and tests are untouched.
- No service-role usage anywhere in the request path.
- `audit_logs` SELECT policies (Stage 1A) are **not** modified — doctors still
  cannot read audit rows; only `system_admin` and same-clinic `clinic_admin`
  can.
- No `GRANT INSERT ON public.audit_logs` is added. Direct INSERTs by
  authenticated users continue to be rejected by RLS — the new RPC is the
  only sanctioned write path.
- The RPC enforces:
  1. `auth.uid()` must be set.
  2. `_action ∈ {create, update, finalize, amend, set_current_version}`.
  3. `_entity ∈ {patient, visit, lesion, assessment, conclusion, report,
     report_version}`.
  4. Caller must satisfy `public.is_clinic_doctor(auth.uid(), _clinic_id)`
     (reuses the Stage 1C helper).
  5. `_payload` may not contain any denylisted key (raw clinical text,
     freeform notes, dictation transcripts, etc.).
  6. `octet_length(_payload::text) <= 4096` bytes.

Files in this stage:

```
db/stage1d/
├── README.md
├── migrations/20260508000001_stage1d_audit.sql
└── tests/stage1d_audit.test.sql
```

Both the migration and the pgTAP test are also installed byte-identically to
`supabase/migrations/` and `supabase/tests/` so `npx supabase db reset` and
`npx supabase test db` exercise them.

Run locally:

```bash
npx supabase db reset
npx supabase test db        # expect Files=3, PASS
```
