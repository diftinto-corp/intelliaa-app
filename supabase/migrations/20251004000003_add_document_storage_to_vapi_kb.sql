-- Migration: INTEL-008 - Add document_storage_id to vapi_knowledge_bases
-- Description: Links VAPI KBs to document storages for assignment feature
-- Author: Claude Code
-- Date: 2025-10-04

BEGIN;

-- ============================================================================
-- ADD DOCUMENT_STORAGE_ID COLUMN
-- ============================================================================

-- Add column (nullable initially for existing records)
ALTER TABLE public.vapi_knowledge_bases
ADD COLUMN IF NOT EXISTS document_storage_id UUID;

-- Add foreign key constraint
ALTER TABLE public.vapi_knowledge_bases
ADD CONSTRAINT vapi_kb_document_storage_fkey
FOREIGN KEY (document_storage_id)
REFERENCES public.document_storages(id)
ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_vapi_kb_document_storage
ON public.vapi_knowledge_bases(document_storage_id)
WHERE deleted_at IS NULL;

-- Add composite index for common query pattern (account + storage)
CREATE INDEX IF NOT EXISTS idx_vapi_kb_account_storage
ON public.vapi_knowledge_bases(account_id, document_storage_id)
WHERE deleted_at IS NULL AND status = 'active';

COMMENT ON COLUMN public.vapi_knowledge_bases.document_storage_id IS
'INTEL-008: Links VAPI KB to document storage. SET NULL on storage deletion allows KB cleanup separately.';

COMMIT;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
    -- Verify column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'vapi_knowledge_bases'
        AND column_name = 'document_storage_id'
    ) THEN
        RAISE EXCEPTION 'Column document_storage_id not created';
    END IF;

    -- Verify FK constraint exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'vapi_kb_document_storage_fkey'
    ) THEN
        RAISE EXCEPTION 'FK constraint vapi_kb_document_storage_fkey not created';
    END IF;

    RAISE NOTICE 'SUCCESS: document_storage_id added to vapi_knowledge_bases';
END $$;

RAISE NOTICE '
================================================================================
INTEL-008: document_storage_id Migration Complete
================================================================================
✅ document_storage_id column added
✅ Foreign key constraint created (SET NULL on delete)
✅ Indexes created for query optimization

NEXT STEPS:
1. Update createVapiKnowledgeBase() to include document_storage_id
2. Update document upload flow to pass documentStorageId
3. Proceed with server actions implementation

NOTE:
- Existing VAPI KBs will have NULL document_storage_id
- Consider backfill script if needed to link existing KBs
================================================================================
';
