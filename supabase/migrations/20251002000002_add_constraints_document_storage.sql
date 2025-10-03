-- ============================================================================
-- INTEL-004: Add Constraints and Performance Indexes
-- ============================================================================
-- Author: INTEL-004 Implementation
-- Date: 2025-10-02
-- Migration: 2 of 4
-- Risk: MEDIUM (requires valid data - pre-migration validation passed)

-- Add NOT NULL constraints (data integrity)
ALTER TABLE public.document_storages
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.pdf_docs
  ALTER COLUMN account_id SET NOT NULL;

-- Add unique constraint on namespace (AC7: Namespace Uniqueness)
-- Note: This is a safeguard. Application already uses crypto-random generation.
ALTER TABLE public.document_storages
  ADD CONSTRAINT document_storages_namespace_unique UNIQUE (namespace);

-- Add check constraint to ensure namespace follows Pinecone format
-- Pattern: ^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$
ALTER TABLE public.document_storages
  ADD CONSTRAINT document_storages_namespace_format CHECK (
    namespace ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' OR
    namespace ~ '^[a-z0-9]{3,63}$'
  );

-- Performance indexes for frequently queried columns
CREATE INDEX idx_document_storages_account_id
  ON public.document_storages(account_id);

CREATE INDEX idx_document_storages_namespace
  ON public.document_storages(namespace);

CREATE INDEX idx_pdf_docs_account_id
  ON public.pdf_docs(account_id);

CREATE INDEX idx_pdf_docs_document_storage_id
  ON public.pdf_docs(document_storage_id);

-- Composite index for common query pattern (list storages by account)
CREATE INDEX idx_document_storages_account_created
  ON public.document_storages(account_id, created_at DESC);

-- Comments
COMMENT ON CONSTRAINT document_storages_namespace_unique ON public.document_storages IS
  'Ensures namespace uniqueness across all document storages. Required for Pinecone isolation.';

COMMENT ON INDEX idx_document_storages_account_created IS
  'Optimizes queries: SELECT * FROM document_storages WHERE account_id = ? ORDER BY created_at DESC';
