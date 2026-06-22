-- Stage 6 · production admin management.
-- Enables private dermatologist accounts in the self-hosted role model.

alter type app_role add value if not exists 'private_doctor';
