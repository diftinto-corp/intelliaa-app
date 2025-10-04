-- ============================================================================
-- INTEL-010: Add UPDATE Policy to Document Storage Assignments Junction Table
-- ============================================================================
-- Priority: MEDIUM (completeness, rarely used)
-- Risk: LOW - Junction tables rarely need updates, but policy adds completeness

-- Create UPDATE policy for document_storage-assistants
CREATE POLICY "Users can update assignments in their accounts"
  ON "document_storage-assistants"
  FOR UPDATE
  TO authenticated
  USING (
    -- User must own the assistant
    EXISTS (
      SELECT 1
      FROM assistants a
      INNER JOIN basejump.account_user au ON au.account_id = a.account_id
      WHERE a.id = "document_storage-assistants".assistant
      AND au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Validate user still owns assistant after update
    EXISTS (
      SELECT 1
      FROM assistants a
      INNER JOIN basejump.account_user au ON au.account_id = a.account_id
      WHERE a.id = "document_storage-assistants".assistant
      AND au.user_id = auth.uid()
    )
    AND
    -- Validate user owns new storage (if storage ID changed)
    EXISTS (
      SELECT 1
      FROM document_storages ds
      INNER JOIN basejump.account_user au ON au.account_id = ds.account_id
      WHERE ds.id = "document_storage-assistants".document_storage
      AND au.user_id = auth.uid()
    )
    AND
    -- CRITICAL: Validate SAME account (prevent cross-account reassignment)
    (
      SELECT a.account_id
      FROM assistants a
      WHERE a.id = "document_storage-assistants".assistant
    ) = (
      SELECT ds.account_id
      FROM document_storages ds
      WHERE ds.id = "document_storage-assistants".document_storage
    )
  );

COMMENT ON POLICY "Users can update assignments in their accounts" ON "document_storage-assistants" IS
  'INTEL-010: Allows updating junction table assignments while preventing cross-account data leakage.';
