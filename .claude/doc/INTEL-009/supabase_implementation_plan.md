# INTEL-009: Supabase Database Implementation Plan
# Assign Document Storage to WhatsApp Assistant

**Created**: 2025-10-04
**Feature**: WhatsApp Assistant Document Storage Assignment
**Related**: INTEL-008 (Voice Assistant Assignment - Reference Implementation)

---

## Executive Summary

After comprehensive database analysis, **NO SCHEMA CHANGES ARE REQUIRED**. The existing `document_storage-assistants` junction table (created for INTEL-008) supports both voice and WhatsApp assistants without modification.

**Key Findings:**
- Junction table already exists with proper foreign keys and indexes
- No unique constraint on (assistant, document_storage) - allows duplicates (needs attention)
- RLS is **DISABLED** on junction table (intentional for cross-service access)
- `assistants.docs_keys` field exists (JSONB array) but is NOT the right solution for namespaces
- Namespace storage strategy: Use junction table + aggregate namespaces in application code

---

## Current Database State Analysis

### 1. Junction Table: `document_storage-assistants`

**Schema:**
```sql
CREATE TABLE public."document_storage-assistants" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_storage UUID, -- FK to document_storages.id
  assistant UUID          -- FK to assistants.id
);
```

**Constraints:**
- ✅ Primary Key: `id` (UUID)
- ✅ Foreign Key: `assistant` → `assistants(id)`
- ✅ Foreign Key: `document_storage` → `document_storages(id)`
- ❌ **MISSING**: Unique constraint on `(assistant, document_storage)` to prevent duplicates
- ❌ **MISSING**: Cascade delete rules (ON DELETE behavior not defined)

**Indexes:**
- ✅ `document_storage-assistas_pkey` on `id` (B-tree, unique)
- ✅ `idx_document_storage_assistants_storage` on `document_storage` (B-tree, non-unique)
- ❌ **MISSING**: Index on `assistant` for efficient reverse lookup

**RLS Status:**
- ❌ RLS **DISABLED** (`rls_enabled: false`)
- ⚠️ **CRITICAL SECURITY NOTE**: RLS is disabled intentionally because:
  - Voice assistants (VAPI) need access without user session
  - WhatsApp bots (Railway) need access without user session
  - Access control enforced at application layer via `account_id` validation

**Rows:** 0 (table empty - new feature)

### 2. Assistants Table: `assistants`

**Relevant Fields for INTEL-009:**
```sql
-- Core fields
id UUID PRIMARY KEY
account_id UUID NOT NULL  -- Multi-tenant isolation
namespace TEXT UNIQUE     -- Assistant's unique namespace (for own data)
name TEXT
type_assistant TEXT       -- NULL, 'voice', 'whatsapp', etc.

-- WhatsApp specific
activated_whatsApp BOOLEAN DEFAULT false
service_id_rw TEXT        -- Railway service ID
qr_url TEXT
is_deploying_ws BOOLEAN DEFAULT false

-- Document keys (legacy/confusing field)
docs_keys JSONB[]         -- Array of JSONB objects
```

**Analysis of `docs_keys` field:**
- **Data Type**: `ARRAY` of `JSONB` (not TEXT[], not simple JSONB)
- **Current Usage**: Unknown (no code references found in assistants.ts)
- **INTEL-009 Decision**: ❌ **DO NOT USE** for namespace storage because:
  - Complex data type (array of JSONB) adds unnecessary overhead
  - Junction table is the correct normalized approach
  - INTEL-008 already established junction table pattern
  - Voice assistants don't use `docs_keys` either

**Namespace Field:**
- Each assistant has **ONE** `namespace` (unique constraint)
- Used for assistant's **own** data isolation (e.g., Flowise bot config)
- **NOT** for storing document storage namespaces (that's junction table's job)

### 3. Document Storages Table: `document_storages`

**Schema:**
```sql
CREATE TABLE public.document_storages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  description TEXT,
  namespace TEXT UNIQUE,  -- Pinecone namespace for this storage
  account_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  update_at TIMESTAMPTZ DEFAULT now()
);
```

**Namespace Constraint:**
```sql
CHECK (
  namespace ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' OR
  namespace ~ '^[a-z0-9]{3,63}$'
)
```

**Key Points:**
- Each document storage has **ONE** unique Pinecone namespace
- Namespace format: lowercase alphanumeric + hyphens, 3-63 chars
- Multiple PDF files can exist within the same namespace
- One assistant can access **MULTIPLE** namespaces via junction table

---

## Database Architecture Decision

### ✅ RECOMMENDED: Junction Table Pattern (Current Implementation)

