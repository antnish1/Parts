# Role permissions reference

This document defines the access model that must be preserved and hardened during the production rebuild.

The current frontend role checks must be treated as UI hints only. In the rebuilt app, Supabase RLS, RPC, or Edge Functions must enforce the real permissions.

## Roles

Recommended normalized roles:

```txt
branch
admin
super
manager
viewer
developer
```

## Role summary

| Role | Purpose |
|---|---|
| branch | Normal branch user who creates and tracks branch orders |
| admin | HQ/Admin user who processes approved orders |
| super | Approval user who approves/rejects/forwards orders |
| manager | Manager user with dashboard and manager approval access |
| viewer | Read-only tracking/reporting access |
| developer | Technical/admin workspace access for maintenance |

## Branch user

Allowed:

- Login and view own branch workspace
- Create new orders
- Add multiple parts to order
- Track own branch orders
- Search/filter own branch orders
- View order details for own branch
- Add comments if enabled

Not allowed:

- View other branch orders
- Approve orders
- Process orders
- Change admin statuses
- Access developer tools
- Upload global inventory unless explicitly assigned

## Admin

Allowed:

- View approved orders queue
- Process approved orders
- Reject approved orders where allowed
- Update billed quantity
- Update processed date
- Update processed value/status
- View tracking data required for processing
- Use report views assigned to admin

Not allowed unless separately granted:

- Developer maintenance tools
- Direct database edits
- Bypassing approval workflow

## Super approver

Allowed:

- View pending approval orders
- Approve orders
- Reject orders
- Forward orders to manager approval
- Edit quantities during approval review
- Accept/reset edited quantities
- Remove order rows for review
- Add approval comments
- View approval history

Not allowed unless separately granted:

- Admin processing after approval
- Developer maintenance tools
- Inventory upload unless assigned

## Manager

Allowed:

- View manager dashboard
- View branch/status/value summaries
- Use date/branch/status filters
- View manager approval queue
- Approve/reject manager approval orders
- View inventory lookup/summaries
- Add comments if enabled

Not allowed unless separately granted:

- Direct developer workspace
- Direct database edits
- Bypassing audit logs

## Viewer

Allowed:

- Read-only tracking access
- Search/filter orders according to assigned visibility
- View order details
- View reports if assigned

Not allowed:

- Create orders
- Approve orders
- Reject orders
- Process orders
- Upload inventory
- Edit quantities
- Access developer tools

## Developer

Allowed:

- Access developer workspace
- View support/debug tools
- Access user/request maintenance tools as explicitly built
- View broader system data for troubleshooting
- Use protected operational tools

Requirements:

- Every developer action must be audited.
- Developer role must not depend only on localStorage/frontend checks.
- Developer tools should be separated from normal business workflows.

## RLS policy direction

### profiles

- Users can read their own profile.
- Admin/developer can read active profiles as needed.
- Only admin/developer service workflow can update roles.

### orders

- Branch users can read orders where `orders.branch = profile.branch`.
- Branch users can create orders only for their own branch.
- Admin/super/manager/viewer/developer visibility depends on role.
- Status changes should happen through RPC/Edge Functions.

### order_items

- Access should follow parent order visibility.
- Edits should be restricted by status and role.

### order_events

- Users can read events for orders they can view.
- Inserts should be created by backend workflow functions.
- Users should not manually edit event history.

### order_comments

- Users can read comments for orders they can view.
- Users can add comments only for orders they can view and where comments are allowed.
- Users should not edit/delete other users' comments unless admin/developer policy allows it.

### inventory

- Branch users can read inventory only relevant to their branch if enabled.
- Manager/admin/developer can read broader inventory depending on business rules.
- Upload/write access should be limited to admin/developer or assigned inventory users.

## Implementation rule

Frontend components can hide or show buttons by role, but every write action must be protected by database policies or backend function checks.
