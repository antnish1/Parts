# Status workflow reference

This document defines the order statuses and workflow transitions that must be preserved during the production rebuild.

The current legacy behavior in `index.html` remains the reference until the new workflow functions are implemented and tested.

## Main status values seen in current app

Current app logic references these status labels:

- `PENDING APPROVAL`
- `APPROVAL PENDING`
- `PENDING MANAGER APPROVAL`
- `APPROVED`
- `PROCESSED`
- `DISPATCHED`
- `PARTIALLY DISPATCHED`
- `PARTIALLY RECEIVED`
- `RECEIVED`
- `ISSUED`
- `NOT DESPATCHED`
- `REJECTED`

Current approval status values include:

- `PendingApproval`
- `Approved`
- `Rejected`

## Recommended normalized status model

For the rebuild, use a controlled status system internally and map it to user-facing labels.

Suggested internal values:

```txt
pending_approval
pending_manager_approval
approved
processed
dispatched
partially_dispatched
partially_received
received
issued
not_dispatched
rejected
```

Suggested display mapping:

```txt
pending_approval              -> PENDING APPROVAL
pending_manager_approval      -> PENDING MANAGER APPROVAL
approved                      -> APPROVED
processed                     -> PROCESSED
dispatched                    -> DISPATCHED
partially_dispatched          -> PARTIALLY DISPATCHED
partially_received            -> PARTIALLY RECEIVED
received                      -> RECEIVED
issued                        -> ISSUED
not_dispatched                -> NOT DESPATCHED
rejected                      -> REJECTED
```

Keep `NOT DESPATCHED` spelling if existing reports/users depend on it. If changing to `NOT DISPATCHED`, add a database/display mapping so old data still works.

## Main workflow transitions

### Branch user

Allowed actions:

1. Create order
2. View/track own branch orders
3. Add comments if allowed

Typical transition:

```txt
new order -> pending_approval
```

### Super approver

Allowed actions:

```txt
pending_approval -> approved
pending_approval -> rejected
pending_approval -> pending_manager_approval
pending_approval -> pending_approval with edited quantities
```

Super can also:

- Edit quantities
- Accept edits
- Reset edits
- Remove part rows for review
- Add approval comments

### Manager

Allowed actions:

```txt
pending_manager_approval -> approved
pending_manager_approval -> rejected
```

Manager can also:

- Review branch/order metrics
- Approve/reject orders escalated to manager
- Add comments if enabled

### Admin / HQ processing

Allowed actions:

```txt
approved -> processed
approved -> rejected
processed -> dispatched
processed -> not_dispatched
processed -> partially_dispatched
partially_dispatched -> partially_received
partially_dispatched -> received
dispatched -> received
received -> issued
```

Actual allowed transitions must be verified against the legacy app before backend enforcement.

## Audit requirements

Every workflow transition must create an `order_events` entry.

Recommended event fields:

```sql
order_events (
  id uuid primary key,
  order_id uuid references orders(id),
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references profiles(id),
  notes text,
  metadata jsonb,
  created_at timestamptz default now()
)
```

Recommended event types:

```txt
ORDER_CREATED
SUPER_APPROVED
SUPER_REJECTED
SUPER_FORWARDED_MANAGER
MANAGER_APPROVED
MANAGER_REJECTED
ADMIN_PROCESSED
ADMIN_REJECTED
STATUS_UPDATED
ORDER_DISPATCHED
ORDER_RECEIVED
ORDER_ISSUED
APPROVER_CHANGED
SUPER_REMOVED_ROW
SUPER_RESET_TO_ORIGINAL
SUPER_ACCEPTED_EDITS
COMMENT_ADDED
ATTACHMENT_ADDED
```

## Backend enforcement requirement

In the production rebuild, status transitions must not be done directly from frontend `.update()` calls.

Use Supabase RPC or Edge Functions such as:

```txt
create_order()
approve_order()
reject_order()
forward_to_manager()
manager_approve_order()
manager_reject_order()
process_order()
update_dispatch_status()
mark_order_received()
mark_order_issued()
accept_edited_quantities()
reset_edited_quantities()
remove_order_item_for_review()
```

Each function should:

1. Check authenticated user.
2. Load user profile and role.
3. Validate branch/role access.
4. Validate current order status.
5. Apply the update.
6. Insert an audit event.
7. Return the updated order summary.

## Frontend rule

Frontend role checks are only for UI visibility. Real permission checks must happen in Supabase RLS/RPC/Edge Functions.
