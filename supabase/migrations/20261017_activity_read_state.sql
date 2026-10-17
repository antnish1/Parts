-- Per-user Activity read state.
-- Additive only: immutable portal_order_events and portal_notifications content is not modified.
create table if not exists public.portal_activity_reads (
  profile_id uuid not null references public.portal_profiles(id) on delete cascade,
  activity_key text not null,
  read_at timestamptz not null default now(),
  primary key (profile_id, activity_key)
);

create index if not exists portal_activity_reads_profile_read_idx
  on public.portal_activity_reads(profile_id, read_at desc);

alter table public.portal_activity_reads enable row level security;

grant select, insert, update(read_at) on public.portal_activity_reads to authenticated;

drop policy if exists activity_reads_select on public.portal_activity_reads;
create policy activity_reads_select
on public.portal_activity_reads
for select
to authenticated
using (
  exists (
    select 1
    from public.portal_profiles p
    where p.id = portal_activity_reads.profile_id
      and p.auth_user_id = auth.uid()
      and p.is_active = true
  )
);

drop policy if exists activity_reads_insert on public.portal_activity_reads;
create policy activity_reads_insert
on public.portal_activity_reads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.portal_profiles p
    where p.id = portal_activity_reads.profile_id
      and p.auth_user_id = auth.uid()
      and p.is_active = true
  )
);

drop policy if exists activity_reads_update on public.portal_activity_reads;
create policy activity_reads_update
on public.portal_activity_reads
for update
to authenticated
using (
  exists (
    select 1
    from public.portal_profiles p
    where p.id = portal_activity_reads.profile_id
      and p.auth_user_id = auth.uid()
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.portal_profiles p
    where p.id = portal_activity_reads.profile_id
      and p.auth_user_id = auth.uid()
      and p.is_active = true
  )
);
