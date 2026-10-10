-- Parts Connect Portal: additive, idempotent master-data entries.
-- Apply only after review. Production database is not changed by this PR.
-- Reversal: delete these exact rows only after confirming they have not been used
-- in orders, dispatches, or subsequent business workflows.

insert into public.portal_service_engineers (branch_key, engineer_name, is_active)
select 'SEONI', 'TUSHAR PATLE', true
where not exists (
  select 1 from public.portal_service_engineers
  where branch_key = 'SEONI' and upper(trim(engineer_name)) = 'TUSHAR PATLE'
);

-- SAP screenshot displays an inventory valuation price of 5,283 INR, NOT
-- a verified Dealer Net Price. Keep DNP/RTL/MRP NULL until pricing is confirmed.
insert into public.part_master ("PartNo", "Description", "PartNoNormalized")
select '448/15701', 'DRIVEHEADADCASING', '448/15701'
where not exists (
  select 1 from public.part_master where upper(trim("PartNo")) = '448/15701'
);
