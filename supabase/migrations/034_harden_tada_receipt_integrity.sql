-- Ensure receipt item selections cannot reference an SVR from another dispatch/stage.
create or replace function public.portal_validate_tada_receipt_item()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_receipt_dispatch uuid;
  v_stage text;
  v_item_dispatch uuid;
  v_hq_received boolean;
begin
  select dispatch_id, stage into v_receipt_dispatch, v_stage
  from public.portal_tada_receipts
  where id=new.receipt_id;

  select dispatch_id, hq_received into v_item_dispatch, v_hq_received
  from public.portal_tada_svr_items
  where id=new.svr_item_id;

  if v_receipt_dispatch is null or v_item_dispatch is null then
    raise exception 'Invalid TA/DA receipt or SVR item';
  end if;
  if v_receipt_dispatch<>v_item_dispatch then
    raise exception 'SVR item belongs to another TA/DA dispatch';
  end if;
  if v_stage='ACCOUNTS' and v_hq_received is distinct from true then
    raise exception 'Only SVRs received at HQ can be acknowledged by Accounts';
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_tada_receipt_item on public.portal_tada_receipt_items;
create trigger trg_validate_tada_receipt_item
before insert or update on public.portal_tada_receipt_items
for each row execute function public.portal_validate_tada_receipt_item();
