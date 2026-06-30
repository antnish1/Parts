-- Safe seed data for Parts Connect Portal rebuild testing.
-- This file inserts only into test_ tables.
-- It does not touch live tables.

insert into public.test_branch_mapping (branch_name, branch_code, is_active)
values
  ('Jabalpur BHL', 'JBP_BHL', true),
  ('Jabalpur HL', 'JBP_HL', true),
  ('Katni', 'KATNI', true),
  ('Damoh', 'DAMOH', true),
  ('Seoni', 'SEONI', true)
on conflict (branch_code) do nothing;

insert into public.test_profiles (full_name, branch, role, is_active)
values
  ('Test Developer', 'HQ', 'developer', true),
  ('Test Admin', 'HQ', 'admin', true),
  ('Test Manager', 'HQ', 'manager', true),
  ('Test Super Approver', 'HQ', 'super', true),
  ('Test Branch User', 'Jabalpur BHL', 'branch', true),
  ('Test Viewer', 'HQ', 'viewer', true);

insert into public.test_part_master (part_no, description, dnp, cat1, cat2, is_active)
values
  ('400/35820', 'FILTER ELEMENT', 182.00, 'FILTER', 'SERVICE', true),
  ('320/04133', 'ENGINE OIL FILTER', 540.00, 'FILTER', 'ENGINE', true),
  ('333/Y7036', 'HYDRAULIC HOSE', 1250.00, 'HOSE', 'HYDRAULIC', true),
  ('701/80317', 'RELAY 12V', 320.00, 'ELECTRICAL', 'RELAY', true),
  ('332/C1063', 'SEAL KIT', 890.00, 'SEAL', 'HYDRAULIC', true)
on conflict (part_no) do nothing;

insert into public.test_orders (
  order_no,
  branch,
  order_type,
  order_for,
  machine_no,
  customer_name,
  call_id,
  warranty_status,
  status,
  approval_status,
  created_at
)
values
  ('TEST-100001', 'Jabalpur BHL', 'VOR', 'Customer', 'JCB3DX001', 'Demo Customer One', 'CALL-001', 'Warranty', 'pending_approval', 'pending', now() - interval '5 days'),
  ('TEST-100002', 'Katni', 'SOP', 'Stock', null, 'Stock Order', null, 'NA', 'approved', 'approved', now() - interval '4 days'),
  ('TEST-100003', 'Damoh', 'VOR', 'Customer', 'JCB3DX003', 'Demo Customer Three', 'CALL-003', 'Paid', 'processed', 'approved', now() - interval '3 days'),
  ('TEST-100004', 'Seoni', 'ZSPL', 'Customer', 'JCB3DX004', 'Demo Customer Four', 'CALL-004', 'Warranty', 'rejected', 'rejected', now() - interval '2 days'),
  ('TEST-100005', 'Jabalpur HL', 'ZMAC', 'Stock', null, 'Stock Order', null, 'NA', 'pending_manager_approval', 'pending', now() - interval '1 day')
on conflict (order_no) do nothing;

insert into public.test_order_items (order_id, part_no, description, dnp, qty, value, previous_30d_qty)
select o.id, '400/35820', 'FILTER ELEMENT', 182.00, 2, 364.00, 1
from public.test_orders o where o.order_no = 'TEST-100001'
and not exists (select 1 from public.test_order_items i where i.order_id = o.id and i.part_no = '400/35820');

insert into public.test_order_items (order_id, part_no, description, dnp, qty, value, previous_30d_qty)
select o.id, '320/04133', 'ENGINE OIL FILTER', 540.00, 1, 540.00, 0
from public.test_orders o where o.order_no = 'TEST-100002'
and not exists (select 1 from public.test_order_items i where i.order_id = o.id and i.part_no = '320/04133');

insert into public.test_order_items (order_id, part_no, description, dnp, qty, value, previous_30d_qty)
select o.id, '333/Y7036', 'HYDRAULIC HOSE', 1250.00, 1, 1250.00, 2
from public.test_orders o where o.order_no = 'TEST-100003'
and not exists (select 1 from public.test_order_items i where i.order_id = o.id and i.part_no = '333/Y7036');

insert into public.test_order_items (order_id, part_no, description, dnp, qty, value, previous_30d_qty)
select o.id, '701/80317', 'RELAY 12V', 320.00, 3, 960.00, 0
from public.test_orders o where o.order_no = 'TEST-100004'
and not exists (select 1 from public.test_order_items i where i.order_id = o.id and i.part_no = '701/80317');

insert into public.test_order_items (order_id, part_no, description, dnp, qty, value, previous_30d_qty)
select o.id, '332/C1063', 'SEAL KIT', 890.00, 2, 1780.00, 1
from public.test_orders o where o.order_no = 'TEST-100005'
and not exists (select 1 from public.test_order_items i where i.order_id = o.id and i.part_no = '332/C1063');

insert into public.test_inventory_current (report_date, branch_code, item_code, item_name, item_group, uom, dnp, qty, inv_value)
values
  (current_date, 'JBP_BHL', '400/35820', 'FILTER ELEMENT', 'FILTER', 'NOS', 182.00, 8, 1456.00),
  (current_date, 'JBP_HL', '332/C1063', 'SEAL KIT', 'SEAL', 'NOS', 890.00, 4, 3560.00),
  (current_date, 'KATNI', '320/04133', 'ENGINE OIL FILTER', 'FILTER', 'NOS', 540.00, 6, 3240.00),
  (current_date, 'DAMOH', '333/Y7036', 'HYDRAULIC HOSE', 'HOSE', 'NOS', 1250.00, 2, 2500.00),
  (current_date, 'SEONI', '701/80317', 'RELAY 12V', 'ELECTRICAL', 'NOS', 320.00, 10, 3200.00)
on conflict (branch_code, item_code) do update set
  report_date = excluded.report_date,
  item_name = excluded.item_name,
  item_group = excluded.item_group,
  uom = excluded.uom,
  dnp = excluded.dnp,
  qty = excluded.qty,
  inv_value = excluded.inv_value,
  updated_at = now();
