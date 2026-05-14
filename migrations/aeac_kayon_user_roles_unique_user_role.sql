-- Migration: aeac_kayon_user_roles_unique_user_role
-- Add unique constraint on (user_id, role) to property.user_roles.
-- Required for ON CONFLICT upserts in the new /akun-staff route handler.
-- Verified no existing duplicates before adding.

ALTER TABLE property.user_roles
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

COMMENT ON CONSTRAINT user_roles_user_id_role_key ON property.user_roles IS
'A given auth user can only have one row per role. Required for idempotent upserts in /akun-staff onboarding flow.';