**Data Model:**
```
assistants (1) ──< document_storage-assistants >── (1) document_storages
                         (junction table)

One assistant can have MANY document storages
One document storage can be assigned to MANY assistants
```

**How Namespaces are Retrieved:**
```sql
-- Get all namespaces for WhatsApp assistant
SELECT DISTINCT ds.namespace
FROM document_storages ds
INNER JOIN "document_storage-assistants" dsa
  ON dsa.document_storage = ds.id
WHERE dsa.assistant = '<assistant_id>'
ORDER BY ds.namespace;
```

**Application Layer:**
```typescript
// In server action
const namespaces = await getNamespacesForAssistant(assistantId);
// Returns: ['storage1-abc123', 'storage2-def456']

// Update Railway/Buildship with namespace array
await updateWhatsAppBotConfig(assistantId, {
  namespaces: namespaces
});
```

**Advantages:**
- ✅ Normalized database design (3NF)
- ✅ Consistent with INTEL-008 voice assistant pattern
- ✅ Easy to query and manage
- ✅ Supports many-to-many relationships
- ✅ Auditability (created_at timestamp per assignment)
- ✅ No data duplication

**Disadvantages:**
- ⚠️ Requires JOIN to get namespaces (acceptable performance cost)
- ⚠️ No built-in ordering of namespaces (use `ORDER BY dsa.created_at` if needed)

### ❌ REJECTED: Store in `assistants.docs_keys` JSONB Array

**Why Rejected:**
```typescript
// This approach would look like:
assistants.docs_keys = [
  { "pinecone_namespaces": ["ns1", "ns2"] }
]
```

**Problems:**
- ❌ Denormalized (duplicates namespace data)
- ❌ Hard to query (requires JSONB operators)
- ❌ No referential integrity (no FK to document_storages)
- ❌ Inconsistent with voice assistant pattern (INTEL-008)
- ❌ Complex data type (array of JSONB)
- ❌ No audit trail (when was storage assigned?)
- ❌ Difficult to validate (prevent duplicates)

---

## Required Database Changes

### Migration 1: Add Missing Indexes (Performance)

**File**: `supabase/migrations/YYYYMMDD_add_junction_indexes_intel009.sql`

```sql
-- ===========================================================================
-- INTEL-009: Add Performance Indexes to document_storage-assistants
-- ===========================================================================
-- Purpose: Optimize queries for WhatsApp assistant namespace retrieval
-- Impact: Improves query performance for assignment checks and namespace lookups
-- Breaking: No (additive only)
-- ===========================================================================

-- Index for efficient assistant lookup (reverse direction)
-- Used by: getNamespacesForAssistant(), getAssignedStoragesForAssistant()
CREATE INDEX IF NOT EXISTS idx_document_storage_assistants_assistant
ON public."document_storage-assistants"(assistant);

-- Composite index for duplicate prevention queries
-- Used by: Check for existing assignment before insert
CREATE INDEX IF NOT EXISTS idx_document_storage_assistants_composite
ON public."document_storage-assistants"(assistant, document_storage);

-- Add index comments for documentation
COMMENT ON INDEX idx_document_storage_assistants_assistant IS
  'INTEL-009: Optimize reverse lookup of storages assigned to assistant';

COMMENT ON INDEX idx_document_storage_assistants_composite IS
  'INTEL-009: Optimize duplicate detection and assignment validation';
```

**Rationale:**
- `idx_document_storage_assistants_assistant`: Currently only `document_storage` is indexed
- `idx_document_storage_assistants_composite`: Speeds up duplicate checks (AC7)
- Both indexes are small (UUIDs) and won't impact insert performance

### Migration 2: Add Unique Constraint (Data Integrity)

**File**: `supabase/migrations/YYYYMMDD_prevent_duplicate_assignments_intel009.sql`

```sql
-- ===========================================================================
-- INTEL-009: Prevent Duplicate Document Storage Assignments
-- ===========================================================================
-- Purpose: Ensure one storage can only be assigned once to same assistant
-- Impact: Prevents data inconsistency and duplicate namespace entries
-- Breaking: No (will fail if duplicates exist - safe)
-- Rollback: DROP CONSTRAINT IF EXISTS
-- ===========================================================================

-- Add unique constraint (will fail if duplicates exist)
DO $$
BEGIN
  -- Check for existing duplicates first
  IF EXISTS (
    SELECT 1
    FROM public."document_storage-assistants"
    GROUP BY assistant, document_storage
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique constraint: duplicate assignments exist. Run cleanup first.';
  END IF;

  -- Add constraint if no duplicates
  ALTER TABLE public."document_storage-assistants"
  ADD CONSTRAINT uq_assistant_storage
  UNIQUE (assistant, document_storage);

  RAISE NOTICE 'Unique constraint added successfully';
END $$;

-- Add constraint comment
COMMENT ON CONSTRAINT uq_assistant_storage
ON public."document_storage-assistants" IS
  'INTEL-009: Prevent duplicate assignment of same storage to same assistant';
```

