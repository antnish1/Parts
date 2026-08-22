create extension if not exists pgcrypto;

create table if not exists public.part_locations (
  id uuid primary key default gen_random_uuid(),
  part_no text not null,
  part_no_normalized text not null,
  location text not null,
  location_normalized text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint part_locations_part_no_not_blank check (length(btrim(part_no)) > 0),
  constraint part_locations_location_not_blank check (length(btrim(location)) > 0),
  constraint part_locations_part_normalized_not_blank check (length(btrim(part_no_normalized)) > 0),
  constraint part_locations_location_normalized_not_blank check (length(btrim(location_normalized)) > 0)
);

create index if not exists part_locations_part_no_normalized_idx
  on public.part_locations (part_no_normalized)
  where is_active = true;

create index if not exists part_locations_location_normalized_idx
  on public.part_locations (location_normalized)
  where is_active = true;

create unique index if not exists part_locations_active_part_location_uidx
  on public.part_locations (part_no_normalized, location_normalized)
  where is_active = true;

alter table public.part_locations enable row level security;

revoke all on table public.part_locations from anon, authenticated;
grant all on table public.part_locations to service_role;

comment on table public.part_locations is 'Physical storage locations for Parts Connect part numbers. Access is mediated by the part-location-action Edge Function.';
comment on column public.part_locations.part_no_normalized is 'Uppercase part number with whitespace removed, used for exact indexed lookup.';
comment on column public.part_locations.location_normalized is 'Uppercase location with whitespace collapsed, used for duplicate detection and suggestions.';
