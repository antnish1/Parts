# Performance Patch

This patch reduces slow portal page loads after the portal table cutover.

Changes:

- Order list reads only recent portal order headers.
- Approval queue reads only pending approval orders.
- Order detail skips the expensive cross-order in-transit lookup during initial load.
- Additional SQL indexes were added in script 009.
