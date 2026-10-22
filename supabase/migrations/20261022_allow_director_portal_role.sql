-- Allow the Director role; preserve every existing profile and other permitted roles.
ALTER TABLE public.portal_profiles DROP CONSTRAINT IF EXISTS portal_profiles_role_check;
ALTER TABLE public.portal_profiles ADD CONSTRAINT portal_profiles_role_check
CHECK (role = ANY (ARRAY['branch','admin','super','manager','director','viewer','developer','hq','accounts']));

-- Reversal: remove director profiles (or assign an existing role) before restoring
-- the original constraint. No existing rows are modified by this migration.
