# Dealer Price List Upload

## Purpose

The monthly Dealer Price List is the authoritative source for the production `public.part_master` used by backend part lookup. The frontend uploader lives inside `/uploads` and is visible only to active `admin` and `developer` profiles.

## Expected Excel columns

`Material | Description | DNP | RTL | MRP | HSN | GST | Cat 1 | Cat 2`

Part numbers are normalized exactly as the portal lookup flow expects: trim, remove whitespace, uppercase.

## Safety model

The uploader does **not** stream changes into `part_master` while the file is being uploaded.

1. Parse and validate the Excel file in the browser.
2. Start an authenticated upload session.
3. Stage validated rows in chunks of 2,000.
4. Compare the full staged snapshot against the current `part_master`.
5. Show new / changed / unchanged / removed counts and sample rows.
6. Require an explicit Publish confirmation.
7. Publish in one PostgreSQL transaction while keeping normal SELECT lookups available.
8. Save the published snapshot in `portal_part_master_history`.

If parsing, staging, preview, or publication fails before commit, the previously active `part_master` remains the operational source.

## Database objects

- `public.part_master` — current active master. Existing columns remain; uploader adds nullable `HSN`, `GST`, `Cat2`, and `PartNoNormalized`.
- `public.portal_part_master_uploads` — upload/audit metadata.
- `public.portal_part_master_staging` — temporary validated rows.
- `public.portal_part_master_history` — immutable published snapshots by upload/month.

RPCs:

- `portal_start_part_master_upload`
- `portal_stage_part_master_chunk`
- `portal_preview_part_master_upload`
- `portal_publish_part_master_upload`
- `portal_discard_part_master_upload`
- `portal_list_part_master_uploads`

All write/read management RPCs validate the signed-in profile server-side and allow only active `admin` or `developer` users. Staging/history tables are not directly exposed to authenticated clients.

## Publish semantics

Each uploaded Dealer Price List is treated as a **complete snapshot**, not a patch. Parts missing from the staged snapshot are shown as `Removed` during preview and are removed from the active master only after the user confirms Publish.

The publication transaction:

- blocks competing writes to `part_master` but allows normal reads;
- resolves legacy duplicate normalized part numbers;
- updates existing parts;
- inserts new parts;
- removes parts absent from the new complete snapshot;
- writes the published snapshot to history;
- marks the upload as published.

## Safety blocks

Publishing is blocked when:

- staged count does not match the validated row count;
- invalid/duplicate rows were reported by validation;
- the staged file contains less than 50% of the currently active part count when the current master has at least 1,000 parts.

A non-zero Removed count is shown as a warning but is not automatically blocked because a genuine monthly complete snapshot may intentionally remove parts.
