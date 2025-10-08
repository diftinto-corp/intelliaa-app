-- =====================================================================
-- Migration: Add Assistant Status Tracking (INT-32)
-- Description: Implements real-time status visualization with enum-based
--              status field, error tracking, and historical logging
-- Created: 2025-10-08
-- =====================================================================

-- Step 1: Create assistant_status enum type
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assistant_status') THEN
    CREATE TYPE assistant_status AS ENUM (
      'configuring',
      'active',
      'error',
      'disconnected'
    );

    COMMENT ON TYPE assistant_status IS 'Status states for assistants: configuring (deploying), active (operational), error (failed), disconnected (inactive)';
  END IF;
END $$;

-- Step 2: Add new columns to assistants table
-- =====================================================================

-- Add status column (default: configuring for new records)
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS status assistant_status NOT NULL DEFAULT 'configuring';

-- Add error tracking
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS error_message text NULL;

-- Add status change timestamp
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS last_status_change timestamptz NOT NULL DEFAULT NOW();

-- Add column comments
COMMENT ON COLUMN assistants.status IS 'Current operational status of the assistant';
COMMENT ON COLUMN assistants.error_message IS 'Error details when status is error, NULL otherwise';
COMMENT ON COLUMN assistants.last_status_change IS 'Timestamp of the last status transition';

-- Step 3: Create assistant_status_history table
-- =====================================================================

CREATE TABLE IF NOT EXISTS assistant_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  status assistant_status NOT NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  metadata jsonb NULL,

  -- Foreign key constraints with CASCADE delete
  CONSTRAINT fk_status_history_assistant
    FOREIGN KEY (assistant_id)
    REFERENCES assistants(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_status_history_account
    FOREIGN KEY (account_id)
    REFERENCES basejump.accounts(id)
    ON DELETE CASCADE
);

-- Add table and column comments
COMMENT ON TABLE assistant_status_history IS 'Historical log of assistant status changes for INT-32';
COMMENT ON COLUMN assistant_status_history.metadata IS 'JSONB field for additional context: {changed_by: uuid, trigger: string, details: object}';

-- Step 4: Enable Row Level Security
-- =====================================================================

ALTER TABLE assistant_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view status history for their account assistants
CREATE POLICY "Users can view status history for their account assistants"
  ON assistant_status_history
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view status history for their account assistants" ON assistant_status_history
IS 'Allows authenticated users to view status history for assistants in their accounts';

-- Policy: Service role can insert status history (for triggers and server actions)
CREATE POLICY "Service role can insert status history"
  ON assistant_status_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Step 5: Create indexes for performance
-- =====================================================================

-- Index 1: Status filter with account ID
CREATE INDEX IF NOT EXISTS idx_assistants_status_account
  ON assistants (account_id, status, updated_at DESC);

COMMENT ON INDEX idx_assistants_status_account IS 'Optimizes queries filtering assistants by account and status with sorting';

-- Index 2: Status change timestamp
CREATE INDEX IF NOT EXISTS idx_assistants_last_status_change
  ON assistants (account_id, last_status_change DESC);

COMMENT ON INDEX idx_assistants_last_status_change IS 'Optimizes queries sorting by status change timestamp';

-- Index 3: Error status partial index
CREATE INDEX IF NOT EXISTS idx_assistants_error_status
  ON assistants (account_id, last_status_change DESC)
  WHERE status = 'error';

COMMENT ON INDEX idx_assistants_error_status IS 'Partial index for efficient error status queries';

-- Index 4: Status history lookup by assistant
CREATE INDEX IF NOT EXISTS idx_status_history_assistant_created
  ON assistant_status_history (assistant_id, created_at DESC);

COMMENT ON INDEX idx_status_history_assistant_created IS 'Optimizes fetching recent status history for an assistant';

-- Index 5: Status history account filtering
CREATE INDEX IF NOT EXISTS idx_status_history_account_status
  ON assistant_status_history (account_id, status, created_at DESC);

COMMENT ON INDEX idx_status_history_account_status IS 'Optimizes account-wide status history queries with filtering';

-- Step 6: Create trigger function to record status changes
-- =====================================================================

CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_status_change if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_status_change := NOW();
  END IF;

  -- Record to history (both INSERT and status changes)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR
     (TG_OP = 'INSERT') THEN

    INSERT INTO assistant_status_history (
      assistant_id,
      account_id,
      status,
      error_message,
      created_at,
      metadata
    ) VALUES (
      NEW.id,
      NEW.account_id,
      NEW.status,
      NEW.error_message,
      NEW.last_status_change,
      jsonb_build_object(
        'trigger', TG_OP,
        'changed_at', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_status_change() IS 'Automatically records status changes to assistant_status_history and updates last_status_change timestamp';

-- Step 7: Create trigger on assistants table
-- =====================================================================

DROP TRIGGER IF EXISTS trg_assistant_status_change ON assistants;

CREATE TRIGGER trg_assistant_status_change
  AFTER INSERT OR UPDATE OF status ON assistants
  FOR EACH ROW
  EXECUTE FUNCTION record_status_change();

COMMENT ON TRIGGER trg_assistant_status_change ON assistants IS 'Automatically records status changes to assistant_status_history';

-- Step 8: Backfill existing data
-- =====================================================================

-- Migrate existing assistants to new status enum
UPDATE assistants
SET
  status = CASE
    -- Deploying state
    WHEN is_deploying_ws = true THEN 'configuring'::assistant_status
    -- Active state
    WHEN activated_whatsApp = true AND is_deploying_ws = false THEN 'active'::assistant_status
    -- Disconnected state (was active but now inactive)
    WHEN activated_whatsApp = false AND is_deploying_ws = false AND updated_at < NOW() - INTERVAL '7 days' THEN 'disconnected'::assistant_status
    -- Default to configuring
    ELSE 'configuring'::assistant_status
  END,
  last_status_change = COALESCE(updated_at, created_at, NOW())
WHERE status = 'configuring'; -- Only update if still at default

-- Create initial history entries for existing assistants
INSERT INTO assistant_status_history (assistant_id, account_id, status, created_at, metadata)
SELECT
  id,
  account_id,
  status,
  last_status_change,
  jsonb_build_object('trigger', 'MIGRATION', 'source', 'INT-32 data migration')
FROM assistants
ON CONFLICT DO NOTHING;

-- Step 9: Optional cleanup function for old history
-- =====================================================================

CREATE OR REPLACE FUNCTION cleanup_old_status_history()
RETURNS void AS $$
BEGIN
  DELETE FROM assistant_status_history
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_status_history() IS 'Removes status history older than 90 days. Can be scheduled with pg_cron.';

-- =====================================================================
-- Migration Complete
-- =====================================================================
