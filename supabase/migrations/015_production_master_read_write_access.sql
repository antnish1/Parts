-- Production master access for Parts Connect Portal cutover.
-- part_master is read-only from the app.
-- machine_master is readable and allows authenticated inserts for missing machine/customer entries.

grant select on table public.part_master to authenticated;
grant select on table public.machine_master to authenticated;
grant insert on table public.machine_master to authenticated;

create policy if not exists part_master_read_authenticated
on public.part_master
for select
to authenticated
using (true);

create policy if not exists machine_master_read_authenticated
on public.machine_master
for select
to authenticated
using (true);

create policy if not exists machine_master_insert_authenticated
on public.machine_master
for insert
to authenticated
with check (true);
