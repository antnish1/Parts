# Parts Connect Portal — Handover Notes

Generated: 2026-07-05
Repository: `antnish1/Parts`
Branch: `main`

Use this file at the start of a fresh ChatGPT session to continue work without losing context.

---

## 1. Project Overview

Parts Connect Portal is a React + Supabase web app for branch users, approval users, admin users, managers, and developer users. It is moving from development/staging tables toward production master data.

The main active frontend app is under:

```text
app/
```

The old root `index.html` is reference/legacy only unless explicitly requested.

---

## 2. Current Production Cutover Direction

The user has clearly instructed that development-only connector tables should be removed where real production tables are now required.

### Production master tables now connected

Parts lookup/search now uses only:

```text
public.part_master
```

Machine lookup/search now uses only:

```text
public.machine_master
```

Machine/customer entries should be written into `machine_master` when a customer order is submitted and the machine number was not found, provided the user enters the customer name through the popup.

### Development tables still used for app workflow

Some workflow tables are still staging/test tables and have not yet been fully migrated unless requested:

```text
test_orders
test_order_items
test_order_events
test_order_comments
test_order_comment_attachments
test_profiles
test_branch_mapping
test_inventory_*
```

Do not switch these to live tables unless the user explicitly asks.

---

## 3. Important Production Safety Rules

Avoid modifying production/live Supabase tables unless the user explicitly asks. The user has now explicitly asked for read access to `part_master` and read/write insert access to `machine_master` for missing machine/customer data.

Still be careful with these live tables:

```text
requests
users
part_master
branch_mapping
inventory_current
inventory_staging
inventory_changes
machine_master
```

Current approved live usage:

```text
part_master: read/search only
machine_master: read/search + insert missing machine/customer during order creation
```

---

## 4. Recent Key Commits / Work Completed

### Production master table connection

- `aa2c5149403a05e99da1a2200f6b8f9574d52b8a` — `app/src/services/testPart.service.ts` now loads only from `part_master`; `test_part_master` removed from that service.
- `f1d9904073cc7e85ce562114aa8b1a058b4e259b` — `app/src/services/testMachine.service.ts` now searches only `machine_master`; `test_machine_master` removed from that service.
- `9292bdac0488f40f3f5081f7d46708f27b7ce22a` — `saveTestMachineCustomer()` now inserts into `machine_master`.
- `d60b2e435a6b8c73ecfc8c4cdbd7c83f181f3c66` — `supabase/functions/create-order-action/index.ts` now saves missing machine/customer into `machine_master` before creating a customer order.
- `0f21e64b5d8ec9d756a15289a56f2474c3bb6fd7` and `b55eff2a6ed58cc3d48383a76a7bd22076f2fd5a` — migration for production master access was created and then syntax fixed.

### Customer name / description behavior

- `008925583a305f02d52ff2bbe01e5ee348e063c1` — New Order customer name and part description are read-only. If machine is not found, a popup asks for customer name manually.

Expected behavior:

1. User enters Machine Number.
2. App searches `machine_master`.
3. If found, `customerName` is filled automatically and remains read-only.
4. If not found, popup asks for customer name.
5. Popup value fills the read-only customer field.
6. On order submit, `create-order-action` saves missing machine/customer into `machine_master`.

### Loader and duplicate popup fixes

- `e9155a0609356b367bb8a095102f33c005f24390` — global UI effects no longer show success/error popups, preventing duplicate dark/light popups.
- `95e02414a02256bb09dcc72b9fa925acc732bbbe` — Submit Order loader starts immediately on click.
- `cc1a8ca8c26ce228a61f8d36871b18050fbaa48f` — fixed loader state declaration order.
- `553cb238073b339ffcff4c0984bc8821ebdafd8b` — removed duplicate generic New Order success popup; New Order keeps only Order Placed summary on success.

### UI compacting and button contrast

- `f6ac679f9d4b04383ac0d26faa8945cbc2d6236c` — compact New Order screen styling via `app/src/index.css`.
- `f49c293a0e70a7777465a62182fdedebe11a4844` — Machine Type dropdown visually patched to U/W and B/W.
- `49e8522d410a135bd9ade64c031345e854a202aa` — Sign Out button made red/white for contrast.
- `a16d30231e50cf159680d94c7fe52f527b07758a` — Bulk Parts Upload button made dark navy/yellow for contrast.

### Header/search/layout

- Universal search exists in `AppLayout.tsx` and routes to `/orders/track?q=...`.
- Track Orders reads `q` and filters automatically.
- Logo/header/sidebar layout was adjusted earlier: profile details moved to top of sidebar, brand logo/name kept in main top-left header.

### User/profile management

- User ID login support exists using internal email alias format:

```text
USERID@portal.local
```

Example: user enters `DAMOH01`; app signs in with `damoh01@portal.local`.

- `create-portal-user` Edge Function creates Supabase Auth user + `test_profiles` row.
- `update-portal-user` Edge Function was added for secure profile editing because direct frontend updates to `test_profiles` are blocked by RLS.
- If profile edits do not work, ensure this is deployed:

```bash
supabase functions deploy update-portal-user
```

---

## 5. Important Files

### New Order page

```text
app/src/features/orders/NewOrderPage.tsx
```

Key logic:

