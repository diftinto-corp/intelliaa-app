-- ============================================================================
-- INTEL-010: Fix WhatsApp Reports RLS Policies
-- ============================================================================
-- CRITICAL: Remove all anon access and cross-account SELECT
-- Risk: HIGH - Breaks webhook inserts if using anon key (must use service_role)

-- Step 1: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "All logged in users can select" ON public.report_ws;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.report_ws;
DROP POLICY IF EXISTS "Update with anon" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can insert" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can update" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can delete" ON public.report_ws;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view reports in their accounts"
  ON public.report_ws
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create secure INSERT policy
-- Note: Webhooks from Railway/WhatsApp must use service_role key
CREATE POLICY "Users can create reports in their accounts"
  ON public.report_ws
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Service role policy for webhook inserts (REQUIRED for webhooks)
CREATE POLICY "Service role can insert reports"
  ON public.report_ws
  FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: Create secure UPDATE policy
CREATE POLICY "Users can update reports in their accounts"
  ON public.report_ws
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

-- Step 6: Service role policy for webhook updates
CREATE POLICY "Service role can update reports"
  ON public.report_ws
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Create secure DELETE policy
CREATE POLICY "Users can delete reports in their accounts"
  ON public.report_ws
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view reports in their accounts" ON public.report_ws IS
  'INTEL-010: Multi-tenant isolation. Users can only view WhatsApp reports from their accounts.';

COMMENT ON POLICY "Service role can insert reports" ON public.report_ws IS
  'INTEL-010: Allows Railway/WhatsApp webhooks to insert reports using service_role key.';

COMMENT ON POLICY "Service role can update reports" ON public.report_ws IS
  'INTEL-010: Allows webhooks to update reports (e.g., conversation continuations).';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- BREAKING CHANGES:
-- 1. Anon users can NO LONGER SELECT/INSERT/UPDATE reports
--    - Webhooks MUST use service_role key (SUPABASE_SERVICE_ROLE_KEY)
--    - Update webhook handlers to use service_role client
-- 2. Users can ONLY see reports from their own accounts
--    - Dashboard queries automatically scoped by RLS
--    - No application code changes needed (relies on authenticated client)