**Rollback:**
```sql
ALTER TABLE public."document_storage-assistants"
DROP CONSTRAINT IF EXISTS uq_assistant_storage;
```

**Safety:**
- Migration will **FAIL** if duplicates exist (good - prevents data corruption)
- Current table is empty (0 rows) so constraint will apply cleanly
- Future inserts that violate constraint will get error code `23505`

### Migration 3: Add Cascade Delete Rules (Optional - Recommended)

**File**: `supabase/migrations/YYYYMMDD_add_cascade_rules_intel009.sql`

```sql
-- ===========================================================================
-- INTEL-009: Add Cascade Delete Rules to Junction Table
-- ===========================================================================
-- Purpose: Auto-cleanup assignments when assistant or storage is deleted
-- Impact: Simplifies deletion logic, prevents orphaned records
-- Breaking: No (only affects delete behavior)
-- ===========================================================================

-- Drop existing foreign keys (they don't have ON DELETE)
ALTER TABLE public."document_storage-assistants"
DROP CONSTRAINT IF EXISTS "public_document_storage-assistants_assistant_fkey",
DROP CONSTRAINT IF EXISTS "public_document_storage-assistants_document-storage_fkey";

-- Re-create with CASCADE delete
ALTER TABLE public."document_storage-assistants"
ADD CONSTRAINT "public_document_storage-assistants_assistant_fkey"
  FOREIGN KEY (assistant)
  REFERENCES public.assistants(id)
  ON DELETE CASCADE,
ADD CONSTRAINT "public_document_storage-assistants_document-storage_fkey"
  FOREIGN KEY (document_storage)
  REFERENCES public.document_storages(id)
  ON DELETE CASCADE;

-- Add comments
COMMENT ON CONSTRAINT "public_document_storage-assistants_assistant_fkey"
ON public."document_storage-assistants" IS
  'INTEL-009: Cascade delete assignments when assistant is deleted';

COMMENT ON CONSTRAINT "public_document_storage-assistants_document-storage_fkey"
ON public."document_storage-assistants" IS
  'INTEL-009: Cascade delete assignments when storage is deleted (prevented by INTEL-007)';
```

**Impact Analysis:**
- **When assistant deleted**: Auto-removes all storage assignments ✅
- **When storage deleted**: INTEL-007 already prevents deletion if assigned ✅
- No breaking changes to existing deletion logic

**Alternative (Keep Current Behavior):**
- Current: No cascade (manual cleanup required)
- Safer for production (explicit deletion only)
- Requires application code to delete assignments first

---

## RLS Policies Analysis

### Current State: RLS DISABLED

**Junction Table RLS Status:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'document_storage-assistants';

-- Result: rowsecurity = false
```

**Why RLS is Disabled:**
1. **VAPI Access**: Voice assistants query without user session
2. **Railway Access**: WhatsApp bots query without user session
3. **Buildship Webhooks**: External services need read access
4. **Multi-Service Architecture**: Junction table accessed by multiple backend services

### Security Model

**Current Protection:**
```typescript
// Application-layer security (server actions)
async function assignDocumentStorage(assistantId, storageId) {
  const supabase = await createClient(); // Has user session

  // 1. Verify user owns assistant
  const { data: assistant } = await supabase
    .from('assistants')
    .select('account_id')
    .eq('id', assistantId)
    .single(); // RLS on assistants table enforces ownership

  // 2. Verify user owns storage
  const { data: storage } = await supabase
    .from('document_storages')
    .select('account_id')
    .eq('id', storageId)
    .single(); // RLS on document_storages enforces ownership

  // 3. Verify same account (prevent cross-account assignments)
  if (assistant.account_id !== storage.account_id) {
    throw new Error('Account mismatch');
  }

  // 4. Insert into junction table (no RLS)
  await supabase
    .from('document_storage-assistants')
    .insert({ assistant: assistantId, document_storage: storageId });
}
```

**Protection Layers:**
1. ✅ `assistants` table has RLS (account-based)
2. ✅ `document_storages` table has RLS (account-based)
3. ✅ Server actions validate account ownership before insert
4. ✅ Junction table foreign keys enforce referential integrity
5. ⚠️ Direct Supabase access to junction table is unrestricted

### ⚠️ RECOMMENDATION: Enable RLS with Service Role Bypass

**Option A: Keep RLS Disabled (Current - Simplest)**
- ✅ Works for current architecture
- ✅ No breaking changes
- ⚠️ Requires discipline in server actions
- ⚠️ Direct database access is unprotected

**Option B: Enable RLS with Policy (More Secure)**

```sql
-- Enable RLS
ALTER TABLE public."document_storage-assistants"
ENABLE ROW LEVEL SECURITY;