- Uses `getTestParts()` but that service now reads production `part_master`.
- Uses `getTestMachineByNo()` but that service now reads production `machine_master`.
- Customer name is read-only.
- Description is read-only.
- Missing machine opens manual customer popup.
- Submit loader should start immediately using `submitStarted || mutation.isPending`.

### Part master service

```text
app/src/services/testPart.service.ts
```

Despite the name, this now reads only:

```text
part_master
```

It maps common column names like:

```text
part_no, part number, material, Material No
Description, material_description
DNP, RTL, New RTL, price
Cat1, Cat2
```

### Machine master service

```text
app/src/services/testMachine.service.ts
```

Despite the name, this now reads only:

```text
machine_master
```

It searches common machine/customer column names and inserts using:

```ts
{ machine_no: normalized, customer_name: customer }
```

If actual production columns differ, update this mapping and the Edge Function insert.

### Create order Edge Function

```text
supabase/functions/create-order-action/index.ts
```

Currently still writes orders into staging workflow tables:

```text
test_orders
test_order_items
test_order_events
```

But before order creation, it calls `saveMissingMachine()` to insert missing machine/customer into production `machine_master`.

### Production access migration

```text
supabase/migrations/015_production_master_read_write_access.sql
```

Grants:

```sql
grant select on table public.part_master to authenticated;
grant select on table public.machine_master to authenticated;
grant insert on table public.machine_master to authenticated;
```

And creates RLS policies for authenticated select/insert.

### Global UI effects

```text
app/src/components/ui/GlobalStatusEffects.tsx
```

Now only handles loader effects and old Machine Type dropdown patch. It no longer opens success/error feedback modals.

### Feedback modal and loaders

```text
app/src/components/ui/FeedbackModal.tsx
```

Contains reusable:

```ts
FeedbackModal
ActionLoader
InlineLoader
ButtonLoader
```

Loader variants:

```text
orbit
scanner
comet
matrix
pulse
```

---

## 6. Required Deploy Commands After Recent Changes

Run these after pulling latest `main`:

```bash
supabase db push
supabase functions deploy create-order-action
```

Then redeploy frontend, for example Vercel/manual host deploy.

After deployment, hard refresh browser.

---

## 7. Known Caveats / Things to Check

### Production table column names

Current code assumes `machine_master` has these insert columns:

```text
machine_no
customer_name
```

If Supabase errors with missing column, inspect the real table columns and adjust:

- `app/src/services/testMachine.service.ts`
- `supabase/functions/create-order-action/index.ts`
- `supabase/migrations/015_production_master_read_write_access.sql` only if policy/table permissions change

Current part service is flexible for reading many possible part column names, but if `part_master` has unusual names, adjust `mapPartMasterRow()`.

### The service names are still `testPart` and `testMachine`

This is only a naming issue. Their current logic points to production tables. Rename later only if desired, but be careful with imports.

### Orders still use `TEST-...` order number and `test_orders`

Current `create-order-action` still generates:

```ts
TEST-${Date.now()}-${random}
```

Do not switch to live order tables unless the user explicitly asks.

### `GlobalStatusEffects` still patches Machine Type dropdown

New Order now has U/W and B/W directly, but `GlobalStatusEffects` still keeps the older runtime patch for safety. It can be removed later once all old dropdown code is gone.

### Duplicate popups

The global success/error scanner was removed to stop duplicate popups. If duplicate popups appear again, search for multiple `FeedbackModal message={...}` usages or any reintroduced global status scanner.

---

## 8. Current User Preferences / UI Direction

- User wants compact professional screens, minimal vertical waste.
- Light background is acceptable but text/background contrast must be strong.
- Section backgrounds can be subtly different.
- Important action buttons must be visually distinct:
  - Sign Out: red/white.
  - Bulk Parts Upload: dark navy/yellow.
- New Order top should show only small `New Order`, not large PageCard style heading/description. CSS currently hides extra PageCard text on New Order.
- Machine Type should be only:

```text
U/W
B/W
```

- Customer Name and Part Description must be read-only.
- If machine not found, ask customer name in popup, not in the main field.

---

## 9. Fresh Chat Startup Prompt

Paste this in a new chat if needed:

```text
@GitHub Please read docs/Parts_Connect_Portal_Handover.md in repo antnish1/Parts first. Continue from that state. Do not modify live production tables unless I explicitly approve. We are currently moving master lookups to production part_master and machine_master while order workflow still uses test_orders/test_order_items unless I say otherwise.
```

---

## 10. Suggested Next Checks

1. Confirm `part_master` loads parts in New Order part selector.
2. Confirm existing machine number fills Customer Name read-only.
3. Confirm missing machine opens customer popup.
4. Submit customer order with missing machine and verify `machine_master` gets a new row.
5. Confirm Submit Order loader appears immediately.
6. Confirm only one success UI appears after order creation.
7. Confirm RLS migration `015` runs successfully in Supabase.

---

## 11. If Something Breaks

### If part list is empty

Check `part_master` RLS/policy and column mapping in:

```text
app/src/services/testPart.service.ts
```

### If machine search never finds a machine

Check `machine_master` column names and mapping in:

```text
app/src/services/testMachine.service.ts
```

### If missing machine does not save

Check:

```text
supabase db push
supabase functions deploy create-order-action
```

Then check whether `machine_master` has columns exactly:

```text
machine_no
customer_name
```

### If order creation fails after adding machine save

The error may come from `machine_master` insert. Temporarily inspect the error from the popup and update `saveMissingMachine()` in `create-order-action`.
