-- Migration: Add embedding metadata columns and feature flags
-- Related to: INTEL-001 - Vercel AI SDK Embedding Service
-- Description: Adds columns to track embedding service usage and feature flags for gradual rollout

-- Add embedding service tracking columns to pdf_docs table
ALTER TABLE pdf_docs
  ADD COLUMN IF NOT EXISTS embedding_service TEXT DEFAULT 'flowise',
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

-- Add index for efficient filtering by embedding service
CREATE INDEX IF NOT EXISTS idx_pdf_docs_embedding_service
  ON pdf_docs(embedding_service);

-- Add comment to explain the embedding_service column
COMMENT ON COLUMN pdf_docs.embedding_service IS
  'Tracks which service generated embeddings: flowise (legacy) or vercel (new Vercel AI SDK)';

COMMENT ON COLUMN pdf_docs.chunk_count IS
  'Number of chunks created during document processing';

COMMENT ON COLUMN pdf_docs.embedding_metadata IS
  'JSON metadata including model used, token count, cost, processing time, etc.';

-- Add feature flag column to accounts table for per-account control
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS use_vercel_embeddings BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN accounts.use_vercel_embeddings IS
  'When true, account uses Vercel AI SDK for embeddings. When false, uses Flowise (default).';

-- Create feature_flags table for global rollout control
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT UNIQUE NOT NULL,
  enabled_percentage INTEGER DEFAULT 0 CHECK (enabled_percentage >= 0 AND enabled_percentage <= 100),
  enabled_accounts UUID[] DEFAULT '{}',
  disabled_accounts UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments to feature_flags table
COMMENT ON TABLE feature_flags IS
  'Global feature flag control for gradual rollout of new features';

COMMENT ON COLUMN feature_flags.feature_name IS
  'Unique identifier for the feature (e.g., vercel_embeddings)';

COMMENT ON COLUMN feature_flags.enabled_percentage IS
  'Percentage of accounts (0-100) that have this feature enabled for gradual rollout';

COMMENT ON COLUMN feature_flags.enabled_accounts IS
  'Array of account UUIDs that always have this feature enabled (whitelist)';

COMMENT ON COLUMN feature_flags.disabled_accounts IS
  'Array of account UUIDs that never have this feature enabled (blacklist)';

-- Insert initial feature flag for Vercel embeddings (disabled by default)
INSERT INTO feature_flags (feature_name, enabled_percentage)
VALUES ('vercel_embeddings', 0)
ON CONFLICT (feature_name) DO NOTHING;

-- Create embedding_usage table for cost tracking
CREATE TABLE IF NOT EXISTS embedding_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_id UUID REFERENCES pdf_docs(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('flowise', 'vercel')),
  model TEXT NOT NULL,
  total_tokens INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  estimated_cost NUMERIC(10, 6) NOT NULL,
  processing_time INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_embedding_usage_account_id
  ON embedding_usage(account_id);

CREATE INDEX IF NOT EXISTS idx_embedding_usage_created_at
  ON embedding_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_usage_account_created
  ON embedding_usage(account_id, created_at DESC);

-- Add comments
COMMENT ON TABLE embedding_usage IS
  'Tracks embedding generation usage and costs per account for monitoring and billing';

COMMENT ON COLUMN embedding_usage.service IS
  'Which service generated the embeddings: flowise or vercel';

COMMENT ON COLUMN embedding_usage.model IS
  'The embedding model used (e.g., text-embedding-ada-002, text-embedding-3-small)';

COMMENT ON COLUMN embedding_usage.total_tokens IS
  'Total tokens processed for cost calculation';

COMMENT ON COLUMN embedding_usage.estimated_cost IS
  'Estimated cost in USD for this embedding generation';

COMMENT ON COLUMN embedding_usage.processing_time IS
  'Processing time in milliseconds';

-- Enable Row Level Security on new tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_flags (read-only for authenticated users)
CREATE POLICY "Feature flags are viewable by all authenticated users"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for embedding_usage (users can only see their own account's usage)
CREATE POLICY "Users can view their account's embedding usage"
  ON embedding_usage FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- Only allow inserts through service role (server-side only)
CREATE POLICY "Only service role can insert embedding usage"
  ON embedding_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add updated_at trigger for feature_flags
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