-- Policy: User can read assignments for their account's assistants
CREATE POLICY select_own_assignments
ON public."document_storage-assistants"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM basejump.account_user au
    INNER JOIN public.assistants a ON a.account_id = au.account_id
    WHERE a.id = assistant
      AND au.user_id = auth.uid()
  )
);

-- Policy: User can insert if they own both assistant and storage
CREATE POLICY insert_own_assignments
ON public."document_storage-assistants"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM basejump.account_user au
    INNER JOIN public.assistants a ON a.account_id = au.account_id
    INNER JOIN public.document_storages ds ON ds.account_id = au.account_id
    WHERE a.id = assistant
      AND ds.id = document_storage
      AND au.user_id = auth.uid()
  )
);

-- Policy: User can delete assignments for their account
CREATE POLICY delete_own_assignments
ON public."document_storage-assistants"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM basejump.account_user au
    INNER JOIN public.assistants a ON a.account_id = au.account_id
    WHERE a.id = assistant
      AND au.user_id = auth.uid()
  )
);

-- Grant service role bypass for external services
GRANT ALL ON public."document_storage-assistants" TO service_role;
```

**Recommendation for INTEL-009:**
- ✅ **Keep RLS disabled** (simpler, matches current architecture)
- Document security model in code comments
- Add validation in server actions (already done in INTEL-008)
- Consider RLS migration as separate future improvement (INTEL-0XX)

---

## Query Performance Analysis

### Query 1: Get Namespaces for WhatsApp Assistant

```sql
-- Used when: Deploying WhatsApp bot to Railway
-- Frequency: Low (only on bot deployment/update)
EXPLAIN ANALYZE
SELECT DISTINCT ds.namespace
FROM public.document_storages ds
INNER JOIN public."document_storage-assistants" dsa
  ON dsa.document_storage = ds.id
WHERE dsa.assistant = '<assistant_id>'
ORDER BY ds.namespace;
```

**Performance (with new indexes):**
- ✅ `assistant` index → O(log n) lookup on junction table
- ✅ `document_storage` FK → index scan on document_storages
- Estimated: < 5ms for 100 assignments

**Without indexes (current):**
- ⚠️ Sequential scan on junction table
- Estimated: 10-50ms for 1000+ assignments

### Query 2: Check for Duplicate Assignment

```sql
-- Used when: Before inserting new assignment
-- Frequency: High (every assignment attempt)
EXPLAIN ANALYZE
SELECT id
FROM public."document_storage-assistants"
WHERE assistant = '<assistant_id>'
  AND document_storage = '<storage_id>';
```

**Performance (with composite index):**
- ✅ Composite index (assistant, document_storage) → O(log n) lookup
- Estimated: < 1ms

**With unique constraint:**
- ✅ Database-level enforcement (no query needed)
- Insert will fail with error code `23505` if duplicate

### Query 3: Get Available Storages (Not Assigned)

```sql
-- Used when: UI shows dropdown of available storages
-- Frequency: Medium (every time assignment UI loads)
EXPLAIN ANALYZE
SELECT ds.id, ds.name, ds.namespace
FROM public.document_storages ds
WHERE ds.account_id = '<account_id>'
  AND NOT EXISTS (
    SELECT 1
    FROM public."document_storage-assistants" dsa
    WHERE dsa.document_storage = ds.id
      AND dsa.assistant = '<assistant_id>'
  )
ORDER BY ds.name;
```

**Performance (with indexes):**
- ✅ `account_id` index on document_storages (assumed from RLS)
- ✅ `document_storage` index on junction table
- Estimated: < 10ms for 100 storages

---

## Migration Execution Plan

### Phase 1: Analysis (Completed ✅)
- [x] Review current schema
- [x] Analyze INTEL-008 implementation
- [x] Identify missing indexes
- [x] Document RLS status
- [x] Query performance analysis

### Phase 2: Schema Improvements (Optional but Recommended)

**Priority 1: Add Indexes (Required for Performance)**
```bash
# Create migration file
supabase migration new add_junction_indexes_intel009

# Apply locally
supabase db push

# Test queries
psql $DATABASE_URL -f test_queries.sql

# Deploy to production
git push origin main
# CI/CD will apply migration
```

**Priority 2: Add Unique Constraint (Recommended for Data Integrity)**
```bash
# Create migration file
supabase migration new prevent_duplicate_assignments_intel009

