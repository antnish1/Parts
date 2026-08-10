# TA/DA Bill Tracking — Agent Contract

Read the repository root `AGENTS.md` first. These rules are mandatory for changes under this module.

## Purpose

This module tracks physical TA/DA bill / SVR movement and chain of custody from branch dispatch to HQ receipt and then Accounts receipt. Tracking is both batch-level and individual-SVR-level.

## Roles

- `branch`: can view TA/DA for own office and create dispatches only for own office. Office is auto-selected and locked in UI; backend also enforces own-office creation.
- `manager`: can view all TA/DA, create for any office, and record HQ receipt.
- `hq`: can view all TA/DA and create for any office. HQ is not permitted to record HQ receipt unless product requirements explicitly change.
- `developer`: can view/create for all offices and can record both HQ and Accounts receipt for support/admin purposes. Actions remain audited.
- `accounts`: TA/DA-focused role. Can view TA/DA and record Accounts receipt. Accounts must not see or directly access unrelated operational modules such as Delayed VOR or Engine & Breaker unless the user explicitly changes this requirement later.
- Other portal roles do not receive TA/DA access by default.

## Entry rules

Top section currently contains only Office.

SVR fields are:
- SVR No.
- Name of Service Engineer (predefined autocomplete from `portal_service_engineers`)
- Date From
- Date To
- No. of Days
- Machine No.
- Customer's Name

Date rules:
- entering Date From defaults Date To to the same date;
- changing No. of Days recalculates Date To inclusively;
- manually changing Date To recalculates No. of Days;
- Date To cannot be earlier than Date From.

Finalization fields:
- Date of Dispatch
- Dispatched By
- Dispatch Mode: `Bus`, `Transport`, `By Hand`
- Ref. No. for courier/bus/bilty/office vehicle/other dispatch reference. Ref. No. is required for Bus and Transport.

## Receipt rules

HQ receipt:
- only Manager or Developer;
- every eligible SVR is checked/received by default;
- receiver can uncheck individual SVRs;
- every unchecked SVR requires a reason;
- partial receipt must not hide or delete missing SVRs.

Accounts receipt:
- only Accounts or Developer;
- only SVRs received at HQ are eligible for Accounts receipt;
- all eligible SVRs default checked;
- unchecked SVRs require a reason;
- partial receipt is preserved per SVR.

## Data / audit rules

Production tables:
- `portal_service_engineers`
- `portal_tada_dispatches`
- `portal_tada_svr_items`
- `portal_tada_receipts`
- `portal_tada_receipt_items`
- `portal_tada_events`

Use `portal_branches` as the canonical Office master. Do not create a second branch list.

`portal_tada_events` is append-only audit history. Do not silently rewrite movement history.

Do not reduce the workflow to only a dispatch-level status: individual SVR location/receipt state is required for partial receipts and traceability.

Do not let frontend role checks replace backend permission checks. Receipt and creation writes are handled through security-definer RPCs with server-side role/stage validation.

## UI rules

- Main list rows are clickable; do not add redundant View buttons.
- Back on detail uses actual history (`navigate(-1)`).
- Preserve desktop and mobile usability.
- Keep missing/not-received SVRs clearly visible.
- Sidebar badges show actionable counts for Manager, Accounts, and Developer.
