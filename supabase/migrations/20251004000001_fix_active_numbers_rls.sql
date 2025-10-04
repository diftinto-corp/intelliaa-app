-- ============================================================================
-- INTEL-010: Create RLS Policies for Active Numbers
-- ============================================================================
-- CRITICAL: Table has RLS enabled but NO policies = BLOCKED ACCESS
-- Risk: CRITICAL - Application broken for phone number management

-- Step 1: Create SELECT policy
CREATE POLICY "Users can view phone numbers in their accounts"
  ON public.active_numbers
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 2: Create INSERT policy
CREATE POLICY "Users can add phone numbers to their accounts"
  ON public.active_numbers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create UPDATE policy
CREATE POLICY "Users can update phone numbers in their accounts"
  ON public.active_numbers
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

-- Step 4: Create DELETE policy (restrict to owners/admins)
CREATE POLICY "Owners and admins can delete phone numbers"
  ON public.active_numbers
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
      AND account_role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view phone numbers in their accounts" ON public.active_numbers IS
  'INTEL-010: Multi-tenant isolation. Users can only view phone numbers in accounts they belong to.';

COMMENT ON POLICY "Users can add phone numbers to their accounts" ON public.active_numbers IS
  'INTEL-010: Users can only add phone numbers to accounts they are members of.';

COMMENT ON POLICY "Owners and admins can delete phone numbers" ON public.active_numbers IS
  'INTEL-010: Only owners and admins can delete phone numbers for security.';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- FIXES:
-- 1. Restores phone number management functionality (table was inaccessible)
-- 2. Implements multi-tenant isolation
-- 3. Role-based access control for deletions (owner/admin only)
-- 4. No breaking changes (table was broken, this fixes it)