# Apply locally
supabase db push

# Verify constraint
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conrelid = 'public.\"document_storage-assistants\"'::regclass;"

# Deploy to production
```

**Priority 3: Add Cascade Rules (Optional - Can Be Done Later)**
```bash
# Create migration file
supabase migration new add_cascade_rules_intel009

# Apply locally and test deletion behavior
```

### Phase 3: Rollback Plan

**If Migration Fails:**
```sql
-- Rollback indexes (safe - will auto-recreate on next migration)
DROP INDEX IF EXISTS idx_document_storage_assistants_assistant;
DROP INDEX IF EXISTS idx_document_storage_assistants_composite;

-- Rollback unique constraint
ALTER TABLE public."document_storage-assistants"
DROP CONSTRAINT IF EXISTS uq_assistant_storage;

-- Rollback cascade rules (restore original FKs)
ALTER TABLE public."document_storage-assistants"
DROP CONSTRAINT IF EXISTS "public_document_storage-assistants_assistant_fkey",
DROP CONSTRAINT IF EXISTS "public_document_storage-assistants_document-storage_fkey";

ALTER TABLE public."document_storage-assistants"
ADD CONSTRAINT "public_document_storage-assistants_assistant_fkey"
  FOREIGN KEY (assistant) REFERENCES public.assistants(id),
ADD CONSTRAINT "public_document_storage-assistants_document-storage_fkey"
  FOREIGN KEY (document_storage) REFERENCES public.document_storages(id);
```

---

## Server Actions Implementation Guide

### Required Actions (Modeled After INTEL-008)

**File**: `src/lib/actions/intelliaa/documentStorageAssignments.ts`

```typescript
/**
 * Assign document storage to WhatsApp assistant
 * Similar to assignDocumentStorageToVoiceAssistant but for WhatsApp
 */
export async function assignDocumentStorageToWhatsAppAssistant(
  assistantId: string,
  documentStorageId: string
): Promise<AssignmentResult>

/**
 * Unassign document storage from WhatsApp assistant
 * Similar to unassignDocumentStorageFromVoiceAssistant
 */
export async function unassignDocumentStorageFromWhatsAppAssistant(
  assignmentId: string
): Promise<AssignmentResult>

/**
 * Get namespaces for WhatsApp assistant (NEW - not in voice implementation)
 * Used by Railway/Buildship integration
 */
export async function getNamespacesForWhatsAppAssistant(
  assistantId: string
): Promise<{ success: boolean; namespaces?: string[]; error?: string }>

/**
 * REUSE from INTEL-008 (works for both voice and WhatsApp)
 */
