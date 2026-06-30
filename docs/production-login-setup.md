# Production login setup

This rebuild now uses Supabase Auth for login.

The legacy frontend password flow must not be used in the React production app.

## Current implementation

- Login page uses `supabase.auth.signInWithPassword`.
- Protected routes are wrapped by `RequireAuth`.
- User access is finalized by a profile row.
- During staging, profile rows are read from `test_profiles`.
- The app redirects users to their role home after login.
- The app layout shows signed-in user, role, branch, and Sign Out.

## Required Vercel environment variables

Set these in the Vercel project:

```txt
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_ENV=staging
```

## How to create a staging login safely

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Create a user with email and password.
4. Copy the new Auth user UUID.
5. Insert or update a matching row in `test_profiles` using that UUID.

Example:

```sql
insert into public.test_profiles (id, full_name, branch, role, is_active)
values (
  'PASTE_AUTH_USER_UUID_HERE',
  'Test Manager',
  'HQ',
  'manager',
  true
)
on conflict (id) do update set
  full_name = excluded.full_name,
  branch = excluded.branch,
  role = excluded.role,
  is_active = excluded.is_active;
```

Allowed roles:

- branch
- admin
- super
- manager
- viewer
- developer

## Role home paths

- branch: `/orders/new`
- admin: `/admin/approved`
- super: `/approvals/pending`
- manager: `/manager/dashboard`
- viewer: `/orders/track`
- developer: `/developer/workspace`

## Important production cutover note

Before final production cutover, replace `test_profiles` with the production `profiles` table and enable strict RLS policies.

Do not read passwords from the old `users` table in the frontend.
