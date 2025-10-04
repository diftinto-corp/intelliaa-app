-- ============================================================================
-- INTEL-010: Fix Voice Reports RLS Policies
-- ============================================================================
-- CRITICAL: Protect call recordings, transcripts, and summaries
-- Risk: CRITICAL - Current state allows all users to access all call data

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.report_voice;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.report_voice;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view voice reports in their accounts"
  ON public.report_voice
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
-- Note: VAPI webhooks must use service_role key
CREATE POLICY "Users can create voice reports in their accounts"
  ON public.report_voice
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Service role policy for VAPI webhook inserts
CREATE POLICY "Service role can insert voice reports"
  ON public.report_voice
  FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: Create secure UPDATE policy
CREATE POLICY "Users can update voice reports in their accounts"
  ON public.report_voice
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

-- Step 6: Service role policy for VAPI webhook updates
CREATE POLICY "Service role can update voice reports"
  ON public.report_voice
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Create secure DELETE policy
CREATE POLICY "Users can delete voice reports in their accounts"
  ON public.report_voice
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

COMMENT ON POLICY "Users can view voice reports in their accounts" ON public.report_voice IS
  'INTEL-010: CRITICAL privacy protection. Users can only access call recordings/transcripts from their accounts.';

COMMENT ON POLICY "Service role can insert voice reports" ON public.report_voice IS
  'INTEL-010: Allows VAPI webhooks to insert voice call reports using service_role key.';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- BREAKING CHANGES:
-- 1. Anon users can NO LONGER access voice reports
-- 2. Users can ONLY see call data from their own accounts
-- 3. VAPI webhooks MUST use service_role key in API routes
--    - Update src/app/api/vapi-webhook/route.ts (or similar)
--
-- PRIVACY COMPLIANCE:
-- - Call recordings now properly isolated by account
-- - Transcripts and summaries protected
-- - Complies with GDPR/CCPA data isolation requirements
