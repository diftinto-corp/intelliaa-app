# INTEL-005: Database Migration Guide

## Migration: Upload Locks Table

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the migration SQL below
5. Click **Run**

### Option 2: Supabase CLI (if installed)

```bash
# From project root
supabase migration up

# Or push directly
supabase db push
```

### Option 3: Run via Script

```bash
# From project root
npm run migrate:intel-005
```

---

## Migration SQL

```sql
-- INTEL-005: Upload Locks Table
-- Prevents concurrent uploads to the same document storage

CREATE TABLE IF NOT EXISTS public.upload_locks (
    storage_id UUID NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by UUID NOT NULL,
    process_id TEXT NOT NULL,

    -- Constraints
    PRIMARY KEY (storage_id),
    FOREIGN KEY (storage_id) REFERENCES public.document_storages(id) ON DELETE CASCADE,
    FOREIGN KEY (locked_by) REFERENCES public.accounts(id) ON DELETE CASCADE
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
```

---

## Verification

After running the migration, verify with:

```sql
-- Check table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'upload_locks';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'upload_locks';

-- Check policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'upload_locks';
```

Expected output:
- Table: `upload_locks` exists
- RLS: `rowsecurity = true`
- Policies: 3 policies (SELECT, INSERT, DELETE)

---

## Rollback (if needed)

```sql
-- Drop table and all related objects
DROP TABLE IF EXISTS public.upload_locks CASCADE;
```

---

## Testing the Migration

After migration, test the lock mechanism:

```sql
-- Manual test: Acquire lock
INSERT INTO public.upload_locks (storage_id, locked_by, process_id)
VALUES (
    '<document-storage-id>',
    '<account-id>',
    'test-process-123'
);

-- Should fail with unique constraint violation
INSERT INTO public.upload_locks (storage_id, locked_by, process_id)
VALUES (
    '<document-storage-id>',
    '<account-id>',
    'test-process-456'
);

-- Release lock
DELETE FROM public.upload_locks
WHERE storage_id = '<document-storage-id>'
AND process_id = 'test-process-123';

-- Cleanup
DELETE FROM public.upload_locks WHERE process_id LIKE 'test-process-%';
```

---

## Troubleshooting

### Error: Foreign key constraint violation

**Problem**: `document_storages` or `accounts` table doesn't exist

**Solution**: Ensure INTEL-004 migration is applied first

### Error: Permission denied

**Problem**: RLS policies are too restrictive

**Solution**: Check that the user has proper account membership

### Error: Table already exists

**Solution**: Migration already applied - skip or use `CREATE TABLE IF NOT EXISTS`

---

## Next Steps

1. ✅ Run migration
2. ✅ Verify table creation
3. ✅ Test lock acquisition/release
4. ✅ Deploy to production