export { getAssignedStoragesForAssistant }
export { getAvailableStoragesForAssistant }
```

### Implementation Workflow

**1. Assign Storage Flow:**
```typescript
async function assignDocumentStorageToWhatsAppAssistant(assistantId, storageId) {
  // 1. Authenticate user
  // 2. Fetch assistant (validate exists, get account_id)
  // 3. Fetch storage (validate exists, get namespace)
  // 4. Validate same account_id (prevent cross-account)
  // 5. Check for duplicate assignment (idempotent - return success if exists)
  // 6. Insert into junction table
  // 7. Get ALL namespaces for assistant (query junction + storages)
  // 8. Update Railway/Buildship bot config with namespace array
  // 9. Return success
}
```

**2. Unassign Storage Flow:**
```typescript
async function unassignDocumentStorageFromWhatsAppAssistant(assignmentId) {
  // 1. Authenticate user
  // 2. Fetch assignment with joined data
  // 3. Validate user access
  // 4. Delete from junction table
  // 5. Get remaining namespaces for assistant
  // 6. Update Railway/Buildship bot config (remove this namespace)
  // 7. Return success
}
```

**3. Railway Integration:**
```typescript
// In Railway/Buildship update function
async function updateWhatsAppBotConfig(assistantId: string, namespaces: string[]) {
  const mutation = `
    mutation UpdateBot($id: ID!, $namespaces: [String!]!) {
      updateBot(id: $id, input: { namespaces: $namespaces }) {
        id
        namespaces
      }
    }
  `;

  const response = await fetch(RAILWAY_URI, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: mutation,
      variables: { id: assistantId, namespaces }
    })
  });

  return response.json();
}
```

---

## Differences from INTEL-008 (Voice Assistant)

| Aspect | Voice (INTEL-008) | WhatsApp (INTEL-009) |
|--------|-------------------|----------------------|
| **External Service** | VAPI | Railway/Buildship |
| **Config Format** | VAPI tools array | Namespace array |
| **Knowledge Base** | VAPI KB (vapi_kb_id) | Pinecone namespace directly |
| **Tool Generation** | Create query tool per storage | Single namespace list |
| **Rollback** | Remove tool from VAPI | Update namespace array |
| **Assistant ID Field** | `voice_assistant_id` | `service_id_rw` |
| **Activation Field** | N/A (always active) | `activated_whatsApp` |

**Shared Code:**
- ✅ `getAssignedStoragesForAssistant()` - works for both
- ✅ `getAvailableStoragesForAssistant()` - works for both
- ✅ Junction table operations - identical
- ✅ Validation logic - identical

**WhatsApp-Specific Code:**
- ❌ No VAPI KB lookup needed (use Pinecone directly)
- ✅ Railway GraphQL mutation instead of VAPI REST API
- ✅ Simpler configuration (just namespace array, no tool generation)

---

## Testing Strategy

### Unit Tests

```typescript
describe('WhatsApp Document Storage Assignment', () => {
  test('assigns storage successfully', async () => {
    const result = await assignDocumentStorageToWhatsAppAssistant(
      assistantId,
      storageId
    );
    expect(result.success).toBe(true);
  });

  test('prevents duplicate assignment', async () => {
    // Assign once
    await assignDocumentStorageToWhatsAppAssistant(assistantId, storageId);

    // Assign again - should be idempotent
    const result = await assignDocumentStorageToWhatsAppAssistant(assistantId, storageId);
    expect(result.success).toBe(true);
    expect(result.message).toContain('ya está asignado');
  });

  test('prevents cross-account assignment', async () => {
    const result = await assignDocumentStorageToWhatsAppAssistant(
      assistantInAccount1,
      storageInAccount2
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('ACCOUNT_MISMATCH');
  });

  test('retrieves namespaces correctly', async () => {
    await assignDocumentStorageToWhatsAppAssistant(assistantId, storage1Id);
    await assignDocumentStorageToWhatsAppAssistant(assistantId, storage2Id);

    const result = await getNamespacesForWhatsAppAssistant(assistantId);
    expect(result.namespaces).toHaveLength(2);
    expect(result.namespaces).toContain(storage1Namespace);
    expect(result.namespaces).toContain(storage2Namespace);
  });
});
```

### Integration Tests

```typescript
describe('Railway Integration', () => {
  test('updates bot config with namespaces', async () => {
    const namespaces = ['ns1', 'ns2'];
    const result = await updateWhatsAppBotConfig(assistantId, namespaces);
    expect(result.data.updateBot.namespaces).toEqual(namespaces);
  });

  test('handles Railway API errors gracefully', async () => {
    // Mock Railway API failure
    mockRailwayError();

    const result = await assignDocumentStorageToWhatsAppAssistant(assistantId, storageId);
    // Should rollback junction table insert
    expect(result.success).toBe(false);
  });
});
```

### Database Tests

```sql
-- Test unique constraint
BEGIN;
  INSERT INTO "document_storage-assistants" (assistant, document_storage)
  VALUES ('assistant-uuid', 'storage-uuid');

  -- Should fail with error code 23505
  INSERT INTO "document_storage-assistants" (assistant, document_storage)
  VALUES ('assistant-uuid', 'storage-uuid');
ROLLBACK;

-- Test cascade delete (if enabled)
BEGIN;
  INSERT INTO assistants (...) VALUES (...) RETURNING id;
  INSERT INTO "document_storage-assistants" (assistant, ...) VALUES (...);

  DELETE FROM assistants WHERE id = ...;

  -- Should auto-delete from junction table
  SELECT COUNT(*) FROM "document_storage-assistants" WHERE assistant = ...;
  -- Expected: 0
ROLLBACK;

-- Test index usage
EXPLAIN ANALYZE
SELECT ds.namespace
FROM document_storages ds
INNER JOIN "document_storage-assistants" dsa ON dsa.document_storage = ds.id
WHERE dsa.assistant = '<uuid>';
-- Should show "Index Scan" not "Seq Scan"
```

---

## Critical Implementation Notes

### 1. Namespace Storage Decision

**DO ✅:**
- Use junction table for M:N relationship
- Query namespaces dynamically via JOIN
- Store namespace array in memory for Railway update
- Follow INTEL-008 pattern for consistency

**DON'T ❌:**
- Store namespaces in `assistants.docs_keys` JSONB array
- Duplicate namespace data across tables
- Cache namespaces in assistant record
- Create separate table for WhatsApp assignments

### 2. Duplicate Prevention Strategy

**Database Level (Recommended):**
```sql
ALTER TABLE "document_storage-assistants"
ADD CONSTRAINT uq_assistant_storage UNIQUE (assistant, document_storage);
```

**Application Level (Fallback):**
```typescript
const existing = await supabase
  .from('document_storage-assistants')
  .select('id')
  .eq('assistant', assistantId)
  .eq('document_storage', storageId)
  .maybeSingle();

if (existing) {
  return { success: true, message: 'Already assigned' }; // Idempotent
}
```

**Both levels are recommended** for defense in depth.

### 3. Railway Update Timing

**CRITICAL ORDER:**
```typescript
// ❌ WRONG ORDER (can leave orphaned DB records)
await insertJunctionTable();
await updateRailway(); // Might fail, leaving invalid assignment

// ✅ CORRECT ORDER (rollback on failure)
try {
  await insertJunctionTable();
  const namespaces = await getNamespaces();
  await updateRailway(namespaces);
} catch (error) {
  await deleteJunctionTable(); // Rollback
  throw error;
}
```

Alternative: **Optimistic approach** (INTEL-008 pattern)
```typescript
// Insert DB first (creates assignment record)
// Update Railway (if fails, assignment still valid but not active)
// Railway webhook or retry can fix later
```

### 4. Index Requirements

**MINIMUM (Required for production):**
- `idx_document_storage_assistants_assistant` - reverse lookup

**OPTIMAL (Recommended):**
- `idx_document_storage_assistants_assistant` - reverse lookup
- `idx_document_storage_assistants_composite` - duplicate checks
- `uq_assistant_storage` - database-enforced uniqueness

### 5. Error Handling

```typescript
// Error codes to handle
const ERROR_CODES = {
  '23505': 'DUPLICATE_ASSIGNMENT', // Unique constraint violation
  '23503': 'FK_VIOLATION',          // Assistant or storage doesn't exist
  '42501': 'INSUFFICIENT_PRIVILEGE', // RLS blocked (if enabled)
};

// User-friendly messages
const MESSAGES = {
  DUPLICATE_ASSIGNMENT: 'Este almacenamiento ya está asignado',
  FK_VIOLATION: 'Asistente o almacenamiento no encontrado',
  ACCOUNT_MISMATCH: 'El almacenamiento y el asistente deben pertenecer a la misma cuenta',
  RAILWAY_ERROR: 'Error al actualizar configuración del bot',
};
```

---

## Breaking Changes & Compatibility

### Breaking Changes: NONE ✅

**Migrations are additive only:**
- New indexes don't change query results
- Unique constraint only affects future inserts
- Cascade rules only affect delete behavior (opt-in)
- RLS remains disabled (no auth change)

### Backwards Compatibility

**Existing Code:**
- Junction table already created (INTEL-008)
- Foreign keys already exist
- INTEL-008 voice assignments unaffected

**New Code:**
- Can reuse INTEL-008 helper functions
- Same database table, different external service
- No conflicts between voice and WhatsApp assignments

---

## Security Considerations

### 1. Multi-Tenant Isolation

**Enforcement:**
```typescript
// CRITICAL: Always validate account_id match
if (assistant.account_id !== storage.account_id) {
  throw new Error('Cross-account assignment blocked');
}
```

**Why Junction Table Has No RLS:**
- Assistants protected by RLS (account_user check)
- Document storages protected by RLS (account_user check)
- Junction table enforces FK integrity
- Server actions validate account match
- External services (VAPI, Railway) need unauthenticated access

### 2. Authorization Checks

**Required Validation:**
```typescript
// 1. User is authenticated
const { user } = await supabase.auth.getUser();
if (!user) throw new Error('Unauthorized');

// 2. User has access to assistant's account
const { data: accountAccess } = await supabase
  .from('basejump.account_user')
  .select('account_id')
  .eq('account_id', assistant.account_id)
  .eq('user_id', user.id)
  .single();

if (!accountAccess) throw new Error('Forbidden');

// 3. Same account for both resources
if (assistant.account_id !== storage.account_id) {
  throw new Error('Account mismatch');
}
```

### 3. SQL Injection Prevention

**Safe (Parameterized Queries):**
```typescript
// ✅ Supabase client uses parameterized queries
await supabase
  .from('document_storage-assistants')
  .select('*')
  .eq('assistant', assistantId);
```

**Unsafe (Direct SQL):**
```typescript
// ❌ NEVER DO THIS
await supabase.rpc('raw_sql', {
  query: `SELECT * FROM "document_storage-assistants" WHERE assistant = '${assistantId}'`
});
```

---

## Monitoring & Observability

### Metrics to Track

**Assignment Operations:**
```typescript
// Track in application logs
console.log('[INTEL-009] Assignment operation', {
  operation: 'assign',
  assistantId,
  storageId,
  accountId,
  success: true,
  durationMs: 45
});
```

**Database Queries:**
```sql
-- Monitor slow queries (>100ms)
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%document_storage-assistants%'
  AND mean_exec_time > 100
ORDER BY mean_exec_time DESC;
```

**Junction Table Growth:**
```sql
-- Monitor table size
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT assistant) as assistants_with_assignments,
  COUNT(DISTINCT document_storage) as storages_assigned,
  AVG(assignments_per_assistant) as avg_assignments
