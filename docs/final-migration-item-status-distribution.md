# Final Migration - Portal Item Status Distribution

Recorded after importing legacy `public.requests` history into `portal_*` tables.

| portal_item_status | row_count |
| --- | ---: |
| received | 1413 |
| pending_approval | 805 |
| processed | 483 |
| rejected | 454 |
| dispatched | 313 |
| issued | 52 |
| partially_dispatched | 47 |

Total item rows: 3567.

Result: item status distribution matches imported item count.

Business meaning:

- `received` = part received into store.
- `issued` = part issued to customer after receiving; later stage than received.
- `rejected` = closed/rejected.
- `received`, `issued`, and `rejected` must not be counted as active or in-transit.

Pending before code cutover:

1. Missing legacy rows after import must return zero rows.
2. Imported portal items without matching legacy request must return zero rows.
