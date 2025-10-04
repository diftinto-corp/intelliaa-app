-- ============================================================================
-- INTEL-010: Fix QA Documents RLS Policies
-- ============================================================================
-- HIGH: Protect knowledge base Q&A data
-- Risk: HIGH - Current SELECT allows all users to see all QA docs

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "All logged in users can select" ON public.qa_docs;
DROP POLICY IF EXISTS "Account members can update" ON public.qa_docs;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.qa_docs;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view QA docs in their accounts"
  ON public.qa_docs
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
CREATE POLICY "Users can create QA docs in their accounts"
  ON public.qa_docs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Create secure UPDATE policy
CREATE POLICY "Users can update QA docs in their accounts"
  ON public.qa_docs
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

-- Step 5: Create secure DELETE policy
CREATE POLICY "Users can delete QA docs in their accounts"
  ON public.qa_docs
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

COMMENT ON POLICY "Users can view QA docs in their accounts" ON public.qa_docs IS
  'INTEL-010: Multi-tenant isolation for QA documents (knowledge base data).';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- CHANGES:
-- 1. Users can ONLY see QA docs from their own accounts
-- 2. All CRUD operations now properly scoped
-- 3. No breaking changes (authenticated users only, as before)
