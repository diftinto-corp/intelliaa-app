-- ============================================================================
-- Migration: Add namespaces column to assistants table
-- Created: 2025-10-04
-- Feature: INTEL-009 - Assign Document Storage to WhatsApp Assistant
-- Description: Add namespaces array column for caching Pinecone namespaces
-- ============================================================================

-- Add namespaces array column for caching
ALTER TABLE assistants
ADD COLUMN IF NOT EXISTS namespaces TEXT[];

-- Create GIN index for efficient array operations
CREATE INDEX IF NOT EXISTS idx_assistants_namespaces
ON assistants USING GIN (namespaces);

-- Add comment for documentation
COMMENT ON COLUMN assistants.namespaces IS
'Cached array of Pinecone namespace identifiers for assigned document storages. Used by WhatsApp bots for multi-storage RAG queries. Updated via server actions on document_storage-assistants table changes.';

-- Optional: Add constraint to limit max namespaces (prevent performance issues)
ALTER TABLE assistants
ADD CONSTRAINT max_namespaces_limit CHECK (
  namespaces IS NULL OR array_length(namespaces, 1) <= 10
);

-- Add composite index on junction table for better query performance
CREATE INDEX IF NOT EXISTS idx_dsa_assignment
ON "document_storage-assistants" (assistant, document_storage);

-- Add unique constraint to prevent duplicate assignments
ALTER TABLE "document_storage-assistants"
ADD CONSTRAINT IF NOT EXISTS unique_assignment
UNIQUE (assistant, document_storage);

-- Populate existing data from junction table
UPDATE assistants a
SET namespaces = (
  SELECT array_agg(DISTINCT ds.namespace ORDER BY ds.namespace)
  FROM "document_storage-assistants" dsa
  INNER JOIN document_storages ds ON ds.id = dsa.document_storage
  WHERE dsa.assistant = a.id
)
WHERE EXISTS (
  SELECT 1
  FROM "document_storage-assistants" dsa
  WHERE dsa.assistant = a.id
);

-- ============================================================================
-- Migration complete
-- ============================================================================
