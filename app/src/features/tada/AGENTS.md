# TA/DA Bill Tracking — Agent Contract

Read the repository root `AGENTS.md` first. These rules are mandatory for changes under this module.

## Purpose

This module tracks physical TA/DA bill / SVR movement and chain of custody from branch dispatch to HQ receipt and then Accounts receipt. Tracking is both batch-level and individual-SVR-level.

## Roles

- `branch`: can view TA/DA for own office and create dispatches only for own office. Office is auto-selected and locked in UI; backend also enforces own-office creation.
- `manager`: can view all TA/DA, create for any office, and record HQ receipt.
- `hq`: can view all TA/DA and create for any office. HQ is not permitted to record HQ receipt unless product requirements explicitly change.
- `developer`: can view/create for all offices, record both HQ and Accounts receipt, edit dispatch/SVR business details at any stage, delete an individual SVR, or delete a complete TA/DA dispatch. Developer overrides require a reason, are enforced server-side, and are permanently audited outside deletable workflow rows. Developer edits must not directly rewrite custody/status flags.
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
- `portal_developer_override_audit` for permanent developer edit/delete snapshots

Use `portal_branches` as the canonical Office master. Do not create a second branch list.

`portal_tada_events` is normal append-only movement history. Developer destructive overrides must additionally write to `portal_developer_override_audit` before deleting rows, because normal TA/DA events may cascade when their parent dispatch/SVR is deleted.

Developer override rules:
- every edit/delete requires an explicit reason;
- backend RPCs must verify the authenticated active role is exactly `developer`;
- editing can change dispatch metadata and SVR business fields at any stage, but must not directly alter `status`, `current_location`, receipt booleans, receipt exceptions, or receipt actor/timestamps;
- deleting one SVR must leave at least one SVR in the dispatch and must recalculate batch totals, receipt counts and derived batch status;
- deleting the entire list removes the live dispatch and descendants only after a permanent audit snapshot is written.

Do not reduce the workflow to only a dispatch-level status: individual SVR location/receipt state is required for partial receipts and traceability.

Do not let frontend role checks replace backend permission checks. Receipt, creation and developer override writes are handled through security-definer RPCs with server-side role/stage validation.

## UI rules

- Main list rows are clickable; do not add redundant View buttons.
- Back on detail uses actual history (`navigate(-1)`).
- Preserve desktop and mobile usability.
- Keep missing/not-received SVRs clearly visible.
- Sidebar badges show actionable counts for Manager, Accounts, and Developer.
- TA/DA status and physical-location stages use a consistent professional color language and subtle badges; do not make informational badges look like primary action buttons.
- KPI cards on the tracking page are interactive filters on both desktop and mobile. Tapping the active KPI again clears that filter.
- Role-actionable KPI cards must be ordered first: Accounts prioritizes Awaiting/Partial Accounts; Manager prioritizes Awaiting/Partial HQ.
- Mobile is a first-class workflow surface because Accounts is expected to work primarily on phones. Do not simply shrink desktop tables.
- Tracking lists use compact mobile cards; desktop may use tables.
- Dispatch detail mobile summary uses dense multi-column metadata rather than one label/value per full row.
- Receipt rows must show SVR, engineer, machine and customer compactly without forcing excessive vertical scrolling. Exception fields expand only for unchecked/not-received items.
- The active receipt/submit action should remain easy to reach on mobile (sticky action area is acceptable) without obscuring content.
- Traceability remains available but may be collapsed by default to protect mobile vertical space.
- Developer override controls must be visually separated as a privileged/danger area and remain hidden for all non-developer roles.
