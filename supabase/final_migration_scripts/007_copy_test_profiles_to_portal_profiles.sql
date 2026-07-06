-- FINAL MIGRATION SCRIPT 007
-- Copy current working test_profiles into production portal_profiles before app cutover.
--
-- Why this is required:
-- The current app login/role/branch access uses test_profiles.
-- After switching the app to portal_* tables, login/role/branch access will use portal_profiles.
-- This script copies the existing working profile records safely.
--
-- Safety:
-- - Does not delete test_profiles.
-- - Does not modify auth.users.
-- - Upserts into portal_profiles so it is safe to re-run.
-- - Preserves the same profile id where possible, so existing approver ids can remain stable.

-- 1) Preview current profile counts.
select 'test_profiles' as table_name, count(*) as row_count
from public.test_profiles
union all
select 'portal_profiles_before', count(*)
from public.portal_profiles;

-- 2) Copy active/current profile data from test_profiles to portal_profiles.
insert into public.portal_profiles (
  id,
  auth_user_id,
  full_name,
  branch,
  role,
  is_active,
  legacy_user_id,
  legacy_name,
  created_at,
  updated_at
)
select
  id,
  auth_user_id,
  coalesce(nullif(trim(full_name), ''), 'Unnamed User') as full_name,
  coalesce(nullif(trim(branch), ''), 'UNKNOWN') as branch,
  lower(coalesce(nullif(trim(role), ''), 'viewer')) as role,
  coalesce(is_active, true) as is_active,
  id::text as legacy_user_id,
  full_name as legacy_name,
  coalesce(created_at, now()) as created_at,
  now() as updated_at
from public.test_profiles
where lower(coalesce(nullif(trim(role), ''), 'viewer')) in ('branch', 'admin', 'super', 'manager', 'viewer', 'developer')
on conflict (id) do update set
  auth_user_id = excluded.auth_user_id,
  full_name = excluded.full_name,
  branch = excluded.branch,
  role = excluded.role,
  is_active = excluded.is_active,
  legacy_user_id = excluded.legacy_user_id,
  legacy_name = excluded.legacy_name,
  updated_at = now();

-- 3) Verification counts.
select 'test_profiles' as table_name, count(*) as row_count
from public.test_profiles
union all
select 'portal_profiles_after', count(*)
from public.portal_profiles;

-- 4) Profiles that were not copied because of invalid role values. This should ideally return zero rows.
select id, full_name, branch, role, is_active, auth_user_id
from public.test_profiles
where lower(coalesce(nullif(trim(role), ''), 'viewer')) not in ('branch', 'admin', 'super', 'manager', 'viewer', 'developer')
order by full_name;

-- 5) Active portal profiles not linked to Supabase Auth. Review before cutover.
select id, full_name, branch, role, is_active, auth_user_id
from public.portal_profiles
where coalesce(is_active, true) = true
  and auth_user_id is null
order by role, branch, full_name;
