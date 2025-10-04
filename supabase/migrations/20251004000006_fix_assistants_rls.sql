-- ============================================================================
-- INTEL-010: Fix Assistants Table RLS Policies
-- ============================================================================
-- CRITICAL: Remove overly permissive policies and standardize to Basejump pattern
-- Risk: HIGH - Removes anon access, may break webhooks (review API routes)

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.assistants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.assistants;
DROP POLICY IF EXISTS "Account members can update" ON public.assistants;

-- Step 2: Keep secure policies, rename for clarity
-- Note: "Account members can select" and "Account members can insert" are already secure

-- Step 3: Create secure UPDATE policy
CREATE POLICY "Account members can update assistants"
  ON public.assistants
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: DELETE policy is already secure ("Delete Assistant by account_id")
-- Optionally rename for consistency
DROP POLICY IF EXISTS "Delete Assistant by account_id" ON public.assistants;

CREATE POLICY "Account members can delete assistants"
  ON public.assistants
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
      -- Optional: Restrict to owners only
      -- WHERE user_id = auth.uid() AND account_role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Account members can select" ON public.assistants IS
  'INTEL-010: Users can only view assistants in accounts they are members of';

COMMENT ON POLICY "Account members can insert" ON public.assistants IS
  'INTEL-010: Users can only create assistants in accounts they belong to';

COMMENT ON POLICY "Account members can update assistants" ON public.assistants IS
  'INTEL-010: Users can only update assistants in their accounts';

COMMENT ON POLICY "Account members can delete assistants" ON public.assistants IS
  'INTEL-010: Users can only delete assistants in their accounts';

-- ============================================================================
-- WARNING: Webhook Considerations
-- ============================================================================
-- If external webhooks (Railway, Buildship, VAPI) need to update assistants:
-- 1. Use service_role key (bypasses RLS) in webhook handlers
-- 2. OR create separate policy for service_role:
--
-- CREATE POLICY "Service role can update assistants"
--   ON public.assistants
--   FOR UPDATE
--   TO service_role
--   USING (true)
--   WITH CHECK (true);
