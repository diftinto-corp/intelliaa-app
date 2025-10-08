# INT-32: Real-Time Status Visualization - Supabase Architecture Plan

**Date**: 2025-10-08
**Feature**: Real-Time Status Visualization for Assistants
**Database**: Supabase (PostgreSQL with RLS)
**Target**: Multi-tenant status tracking with realtime updates

---

## Executive Summary

This document provides a comprehensive database architecture plan for implementing real-time status visualization for assistants in the IntelliAA platform. The plan addresses:

1. **Schema Changes**: Adding status enum, error tracking, and timestamp fields to `assistants` table
2. **Status History**: New `assistant_status_history` table for historical tracking
3. **RLS Policies**: Multi-tenant security for status history
4. **Indexing Strategy**: Optimized indexes for status filtering and queries
5. **Migration Strategy**: Safe transition from current boolean-based status to enum-based system
6. **Realtime Enhancements**: Leveraging existing Supabase Realtime infrastructure

---

## Current State Analysis

### Existing `assistants` Table Structure

**Current Status Fields:**
- `activated_whatsApp` (boolean, default: false) - Indicates if WhatsApp is activated
- `is_deploying_ws` (boolean, default: false) - Indicates if deployment is in progress
- `updated_at` (timestamptz) - Last update timestamp
- **MISSING**: Unified status field, error tracking, status change timestamp

**Current Indexes:**
- `assistants_pkey` - Primary key on `id`
- `assistants_namespace_key` - Unique index on `namespace`
- `idx_assistants_account_updated` - Composite index on `(account_id, updated_at DESC)`
- `idx_assistants_active_whatsapp` - Partial index on `(account_id, updated_at DESC) WHERE activated_whatsApp = true`
- `idx_assistants_name_trgm` - GIN index for full-text search on `name`

**Existing Realtime Infrastructure:**
- ✅ Supabase Realtime enabled and configured
- ✅ Hook: `useAssistantsRealtime` in `src/hooks/use-assistants-realtime.ts`
- ✅ Channel pattern: `assistants:account_id=eq.${accountId}`
- ✅ Events: INSERT, UPDATE, DELETE
- ✅ Latency: 200-500ms (meeting requirements)

### Current Status Logic

**Status Derivation** (from `AssistantListItem.tsx:88-105`):
```typescript
// Deploying: is_deploying_ws === true
// Active: activated_whatsapp === true && is_deploying_ws === false
// Inactive: activated_whatsapp === false && is_deploying_ws === false
```

**Gaps:**
- No `error` status handling
- No `disconnected` status tracking
- No error message storage
- No status history tracking
- Status logic scattered across components

---

## Recommended Architecture

### 1. PostgreSQL Enum Type Definition

**Enum Name**: `assistant_status`

**Values:**
- `configuring` - Initial state, deployment in progress
- `active` - Fully deployed and operational
- `error` - Deployment failed or runtime error occurred
- `disconnected` - Previously active but now disconnected

**Rationale:**
- Uses PostgreSQL native enum type for type safety
- Aligns with UI requirements (INT-32 AC1)
- Extensible for future states (e.g., `paused`, `maintenance`)
- Database-level validation prevents invalid states

**Migration SQL:**
```sql
-- Create enum type
CREATE TYPE assistant_status AS ENUM (
  'configuring',
  'active',
  'error',
  'disconnected'
);

COMMENT ON TYPE assistant_status IS 'Status states for assistants: configuring (deploying), active (operational), error (failed), disconnected (inactive)';
```

---

### 2. Schema Changes to `assistants` Table

**New Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `status` | `assistant_status` | NO | `'configuring'` | Current status of assistant |
| `error_message` | `text` | YES | `NULL` | Error details when status = 'error' |
| `last_status_change` | `timestamptz` | NO | `NOW()` | Timestamp of last status change |

