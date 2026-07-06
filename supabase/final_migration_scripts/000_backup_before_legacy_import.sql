-- FINAL MIGRATION SCRIPT 000
-- Safe backup before importing legacy requests into portal_* tables.
-- Run this in Supabase SQL Editor BEFORE running 002_migrate_legacy_requests_to_portal.sql.
--
-- This script does not delete or modify source data.
-- It creates a separate backup schema and copies key legacy/current/portal tables into it.
-- If the backup schema already exists, the script stops to avoid overwriting an earlier backup.

-- IMPORTANT:
-- Change this schema name only if you intentionally want to create another backup set.
-- Example for a second backup: migration_backup_20260706_pre_import_v2

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'migration_backup_20260706_pre_import'
  ) THEN
    RAISE EXCEPTION 'Backup schema migration_backup_20260706_pre_import already exists. Do not overwrite it. Use a new schema name if you need another backup.';
  END IF;
END $$;

CREATE SCHEMA migration_backup_20260706_pre_import;

-- 1) Legacy live tables
CREATE TABLE migration_backup_20260706_pre_import.requests AS
SELECT * FROM public.requests;

CREATE TABLE migration_backup_20260706_pre_import.users AS
SELECT * FROM public.users;

CREATE TABLE migration_backup_20260706_pre_import.part_master AS
SELECT * FROM public.part_master;

CREATE TABLE migration_backup_20260706_pre_import.machine_master AS
SELECT * FROM public.machine_master;

-- 2) Existing inventory tables, copied only if they exist
DO $$
BEGIN
  IF to_regclass('public.inventory_current') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.inventory_current AS SELECT * FROM public.inventory_current';
  END IF;

  IF to_regclass('public.inventory_staging') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.inventory_staging AS SELECT * FROM public.inventory_staging';
  END IF;

  IF to_regclass('public.inventory_changes') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.inventory_changes AS SELECT * FROM public.inventory_changes';
  END IF;
END $$;

-- 3) Existing portal tables after schema creation, before old-history import.
-- This gives us a clean snapshot of portal_* before running script 002.
DO $$
BEGIN
  IF to_regclass('public.portal_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_profiles AS SELECT * FROM public.portal_profiles';
  END IF;

  IF to_regclass('public.portal_orders') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_orders AS SELECT * FROM public.portal_orders';
  END IF;

  IF to_regclass('public.portal_order_items') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_order_items AS SELECT * FROM public.portal_order_items';
  END IF;

  IF to_regclass('public.portal_order_item_billings') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_order_item_billings AS SELECT * FROM public.portal_order_item_billings';
  END IF;

  IF to_regclass('public.portal_order_events') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_order_events AS SELECT * FROM public.portal_order_events';
  END IF;

  IF to_regclass('public.portal_order_comments') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_order_comments AS SELECT * FROM public.portal_order_comments';
  END IF;

  IF to_regclass('public.portal_order_comment_attachments') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_order_comment_attachments AS SELECT * FROM public.portal_order_comment_attachments';
  END IF;

  IF to_regclass('public.portal_inventory_current') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_inventory_current AS SELECT * FROM public.portal_inventory_current';
  END IF;

  IF to_regclass('public.portal_inventory_staging') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_inventory_staging AS SELECT * FROM public.portal_inventory_staging';
  END IF;

  IF to_regclass('public.portal_inventory_changes') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE migration_backup_20260706_pre_import.portal_inventory_changes AS SELECT * FROM public.portal_inventory_changes';
  END IF;
END $$;
