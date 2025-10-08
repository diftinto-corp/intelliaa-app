-- =====================================================================
-- Rollback Migration: Remove Assistant Status Tracking (INT-32)
-- Description: Reverts all changes from add_assistant_status_tracking
-- Created: 2025-10-08
-- =====================================================================

-- Step 1: Drop trigger
-- =====================================================================
DROP TRIGGER IF EXISTS trg_assistant_status_change ON assistants;

-- Step 2: Drop trigger function
-- =====================================================================
DROP FUNCTION IF EXISTS record_status_change();
DROP FUNCTION IF EXISTS cleanup_old_status_history();

-- Step 3: Drop indexes
-- =====================================================================
DROP INDEX IF EXISTS idx_assistants_status_account;
DROP INDEX IF EXISTS idx_assistants_last_status_change;
DROP INDEX IF EXISTS idx_assistants_error_status;
DROP INDEX IF EXISTS idx_status_history_assistant_created;
DROP INDEX IF EXISTS idx_status_history_account_status;

-- Step 4: Drop RLS policies
-- =====================================================================
DROP POLICY IF EXISTS "Users can view status history for their account assistants" ON assistant_status_history;
DROP POLICY IF EXISTS "Service role can insert status history" ON assistant_status_history;

-- Step 5: Drop status history table
-- =====================================================================
DROP TABLE IF EXISTS assistant_status_history CASCADE;

-- Step 6: Drop columns from assistants table
-- =====================================================================
ALTER TABLE assistants DROP COLUMN IF EXISTS status;
ALTER TABLE assistants DROP COLUMN IF EXISTS error_message;
ALTER TABLE assistants DROP COLUMN IF EXISTS last_status_change;

-- Step 7: Drop enum type
-- =====================================================================
DROP TYPE IF EXISTS assistant_status;

-- =====================================================================
-- Rollback Complete
-- =====================================================================