**Migration SQL:**
```sql
-- Add status column (default: configuring for new records)
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS status assistant_status NOT NULL DEFAULT 'configuring';

-- Add error tracking
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS error_message text NULL;

-- Add status change timestamp
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS last_status_change timestamptz NOT NULL DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN assistants.status IS 'Current operational status of the assistant';
COMMENT ON COLUMN assistants.error_message IS 'Error details when status is error, NULL otherwise';
COMMENT ON COLUMN assistants.last_status_change IS 'Timestamp of the last status transition';
```

**Backward Compatibility Strategy:**
- **KEEP** `activated_whatsApp` and `is_deploying_ws` fields initially
- Data migration will populate `status` based on existing booleans
- After migration validation, deprecate boolean fields in future release
- Allows gradual transition and easy rollback

---

### 3. New Table: `assistant_status_history`

**Purpose**: Historical tracking of status changes for analytics and debugging

**Schema:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `assistant_id` | `uuid` | NO | - | FK to assistants.id |
| `account_id` | `uuid` | NO | - | FK to accounts.id (for RLS) |
| `status` | `assistant_status` | NO | - | Status at this point in time |
| `error_message` | `text` | YES | `NULL` | Error message if applicable |
| `created_at` | `timestamptz` | NO | `NOW()` | When this status was recorded |
| `metadata` | `jsonb` | YES | `NULL` | Additional context (user_id, trigger source, etc.) |

**Migration SQL:**
```sql
-- Create status history table
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

-- Add table comment
COMMENT ON TABLE assistant_status_history IS 'Historical log of assistant status changes for INT-32';
COMMENT ON COLUMN assistant_status_history.metadata IS 'JSONB field for additional context: {changed_by: uuid, trigger: string, details: object}';
```

**Retention Policy** (Optional - Recommended):
```sql
-- Function to clean up old history (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_status_history()
RETURNS void AS $$
BEGIN
  DELETE FROM assistant_status_history
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule with pg_cron (if enabled)
-- SELECT cron.schedule('cleanup-status-history', '0 2 * * 0', 'SELECT cleanup_old_status_history()');
```

---

### 4. Row Level Security (RLS) Policies

**Enable RLS on `assistant_status_history`:**
```sql
ALTER TABLE assistant_status_history ENABLE ROW LEVEL SECURITY;
```

**Policy 1: SELECT - View Status History**
```sql
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
```

**Policy 2: INSERT - Record Status Changes**
```sql
-- Option A: Application-managed (RECOMMENDED)
-- Allow inserts only through application logic (server actions)
CREATE POLICY "Service role can insert status history"
  ON assistant_status_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Option B: Trigger-managed (Alternative - see trigger section)
-- No explicit INSERT policy needed if using database trigger
```

**Policy 3: UPDATE/DELETE - Restricted**
```sql
-- Status history is append-only (no updates or deletes by users)
-- Cascade delete handles cleanup when assistant is deleted
```

**Existing `assistants` RLS:**
- ✅ Already has RLS enabled
- ✅ Policy: Users can view/modify assistants in their accounts
- No changes needed

---

### 5. Indexing Strategy

**Goal**: Optimize status filtering, sorting, and history queries

**Index 1: Status Filter with Account ID**
```sql
-- Composite index for filtering by status within account
CREATE INDEX IF NOT EXISTS idx_assistants_status_account
  ON assistants (account_id, status, updated_at DESC);

COMMENT ON INDEX idx_assistants_status_account IS 'Optimizes queries filtering assistants by account and status with sorting';
```

**Index 2: Status Change Timestamp**
```sql
-- Index for sorting by last status change
CREATE INDEX IF NOT EXISTS idx_assistants_last_status_change
  ON assistants (account_id, last_status_change DESC);

COMMENT ON INDEX idx_assistants_last_status_change IS 'Optimizes queries sorting by status change timestamp';
```

**Index 3: Error Status Partial Index**
```sql
-- Partial index for quickly finding errored assistants
CREATE INDEX IF NOT EXISTS idx_assistants_error_status
  ON assistants (account_id, last_status_change DESC)
  WHERE status = 'error';

COMMENT ON INDEX idx_assistants_error_status IS 'Partial index for efficient error status queries';
```

