# INTEL-010: Multi-Tenant Security Implementation Plan

**Status**: Implementation Plan
**Priority**: P0 - Critical
**Created**: 2025-10-04
**Author**: Supabase Architect (Claude Code)

---

## Executive Summary

This document provides a comprehensive security audit and implementation plan for the IntelliAA platform's multi-tenant Row Level Security (RLS) architecture. The analysis covers 9 critical tables, identifies 7 major security gaps, and provides detailed migration strategies to ensure complete data isolation between organizations.

### Critical Findings

**SEVERITY: HIGH** - Several tables have inadequate or missing RLS policies that could allow cross-account data access:

1. **report_ws**: Overly permissive policies allow `anon` role SELECT access (all users can see all reports)
2. **report_voice**: No account-based filtering (all authenticated users can see all call records)
3. **qa_docs**: Missing account-based RLS policies (has RLS enabled but policies use `true` for SELECT)
4. **assistants**: Multiple conflicting policies, some overly permissive (`anon` SELECT all)
5. **document_storage-assistants**: RLS enabled but needs UPDATE policy
6. **vapi_knowledge_bases**: Uses custom function `get_user_account_ids()` - needs verification
7. **active_numbers**: RLS enabled but no policies found in query results

### Tables Analyzed

| Table | RLS Enabled | Policies Found | Status |
|-------|-------------|----------------|--------|
| `document_storages` | ✅ Yes | 4 (SELECT, INSERT, UPDATE, DELETE) | ✅ **SECURE** |
| `pdf_docs` | ✅ Yes | 4 (SELECT, INSERT, UPDATE, DELETE) | ✅ **SECURE** |
| `document_storage-assistants` | ✅ Yes | 3 (SELECT, INSERT, DELETE) | ⚠️ **MISSING UPDATE** |
| `assistants` | ✅ Yes | 6 (conflicting policies) | 🔴 **INSECURE** |
| `report_ws` | ✅ Yes | 6 (overly permissive) | 🔴 **INSECURE** |
| `report_voice` | ✅ Yes | 2 (no account filtering) | 🔴 **INSECURE** |
| `qa_docs` | ✅ Yes | 3 (permissive SELECT) | 🔴 **INSECURE** |
| `vapi_knowledge_bases` | ✅ Yes | 4 (uses custom function) | ⚠️ **NEEDS VERIFICATION** |
| `active_numbers` | ✅ Yes | 0 (no policies in results) | 🔴 **NO POLICIES** |

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Security Gaps Identified](#security-gaps-identified)
3. [Recommended RLS Policies](#recommended-rls-policies)
4. [Migration Strategy](#migration-strategy)
5. [Testing Approach](#testing-approach)
6. [Rollback Plan](#rollback-plan)
7. [Application-Level Security](#application-level-security)
8. [External Service Isolation](#external-service-isolation)
9. [Acceptance Criteria Validation](#acceptance-criteria-validation)

---

## 1. Current State Analysis

### 1.1 Secure Tables (No Changes Needed)

#### `document_storages`
**Status**: ✅ SECURE - Properly implemented RLS policies

**Current Policies**:
```sql
-- SELECT: Users can view storages in their accounts
USING (account_id IN (
  SELECT account_id FROM basejump.account_user
  WHERE user_id = auth.uid()
))

-- INSERT: Users can create storages in their accounts
WITH CHECK (account_id IN (
  SELECT account_id FROM basejump.account_user
  WHERE user_id = auth.uid()
))

-- UPDATE: Users can update storages in their accounts
USING (account_id IN (...)) WITH CHECK (account_id IN (...))

-- DELETE: Users can delete storages in their accounts
USING (account_id IN (...))
```

**Security Assessment**: ✅ All CRUD operations properly scoped to user's accounts.

---

#### `pdf_docs`
**Status**: ✅ SECURE - Properly implemented RLS policies

**Current Policies**: Identical pattern to `document_storages` - all operations scoped by `account_id`.

**Security Assessment**: ✅ Complete multi-tenant isolation.

---

#### `document_storage-assistants` (Junction Table)
**Status**: ⚠️ MOSTLY SECURE - Missing UPDATE policy

**Current Policies**:
```sql
-- SELECT: Users can view assignments for their accounts
USING (
  EXISTS (
    SELECT 1 FROM assistants a
    INNER JOIN basejump.account_user au ON au.account_id = a.account_id
    WHERE a.id = "document_storage-assistants".assistant
    AND au.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM document_storages ds
    INNER JOIN basejump.account_user au ON au.account_id = ds.account_id
    WHERE ds.id = "document_storage-assistants".document_storage
    AND au.user_id = auth.uid()
  )
)

-- INSERT: Validates SAME account for assistant AND storage
WITH CHECK (
  -- Validates user owns assistant
  -- Validates user owns storage
  -- CRITICAL: Validates assistant.account_id = storage.account_id
)

-- DELETE: Users can delete assignments for assistants they own
USING (EXISTS (SELECT 1 FROM assistants WHERE ...))
```

**Security Assessment**: ✅ Excellent cross-account prevention on INSERT. ⚠️ Missing UPDATE policy (though junction tables rarely need updates).

**Recommendation**: Add UPDATE policy for completeness (even if not actively used).

---

### 1.2 Insecure Tables (Require Fixes)

#### `assistants`
**Status**: 🔴 CRITICAL - Multiple conflicting and overly permissive policies

**Current Policies** (6 total):
1. ✅ `Account members can select` - Scoped by account
2. ✅ `Account members can insert` - Scoped by account
3. 🔴 `Enable read access for all users` (anon role) - **ALLOWS ANON USERS TO SELECT ALL**
4. 🔴 `Enable insert for authenticated users only` - `WITH CHECK (true)` **NO VALIDATION**
5. 🔴 `Account members can update` - `USING (true)` **NO VALIDATION**
6. ✅ `Delete Assistant by account_id` - Scoped by account

**Security Issues**:
- **CRITICAL**: Anonymous users can SELECT all assistants (policy #3)
- **HIGH**: Authenticated users can INSERT to any account (policy #4 with `WITH CHECK (true)`)
- **HIGH**: Users can UPDATE any assistant (policy #5 with `USING (true)`)
- **Conflicting**: Multiple policies for same operation create confusion

**Impact**: Cross-account data leakage, unauthorized modifications.

---

#### `report_ws` (WhatsApp Reports)
**Status**: 🔴 CRITICAL - Allows anonymous and cross-account SELECT

**Current Policies** (6 total):
1. 🔴 `All logged in users can select` (anon, authenticated) - `USING (true)` **NO ACCOUNT FILTER**
2. 🔴 `Enable insert for authenticated users only` (anon, authenticated) - `WITH CHECK (true)` **NO VALIDATION**
3. ✅ `Account members can insert` - Scoped by account
4. ✅ `Account members can update` - Scoped by account
5. 🔴 `Update with anon` - `USING (true)` **ANON CAN UPDATE ALL**
6. ✅ `Account members can delete` - Scoped by account

**Security Issues**:
- **CRITICAL**: Anonymous users can SELECT all WhatsApp reports from all accounts
- **CRITICAL**: Anonymous users can INSERT reports to any account
- **CRITICAL**: Anonymous users can UPDATE any report
- **Conflicting**: Multiple policies for same operations

**Impact**: Complete data exposure, unauthorized access to sensitive conversation data.

---

#### `report_voice` (Voice Call Reports)
**Status**: 🔴 CRITICAL - No account-based filtering

**Current Policies** (2 total):
1. 🔴 `Enable read access for all users` (anon, authenticated) - `USING (true)` **NO ACCOUNT FILTER**
2. 🔴 `Enable insert for authenticated users only` (anon) - `WITH CHECK (true)` **NO VALIDATION**

**Security Issues**:
- **CRITICAL**: All users can SELECT all voice call reports (includes recordings, transcripts, summaries)
- **CRITICAL**: Anonymous users can INSERT reports to any account
- **Missing**: No UPDATE or DELETE policies

**Impact**: Massive privacy violation - call recordings and transcripts visible to all users.

---

#### `qa_docs` (Question-Answer Documents)
**Status**: 🔴 HIGH - Overly permissive SELECT, missing account scoping

**Current Policies** (3 total):
1. 🔴 `All logged in users can select` - `USING (true)` **NO ACCOUNT FILTER**
2. 🔴 `Account members can update` - `USING (true)` **NO VALIDATION**
3. ✅ `Enable delete for users based on user_id` - Scoped by account

**Security Issues**:
- **HIGH**: All authenticated users can SELECT all QA docs from all accounts
- **HIGH**: All authenticated users can UPDATE any QA doc
- **Missing**: No INSERT policy (defaults to deny, but should be explicit)

**Impact**: Knowledge base data leakage between organizations.

---

#### `active_numbers` (Phone Numbers)
**Status**: 🔴 CRITICAL - RLS enabled but NO policies found

**Current Policies**: NONE (0 policies returned from `pg_policies`)

**Security Issues**:
- **CRITICAL**: RLS enabled with no policies = **ALL OPERATIONS BLOCKED** (even for legitimate users)
- **Breaking**: Application likely broken for this table
- **Missing**: All CRUD policies needed

**Impact**: Table is inaccessible to users (likely causing errors in phone number management).

---

#### `vapi_knowledge_bases`
**Status**: ⚠️ NEEDS VERIFICATION - Uses custom helper function

**Current Policies** (4 total):
```sql
-- All policies use: get_user_account_ids()
USING (account_id = ANY (ARRAY(SELECT get_user_account_ids())))
```

**Security Assessment**: ⚠️ Policies are well-structured, BUT depend on custom function `get_user_account_ids()`.

**Action Required**: Verify function implementation matches Basejump pattern.

---

## 2. Security Gaps Identified

### 2.1 Critical Security Vulnerabilities

| Gap ID | Table | Severity | Description | Impact |
|--------|-------|----------|-------------|--------|
| GAP-001 | `assistants` | CRITICAL | Anonymous SELECT all assistants | Cross-account data exposure |
| GAP-002 | `assistants` | HIGH | Unvalidated INSERT/UPDATE | Unauthorized modifications |
| GAP-003 | `report_ws` | CRITICAL | Anonymous SELECT/INSERT/UPDATE all reports | Complete WhatsApp data exposure |
| GAP-004 | `report_voice` | CRITICAL | All users SELECT all call records | Privacy violation (recordings/transcripts) |
| GAP-005 | `qa_docs` | HIGH | All users SELECT/UPDATE all QA docs | Knowledge base leakage |
| GAP-006 | `active_numbers` | CRITICAL | No policies = table inaccessible | Application broken |
| GAP-007 | `document_storage-assistants` | MEDIUM | Missing UPDATE policy | Incomplete CRUD coverage |

### 2.2 Policy Conflict Issues

**Problem**: Multiple policies for same operation on same table can create confusion and security holes.

**Affected Tables**:
- `assistants`: 2x SELECT, 2x INSERT, 2x UPDATE policies
- `report_ws`: 2x SELECT, 2x INSERT, 2x UPDATE policies

**Basejump RLS Pattern**: PostgreSQL evaluates ALL policies with OR logic. If ANY policy returns `true`, access is granted.

**Example**:
```sql
-- Policy 1: Secure
CREATE POLICY "Secure policy" ON assistants FOR SELECT
TO authenticated
USING (account_id IN (SELECT basejump.get_accounts_with_role()));

-- Policy 2: Insecure (grants access to everyone)
CREATE POLICY "Insecure policy" ON assistants FOR SELECT
TO anon
USING (true);  -- ALWAYS TRUE

-- Result: Even if Policy 1 would deny, Policy 2 grants access to anon users
```

**Solution**: Drop all insecure policies, keep only account-scoped policies.

---

## 3. Recommended RLS Policies

### 3.1 Standard Multi-Tenant RLS Pattern

**Template** (used by Basejump):
```sql
-- SELECT: Users can only view records in their accounts
CREATE POLICY "Account members can select" ON {table_name}
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Users can only insert to their accounts
CREATE POLICY "Account members can insert" ON {table_name}
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- UPDATE: Users can only update records in their accounts
CREATE POLICY "Account members can update" ON {table_name}
FOR UPDATE
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- DELETE: Users can only delete from their accounts
-- Optional: Restrict to owners/admins by using basejump.get_accounts_with_role('owner')
CREATE POLICY "Account members can delete" ON {table_name}
FOR DELETE
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);
```

---

### 3.2 Migration SQL: Fix `assistants` Table

**File**: `supabase/migrations/20251004_fix_assistants_rls.sql`

```sql
-- ============================================================================
-- INTEL-010: Fix Assistants Table RLS Policies
-- ============================================================================
-- CRITICAL: Remove overly permissive policies and standardize to Basejump pattern
-- Risk: HIGH - Removes anon access, may break webhooks (review API routes)

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.assistants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.assistants;
DROP POLICY IF EXISTS "Account members can update" ON public.assistants;

-- Step 2: Keep secure policies, rename for clarity
-- Note: "Account members can select" and "Account members can insert" are already secure

-- Step 3: Create secure UPDATE policy
CREATE POLICY "Account members can update assistants"
  ON public.assistants
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: DELETE policy is already secure ("Delete Assistant by account_id")
-- Optionally rename for consistency
DROP POLICY IF EXISTS "Delete Assistant by account_id" ON public.assistants;

CREATE POLICY "Account members can delete assistants"
  ON public.assistants
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
      -- Optional: Restrict to owners only
      -- WHERE user_id = auth.uid() AND account_role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Account members can select" ON public.assistants IS
  'INTEL-010: Users can only view assistants in accounts they are members of';

COMMENT ON POLICY "Account members can insert" ON public.assistants IS
  'INTEL-010: Users can only create assistants in accounts they belong to';

COMMENT ON POLICY "Account members can update assistants" ON public.assistants IS
  'INTEL-010: Users can only update assistants in their accounts';

COMMENT ON POLICY "Account members can delete assistants" ON public.assistants IS
  'INTEL-010: Users can only delete assistants in their accounts';

-- ============================================================================
-- WARNING: Webhook Considerations
-- ============================================================================
-- If external webhooks (Railway, Buildship, VAPI) need to update assistants:
-- 1. Use service_role key (bypasses RLS) in webhook handlers
-- 2. OR create separate policy for service_role:
--
-- CREATE POLICY "Service role can update assistants"
--   ON public.assistants
--   FOR UPDATE
--   TO service_role
--   USING (true)
--   WITH CHECK (true);
```

---

### 3.3 Migration SQL: Fix `report_ws` Table

**File**: `supabase/migrations/20251004_fix_report_ws_rls.sql`

```sql
-- ============================================================================
-- INTEL-010: Fix WhatsApp Reports RLS Policies
-- ============================================================================
-- CRITICAL: Remove all anon access and cross-account SELECT
-- Risk: HIGH - Breaks webhook inserts if using anon key (must use service_role)

-- Step 1: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "All logged in users can select" ON public.report_ws;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.report_ws;
DROP POLICY IF EXISTS "Update with anon" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can insert" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can update" ON public.report_ws;
DROP POLICY IF EXISTS "Account members can delete" ON public.report_ws;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view reports in their accounts"
  ON public.report_ws
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create secure INSERT policy
-- Note: Webhooks from Railway/WhatsApp must use service_role key
CREATE POLICY "Users can create reports in their accounts"
  ON public.report_ws
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Service role policy for webhook inserts (REQUIRED for webhooks)
CREATE POLICY "Service role can insert reports"
  ON public.report_ws
  FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: Create secure UPDATE policy
CREATE POLICY "Users can update reports in their accounts"
  ON public.report_ws
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 6: Service role policy for webhook updates
CREATE POLICY "Service role can update reports"
  ON public.report_ws
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Create secure DELETE policy
CREATE POLICY "Users can delete reports in their accounts"
  ON public.report_ws
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view reports in their accounts" ON public.report_ws IS
  'INTEL-010: Multi-tenant isolation. Users can only view WhatsApp reports from their accounts.';

COMMENT ON POLICY "Service role can insert reports" ON public.report_ws IS
  'INTEL-010: Allows Railway/WhatsApp webhooks to insert reports using service_role key.';

COMMENT ON POLICY "Service role can update reports" ON public.report_ws IS
  'INTEL-010: Allows webhooks to update reports (e.g., conversation continuations).';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- BREAKING CHANGES:
-- 1. Anon users can NO LONGER SELECT/INSERT/UPDATE reports
--    - Webhooks MUST use service_role key (NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
--    - Update src/app/api/railway/route.ts to use service_role client
-- 2. Users can ONLY see reports from their own accounts
--    - Dashboard queries automatically scoped by RLS
--    - No application code changes needed (relies on authenticated client)
```

---

### 3.4 Migration SQL: Fix `report_voice` Table

**File**: `supabase/migrations/20251004_fix_report_voice_rls.sql`

```sql
-- ============================================================================
-- INTEL-010: Fix Voice Reports RLS Policies
-- ============================================================================
-- CRITICAL: Protect call recordings, transcripts, and summaries
-- Risk: CRITICAL - Current state allows all users to access all call data

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.report_voice;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.report_voice;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view voice reports in their accounts"
  ON public.report_voice
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create secure INSERT policy
-- Note: VAPI webhooks must use service_role key
CREATE POLICY "Users can create voice reports in their accounts"
  ON public.report_voice
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Service role policy for VAPI webhook inserts
CREATE POLICY "Service role can insert voice reports"
  ON public.report_voice
  FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: Create secure UPDATE policy
CREATE POLICY "Users can update voice reports in their accounts"
  ON public.report_voice
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 6: Service role policy for VAPI webhook updates
CREATE POLICY "Service role can update voice reports"
  ON public.report_voice
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Create secure DELETE policy
CREATE POLICY "Users can delete voice reports in their accounts"
  ON public.report_voice
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view voice reports in their accounts" ON public.report_voice IS
  'INTEL-010: CRITICAL privacy protection. Users can only access call recordings/transcripts from their accounts.';

COMMENT ON POLICY "Service role can insert voice reports" ON public.report_voice IS
  'INTEL-010: Allows VAPI webhooks to insert voice call reports using service_role key.';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- BREAKING CHANGES:
-- 1. Anon users can NO LONGER access voice reports
-- 2. Users can ONLY see call data from their own accounts
-- 3. VAPI webhooks MUST use service_role key in API routes
--    - Update src/app/api/vapi-webhook/route.ts (or similar)
--
-- PRIVACY COMPLIANCE:
-- - Call recordings now properly isolated by account
-- - Transcripts and summaries protected
-- - Complies with GDPR/CCPA data isolation requirements
```

---

### 3.5 Migration SQL: Fix `qa_docs` Table

**File**: `supabase/migrations/20251004_fix_qa_docs_rls.sql`

```sql
-- ============================================================================
-- INTEL-010: Fix QA Documents RLS Policies
-- ============================================================================
-- HIGH: Protect knowledge base Q&A data
-- Risk: HIGH - Current SELECT allows all users to see all QA docs

-- Step 1: Drop all existing insecure policies
DROP POLICY IF EXISTS "All logged in users can select" ON public.qa_docs;
DROP POLICY IF EXISTS "Account members can update" ON public.qa_docs;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.qa_docs;

-- Step 2: Create secure SELECT policy
CREATE POLICY "Users can view QA docs in their accounts"
  ON public.qa_docs
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create secure INSERT policy
CREATE POLICY "Users can create QA docs in their accounts"
  ON public.qa_docs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Create secure UPDATE policy
CREATE POLICY "Users can update QA docs in their accounts"
  ON public.qa_docs
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 5: Create secure DELETE policy
CREATE POLICY "Users can delete QA docs in their accounts"
  ON public.qa_docs
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view QA docs in their accounts" ON public.qa_docs IS
  'INTEL-010: Multi-tenant isolation for QA documents (knowledge base data).';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- CHANGES:
-- 1. Users can ONLY see QA docs from their own accounts
-- 2. All CRUD operations now properly scoped
-- 3. No breaking changes (authenticated users only, as before)
```

---

### 3.6 Migration SQL: Fix `active_numbers` Table

**File**: `supabase/migrations/20251004_fix_active_numbers_rls.sql`

```sql
-- ============================================================================
-- INTEL-010: Create RLS Policies for Active Numbers
-- ============================================================================
-- CRITICAL: Table has RLS enabled but NO policies = BLOCKED ACCESS
-- Risk: CRITICAL - Application broken for phone number management

-- Step 1: Create SELECT policy
CREATE POLICY "Users can view phone numbers in their accounts"
  ON public.active_numbers
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 2: Create INSERT policy
CREATE POLICY "Users can add phone numbers to their accounts"
  ON public.active_numbers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 3: Create UPDATE policy
CREATE POLICY "Users can update phone numbers in their accounts"
  ON public.active_numbers
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Create DELETE policy
CREATE POLICY "Users can delete phone numbers from their accounts"
  ON public.active_numbers
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view phone numbers in their accounts" ON public.active_numbers IS
  'INTEL-010: Multi-tenant isolation for active phone numbers.';

-- ============================================================================
-- MIGRATION IMPACT ANALYSIS
-- ============================================================================
-- FIXES:
-- 1. Restores access to active_numbers table (previously blocked)
-- 2. Properly scopes all phone number operations by account
-- 3. Should immediately fix any "permission denied" errors in phone number UI
```

---

### 3.7 Migration SQL: Add UPDATE Policy to Junction Table

**File**: `supabase/migrations/20251004_add_update_policy_junction.sql`

```sql
-- ============================================================================
-- INTEL-010: Add UPDATE Policy to Document Storage Assignments Junction Table
-- ============================================================================
-- Priority: MEDIUM (completeness, rarely used)
-- Risk: LOW - Junction tables rarely need updates, but policy adds completeness

-- Create UPDATE policy for document_storage-assistants
CREATE POLICY "Users can update assignments in their accounts"
  ON "document_storage-assistants"
  FOR UPDATE
  TO authenticated
  USING (
    -- User must own the assistant
    EXISTS (
      SELECT 1
      FROM assistants a
      INNER JOIN basejump.account_user au ON au.account_id = a.account_id
      WHERE a.id = "document_storage-assistants".assistant
      AND au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Validate user still owns assistant after update
    EXISTS (
      SELECT 1
      FROM assistants a
      INNER JOIN basejump.account_user au ON au.account_id = a.account_id
      WHERE a.id = "document_storage-assistants".assistant
      AND au.user_id = auth.uid()
    )
    AND
    -- Validate user owns new storage (if storage ID changed)
    EXISTS (
      SELECT 1
      FROM document_storages ds
      INNER JOIN basejump.account_user au ON au.account_id = ds.account_id
      WHERE ds.id = "document_storage-assistants".document_storage
      AND au.user_id = auth.uid()
    )
    AND
    -- CRITICAL: Validate SAME account (prevent cross-account reassignment)
    (
      SELECT a.account_id
      FROM assistants a
      WHERE a.id = "document_storage-assistants".assistant
    ) = (
      SELECT ds.account_id
      FROM document_storages ds
      WHERE ds.id = "document_storage-assistants".document_storage
    )
  );

COMMENT ON POLICY "Users can update assignments in their accounts" ON "document_storage-assistants" IS
  'INTEL-010: Allows updating junction table assignments while preventing cross-account data leakage.';
```

---

## 4. Migration Strategy

### 4.1 Migration Execution Order

**CRITICAL**: Execute migrations in this exact order to minimize downtime and risk.

#### Phase 1: Low-Risk Tables (No Webhooks)
1. `active_numbers` - **URGENT** (fixes broken functionality)
2. `qa_docs` - Medium impact
3. `document_storage-assistants` - Low impact (adds UPDATE policy)

#### Phase 2: High-Risk Tables (Affects Webhooks)
4. `assistants` - **Review API routes first**
5. `report_ws` - **Update Railway webhook to use service_role**
6. `report_voice` - **Update VAPI webhook to use service_role**

### 4.2 Pre-Migration Checklist

- [ ] **Backup Database**: Create snapshot of production database
- [ ] **Test on Staging**: Run all migrations on staging environment first
- [ ] **Audit Webhooks**: Identify all external webhooks (Railway, VAPI, Buildship)
- [ ] **Update Webhook Clients**: Switch webhook handlers to use `service_role` key
- [ ] **Notify Team**: Alert team of upcoming policy changes
- [ ] **Prepare Rollback Scripts**: Create rollback migrations for each change

### 4.3 Webhook Migration Guide

**Problem**: Current insecure policies allow `anon` role to INSERT/UPDATE. Fixing RLS will break webhooks unless they use `service_role` key.

**Affected API Routes**:
1. `src/app/api/railway/route.ts` - WhatsApp webhook (inserts to `report_ws`)
2. VAPI webhook handler (inserts to `report_voice`)
3. Buildship webhook (may update `assistants`)

**Solution**: Update webhook handlers to use service role client.

**Example Fix** (`src/app/api/railway/route.ts`):

```typescript
// BEFORE (uses anon key, bypasses auth but relies on insecure RLS)
import { createClient } from '@/lib/supabase/client';

export async function POST(request: Request) {
  const supabase = createClient(); // Uses anon key

  const { data, error } = await supabase
    .from('report_ws')
    .insert({ ... });
  // ...
}

// AFTER (uses service_role key, bypasses RLS for webhook inserts)
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseServiceRole = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only, never expose
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  // Validate webhook signature/token here

  const { data, error } = await supabaseServiceRole
    .from('report_ws')
    .insert({ ... });
  // ...
}
```

**CRITICAL**: Service role key bypasses RLS. Validate webhook authenticity before using.

### 4.4 Migration Execution Commands

**Local Testing** (Supabase local dev):
```bash
# Start local Supabase
supabase start

# Run migration
supabase migration up --file 20251004_fix_active_numbers_rls.sql

# Test with psql
supabase db test
```

**Production Deployment**:
```bash
# Push migrations to production (use with caution)
supabase db push

# OR apply via Supabase Dashboard > SQL Editor
```

### 4.5 Rollback Plan

Each migration has a corresponding rollback script.

**Example Rollback** (`20251004_rollback_fix_assistants_rls.sql`):
```sql
-- Rollback: Restore original policies (if migration fails)

-- Drop new policies
DROP POLICY IF EXISTS "Account members can update assistants" ON public.assistants;
DROP POLICY IF EXISTS "Account members can delete assistants" ON public.assistants;

-- Restore original policies
CREATE POLICY "Enable read access for all users" ON public.assistants
  FOR SELECT TO anon USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.assistants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Account members can update" ON public.assistants
  FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Delete Assistant by account_id" ON public.assistants
  FOR DELETE TO anon, authenticated
  USING (account_id IN (SELECT basejump.get_accounts_with_role()));
```

**Rollback Execution**:
```bash
supabase migration revert --file 20251004_fix_assistants_rls.sql
```

---

## 5. Testing Approach

### 5.1 Database-Level RLS Tests

**Objective**: Verify RLS policies block cross-account access at the PostgreSQL level.

**Test Strategy**: Create two test accounts (Account A, Account B) with different users, attempt cross-account operations.

#### Test Suite: `tests/security/rls_cross_account_test.sql`

```sql
-- ============================================================================
-- INTEL-010: RLS Cross-Account Access Prevention Tests
-- ============================================================================
-- Prerequisites:
-- - Two test accounts: test_account_a, test_account_b
-- - Two test users: user_a (member of A), user_b (member of B)
-- - Sample data in all tables

-- Test 1: document_storages - User B cannot SELECT storage from Account A
-- Expected: 0 rows
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user_b_uuid';

SELECT COUNT(*) AS should_be_zero
FROM document_storages
WHERE account_id = 'test_account_a_uuid';

-- Test 2: assistants - User B cannot SELECT assistants from Account A
SELECT COUNT(*) AS should_be_zero
FROM assistants
WHERE account_id = 'test_account_a_uuid';

-- Test 3: report_ws - User B cannot SELECT reports from Account A
SELECT COUNT(*) AS should_be_zero
FROM report_ws
WHERE account_id = 'test_account_a_uuid';

-- Test 4: report_voice - User B cannot SELECT voice reports from Account A
SELECT COUNT(*) AS should_be_zero
FROM report_voice
WHERE account_id = 'test_account_a_uuid';

-- Test 5: qa_docs - User B cannot SELECT QA docs from Account A
SELECT COUNT(*) AS should_be_zero
FROM qa_docs
WHERE account_id = 'test_account_a_uuid';

-- Test 6: document_storage-assistants - User B cannot SELECT assignments from Account A
SELECT COUNT(*) AS should_be_zero
FROM "document_storage-assistants" dsa
INNER JOIN assistants a ON a.id = dsa.assistant
WHERE a.account_id = 'test_account_a_uuid';

-- Test 7: User B cannot INSERT document storage to Account A
-- Expected: Error "permission denied" or violates WITH CHECK
DO $$
BEGIN
  INSERT INTO document_storages (account_id, name)
  VALUES ('test_account_a_uuid', 'Hacked Storage');

  RAISE EXCEPTION 'SECURITY BREACH: User B inserted to Account A';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS: INSERT correctly blocked';
END $$;

-- Test 8: User B cannot UPDATE assistant in Account A
-- Expected: 0 rows updated
UPDATE assistants
SET name = 'Hacked Assistant'
WHERE account_id = 'test_account_a_uuid';

-- Check rows affected
SELECT CASE
  WHEN COUNT(*) > 0 THEN 'FAIL: Updated cross-account'
  ELSE 'PASS: No updates allowed'
END AS result
FROM assistants
WHERE account_id = 'test_account_a_uuid'
AND name = 'Hacked Assistant';

-- Test 9: User B cannot DELETE report from Account A
DELETE FROM report_ws
WHERE account_id = 'test_account_a_uuid';

-- Check rows affected
GET DIAGNOSTICS v_affected := ROW_COUNT;
IF v_affected > 0 THEN
  RAISE EXCEPTION 'SECURITY BREACH: Deleted cross-account reports';
ELSE
  RAISE NOTICE 'PASS: DELETE correctly blocked';
END IF;

-- Test 10: Junction table - User B cannot assign Account A storage to Account A assistant
-- Expected: Error "permission denied"
DO $$
BEGIN
  INSERT INTO "document_storage-assistants" (assistant, document_storage)
  VALUES (
    (SELECT id FROM assistants WHERE account_id = 'test_account_a_uuid' LIMIT 1),
    (SELECT id FROM document_storages WHERE account_id = 'test_account_a_uuid' LIMIT 1)
  );

  RAISE EXCEPTION 'SECURITY BREACH: Cross-account assignment succeeded';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS: Cross-account assignment blocked';
END $$;
```

**Expected Results**: All tests should return 0 rows or raise expected errors. Any test returning data = SECURITY BREACH.

### 5.2 Application-Level Integration Tests

**Objective**: Verify RLS works correctly with Next.js server actions and API routes.

#### Test Suite: `tests/integration/document_storage_security.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient as createClientA } from './fixtures/supabase_client_user_a';
import { createClient as createClientB } from './fixtures/supabase_client_user_b';

describe('INTEL-010: Document Storage Multi-Tenant Security', () => {
  let accountA_id: string;
  let accountB_id: string;
  let storageA_id: string;
  let storageB_id: string;

  beforeAll(async () => {
    // Create test accounts and storages
    // ...
  });

  describe('SELECT Isolation', () => {
    it('User A can SELECT their own document storages', async () => {
      const supabaseA = await createClientA();

      const { data, error } = await supabaseA
        .from('document_storages')
        .select('*')
        .eq('account_id', accountA_id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1); // Should see 1 storage (their own)
      expect(data[0].id).toBe(storageA_id);
    });

    it('User B cannot SELECT document storages from Account A', async () => {
      const supabaseB = await createClientB();

      const { data, error } = await supabaseB
        .from('document_storages')
        .select('*')
        .eq('account_id', accountA_id); // Try to access A's account

      expect(error).toBeNull(); // No error (RLS just filters)
      expect(data).toHaveLength(0); // Should see 0 storages (RLS blocked)
    });

    it('User B cannot SELECT by storage ID from Account A', async () => {
      const supabaseB = await createClientB();

      const { data, error } = await supabaseB
        .from('document_storages')
        .select('*')
        .eq('id', storageA_id); // Direct ID access

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS should block
    });
  });

  describe('INSERT Validation', () => {
    it('User B cannot INSERT storage to Account A', async () => {
      const supabaseB = await createClientB();

      const { data, error } = await supabaseB
        .from('document_storages')
        .insert({
          account_id: accountA_id, // Try to insert to A's account
          name: 'Malicious Storage',
          namespace: 'hack123'
        })
        .select();

      expect(error).not.toBeNull(); // Should fail WITH CHECK
      expect(error?.code).toBe('42501'); // Permission denied
      expect(data).toBeNull();
    });
  });

  describe('UPDATE Validation', () => {
    it('User B cannot UPDATE storage in Account A', async () => {
      const supabaseB = await createClientB();

      const { data, error } = await supabaseB
        .from('document_storages')
        .update({ name: 'Hacked Name' })
        .eq('id', storageA_id)
        .select();

      expect(error).toBeNull(); // No error (RLS just prevents update)
      expect(data).toHaveLength(0); // No rows updated
    });
  });

  describe('DELETE Validation', () => {
    it('User B cannot DELETE storage from Account A', async () => {
      const supabaseB = await createClientB();

      const { data, error } = await supabaseB
        .from('document_storages')
        .delete()
        .eq('id', storageA_id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // No rows deleted

      // Verify storage still exists
      const supabaseA = await createClientA();
      const { data: verifyData } = await supabaseA
        .from('document_storages')
        .select('id')
        .eq('id', storageA_id);

      expect(verifyData).toHaveLength(1); // Still exists
    });
  });

  describe('Junction Table Assignment Security', () => {
    it('User B cannot assign Account A storage to Account A assistant', async () => {
      const supabaseB = await createClientB();

      // Get Account A assistant and storage
      const supabaseA = await createClientA();
      const { data: assistantA } = await supabaseA
        .from('assistants')
        .select('id')
        .eq('account_id', accountA_id)
        .limit(1)
        .single();

      // User B tries to create assignment
      const { data, error } = await supabaseB
        .from('document_storage-assistants')
        .insert({
          assistant: assistantA.id,
          document_storage: storageA_id
        })
        .select();

      expect(error).not.toBeNull(); // Should fail WITH CHECK
      expect(data).toBeNull();
    });

    it('User cannot assign Account A storage to Account B assistant (cross-account)', async () => {
      const supabaseA = await createClientA();

      // User A has access to both accounts (test edge case)
      // Try to assign Account B storage to Account A assistant
      const { data, error } = await supabaseA
        .from('document_storage-assistants')
        .insert({
          assistant: assistantA_id, // Account A
          document_storage: storageB_id // Account B - DIFFERENT ACCOUNT
        })
        .select();

      expect(error).not.toBeNull(); // Should fail WITH CHECK (same account validation)
    });
  });
});
```

### 5.3 Manual Testing Checklist

**Execute these manual tests after migration**:

- [ ] **Test 1**: Login as User A, verify dashboard shows only Account A data
- [ ] **Test 2**: Login as User B, verify dashboard shows only Account B data
- [ ] **Test 3**: Login as User A, copy a document storage ID from Account B (via database)
- [ ] **Test 4**: Try to access Account B storage via direct URL: `/accountA/documents?storage_id=<account_b_storage_id>`
- [ ] **Test 5**: Verify error or empty result (RLS blocks access)
- [ ] **Test 6**: Test WhatsApp webhook (send test message, verify report created)
- [ ] **Test 7**: Test VAPI webhook (make test call, verify voice report created)
- [ ] **Test 8**: Verify no errors in Supabase logs after RLS migration
- [ ] **Test 9**: Test phone number management (verify `active_numbers` policies work)
- [ ] **Test 10**: Test QA document creation/editing (verify `qa_docs` policies work)

---

## 6. Rollback Plan

### 6.1 Rollback Triggers

Execute rollback if any of these occur within 24 hours of migration:

1. **User reports inability to access their own data** (false positive RLS block)
2. **Webhook failures exceed 5% error rate** (service_role migration incomplete)
3. **Database query performance degrades >20%** (RLS policy inefficiency)
4. **Critical application features broken** (phone numbers, reports, documents)

### 6.2 Rollback Procedure

**Step 1**: Identify failing migration
**Step 2**: Execute rollback migration script
**Step 3**: Verify application functionality restored
**Step 4**: Analyze root cause, fix migration script
**Step 5**: Re-test on staging before retry

### 6.3 Rollback Scripts

Located in: `supabase/migrations/rollback/`

- `rollback_fix_assistants_rls.sql`
- `rollback_fix_report_ws_rls.sql`
- `rollback_fix_report_voice_rls.sql`
- `rollback_fix_qa_docs_rls.sql`
- `rollback_fix_active_numbers_rls.sql`

**Execute via**:
```bash
psql $DATABASE_URL < supabase/migrations/rollback/rollback_fix_assistants_rls.sql
```

---

## 7. Application-Level Security

### 7.1 Server Action Authorization Pattern

**Current State**: Some server actions rely solely on RLS (no explicit authorization checks).

**Recommended Pattern**: Defense in depth - validate authorization in server actions BEFORE database query.

#### Example: Secure Server Action Pattern

**File**: `src/lib/actions/intelliaa/documents.ts`

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * INTEL-010: Secure pattern for document storage operations
 * Defense in depth: Validate authorization BEFORE relying on RLS
 */
export async function deleteDocumentStorage(
  accountId: string,
  documentStorageId: string
) {
  const supabase = await createClient();

  // Step 1: Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false,
      error: 'Unauthorized: Not authenticated'
    };
  }

  // Step 2: Verify user is member of the account (explicit check)
  const { data: membership, error: membershipError } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    return {
      success: false,
      error: 'Forbidden: Not a member of this account'
    };
  }

  // Step 3: Verify storage belongs to this account (double-check)
  // RLS will enforce this, but explicit check provides better error messages
  const { data: storage, error: storageError } = await supabase
    .from('document_storages')
    .select('account_id')
    .eq('id', documentStorageId)
    .single();

  if (storageError || !storage) {
    return {
      success: false,
      error: 'Not found: Document storage does not exist or access denied'
    };
  }

  if (storage.account_id !== accountId) {
    return {
      success: false,
      error: 'Forbidden: Document storage belongs to a different account'
    };
  }

  // Step 4: Proceed with deletion (RLS provides final enforcement layer)
  const { error: deleteError } = await supabase
    .from('document_storages')
    .delete()
    .eq('id', documentStorageId);

  if (deleteError) {
    return {
      success: false,
      error: `Delete failed: ${deleteError.message}`
    };
  }

  return {
    success: true,
    message: 'Document storage deleted successfully'
  };
}
```

**Benefits**:
- **Better error messages**: Users get meaningful feedback vs generic RLS denial
- **Early validation**: Fails fast before expensive operations
- **Defense in depth**: Multiple security layers (RLS is final enforcement)
- **Audit trail**: Can log authorization failures before database access

### 7.2 API Route Middleware Pattern

**Current State**: API routes may use `anon` key or client-side Supabase client.

**Recommended Pattern**: All API routes validate authentication and account membership.

#### Example: Secure API Route

**File**: `src/app/api/documents/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Step 1: Verify authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Step 2: Parse request body
  const body = await request.json();
  const { account_id, name, description } = body;

  if (!account_id || !name) {
    return NextResponse.json(
      { error: 'Missing required fields: account_id, name' },
      { status: 400 }
    );
  }

  // Step 3: Verify user is member of account
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', account_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'Forbidden: Not a member of this account' },
      { status: 403 }
    );
  }

  // Step 4: Proceed with operation (RLS provides final validation)
  const { data, error } = await supabase
    .from('document_storages')
    .insert({
      account_id,
      name,
      description,
      namespace: generateUniqueNamespace()
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
```

### 7.3 Client Component Security

**Current State**: Client components may directly query Supabase with client-side key.

**Recommendation**: Client components should use RLS-protected queries, but sensitive operations should use server actions.

**Best Practices**:
1. **Read operations**: OK to use client-side Supabase client (RLS enforces)
2. **Write operations**: Use server actions for better validation and error handling
3. **Never expose**: Service role key, sensitive API keys
4. **Always validate**: Account membership in server actions

---

## 8. External Service Isolation

### 8.1 Pinecone Namespace Isolation

**Current Implementation**: ✅ SECURE

Each document storage has a unique `namespace` field:
```typescript
const namespace = `${Math.random().toString(36).substring(2, 15)}`;
```

**Pinecone Query Pattern**:
```typescript
const results = await pineconeIndex.query({
  namespace: documentStorage.namespace, // Isolated by namespace
  vector: embeddingVector,
  topK: 5
});
```

**Security Assessment**: ✅ Namespace-based isolation prevents cross-account vector retrieval.

**Recommendations**:
- ✅ Continue using unique namespaces per document storage
- ⚠️ Ensure namespace is NEVER user-controlled (use generated values only)
- ✅ Validate namespace belongs to user's account before querying

### 8.2 VAPI Knowledge Base Isolation

**Current Implementation**: Uses `vapi_knowledge_bases` table with RLS policies.

**Security Verification Needed**: Confirm `get_user_account_ids()` function implementation.

#### Verify Function Implementation

**SQL Query**:
```sql
SELECT prosrc
FROM pg_proc
WHERE proname = 'get_user_account_ids';
```

**Expected Implementation** (should match Basejump pattern):
```sql
CREATE OR REPLACE FUNCTION get_user_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT account_id
  FROM basejump.account_user
  WHERE user_id = auth.uid();
$$;
```

**If function doesn't exist**: Replace `vapi_knowledge_bases` policies with standard Basejump pattern:

```sql
-- Replace custom function with standard pattern
DROP POLICY IF EXISTS "Users can view knowledge bases for their accounts" ON vapi_knowledge_bases;

CREATE POLICY "Users can view knowledge bases for their accounts"
  ON vapi_knowledge_bases
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id
      FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  );
```

### 8.3 Flowise Document Store Isolation

**Current Implementation**: Uses namespace-based isolation (similar to Pinecone).

**Security Assessment**: ✅ Namespace isolation prevents cross-account document retrieval.

**Recommendations**:
- ✅ Continue using document storage `namespace` for Flowise operations
- ⚠️ Validate namespace belongs to user's account before Flowise API calls

### 8.4 Railway/WhatsApp Integration

**Current State**: WhatsApp reports stored in `report_ws` table.

**Migration Impact**: After RLS fixes, Railway webhooks MUST use service_role key.

**Action Required**:
1. Update `src/app/api/railway/route.ts` to use service role client
2. Validate webhook signature before inserting reports
3. Test webhook with sample WhatsApp message

---

## 9. Acceptance Criteria Validation

### AC1: Query Isolation ✅

**Criteria**: When logged into organization A, users only see storages where `account_id` matches their organization, enforced by RLS.

**Validation**:
- ✅ `document_storages` has SELECT policy scoped by `account_id`
- ✅ `pdf_docs` has SELECT policy scoped by `account_id`
- ✅ After migration: `assistants`, `report_ws`, `report_voice`, `qa_docs` will have SELECT policies
- ✅ RLS enabled on all tables

**Status**: PASS after migration.

---

### AC2: Direct Access Prevention ✅

**Criteria**: When trying to access document storage ID from organization B, RLS blocks query and returns empty result.

**Validation**:
- ✅ SELECT policies use `account_id IN (SELECT ... WHERE user_id = auth.uid())`
- ✅ Direct ID queries (`.eq('id', storage_id_from_org_b)`) return 0 rows
- ✅ No error message (RLS silently filters)

**Status**: PASS after migration.

---

### AC3: Vector Store Isolation ✅

**Criteria**: Namespace isolation prevents cross-organization retrieval in Pinecone.

**Validation**:
- ✅ Each `document_storages` record has unique `namespace`
- ✅ Pinecone queries scoped by `namespace` parameter
- ✅ No way to query across namespaces in single call

**Status**: PASS (already implemented correctly).

---

### AC4: Assignment Validation ✅

**Criteria**: System blocks attempts to assign document storage from organization B to assistant in organization A.

**Validation**:
- ✅ Junction table `document_storage-assistants` has INSERT policy
- ✅ Policy validates `assistant.account_id = storage.account_id` (CRITICAL check)
- ✅ Attempting cross-account assignment fails WITH CHECK violation

**Status**: PASS (implemented in INTEL-008 migration).

---

### AC5: API Route Authorization ✅

**Criteria**: Middleware validates user has write permissions to account before proceeding.

**Validation**:
- ⚠️ **Needs Implementation**: Not all API routes have explicit authorization checks
- ✅ RLS provides fallback enforcement
- 📝 **Recommendation**: Add explicit authorization pattern to all API routes (see Section 7.2)

**Status**: PARTIAL (RLS enforces, but explicit checks recommended).

---

### AC6: VAPI Knowledge Base Isolation ⚠️

**Criteria**: Assistants can only access knowledge bases created by same organization.

**Validation**:
- ✅ `vapi_knowledge_bases` table has RLS policies
- ⚠️ **Needs Verification**: `get_user_account_ids()` function implementation
- ✅ Policies scope by `account_id`

**Status**: NEEDS VERIFICATION (verify custom function).

---

### AC7: File Upload Authorization ⚠️

**Criteria**: System verifies user has write access to storage's account before upload.

**Validation**:
- ✅ Server action `uploadPdfToDocumentStorage()` validates account membership
- ✅ RLS INSERT policy enforces `account_id` check
- ⚠️ **Needs Review**: Ensure all upload routes use this pattern

**Status**: PASS (validate all upload endpoints).

---

## 10. Implementation Checklist

### Phase 1: Preparation (Week 1)
- [ ] Review this security plan with team
- [ ] Create staging environment snapshot
- [ ] Audit all webhook implementations
- [ ] Identify API routes that need service_role updates
- [ ] Create rollback scripts for each migration
- [ ] Set up monitoring/alerting for RLS policy errors

### Phase 2: Low-Risk Migrations (Week 1)
- [ ] Deploy migration: `20251004_fix_active_numbers_rls.sql`
- [ ] Test phone number management UI
- [ ] Deploy migration: `20251004_fix_qa_docs_rls.sql`
- [ ] Test QA document creation/editing
- [ ] Deploy migration: `20251004_add_update_policy_junction.sql`
- [ ] Test document storage assignments

### Phase 3: Webhook Preparation (Week 2)
- [ ] Update Railway webhook to use service_role key
- [ ] Update VAPI webhook to use service_role key
- [ ] Test webhooks on staging environment
- [ ] Verify webhook signature validation
- [ ] Deploy webhook updates to production

### Phase 4: High-Risk Migrations (Week 2)
- [ ] Deploy migration: `20251004_fix_assistants_rls.sql`
- [ ] Monitor for errors in assistant operations
- [ ] Deploy migration: `20251004_fix_report_ws_rls.sql`
- [ ] Test WhatsApp reporting (send test message)
- [ ] Deploy migration: `20251004_fix_report_voice_rls.sql`
- [ ] Test voice call reporting (make test call)

### Phase 5: Verification (Week 2-3)
- [ ] Run database-level RLS tests (Section 5.1)
- [ ] Run application-level integration tests (Section 5.2)
- [ ] Execute manual testing checklist (Section 5.3)
- [ ] Verify `get_user_account_ids()` function (Section 8.2)
- [ ] Monitor error rates for 7 days
- [ ] Validate all acceptance criteria (Section 9)

### Phase 6: Documentation & Cleanup (Week 3)
- [ ] Document final RLS policy structure
- [ ] Update CLAUDE.md with security patterns
- [ ] Create developer guide for secure server actions
- [ ] Archive rollback scripts (keep for 30 days)
- [ ] Close INTEL-010 issue

---

## 11. Critical Notes & Warnings

### 11.1 Breaking Changes Summary

**CRITICAL BREAKING CHANGES** after migration:

1. **Anonymous users lose all access** to `assistants`, `report_ws`, `report_voice`
   - **Impact**: Webhooks using `anon` key will fail
   - **Fix**: Update webhooks to use `service_role` key

2. **Users can only see their own account data**
   - **Impact**: Cross-account queries return empty results
   - **Fix**: No fix needed (this is the desired behavior)

3. **Phone number management restored**
   - **Impact**: Previously broken `active_numbers` table now works
   - **Fix**: No fix needed (this fixes existing bug)

4. **Service role required for webhooks**
   - **Impact**: All external webhooks need service_role key
   - **Fix**: Update webhook handlers (see Section 4.3)

### 11.2 Performance Considerations

**RLS Policy Performance**: Each RLS policy adds a subquery to every query.

**Example Query Plan**:
```sql
-- Before RLS:
SELECT * FROM assistants WHERE account_id = 'abc123';

-- After RLS (with policy):
SELECT * FROM assistants
WHERE account_id = 'abc123'
  AND account_id IN (
    SELECT account_id FROM basejump.account_user
    WHERE user_id = auth.uid()
  );
```

**Performance Impact**:
- ✅ Minimal for indexed columns (`account_id` has FK index)
- ✅ Basejump's `account_user` table is optimized for RLS lookups
- ⚠️ May add 1-5ms latency per query

**Optimization**:
- ✅ Ensure `account_id` has indexes on all tables
- ✅ Use connection pooling (Supabase provides this)
- ⚠️ Monitor slow query logs after migration

### 11.3 Basejump Version Compatibility

**Current Project**: Uses Basejump's `account_user` table and `get_accounts_with_role()` function.

**Compatibility**: All migrations use standard Basejump patterns (compatible with current version).

**Future Basejump Updates**: If Basejump updates RLS helper functions, may need to update policies.

### 11.4 Next.js 15 Async Considerations

**This project uses Next.js 15.5.4** with async `cookies()` API.

**Server Action Pattern**:
```typescript
// Correct (async cookies)
export async function someServerAction() {
  const supabase = await createClient(); // createClient is async
  // ...
}
```

**No Impact on RLS**: RLS policies run in PostgreSQL, independent of Next.js version.

---

## 12. Post-Migration Monitoring

### 12.1 Metrics to Track

Monitor these metrics for 7 days post-migration:

1. **RLS Policy Errors**: `SELECT count(*) FROM logs WHERE error_code = '42501'` (permission denied)
2. **Webhook Success Rate**: Track Railway/VAPI webhook response codes
3. **Query Latency**: Monitor average response time for document storage queries
4. **User Error Reports**: Track support tickets related to "access denied" or "not found"
5. **Database CPU Usage**: Ensure RLS policies don't spike CPU

### 12.2 Alerting Thresholds

Set up alerts for:

- **ERROR**: RLS permission denied errors > 10/hour (likely migration issue)
- **WARNING**: Webhook failure rate > 5% (service_role migration incomplete)
- **WARNING**: Query latency increase > 20% (RLS performance impact)
- **ERROR**: User reports of "cannot see my data" (false positive RLS block)

### 12.3 Rollback Decision Matrix

| Symptom | Severity | Action | Rollback? |
|---------|----------|--------|-----------|
| Users can't see own data | CRITICAL | Immediate rollback | YES |
| Webhooks failing >10% | HIGH | Fix webhook clients, rollback if not fixed in 1 hour | YES (if not fixed) |
| Query latency +20% | MEDIUM | Monitor, optimize queries | NO (monitor 48h) |
| Cross-account access attempt blocked | INFO | Expected behavior | NO |
| Service role errors in logs | LOW | Review service role usage | NO |

---

## 13. Conclusion

This security implementation plan addresses **7 critical security gaps** in the IntelliAA platform's multi-tenant architecture. By implementing these RLS policies, the platform will achieve:

✅ **Complete data isolation** between organizations
✅ **Defense in depth** (RLS + application-level validation)
✅ **Compliance-ready** (GDPR/CCPA data isolation)
✅ **Zero-trust architecture** (every query validated)
✅ **Secure by default** (explicit policies, no permissive fallbacks)

**Estimated Implementation Time**: 2-3 weeks
**Risk Level**: MEDIUM (with proper testing and rollback plan)
**Impact**: HIGH (critical security improvement)

---

## Appendix A: Complete Migration File List

**Production-Ready Migrations** (in execution order):

1. `supabase/migrations/20251004_fix_active_numbers_rls.sql` (URGENT)
2. `supabase/migrations/20251004_fix_qa_docs_rls.sql`
3. `supabase/migrations/20251004_add_update_policy_junction.sql`
4. `supabase/migrations/20251004_fix_assistants_rls.sql`
5. `supabase/migrations/20251004_fix_report_ws_rls.sql`
6. `supabase/migrations/20251004_fix_report_voice_rls.sql`

**Rollback Migrations**:

1. `supabase/migrations/rollback/rollback_fix_active_numbers_rls.sql`
2. `supabase/migrations/rollback/rollback_fix_qa_docs_rls.sql`
3. `supabase/migrations/rollback/rollback_add_update_policy_junction.sql`
4. `supabase/migrations/rollback/rollback_fix_assistants_rls.sql`
5. `supabase/migrations/rollback/rollback_fix_report_ws_rls.sql`
6. `supabase/migrations/rollback/rollback_fix_report_voice_rls.sql`

---

## Appendix B: Glossary

**RLS (Row Level Security)**: PostgreSQL feature that filters query results based on user identity
**Basejump**: Supabase SaaS starter kit providing multi-tenant account management
**Service Role**: Supabase admin key that bypasses RLS (server-side only, NEVER expose to client)
**Anon Key**: Supabase public key for client-side usage (respects RLS, limited permissions)
**WITH CHECK**: RLS policy clause for INSERT/UPDATE operations
**USING**: RLS policy clause for SELECT/UPDATE/DELETE operations
**Multi-Tenant**: Architecture where multiple organizations share same database with data isolation

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Next Review**: After Phase 5 (Verification) completion
**Owner**: Supabase Architect / Security Team
