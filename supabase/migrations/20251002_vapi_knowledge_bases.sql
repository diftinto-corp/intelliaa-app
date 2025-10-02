-- ============================================================================
-- VAPI Knowledge Bases Table - Migration
-- Created: 2025-10-02 (INTEL-002)
-- Description: Stores metadata for VAPI knowledge bases
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vapi_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,

  -- VAPI Knowledge Base details
  vapi_kb_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'google',

  -- File references
  vapi_file_ids TEXT[] DEFAULT '{}',
  file_count INTEGER DEFAULT 0,

  -- Assistant linkage (optional)
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,

  -- Query tool configuration
  tool_name TEXT,
  tool_description TEXT,

  -- Custom KB configuration (for provider = 'custom-knowledge-base')
  custom_server_url TEXT,
  custom_server_secret TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT vapi_kb_account_check CHECK (account_id IS NOT NULL),
  CONSTRAINT vapi_kb_provider_check CHECK (provider IN ('google', 'custom-knowledge-base')),
  CONSTRAINT vapi_kb_status_check CHECK (status IN ('active', 'inactive', 'error', 'syncing'))
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_vapi_kb_account
  ON public.vapi_knowledge_bases(account_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_vapi_kb_assistant
  ON public.vapi_knowledge_bases(assistant_id)
  WHERE deleted_at IS NULL;

-- Unique constraint (partial for soft delete compatibility)
CREATE UNIQUE INDEX idx_vapi_kb_vapi_id_unique
  ON public.vapi_knowledge_bases(vapi_kb_id)
  WHERE deleted_at IS NULL;

-- Status filtering
CREATE INDEX idx_vapi_kb_status
  ON public.vapi_knowledge_bases(status)
  WHERE deleted_at IS NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_vapi_kb_account_status_active
  ON public.vapi_knowledge_bases(account_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX idx_vapi_kb_assistant_account
  ON public.vapi_knowledge_bases(assistant_id, account_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. CREATE TRIGGERS
-- ============================================================================

-- Auto-update file_count when vapi_file_ids changes
CREATE OR REPLACE FUNCTION update_vapi_kb_file_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.file_count = COALESCE(array_length(NEW.vapi_file_ids, 1), 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vapi_kb_file_count
  BEFORE INSERT OR UPDATE OF vapi_file_ids ON public.vapi_knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_vapi_kb_file_count();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vapi_kb_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vapi_kb_updated_at
  BEFORE UPDATE ON public.vapi_knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_vapi_kb_updated_at();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.vapi_knowledge_bases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE HELPER FUNCTION (Performance Optimization)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_account_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT account_id
  FROM basejump.account_user
  WHERE user_id = auth.uid();
$$;

-- ============================================================================
-- 6. CREATE RLS POLICIES (Optimized)
-- ============================================================================

-- SELECT policy
CREATE POLICY "Users can view knowledge bases for their accounts"
  ON public.vapi_knowledge_bases
  FOR SELECT
  USING (account_id = ANY(ARRAY(SELECT public.get_user_account_ids())));

-- INSERT policy
CREATE POLICY "Users can create knowledge bases for their accounts"
  ON public.vapi_knowledge_bases
  FOR INSERT
  WITH CHECK (account_id = ANY(ARRAY(SELECT public.get_user_account_ids())));

-- UPDATE policy (with account_id change prevention)
CREATE POLICY "Users can update knowledge bases for their accounts"
  ON public.vapi_knowledge_bases
  FOR UPDATE
  USING (account_id = ANY(ARRAY(SELECT public.get_user_account_ids())))
  WITH CHECK (
    account_id = ANY(ARRAY(SELECT public.get_user_account_ids()))
  );

-- DELETE policy
CREATE POLICY "Users can delete knowledge bases for their accounts"
  ON public.vapi_knowledge_bases
  FOR DELETE
  USING (account_id = ANY(ARRAY(SELECT public.get_user_account_ids())));

-- ============================================================================
-- 7. HELPER FUNCTIONS FOR APPLICATION
-- ============================================================================

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_vapi_kb(kb_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.vapi_knowledge_bases
  SET
    deleted_at = NOW(),
    status = 'inactive',
    updated_at = NOW()
  WHERE id = kb_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION soft_delete_vapi_kb TO authenticated;

-- ============================================================================
-- 8. ADD COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.vapi_knowledge_bases IS
  'Stores VAPI knowledge base metadata for multi-tenant voice assistant document storage. Created for INTEL-002.';

COMMENT ON COLUMN public.vapi_knowledge_bases.vapi_kb_id IS
  'VAPI knowledge base ID returned from API. Unique across active (non-deleted) records.';

COMMENT ON COLUMN public.vapi_knowledge_bases.vapi_file_ids IS
  'Array of VAPI file IDs linked to this KB. Max 100 per KB (VAPI limit). For batches >100, see batch operations.';

COMMENT ON COLUMN public.vapi_knowledge_bases.provider IS
  'KB provider: google (default, VAPI-hosted search) or custom-knowledge-base (webhook-based)';

COMMENT ON COLUMN public.vapi_knowledge_bases.assistant_id IS
  'Optional FK to assistant using this KB. SET NULL on assistant deletion allows KB reuse.';

COMMENT ON COLUMN public.vapi_knowledge_bases.file_count IS
  'Auto-computed count of files in vapi_file_ids array. Updated by trigger.';

COMMENT ON COLUMN public.vapi_knowledge_bases.deleted_at IS
  'Soft delete timestamp. RLS does NOT filter deleted records - handle in application layer with WHERE deleted_at IS NULL.';

COMMENT ON COLUMN public.vapi_knowledge_bases.custom_server_secret IS
  'WARNING: Encrypt in application layer before storing. Future: use vault.secrets reference.';

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vapi_knowledge_bases TO authenticated;

COMMIT;
