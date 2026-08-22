# Part Location Finder

## Purpose

Part Location Finder is a mobile-first Parts Connect Portal module for answering one operational question quickly: **where is this part physically stored?**

The feature lives in the active React app under `app/` and reuses the portal's existing authentication, role-aware navigation, Parts Master lookup, mobile bottom navigation, and feedback conventions.

## Routes

- `/parts/location-finder` — lookup screen. Available to authenticated portal roles.
- `/parts/location-finder/manage` — location maintenance. Frontend access is restricted to Manager, Admin, and Developer roles; the backend independently enforces the same write-role rule.

## Data model

Location data is stored separately from `part_master` in `public.part_locations`.

Each active part/location relationship is one row. A part with three physical locations therefore has three rows.

Important columns:

- `part_no` — display value entered/imported for the part.
- `part_no_normalized` — uppercase part number with whitespace removed; used for exact indexed lookup.
- `location` — user-facing physical location.
- `location_normalized` — uppercase, whitespace-normalized value used for duplicate detection.
- `is_active` — locations are deactivated instead of physically deleted so history is retained.
- `created_by`, `created_at`, `updated_by`, `updated_at` — audit metadata.

A partial unique index prevents duplicate active mappings for the same normalized part number and location.

## Security

The browser does not have direct table privileges for `part_locations`. Reads and writes go through the authenticated `part-location-action` Edge Function using the service role on the server.

- Lookup and known-location suggestions require a valid Supabase Auth session.
- Add/deactivate actions also resolve the current `portal_profiles` role and allow only `manager`, `admin`, or `developer` when the profile is active.
- Role resolution supports both `auth_user_id` and the existing `legacy_user_id` portal-login fallback.

The migration and Edge Function in this branch are source changes only. They must not be deployed to production until reviewed and explicitly approved.

## Parts Master enrichment

Part description and DNP continue to use the existing `lookup-part-action` / `testPart.service.ts` backend lookup. Location lookup is independent, so a temporary Parts Master failure does not hide location results.

The UI displays `DNP` because that is the field currently established by the portal. It does not relabel DNP as MRP.

## Mobile UX

The finder is card-based rather than table-based. It provides:

- one prominent Part Number search field;
- keyboard Search support (`enterKeyHint="search"`);
- recent searches saved locally in the browser;
- description/DNP enrichment when available;
- large touch-friendly location cards;
- clear empty/error states;
- a primary mobile navigation entry for key operational roles.

The management page provides:

- part verification before location maintenance;
- current active locations;
- known-location suggestions from existing records;
- duplicate protection;
- soft removal/deactivation;
- history-aware Back navigation through `navigate(-1)`.

## Sheet3 migration preparation

The supplied workbook's `Sheet3` contains 3,072 source rows after the header and two columns: `Part No` and `Location`.

The preparation logic was validated against that sheet and produces:

- 3,674 unique normalized part/location records;
- 3,071 unique part numbers;
- 495 source rows that expand to more than one location when splitting on `&` and comma;
- 2 duplicate normalized mappings removed;
- 0 blank/invalid source rows in the supplied Sheet3.

The repository includes `app/scripts/prepare-part-location-import.cjs` to reproduce this transformation. It only reads the workbook and writes a CSV plus JSON validation report; it never connects to Supabase.

Example:

```bash
cd app
node scripts/prepare-part-location-import.cjs "/path/to/Recheck Sheet.xlsx" Sheet3 "/safe/output/folder"
```

Generated files:

- `part_locations_import.csv`
- `part_locations_import_report.json`

Because the repository is public and warehouse-location data is operational information, the supplied workbook and generated location dataset must **not** be committed to this repository. Import should be performed through an approved private/production data path only after validation.

## Deployment order when approved

1. Review the migration SQL and role rules.
2. Apply `20260822_create_part_locations.sql` to the intended Supabase environment.
3. Deploy `part-location-action`.
4. Run the Sheet3 preparation script privately and review the generated report/CSV.
5. Import the reviewed CSV through a secure non-public process.
6. Deploy the frontend branch/PR to preview and test mobile + desktop roles.
7. Merge only after workflow, permission, lookup, duplicate, and mobile regression checks pass.
