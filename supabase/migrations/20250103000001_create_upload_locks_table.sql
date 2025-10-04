-- INTEL-005: Upload Locks Table
-- Prevents concurrent uploads to the same document storage

CREATE TABLE IF NOT EXISTS public.upload_locks (
    storage_id UUID NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by UUID NOT NULL,
    process_id TEXT NOT NULL,

    -- Constraints
    PRIMARY KEY (storage_id),
    FOREIGN KEY (storage_id) REFERENCES public.document_storages(id) ON DELETE CASCADE
    -- Note: locked_by references account_id but no FK constraint to avoid basejump schema coupling
);

-- Index for fast lookups
CREATE INDEX idx_upload_locks_storage_id ON public.upload_locks(storage_id);
CREATE INDEX idx_upload_locks_locked_at ON public.upload_locks(locked_at);

-- RLS Policies
ALTER TABLE public.upload_locks ENABLE ROW LEVEL SECURITY;

-- Allow users to see locks for storages they have access to
CREATE POLICY "Users can view locks for their document storages"
    ON public.upload_locks
    FOR SELECT
    TO authenticated
    USING (
        storage_id IN (
            SELECT id FROM public.document_storages
            WHERE account_id IN (
                SELECT account_id FROM basejump.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- Allow users to create locks for storages they have access to
CREATE POLICY "Users can create locks for their document storages"
    ON public.upload_locks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        storage_id IN (
            SELECT id FROM public.document_storages
            WHERE account_id IN (
                SELECT account_id FROM basejump.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- Allow users to delete their own locks
CREATE POLICY "Users can delete their own locks"
    ON public.upload_locks
    FOR DELETE
    TO authenticated
    USING (locked_by IN (
        SELECT account_id FROM basejump.account_user
        WHERE user_id = auth.uid()
    ));

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.upload_locks TO authenticated;

-- Comment
COMMENT ON TABLE public.upload_locks IS 'INTEL-005: Distributed locks to prevent concurrent uploads to the same document storage';
