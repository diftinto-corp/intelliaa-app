-- ============================================================================
-- INTEL-004: Add Embedding Metadata Columns to pdf_docs
-- ============================================================================
-- Author: INTEL-004 Implementation
-- Date: 2025-10-02
-- Migration: 1 of 4
-- Risk: LOW (adds nullable columns, backward compatible)

-- Add embedding service tracking (Vercel AI SDK vs Flowise)
ALTER TABLE public.pdf_docs
  ADD COLUMN embedding_service TEXT
  CHECK (embedding_service IN ('vercel', 'flowise'));

-- Add chunk count for metrics
ALTER TABLE public.pdf_docs
  ADD COLUMN chunk_count INTEGER
  CHECK (chunk_count >= 0);

-- Add embedding metadata (cost, tokens, processing time)
ALTER TABLE public.pdf_docs
  ADD COLUMN embedding_metadata JSONB;

-- Add comments for documentation
COMMENT ON COLUMN public.pdf_docs.embedding_service IS
  'Embedding service used: vercel (Vercel AI SDK with OpenAI) or flowise (Flowise legacy)';

COMMENT ON COLUMN public.pdf_docs.chunk_count IS
  'Number of text chunks generated from PDF for embedding';

COMMENT ON COLUMN public.pdf_docs.embedding_metadata IS
  'JSONB metadata: {service, model, chunkCount, totalTokens, estimatedCost, processingTime, namespace}';
