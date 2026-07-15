create table if not exists public.portal_sales_employees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_sales_employees_name_not_blank check (length(btrim(name)) > 0)
);

alter table public.portal_sales_employees enable row level security;

create policy "authenticated users can read sales employees"
on public.portal_sales_employees
for select
to authenticated
using (is_active = true);

create policy "authenticated users can add sales employees"
on public.portal_sales_employees
for insert
to authenticated
with check (auth.uid() is not null);

insert into public.portal_sales_employees (name)
values
  ('RAVI CHAURASIYA'),
  ('JEETESH VISHWAKARMA'),
  ('SANTRAM PANCHESHWAR'),
  ('ROHIT SHRIVASTAVA'),
  ('KOUSHAL VISHWAKARMA'),
  ('DHARMENDRA PRAJAPATI'),
  ('VIJAY KHAIRWAR'),
  ('SHIVAM CHOUDHARY'),
  ('MAHENDRA KUSHWAHA'),
  ('RAMANUJ YADAV'),
  ('BRAJENDRA KUMAR JOGI'),
  ('LEKHRAM MANESHWAR'),
  ('KISHOR BISEN'),
  ('SHISHUPAL BISEN'),
  ('MOHIT PATLE'),
  ('SHIV PRASAD RAUT'),
  ('AMAN GANVEER'),
  ('SURESH BANOTE'),
  ('PRADEEP DWIVEDI'),
  ('LOVEKESH RAI'),
  ('LAVKUSH MISHRA'),
  ('KAUSHAL KISHOR VISHWAKARMA'),
  ('BALJI SINGH PARIHAR'),
  ('ANUJ DUBEY'),
  ('PAWAN PATEL'),
  ('ADITYA TILAK'),
  ('ANIL DEHARIYA'),
  ('ANKIT VISHWAKARMA'),
  ('ABHISHEK KANOJIYA'),
  ('BRAJESH PATEL'),
  ('DEEPAK NAMDEO'),
  ('JAIVEER SAINI'),
  ('PIYUSH PATEL'),
  ('PRAKASH SHRIVAS'),
  ('RAHUL JOUNJARD'),
  ('SACHIN NAMDEO'),
  ('RAJESH BAIN'),
  ('SAT SINGH PAL'),
  ('SOURABH SEN'),
  ('TUSHAR THAPA'),
  ('VIMAL GOTIYA'),
  ('PRADEEP SEN'),
  ('SHYAM SHIVVEDI'),
  ('RAHUL DHAWAN'),
  ('DEVENDRA DIWAN'),
  ('NITESH RAGHUVANSHI'),
  ('JITENDRA SONI'),
  ('HARI SHANKAR MALVIYA'),
  ('PUNEET YADAV'),
  ('RAKESH YADAV'),
  ('MO. REZWAN'),
  ('DURGESH PAWAR'),
  ('RAJESH GUPTA'),
  ('PAWAN UPADHYAY'),
  ('VIKESH RAHANGDALE'),
  ('SUBHASH PRAJAPATI'),
  ('LALIT THAKRE'),
  ('DHARMENDRA CHOUDHARY'),
  ('SHOBHIT LAKHERA'),
  ('MD TOUSEEF AHMED'),
  ('SUNIL NAGRIKAR'),
  ('IBRAN KHAN'),
  ('SAURAV BAGHEL'),
  ('DUSHYANT RINAYAT'),
  ('SUKANTA KUMAR DAS'),
  ('ANKIT DAS'),
  ('AVINASH KUMAR THAKUR')
on conflict (name) do update set is_active = true, updated_at = now();
