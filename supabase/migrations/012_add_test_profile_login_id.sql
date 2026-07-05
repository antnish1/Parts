alter table public.test_profiles
add column if not exists login_id text;

create unique index if not exists idx_test_profiles_login_id_unique
on public.test_profiles (lower(login_id))
where login_id is not null and btrim(login_id) <> '';