FROM (
  SELECT assistant, COUNT(*) as assignments_per_assistant
  FROM "document_storage-assistants"
  GROUP BY assistant
) stats;
```

### Health Checks

```typescript
// API endpoint: /api/health/intel-009
export async function GET() {
  const supabase = await createClient();

  // Check junction table health
  const { count, error } = await supabase
    .from('document_storage-assistants')
    .select('*', { count: 'exact', head: true });

  // Check for orphaned records (FK violations - shouldn't exist)
  const { data: orphaned } = await supabase.rpc('check_orphaned_assignments');

  return Response.json({
    healthy: !error && orphaned.length === 0,
    stats: { totalAssignments: count, orphaned: orphaned.length }
  });
}
```

---

## Future Improvements

### 1. Batch Assignment API

```typescript
// Assign multiple storages at once
export async function assignMultipleStorages(
  assistantId: string,
  storageIds: string[]
): Promise<AssignmentResult[]>
```

### 2. Assignment Templates

```typescript
// Save common storage combinations
export async function createAssignmentTemplate(
  name: string,
  storageIds: string[]
)

export async function applyTemplate(
  assistantId: string,
  templateId: string
)
```

### 3. Assignment History/Audit Log

```sql
CREATE TABLE document_storage_assignment_history (
  id UUID PRIMARY KEY,
  assignment_id UUID, -- nullable (if unassigned)
  assistant UUID,
  document_storage UUID,
  action TEXT, -- 'assigned' | 'unassigned'
  performed_by UUID, -- user who made change
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. RLS Migration

**Future Enhancement** (INTEL-0XX):
- Enable RLS on junction table
- Add policies for authenticated users
- Service role bypass for external services
- Migrate existing code to handle RLS

---

## Summary & Recommendations

### Required Changes: NONE (But Recommended)

**Schema is ready for INTEL-009 implementation:**
- ✅ Junction table exists
- ✅ Foreign keys exist
- ✅ Basic index exists

**Recommended Improvements:**
1. **Add indexes** (Priority 1 - Performance)
2. **Add unique constraint** (Priority 2 - Data integrity)
3. **Add cascade rules** (Priority 3 - Optional)

### Implementation Checklist

**Database:**
- [ ] Run migration 1: Add indexes
- [ ] Run migration 2: Add unique constraint
- [ ] (Optional) Run migration 3: Add cascade rules
- [ ] Verify migrations in local Supabase
- [ ] Test queries with indexes

**Server Actions:**
- [ ] Implement `assignDocumentStorageToWhatsAppAssistant()`
- [ ] Implement `unassignDocumentStorageFromWhatsAppAssistant()`
- [ ] Implement `getNamespacesForWhatsAppAssistant()`
- [ ] Add Railway/Buildship integration
- [ ] Add error handling and rollback logic

**Testing:**
- [ ] Unit tests for server actions
- [ ] Integration tests with Railway
- [ ] Database constraint tests
- [ ] Performance tests with indexes

**Documentation:**
- [ ] Update context file with findings
- [ ] Document namespace retrieval pattern
- [ ] Add code comments in server actions
- [ ] Update API documentation

### Next Steps

1. **Review this plan** with team/stakeholders
2. **Create migrations** in `supabase/migrations/`
3. **Test locally** with `supabase start`
4. **Implement server actions** following INTEL-008 pattern
5. **Update Railway integration** to accept namespace array
6. **Create UI components** for assignment management
7. **Deploy to staging** and verify
8. **Deploy to production** with monitoring

---

## Document Metadata

**Author**: Claude (Supabase Architect)
**Date**: 2025-10-04
**Feature**: INTEL-009
**Status**: ✅ Analysis Complete - Ready for Implementation
**Supabase Version**: Latest (v0.5.2 SSR)
**Next.js Version**: 15.5.4
**Database**: PostgreSQL via Supabase

**Related Documents:**
- INTEL-008: Voice Assistant Assignment (reference implementation)
- INTEL-007: Document Storage Deletion (cascade behavior)
- INTEL-004: Document Storage Creation (namespace generation)

**Confidence Level**: HIGH (95%)
- Schema analysis completed via MCP tools
- INTEL-008 pattern validated
- No breaking changes required
- Clear implementation path