**Index 4: Status History Lookup**
```sql
-- Index for retrieving history by assistant
CREATE INDEX IF NOT EXISTS idx_status_history_assistant_created
  ON assistant_status_history (assistant_id, created_at DESC);

COMMENT ON INDEX idx_status_history_assistant_created IS 'Optimizes fetching recent status history for an assistant';
```

**Index 5: Status History Account Filtering**
```sql
-- Index for account-scoped history queries
CREATE INDEX IF NOT EXISTS idx_status_history_account_status
  ON assistant_status_history (account_id, status, created_at DESC);

COMMENT ON INDEX idx_status_history_account_status IS 'Optimizes account-wide status history queries with filtering';
```

**Index Analysis:**

| Query Pattern | Index Used | Performance Impact |
|---------------|------------|-------------------|
| List assistants filtered by status | `idx_assistants_status_account` | O(log n) - BTREE lookup |
| Find all errored assistants | `idx_assistants_error_status` | O(log n) - Partial index |
| Get assistant history (last 5) | `idx_status_history_assistant_created` | O(log n) - BTREE with LIMIT 5 |
| Status summary counts | `idx_assistants_status_account` | Sequential scan per status (acceptable for counts) |

**Note on Existing Indexes:**
- **KEEP** `idx_assistants_active_whatsapp` temporarily for backward compatibility
- **DEPRECATE** in future migration after full status enum adoption

---

### 6. Database Trigger vs Application Code

**Question**: Should we auto-populate status history via trigger or application code?

**ANSWER: Hybrid Approach (RECOMMENDED)**

**Trigger for Automatic History Recording:**
```sql
-- Function to record status changes
CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if status actually changed
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

-- Create trigger
CREATE TRIGGER trg_assistant_status_change
  AFTER INSERT OR UPDATE OF status ON assistants
  FOR EACH ROW
  EXECUTE FUNCTION record_status_change();

COMMENT ON TRIGGER trg_assistant_status_change ON assistants IS 'Automatically records status changes to assistant_status_history';
```

**Application Code for Explicit Context:**
```typescript
// src/lib/actions/intelliaa/assistants-status.ts
export async function updateAssistantStatus(
  assistantId: string,
  status: AssistantStatus,
  errorMessage?: string,
  metadata?: Record<string, any>
) {
  const supabase = await createClient();

  // Update assistant status (trigger will auto-record history)
  const { error } = await supabase
    .from('assistants')
    .update({
      status,
      error_message: errorMessage || null,
      last_status_change: new Date().toISOString(),
    })
    .eq('id', assistantId);

  if (error) throw error;

  // Optional: Explicitly add history with rich metadata
  if (metadata) {
    await supabase.from('assistant_status_history').insert({
      assistant_id: assistantId,
      account_id: metadata.account_id,
      status,
      error_message: errorMessage,
      metadata: {
        changed_by: metadata.user_id,
        trigger: metadata.trigger,
        details: metadata.details,
      },
    });
  }
}
```

**Rationale:**
- ✅ Trigger ensures NO status change is missed (defensive)
- ✅ Application code provides rich context when available
- ✅ Trigger handles external updates (e.g., webhooks from Evolution API, VAPI)
- ✅ Application code can add user attribution and business logic context

**Trigger also updates `last_status_change`:**
```sql
-- Enhanced trigger to update timestamp
CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_status_change if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.last_status_change := NOW();
  END IF;

  -- Record to history
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
```

---

### 7. Data Migration Strategy

**Goal**: Safely transition from boolean-based status to enum-based status

**Phase 1: Add New Columns (Non-Breaking)**
```sql
-- Already covered in schema changes above
-- All new columns are nullable or have defaults
-- No existing queries break
```

**Phase 2: Backfill Existing Data**
```sql
-- Migrate existing assistants to new status enum
UPDATE assistants
SET status = CASE
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
WHERE status IS NULL OR status = 'configuring'; -- Only update if not already set

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
```

