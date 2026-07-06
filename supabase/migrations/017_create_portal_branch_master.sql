-- Portal branch master mapping.
-- Branch_Code is not unique: JABALPUR BHL, JABALPUR HL, JABALPUR PARTS, and WARRANTY share DFM003.
-- The app must use branch_key as the canonical internal branch identity.

create or replace function public.normalize_portal_branch_key(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(upper(trim(coalesce(value, ''))), '[^A-Z0-9]+', '', 'g'), '')
$$;

create table if not exists public.portal_branches (
  branch_key text primary key,
  branch_name text not null,
  display_name text not null,
  inventory_branch_code text,
  head_quarter text,
  is_active boolean not null default true,
  sort_order int not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_branch_aliases (
  alias_key text primary key,
  alias_text text not null,
  branch_key text not null references public.portal_branches(branch_key) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.add_portal_branch_alias(p_branch_key text, p_alias text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias_key text;
begin
  v_alias_key := public.normalize_portal_branch_key(p_alias);
  if v_alias_key is null then
    return;
  end if;

  insert into public.portal_branch_aliases(alias_key, alias_text, branch_key)
  values (v_alias_key, trim(p_alias), p_branch_key)
  on conflict (alias_key) do update set
    alias_text = excluded.alias_text,
    branch_key = excluded.branch_key;
end;
$$;

create or replace function public.resolve_portal_branch(value text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
  v_alias_key text;
begin
  v_alias_key := public.normalize_portal_branch_key(value);
  if v_alias_key is null then
    return null;
  end if;

  select a.branch_key into v_key
  from public.portal_branch_aliases a
  join public.portal_branches b on b.branch_key = a.branch_key
  where a.alias_key = v_alias_key
    and b.is_active = true
  limit 1;

  if v_key is not null then
    return v_key;
  end if;

  select b.branch_key into v_key
  from public.portal_branches b
  where public.normalize_portal_branch_key(b.branch_key) = v_alias_key
     or public.normalize_portal_branch_key(b.branch_name) = v_alias_key
     or public.normalize_portal_branch_key(b.display_name) = v_alias_key
  limit 1;

  return v_key;
end;
$$;

insert into public.portal_branches(branch_key, branch_name, display_name, inventory_branch_code, head_quarter, sort_order, is_active)
values
  ('SEONI', 'SEONI', 'Seoni', 'DFM0013', 'SEONI', 10, true),
  ('BALAGHAT', 'BALAGHAT', 'Balaghat', 'DFM0015', 'BALAGHAT', 20, true),
  ('MANDLA', 'MANDLA', 'Mandla', 'DFM0016', 'MANDLA', 30, true),
  ('KATNI', 'KATNI', 'Katni', 'DFM0020', 'KATNI', 40, true),
  ('JABALPUR_BHL', 'JABALPUR BHL', 'Jabalpur BHL', 'DFM003', 'JABALPUR', 50, true),
  ('JABALPUR_HL', 'JABALPUR HL', 'Jabalpur HL', 'DFM003', 'JABALPUR', 60, true),
  ('JABALPUR_PARTS', 'JABALPUR PARTS', 'Jabalpur Parts', 'DFM003', 'JABALPUR', 70, true),
  ('WARRANTY', 'WARRANTY', 'Warranty', 'DFM003', 'JABALPUR', 80, true),
  ('DAMOH', 'DAMOH', 'Damoh', 'DFM0033', 'DAMOH', 90, true),
  ('ANUPPUR', 'ANUPPUR', 'Anuppur', 'DFM0034', 'ANUPPUR', 100, true),
  ('GADARWARA', 'GADARWARA', 'Gadarwara', '100000', 'GADARWARA', 110, true),
  ('DINDORI', 'DINDORI', 'Dindori', '100001', 'DINDORI', 120, true)
on conflict (branch_key) do update set
  branch_name = excluded.branch_name,
  display_name = excluded.display_name,
  inventory_branch_code = excluded.inventory_branch_code,
  head_quarter = excluded.head_quarter,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

select public.add_portal_branch_alias('SEONI', 'SEONI');
select public.add_portal_branch_alias('SEONI', 'Seoni');
select public.add_portal_branch_alias('SEONI', 'DFM0013');
select public.add_portal_branch_alias('BALAGHAT', 'BALAGHAT');
select public.add_portal_branch_alias('BALAGHAT', 'Balaghat');
select public.add_portal_branch_alias('BALAGHAT', 'DFM0015');
select public.add_portal_branch_alias('MANDLA', 'MANDLA');
select public.add_portal_branch_alias('MANDLA', 'Mandla');
select public.add_portal_branch_alias('MANDLA', 'DFM0016');
select public.add_portal_branch_alias('KATNI', 'KATNI');
select public.add_portal_branch_alias('KATNI', 'Katni');
select public.add_portal_branch_alias('KATNI', 'Katni Branch');
select public.add_portal_branch_alias('KATNI', 'DFM0020');
select public.add_portal_branch_alias('JABALPUR_BHL', 'JABALPUR BHL');
select public.add_portal_branch_alias('JABALPUR_BHL', 'Jabalpur BHL');
select public.add_portal_branch_alias('JABALPUR_BHL', 'Jabalpur_BHL');
select public.add_portal_branch_alias('JABALPUR_BHL', 'JBP BHL');
select public.add_portal_branch_alias('JABALPUR_BHL', 'JBP_BHL');
select public.add_portal_branch_alias('JABALPUR_BHL', 'BHL');
select public.add_portal_branch_alias('JABALPUR_HL', 'JABALPUR HL');
select public.add_portal_branch_alias('JABALPUR_HL', 'Jabalpur HL');
select public.add_portal_branch_alias('JABALPUR_HL', 'Jabalpur_HL');
select public.add_portal_branch_alias('JABALPUR_HL', 'JBP HL');
select public.add_portal_branch_alias('JABALPUR_HL', 'JBP_HL');
select public.add_portal_branch_alias('JABALPUR_HL', 'HL');
select public.add_portal_branch_alias('JABALPUR_PARTS', 'JABALPUR PARTS');
select public.add_portal_branch_alias('JABALPUR_PARTS', 'Jabalpur Parts');
select public.add_portal_branch_alias('JABALPUR_PARTS', 'Jabalpur_Parts');
select public.add_portal_branch_alias('JABALPUR_PARTS', 'JBP PARTS');
select public.add_portal_branch_alias('JABALPUR_PARTS', 'PARTS');
select public.add_portal_branch_alias('WARRANTY', 'WARRANTY');
select public.add_portal_branch_alias('WARRANTY', 'Warranty');
select public.add_portal_branch_alias('WARRANTY', 'Jabalpur Warranty');
select public.add_portal_branch_alias('DAMOH', 'DAMOH');
select public.add_portal_branch_alias('DAMOH', 'Damoh');
select public.add_portal_branch_alias('DAMOH', 'Damoh Branch');
select public.add_portal_branch_alias('DAMOH', 'DFM0033');
select public.add_portal_branch_alias('ANUPPUR', 'ANUPPUR');
select public.add_portal_branch_alias('ANUPPUR', 'Anuppur');
select public.add_portal_branch_alias('ANUPPUR', 'DFM0034');
select public.add_portal_branch_alias('GADARWARA', 'GADARWARA');
select public.add_portal_branch_alias('GADARWARA', 'Gadarwara');
select public.add_portal_branch_alias('GADARWARA', '100000');
select public.add_portal_branch_alias('DINDORI', 'DINDORI');
select public.add_portal_branch_alias('DINDORI', 'Dindori');
select public.add_portal_branch_alias('DINDORI', '100001');

-- Do not map DFM003 as an alias because it belongs to multiple Jabalpur branches.

update public.portal_profiles p
set branch = resolved.branch_key,
    updated_at = now()
from (
  select id, public.resolve_portal_branch(branch) as branch_key
  from public.portal_profiles
) resolved
where resolved.id = p.id
  and resolved.branch_key is not null
  and p.branch is distinct from resolved.branch_key;

update public.portal_orders o
set branch = resolved.branch_key,
    updated_at = now()
from (
  select id, public.resolve_portal_branch(branch) as branch_key
  from public.portal_orders
) resolved
where resolved.id = o.id
  and resolved.branch_key is not null
  and o.branch is distinct from resolved.branch_key;

alter table public.portal_inventory_staging add column if not exists branch_key text;
alter table public.portal_inventory_current add column if not exists branch_key text;
alter table public.portal_inventory_changes add column if not exists branch_key text;

update public.portal_inventory_staging
set branch_key = coalesce(public.resolve_portal_branch(branch_name), public.resolve_portal_branch(branch_code))
where branch_key is null;

update public.portal_inventory_current
set branch_key = coalesce(public.resolve_portal_branch(branch_name), public.resolve_portal_branch(branch_code))
where branch_key is null;

update public.portal_inventory_changes
set branch_key = coalesce(public.resolve_portal_branch(branch_name), public.resolve_portal_branch(branch_code))
where branch_key is null;

-- Existing imports can contain duplicate inventory rows after resolving branch aliases.
-- Keep the latest row per canonical branch + item, then create the uniqueness guard.
with ranked_inventory as (
  select
    id,
    row_number() over (
      partition by branch_key, item_code
      order by report_date desc nulls last, updated_at desc nulls last, id desc
    ) as rn
  from public.portal_inventory_current
  where branch_key is not null
    and nullif(trim(item_code), '') is not null
)
delete from public.portal_inventory_current c
using ranked_inventory r
where c.id = r.id
  and r.rn > 1;

-- The old branch_code/item_code uniqueness cannot represent JABALPUR BHL vs HL vs PARTS because all use DFM003.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'portal_inventory_current_branch_code_item_code_key'
      and conrelid = 'public.portal_inventory_current'::regclass
  ) then
    alter table public.portal_inventory_current drop constraint portal_inventory_current_branch_code_item_code_key;
  end if;
end $$;

drop index if exists public.uq_portal_inventory_current_branch_key_item;
create unique index if not exists uq_portal_inventory_current_branch_key_item
on public.portal_inventory_current(branch_key, item_code);

create index if not exists idx_portal_profiles_branch_key on public.portal_profiles(branch);
create index if not exists idx_portal_orders_branch_key on public.portal_orders(branch);
create index if not exists idx_portal_inventory_current_branch_key on public.portal_inventory_current(branch_key);

grant select on public.portal_branches to authenticated;
grant select on public.portal_branch_aliases to authenticated;
grant execute on function public.resolve_portal_branch(text) to authenticated;
grant execute on function public.normalize_portal_branch_key(text) to authenticated;
