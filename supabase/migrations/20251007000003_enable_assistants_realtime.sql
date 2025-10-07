-- Migration: Enable Realtime on Assistants Table
-- Description: Enables Supabase Realtime subscriptions for assistants table
-- Priority: HIGH (P0)
-- Created: 2025-10-07
-- Related: INT-30 Master-Detail Layout Implementation

-- ============================================================================
-- ENABLE REALTIME REPLICATION
-- This allows clients to subscribe to changes (INSERT, UPDATE, DELETE)
-- on the assistants table in real-time via WebSocket connections
-- ============================================================================

-- Add assistants table to the realtime publication
-- This is required for Supabase Realtime subscriptions to work
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistants;

-- ============================================================================
-- VERIFICATION
-- Run this query to verify the table is in the realtime publication
-- ============================================================================

/*
-- Check if assistants table is in realtime publication
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'assistants';

-- Expected result: One row showing public.assistants
*/

-- ============================================================================
-- CLIENT-SIDE SUBSCRIPTION PATTERN
-- Example of how to subscribe to changes in the client application
-- ============================================================================

/*
// TypeScript/JavaScript example for client-side subscription

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Subscribe to all changes for a specific account
const channel = supabase
  .channel(`assistants:account_id=eq.${accountId}`)
  .on(
    'postgres_changes',
    {
      event: '*', // Listen to INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'assistants',
      filter: `account_id=eq.${accountId}`, // Only changes for this account
    },
    (payload) => {
      console.log('Change received!', payload);
      // Handle the change: payload.eventType, payload.new, payload.old
    }
  )
  .subscribe();

// Clean up when component unmounts (CRITICAL to prevent memory leaks)
return () => {
  supabase.removeChannel(channel);
};
*/

-- ============================================================================
-- REALTIME SECURITY NOTES
-- ============================================================================

-- Realtime respects RLS policies!
-- Clients will only receive updates for rows they have SELECT permission on
-- This means the RLS policies we created in migration 20251007000001 protect realtime too

-- Recommended subscription pattern:
-- 1. Use account-level filters (not per-assistant) to avoid hitting 100-channel limit
-- 2. Always clean up channels on component unmount
-- 3. Debounce rapid updates on the client side (200ms window recommended)

-- ============================================================================
-- MONITORING REALTIME CONNECTIONS
-- ============================================================================

/*
-- Check active realtime connections (requires Supabase Dashboard or Admin API)
-- This query shows the number of active WebSocket connections

SELECT
  count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active'
  AND query LIKE '%realtime%';
*/

-- ============================================================================
-- PERFORMANCE CONSIDERATIONS
-- ============================================================================

-- Realtime uses PostgreSQL's logical replication feature (wal2json)
-- This has minimal performance impact on the database
-- Each change triggers a small JSON message sent to subscribed clients

-- Expected overhead:
-- - Database: < 1% CPU increase for typical workload
-- - Network: ~100-500 bytes per change notification
-- - Client: ~10ms latency from mutation to notification

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- If this migration causes issues, run this command to disable realtime
-- ============================================================================

/*
-- Rollback: Remove assistants table from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.assistants;

-- Verify removal
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'assistants';
-- Expected: Empty result
*/

-- ============================================================================
-- ADDITIONAL CONFIGURATION (Optional)
-- ============================================================================

-- If you need to customize which columns trigger realtime events:
-- By default, ALL column changes trigger events
-- You can create a custom publication with specific columns if needed

/*
-- Example: Only notify on specific column changes
CREATE PUBLICATION assistants_status_changes FOR TABLE public.assistants
  (id, name, activated_whatsapp, is_deploying_ws, updated_at);

-- Then modify your client subscription to use this publication
-- Note: This is advanced usage and not required for INT-30
*/