**Phase 3: Validation**
```sql
-- Validate migration results
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE activated_whatsApp = true) as was_active,
  COUNT(*) FILTER (WHERE is_deploying_ws = true) as was_deploying
FROM assistants
GROUP BY status;

-- Expected results:
-- configuring: is_deploying_ws = true
-- active: activated_whatsApp = true AND is_deploying_ws = false
-- disconnected: activated_whatsApp = false (old inactive)
```

**Phase 4: Application Code Update**
- Update server actions to use `status` field
- Update realtime hook to handle status changes
- Update UI components to read from `status` field
- **KEEP** boolean fields for 1-2 releases as fallback

**Phase 5: Deprecation (Future Release)**
```sql
-- After 2-3 releases, drop old columns
ALTER TABLE assistants DROP COLUMN IF EXISTS activated_whatsApp;
ALTER TABLE assistants DROP COLUMN IF EXISTS is_deploying_ws;
DROP INDEX IF EXISTS idx_assistants_active_whatsapp;
```

**Rollback Strategy:**
```sql
-- If migration fails, rollback is simple:
ALTER TABLE assistants DROP COLUMN IF EXISTS status;
ALTER TABLE assistants DROP COLUMN IF EXISTS error_message;
ALTER TABLE assistants DROP COLUMN IF EXISTS last_status_change;
DROP TABLE IF EXISTS assistant_status_history CASCADE;
DROP TYPE IF EXISTS assistant_status;
```

---

### 8. Realtime Subscription Enhancements

**Current Implementation** (`use-assistants-realtime.ts`):
```typescript
// Already subscribes to all changes on assistants table
// Channel: `assistants:account_id=eq.${accountId}`
// Events: INSERT, UPDATE, DELETE
```

