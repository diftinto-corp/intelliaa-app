-- ============================================================================
-- INTEL-004: Enable Row Level Security (RLS) Policies
-- ============================================================================
-- Author: INTEL-004 Implementation
-- Date: 2025-10-02
-- Migration: 4 of 4
-- Risk: HIGH IMPACT (changes data access patterns system-wide)

-- Enable RLS on document_storages (AC6: Multi-tenant Isolation)
ALTER TABLE public.document_storages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pdf_docs (AC6: Multi-tenant Isolation)
ALTER TABLE public.pdf_docs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for document_storages
-- ============================================================================

-- Policy 1: SELECT - Users can view storages in their accounts
CREATE POLICY "Users can view document storages in their accounts"
  ON public.document_storages
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Users can create storages in accounts they belong to
-- Note: This policy is secondary to the PostgreSQL function which handles authorization
CREATE POLICY "Users can create document storages in their accounts"
  ON public.document_storages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: UPDATE - Users can update storages in their accounts
CREATE POLICY "Users can update document storages in their accounts"
  ON public.document_storages
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

-- Policy 4: DELETE - Users can delete storages in their accounts
CREATE POLICY "Users can delete document storages in their accounts"
  ON public.document_storages
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
-- RLS Policies for pdf_docs
-- ============================================================================

-- Policy 1: SELECT - Users can view PDF docs in their accounts
CREATE POLICY "Users can view PDF docs in their accounts"
  ON public.pdf_docs
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Users can create PDF docs in accounts they belong to
CREATE POLICY "Users can create PDF docs in their accounts"
  ON public.pdf_docs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: UPDATE - Users can update PDF docs in their accounts
CREATE POLICY "Users can update PDF docs in their accounts"
  ON public.pdf_docs
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

-- Policy 4: DELETE - Users can delete PDF docs in their accounts
CREATE POLICY "Users can delete PDF docs in their accounts"
  ON public.pdf_docs
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

COMMENT ON POLICY "Users can view document storages in their accounts" ON public.document_storages IS
  'AC6: Multi-tenant isolation. Users can only view document storages in accounts they are members of.';

COMMENT ON POLICY "Users can view PDF docs in their accounts" ON public.pdf_docs IS
  'AC6: Multi-tenant isolation. Users can only view PDF docs in accounts they are members of.';
