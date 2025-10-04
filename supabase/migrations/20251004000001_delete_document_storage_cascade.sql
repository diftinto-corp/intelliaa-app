-- INTEL-007: Delete Document Storage with Comprehensive Validation
-- Migration: Add PostgreSQL function for atomic document storage deletion

-- Function: delete_document_storage_cascade
-- Purpose: Safely deletes document storage with validation and cascade deletion
-- Returns: JSONB with success status and error details if validation fails

CREATE OR REPLACE FUNCTION delete_document_storage_cascade(
  p_document_storage_id UUID,
  p_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS for junction table check
SET search_path = public -- Security: prevent search_path attacks
AS $$
DECLARE
  v_assigned_assistants JSONB;
  v_pdf_count INTEGER;
  v_qa_count INTEGER;
  v_storage_name TEXT;
  v_namespace TEXT;
BEGIN
  -- Step 1: Validate ownership (RLS bypass for explicit check)
  SELECT name, namespace INTO v_storage_name, v_namespace
  FROM document_storages
  WHERE id = p_document_storage_id
    AND account_id = p_account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NOT_FOUND',
      'message', 'Almacenamiento no encontrado o sin acceso'
    );
  END IF;

  -- Step 2: Check for assistant assignments
  SELECT jsonb_agg(
    jsonb_build_object(
      'assistant_id', a.id,
      'assistant_name', a.name
    )
  )
  INTO v_assigned_assistants
  FROM "document_storage-assistants" dsa
  INNER JOIN assistants a ON dsa.assistant = a.id
  WHERE dsa.document_storage = p_document_storage_id
    AND a.account_id = p_account_id; -- Additional security check

  -- If assigned to any assistants, return error with details
  IF v_assigned_assistants IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ASSIGNED_TO_ASSISTANTS',
      'message', 'No se puede eliminar. El almacenamiento está asignado a uno o más asistentes.',
      'assigned_assistants', v_assigned_assistants
    );
  END IF;

  -- Step 3: Count related records (for logging/audit)
  SELECT COUNT(*) INTO v_pdf_count
  FROM pdf_docs
  WHERE document_storage_id = p_document_storage_id;

  SELECT COUNT(*) INTO v_qa_count
  FROM qa_docs
  WHERE document_storage_id = p_document_storage_id;

  -- Step 4: Begin cascade deletion (order matters)

  -- Delete pdf_docs first
  DELETE FROM pdf_docs
  WHERE document_storage_id = p_document_storage_id
    AND account_id = p_account_id; -- RLS-friendly

  -- Delete qa_docs second
  DELETE FROM qa_docs
  WHERE document_storage_id = p_document_storage_id
    AND account_id = p_account_id; -- RLS-friendly

  -- Finally delete document_storages (will fail if FK constraint violated)
  DELETE FROM document_storages
  WHERE id = p_document_storage_id
    AND account_id = p_account_id; -- RLS-friendly

  -- Step 5: Return success with metadata
  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'document_storage_id', p_document_storage_id,
      'storage_name', v_storage_name,
      'namespace', v_namespace,
      'pdf_docs_count', v_pdf_count,
      'qa_docs_count', v_qa_count
    )
  );

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FOREIGN_KEY_VIOLATION',
      'message', 'Error de integridad: existen registros relacionados que impiden la eliminación',
      'detail', SQLERRM
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DATABASE_ERROR',
      'message', 'Error inesperado en la base de datos',
      'detail', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users (RLS handled inside function)
GRANT EXECUTE ON FUNCTION delete_document_storage_cascade(UUID, UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION delete_document_storage_cascade IS
  'INTEL-007: Safely deletes document storage with validation and cascade deletion.
   Returns JSONB with success status and error details if validation fails.

   Usage:
   SELECT delete_document_storage_cascade(
     ''doc-storage-uuid''::uuid,
     ''account-uuid''::uuid
   );

   Response structure:
   {
     "success": true/false,
     "error_code": "NOT_FOUND" | "ASSIGNED_TO_ASSISTANTS" | "FOREIGN_KEY_VIOLATION" | "DATABASE_ERROR",
     "message": "User-friendly error message",
     "assigned_assistants": [...], // Only if ASSIGNED_TO_ASSISTANTS
     "deleted": {...} // Only if success
   }';

-- Create indexes for performance (if not exist)
CREATE INDEX IF NOT EXISTS idx_pdf_docs_storage_id
  ON pdf_docs(document_storage_id);

CREATE INDEX IF NOT EXISTS idx_qa_docs_storage_id
  ON qa_docs(document_storage_id);

CREATE INDEX IF NOT EXISTS idx_document_storage_assistants_storage
  ON "document_storage-assistants"(document_storage);