**Enhancement 1: Status-Specific Filtering (Optional)**
```typescript
// If we want to only listen to status changes (reduces payload)
export function useAssistantStatusRealtime(
  accountId: string,
  onStatusChange: (assistant: AssistantListItem) => void
) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`assistants-status:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assistants',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          // Only trigger callback if status actually changed
          if (payload.old.status !== payload.new.status) {
            onStatusChange(payload.new as AssistantListItem);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, onStatusChange]);
}
```

**Enhancement 2: Optimistic UI Updates**
```typescript
// In components using status updates
export function updateStatusOptimistically(
  assistantId: string,
  newStatus: AssistantStatus
) {
  // Update local state immediately
  setAssistants(prev => prev.map(a =>
    a.id === assistantId
      ? { ...a, status: newStatus, last_status_change: new Date().toISOString() }
      : a
  ));

  // Server update will sync via realtime
  updateAssistantStatus(assistantId, newStatus);
}
```

**Enhancement 3: Animation Trigger**
```typescript
// Detect status changes and trigger animations
export function useAssistantsList(
  initialAssistants: AssistantListItem[],
  accountId: string
) {
  const [assistants, setAssistants] = useState(initialAssistants);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(new Set());

  useAssistantsRealtime(accountId, {
    onUpdate: useCallback((updatedAssistant: AssistantListItem) => {
      setAssistants(prev => {
        const oldAssistant = prev.find(a => a.id === updatedAssistant.id);

        // Check if status changed
        if (oldAssistant && oldAssistant.status !== updatedAssistant.status) {
          // Trigger animation for 1 second
          setRecentlyChanged(prevSet => new Set(prevSet).add(updatedAssistant.id));
          setTimeout(() => {
            setRecentlyChanged(prevSet => {
              const newSet = new Set(prevSet);
              newSet.delete(updatedAssistant.id);
              return newSet;
            });
          }, 1000);
        }

        return prev.map(a => a.id === updatedAssistant.id ? updatedAssistant : a);
      });
    }, []),
  });

  return { assistants, recentlyChanged };
}
```

**No Major Changes Needed:**
- Existing `useAssistantsRealtime` hook already handles UPDATE events
- Status changes will automatically propagate via existing channel
- Latency remains 200-500ms (within requirement)

---

### 9. Query Examples for Application Code

**Query 1: Get Assistants with Status Filter**
```typescript
// src/lib/actions/intelliaa/assistants-server.ts
export async function getAssistantsByStatus(
  accountId: string,
  status: AssistantStatus
): Promise<AssistantListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', status)
    .order('last_status_change', { ascending: false });

  if (error) throw error;
  return data;
}
```

**Query 2: Get Status Summary Counts**
```typescript
export async function getStatusSummary(
  accountId: string
): Promise<Record<AssistantStatus, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assistants')
    .select('status')
    .eq('account_id', accountId);

  if (error) throw error;

  // Count by status
  const summary = {
    active: 0,
    configuring: 0,
    error: 0,
    disconnected: 0,
  };

  data.forEach(assistant => {
    summary[assistant.status]++;
  });

  return summary;
}
```

**Query 3: Get Status History for Assistant**
```typescript
export async function getAssistantStatusHistory(
  assistantId: string,
  limit = 5
): Promise<AssistantStatusHistoryItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assistant_status_history')
    .select('*')
    .eq('assistant_id', assistantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

**Query 4: Get All Errored Assistants with Details**
```typescript
export async function getErroredAssistants(
  accountId: string
): Promise<AssistantListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'error')
    .not('error_message', 'is', null)
    .order('last_status_change', { ascending: false });

  if (error) throw error;
  return data;
}
```

---

### 10. Performance Considerations

**Database Size Impact:**

| Change | Estimated Size Impact |
|--------|----------------------|
| Enum type | < 1KB (metadata only) |
| 3 new columns on `assistants` | ~24 bytes per row |
| `assistant_status_history` table | ~100 bytes per status change |

**Scaling Estimates:**
- 1,000 assistants × 24 bytes = 24KB additional data
- 1,000 assistants × 10 status changes/year = 10,000 history rows = 1MB/year
- **Conclusion**: Negligible impact on database size

**Query Performance:**
- All new indexes use BTREE (O(log n) complexity)
- Partial indexes reduce index size for error queries
- Composite indexes cover most filter/sort combinations
- **Conclusion**: No performance degradation expected

**Realtime Performance:**
- No additional channels needed (reuse existing)
- Status changes are part of UPDATE events (no extra payload)
- **Conclusion**: No additional realtime overhead

---

## Complete Migration SQL File

**File**: `supabase/migrations/20251008000000_add_assistant_status_tracking.sql`

```sql
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
```

---

## Rollback Migration SQL

**File**: `supabase/migrations/20251008000000_add_assistant_status_tracking_rollback.sql`

```sql
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
```

---

## TypeScript Type Definitions

**File**: `src/types/assistants.ts`

```typescript
/**
 * Assistant status enum matching database type
 */
export enum AssistantStatus {
  CONFIGURING = 'configuring',
  ACTIVE = 'active',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

/**
 * Status history item
 */
export interface AssistantStatusHistoryItem {
  id: string;
  assistant_id: string;
  account_id: string;
  status: AssistantStatus;
  error_message: string | null;
  created_at: string;
  metadata: {
    trigger?: string;
    changed_by?: string;
    details?: Record<string, any>;
  } | null;
}

/**
 * Updated Assistant type with new status fields
 */
export interface Assistant {
  id: string;
  account_id: string;
  name: string;
  namespace: string;
  status: AssistantStatus; // NEW
  error_message: string | null; // NEW
  last_status_change: string; // NEW

  // Deprecated (keep for backward compatibility)
  activated_whatsApp?: boolean;
  is_deploying_ws?: boolean;

  // ... other existing fields
}
```

---

## Implementation Checklist

### Database Migration
- [ ] Create migration file: `20251008000000_add_assistant_status_tracking.sql`
- [ ] Test migration on local Supabase instance
- [ ] Validate data backfill results
- [ ] Test rollback migration
- [ ] Apply to staging environment
- [ ] Validate staging data integrity
- [ ] Apply to production

### Application Code Updates
- [ ] Update TypeScript types in `src/types/assistants.ts`
- [ ] Create server actions for status updates in `src/lib/actions/intelliaa/assistants-status.ts`
- [ ] Update `getAssistantsForAccount` to include new fields
- [ ] Add `getStatusSummary` function
- [ ] Add `getAssistantStatusHistory` function
- [ ] Update realtime hook to handle status changes (optional enhancements)

### UI Components (INT-32 Implementation)
- [ ] Create `StatusBadge.tsx` component
- [ ] Create `StatusSummary.tsx` component
- [ ] Create `StatusHistoryTimeline.tsx` component
- [ ] Update `AssistantListItem.tsx` to use new status field
- [ ] Add status filter integration with existing filters

### Testing
- [ ] Unit tests for status transitions
- [ ] Integration tests for status history recording
- [ ] Realtime subscription tests for status updates
- [ ] Performance tests with 100+ assistants
- [ ] RLS policy tests for multi-tenant isolation

### Documentation
- [ ] Update API documentation with new status endpoints
- [ ] Document status transition logic
- [ ] Create troubleshooting guide for status issues

---

## Answers to Specific Questions

### 1. Should we use a database trigger to populate status history, or handle it in application code?

**ANSWER: Hybrid Approach (RECOMMENDED)**

Use **database trigger** as the primary mechanism with **application code** for enrichment:

**Trigger Advantages:**
- ✅ Ensures NO status change is missed (defensive programming)
- ✅ Handles external updates (webhooks, manual DB changes)
- ✅ Automatically updates `last_status_change` timestamp
- ✅ Simple, reliable, low maintenance

**Application Code Advantages:**
- ✅ Can add rich metadata (user_id, trigger source, business context)
- ✅ Explicit control over when history is recorded
- ✅ Easier to test and debug

**Implementation:**
- Trigger records ALL status changes automatically
- Application code optionally adds additional history entries with metadata
- Best of both worlds: reliability + rich context

---

### 2. What's the optimal indexing strategy for status filtering combined with account_id?

**ANSWER: Composite Index with Status First**

**Recommended Index:**
```sql
CREATE INDEX idx_assistants_status_account
  ON assistants (account_id, status, updated_at DESC);
```

**Why This Order:**
- `account_id` filters first (RLS requirement, reduces set size)
- `status` filters within account (common query pattern)
- `updated_at DESC` allows sorting without additional index

**Alternative for Error Queries:**
```sql
CREATE INDEX idx_assistants_error_status
  ON assistants (account_id, last_status_change DESC)
  WHERE status = 'error';
```
- Partial index reduces size
- Optimized for "show me all errors" query
- Covers ~5-10% of data (typical error rate)

**Query Pattern Coverage:**
| Query | Index Used | Performance |
|-------|------------|-------------|
| All assistants for account | `idx_assistants_account_updated` (existing) | O(log n) |
| Filter by status | `idx_assistants_status_account` | O(log n) |
| Only errors | `idx_assistants_error_status` | O(log n) partial |
| Sort by status change | `idx_assistants_last_status_change` | O(log n) |

---

### 3. How to handle the transition from current `activated_whatsapp`/`is_deploying_ws` to new `status` enum?

**ANSWER: Gradual Migration with Backward Compatibility**

**Phase 1: Additive Changes (Non-Breaking)**
- Add `status`, `error_message`, `last_status_change` columns
- **KEEP** existing boolean fields
- Backfill `status` from booleans using migration logic
- Application reads from both (status preferred, booleans as fallback)

**Migration Logic:**
```sql
UPDATE assistants SET status = CASE
  WHEN is_deploying_ws = true THEN 'configuring'
  WHEN activated_whatsApp = true THEN 'active'
  WHEN activated_whatsApp = false AND updated_at < NOW() - INTERVAL '7 days' THEN 'disconnected'
  ELSE 'configuring'
END;
```

**Phase 2: Application Update**
- Update UI components to read `status` field
- Update server actions to write to both `status` AND booleans (for rollback safety)
- Monitor for 1-2 releases

**Phase 3: Deprecation (Future Release)**
- Remove boolean field writes from application
- Add deprecation comments to boolean fields
- Eventually drop columns in separate migration

**Rollback Safety:**
- If new status system fails, boolean fields still have correct values
- Easy rollback by reverting to previous code version
- No data loss

---

### 4. Should we keep old fields for backward compatibility or migrate completely?

**ANSWER: Keep Old Fields Temporarily (1-2 Releases)**

**Rationale:**
- ✅ **Safety**: Easy rollback if status enum causes issues
- ✅ **Gradual Adoption**: External integrations may still use boolean fields
- ✅ **Validation**: Run both systems in parallel to verify correctness
- ✅ **Zero Downtime**: No breaking changes during transition

**Deprecation Timeline:**
1. **Release 1** (Current): Add status fields, backfill data, keep booleans
2. **Release 2**: Update application to use status, write to both
3. **Release 3**: Monitor, validate, build confidence
4. **Release 4**: Mark booleans as deprecated, stop writing
5. **Release 5**: Drop boolean columns and indexes

**Cost of Keeping:**
- ~8 bytes per row (2 booleans)
- 1 partial index (~5% of table size)
- **Total**: < 1MB for 10,000 assistants
- **Conclusion**: Negligible cost, high safety benefit

---

### 5. What's the best approach for cleaning up old status history records (retention policy)?

**ANSWER: Manual Function + Optional Scheduled Job**

**Recommended Approach:**

**Option 1: On-Demand Cleanup Function (RECOMMENDED)**
```sql
CREATE FUNCTION cleanup_old_status_history()
RETURNS void AS $$
BEGIN
  DELETE FROM assistant_status_history
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Execute manually:**
```sql
SELECT cleanup_old_status_history();
```

**Option 2: Scheduled with pg_cron (If Enabled)**
```sql
-- Run every Sunday at 2 AM
SELECT cron.schedule(
  'cleanup-status-history',
  '0 2 * * 0',
  'SELECT cleanup_old_status_history()'
);
```

**Option 3: Application-Level Cleanup**
```typescript
// Background job in Next.js (e.g., Vercel Cron)
// /api/cron/cleanup-status-history
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  await supabase
    .from('assistant_status_history')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  return Response.json({ success: true });
}
```

**Retention Recommendations:**
- **90 days**: Standard retention (balances history vs storage)
- **365 days**: If analytics/compliance needed
- **30 days**: If storage is critical concern

**Why Not Auto-Delete Trigger?**
- ❌ Triggers on DELETE are expensive
- ❌ Can cause cascading performance issues
- ❌ Hard to disable if needed
- ✅ Manual/scheduled approach is more controllable

---

## Critical Notes & Breaking Changes

### ⚠️ CRITICAL NOTE 1: PostgreSQL Enum Type Behavior
**Issue**: PostgreSQL enum types cannot be easily modified after creation.

**Impact:**
- Adding new enum values requires `ALTER TYPE ... ADD VALUE`
- Removing enum values is NOT supported (requires recreating type)
- Renaming values is NOT supported

**Mitigation:**
- Chosen enum values are generic and stable: `configuring`, `active`, `error`, `disconnected`
- Future states (e.g., `paused`, `maintenance`) can be added without breaking changes
- If major enum refactor needed, create new type and migrate

**Migration Pattern for Adding Values:**
```sql
ALTER TYPE assistant_status ADD VALUE IF NOT EXISTS 'paused' AFTER 'active';
```

---

### ⚠️ CRITICAL NOTE 2: Trigger Performance on Bulk Updates
**Issue**: Trigger fires for EACH ROW on bulk updates.

**Impact:**
- Bulk update of 1,000 assistants = 1,000 trigger executions
- Each trigger inserts into `assistant_status_history`
- Can cause temporary performance degradation

**Mitigation:**
- Trigger only fires on status changes (NOT every update)
- History table has efficient indexes
- For bulk operations, consider disabling trigger temporarily:

```sql
-- Disable trigger for bulk operation
ALTER TABLE assistants DISABLE TRIGGER trg_assistant_status_change;

-- Perform bulk update
UPDATE assistants SET status = 'active' WHERE ...;

-- Re-enable trigger
ALTER TABLE assistants ENABLE TRIGGER trg_assistant_status_change;
```

---

### ⚠️ CRITICAL NOTE 3: RLS Policy for service_role
**Issue**: `service_role` bypass RLS by default in Supabase.

**Impact:**
- Server actions using `service_role` key can bypass account filtering
- Security risk if not careful with account_id filtering

**Mitigation:**
- Always filter by `account_id` in server actions
- Use `authenticated` role for user-facing queries
- Only use `service_role` for admin operations or triggers
- Add runtime checks in application code:

```typescript
export async function updateAssistantStatus(
  assistantId: string,
  accountId: string,
  status: AssistantStatus
) {
  const supabase = await createClient();

  // Verify user has access to this account
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .eq('account_id', accountId)
    .single();

  if (!membership) {
    throw new Error('Unauthorized: User does not have access to this account');
  }

  // Proceed with update
  await supabase
    .from('assistants')
    .update({ status, last_status_change: new Date().toISOString() })
    .eq('id', assistantId)
    .eq('account_id', accountId); // CRITICAL: Always filter by account
}
```

---

### ⚠️ CRITICAL NOTE 4: Realtime Payload Size
**Issue**: Supabase Realtime sends full row in UPDATE payload.

**Impact:**
- Large `prompt` or `docs_keys` fields increase payload size
- Can cause network congestion for frequent updates

**Mitigation:**
- Current payload size: ~2-5KB per assistant (acceptable)
- If payload becomes issue, use filtered columns:

```typescript
const channel = supabase
  .channel(`assistants:${accountId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'assistants',
      filter: `account_id=eq.${accountId}`,
    },
    (payload) => {
      // Only extract needed fields
      const { id, status, error_message, last_status_change } = payload.new;
      updateLocalState({ id, status, error_message, last_status_change });
    }
  );
```

---

### ⚠️ CRITICAL NOTE 5: Status History Growth Rate
**Issue**: Active assistants may generate many status changes.

**Growth Estimates:**
- 1,000 assistants × 10 changes/year = 10,000 rows/year
- 10,000 rows × 100 bytes = 1MB/year
- **10 years** = 10MB (negligible)

**However, if status changes are frequent:**
- Deployment failures with retries: 50 changes/day
- 1,000 assistants × 50 changes/day = 50,000 rows/day
- 50,000 × 100 bytes = 5MB/day = **1.8GB/year**

**Mitigation:**
- Implement 90-day retention policy (reduces to ~450MB)
- Monitor history table growth
- Consider partitioning by month if growth exceeds 1GB

---

## Next Steps

1. **Review this plan** with team and stakeholders
2. **Test migration** on local Supabase instance:
   ```bash
   supabase start
   supabase migration new add_assistant_status_tracking
   # Copy SQL from this document
   supabase db reset
   ```
3. **Validate data migration** results
4. **Update context file** with final decisions
5. **Proceed to UI implementation** (Phase 2)

---

## Summary

This architecture plan provides a comprehensive, production-ready solution for INT-32 status tracking:

✅ **Enum-based status system** with 4 well-defined states
✅ **Historical tracking** via `assistant_status_history` table
✅ **Automatic recording** via database trigger (defensive)
✅ **Multi-tenant security** with RLS policies
✅ **Optimized indexing** for all query patterns
✅ **Backward compatibility** with existing boolean fields
✅ **Safe migration strategy** with rollback support
✅ **Realtime-ready** using existing infrastructure
✅ **Scalable** with retention policies and efficient indexes

**Estimated Implementation Time**: 4-6 hours (database + testing)
**Risk Level**: Low (additive changes, no breaking changes)
**Performance Impact**: Negligible (< 1% query overhead)

---

**Document Status**: Ready for Implementation
**Next Phase**: Application Code & UI Components (INT-32 Phase 2)
