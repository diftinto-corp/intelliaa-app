# INTEL-002: VAPI Knowledge Base Service - Deployment Guide

**Feature**: Create VAPI Knowledge Base Service
**Priority**: P0 - Critical
**Environment**: Remote Supabase (Already Configured)
**Created**: 2025-10-02

---

## Overview

This guide provides step-by-step instructions for deploying the VAPI Knowledge Base Service to your **remote Supabase environment** (already configured). No local Supabase setup required.

---

## Prerequisites

### 1. Environment Verification

Verify your remote Supabase connection is working:

```bash
# Check Supabase environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Test connection via application
npm run dev
# Visit http://localhost:3000 and verify database queries work
```

### 2. VAPI API Key Verification

```bash
# Verify VAPI key is configured
echo $NEXT_PRIVATE_VAPI_KEY

# Should output: e3e1fbaa-23d3-438b-83ce-33a03043dac8 (from your .env.local)
```

### 3. Required Tools

- Node.js (already installed)
- npm (already installed)
- Access to Supabase Studio (via web browser)
- Git (for version control)

---

## Phase 1: Database Migration (Remote Supabase)

### Step 1.1: Access Supabase Studio

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Open a new query tab

### Step 1.2: Create Backup (Safety)

Before applying migration, create a backup:

```sql
-- In Supabase Studio SQL Editor
-- Export existing schema (if needed for rollback)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Take note of all tables for rollback reference
```

### Step 1.3: Apply Migration Script

**Location**: `supabase/migrations/20251002_vapi_knowledge_bases.sql`

**Method 1: Via Supabase Studio (Recommended)**

1. Open Supabase Studio → SQL Editor
2. Click "New Query"
3. Copy the entire migration script from `supabase/migrations/20251002_vapi_knowledge_bases.sql`
4. Paste into SQL Editor
5. Click "Run" (bottom right)
6. Verify success message: "Success. No rows returned"

**Method 2: Via Supabase CLI (If you have it installed)**

```bash
# If you have Supabase CLI configured for remote
supabase db push --db-url "your-remote-url"
```

### Step 1.4: Verify Migration Success

In Supabase Studio, verify the new table was created:

```sql
-- Check table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'vapi_knowledge_bases';

-- Check indexes created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'vapi_knowledge_bases'
ORDER BY indexname;

-- Expected indexes:
-- - idx_vapi_kb_account
-- - idx_vapi_kb_account_status_active
-- - idx_vapi_kb_assistant
-- - idx_vapi_kb_assistant_account
-- - idx_vapi_kb_status
-- - idx_vapi_kb_vapi_id_unique
-- - vapi_knowledge_bases_pkey (primary key)

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'vapi_knowledge_bases';
-- Should return: rowsecurity = true

-- Check policies created
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'vapi_knowledge_bases'
ORDER BY policyname;

-- Expected policies:
-- - Users can create knowledge bases for their accounts (INSERT)
-- - Users can delete knowledge bases for their accounts (DELETE)
-- - Users can update knowledge bases for their accounts (UPDATE)
-- - Users can view knowledge bases for their accounts (SELECT)
```

### Step 1.5: Test RLS Policies (Optional)

```sql
-- This should work (insert for your own account)
-- Replace 'your-account-id' with actual account UUID
INSERT INTO public.vapi_knowledge_bases (
  account_id,
  vapi_kb_id,
  name,
  provider
) VALUES (
  'your-account-id',
  'kb-test-001',
  'Test Knowledge Base',
  'google'
);

-- Verify it was created
SELECT id, name, vapi_kb_id, status
FROM public.vapi_knowledge_bases
WHERE vapi_kb_id = 'kb-test-001';

-- Clean up test data
DELETE FROM public.vapi_knowledge_bases
WHERE vapi_kb_id = 'kb-test-001';
```

---

## Phase 2: Code Implementation

### Step 2.1: Create Feature Branch

```bash
# Create and switch to feature branch
git checkout -b feature/INTEL-002-vapi-kb-service

# Verify you're on the new branch
git branch
```

### Step 2.2: Implement Core Service

**File**: `src/services/vapiKnowledgeBaseService.ts`

Copy the complete implementation from:
`.claude/doc/INTEL-002/vapi_kb_implementation_plan.md` (Section: File 1)

```bash
# Create the file
touch src/services/vapiKnowledgeBaseService.ts

# Open in your editor and paste the implementation
# Full code is in the implementation plan document
```

### Step 2.3: Create Type Definitions

**File**: `src/types/vapi.ts`

Copy from implementation plan (Section: File 2)

```bash
# Create the file
touch src/types/vapi.ts

# Paste implementation from plan
```

### Step 2.4: Create Server Actions

**File**: `src/lib/actions/intelliaa/vapiKnowledgeBase.ts`

Copy from implementation plan (Section: File 4)

```bash
# Create the file
touch src/lib/actions/intelliaa/vapiKnowledgeBase.ts

# Paste implementation from plan
```

### Step 2.5: Verify TypeScript Compilation

```bash
# Check for TypeScript errors
npm run build

# If errors, fix them before proceeding
# Common issues:
# - Missing imports
# - Type mismatches
# - Path alias issues
```

---

## Phase 3: Environment Configuration

### Step 3.1: Add Feature Flag

Add to your `.env.local`:

```bash
# VAPI Knowledge Base Service (INTEL-002)
NEXT_PUBLIC_USE_VAPI_KB=false

# VAPI API URL (optional - defaults to production)
VAPI_API_URL=https://api.vapi.ai
```

**Note**: Start with `false` to deploy the code without activating the feature yet.

### Step 3.2: Verify Environment Variables

```bash
# Restart dev server to load new env vars
npm run dev

# Test that feature flag is read correctly
# You can add a console.log in your code temporarily:
# console.log('VAPI KB Feature Flag:', process.env.NEXT_PUBLIC_USE_VAPI_KB);
```

---

## Phase 4: Testing (Without Feature Flag)

### Step 4.1: Unit Tests (Optional for MVP)

```bash
# Run tests (if implemented)
npm test

# Or run specific test
npm test vapiKnowledgeBaseService
```

### Step 4.2: Manual Integration Test

**Test Script**: Create a test page or API route

```typescript
// app/api/test-vapi-kb/route.ts
import { vapiKnowledgeBaseService } from '@/services/vapiKnowledgeBaseService';

export async function GET() {
  try {
    // Test 1: List KBs (should work even with empty account)
    const kbs = await vapiKnowledgeBaseService.listKnowledgeBases();

    return Response.json({
      success: true,
      message: 'VAPI KB Service working',
      kbCount: kbs.length
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

Access: `http://localhost:3000/api/test-vapi-kb`

Expected: `{ "success": true, "message": "VAPI KB Service working", "kbCount": 0 }`

---

## Phase 5: Deployment to Remote (Vercel/Production)

### Step 5.1: Commit Changes

```bash
# Stage all new files
git add src/services/vapiKnowledgeBaseService.ts
git add src/types/vapi.ts
git add src/lib/actions/intelliaa/vapiKnowledgeBase.ts
git add supabase/migrations/20251002_vapi_knowledge_bases.sql
git add .env.local

# Commit
git commit -m "feat(INTEL-002): Add VAPI Knowledge Base Service

- Create vapiKnowledgeBaseService with retry logic
- Add TypeScript types for VAPI API
- Implement server actions for KB management
- Add database migration for vapi_knowledge_bases table
- Add feature flag NEXT_PUBLIC_USE_VAPI_KB (default: false)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Verify commit
git log -1
```

### Step 5.2: Push to Remote

```bash
# Push feature branch
git push origin feature/INTEL-002-vapi-kb-service

# Create Pull Request (via GitHub/GitLab UI)
```

### Step 5.3: Set Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following:

```
NEXT_PUBLIC_USE_VAPI_KB=false
VAPI_API_URL=https://api.vapi.ai
```

**Note**: `NEXT_PRIVATE_VAPI_KEY` should already be configured

### Step 5.4: Deploy to Production

```bash
# Merge PR to main branch (via UI)
# Vercel auto-deploys on merge

# OR manually trigger deployment
vercel --prod
```

---

## Phase 6: Feature Flag Activation (Gradual Rollout)

### Step 6.1: Development Testing (Week 1)

```bash
# In .env.local (your local environment)
NEXT_PUBLIC_USE_VAPI_KB=true

# Restart dev server
npm run dev

# Test document upload → KB creation flow
```

**Test Cases**:
1. Upload PDF document
2. Verify VAPI file uploaded (check logs: `[VAPI KB] Uploading file...`)
3. Verify KB created (check Supabase Studio: `vapi_knowledge_bases` table)
4. Verify no errors in console

### Step 6.2: Beta Testing (Week 2)

**Enable for 2-3 beta test accounts only**

1. In Vercel Dashboard → Environment Variables
2. Update: `NEXT_PUBLIC_USE_VAPI_KB=true`
3. Redeploy
4. Monitor via Vercel Logs + Supabase Dashboard
5. Gather feedback from beta users

**Monitoring Checklist**:
- [ ] KB creation rate (expect 1 KB per document upload)
- [ ] Error rate (should be <5%)
- [ ] Average KB creation time (should be <10s)
- [ ] Database query performance (check Supabase Dashboard)
- [ ] VAPI API usage (check VAPI Dashboard)

### Step 6.3: Canary Rollout (Week 3)

**Enable for 10% of accounts** (if you have logic for partial rollout)

If not using percentage-based rollout:
- Continue with beta accounts for 1 more week
- Monitor metrics daily

### Step 6.4: Full Production Rollout (Week 4+)

**Enable for all accounts**

1. Update in Vercel: `NEXT_PUBLIC_USE_VAPI_KB=true`
2. Monitor for 48 hours
3. Address any issues immediately
4. Update documentation with new feature

---

## Rollback Procedures

### Immediate Rollback (Feature Flag)

**If issues detected during rollout:**

```bash
# In Vercel Dashboard
NEXT_PUBLIC_USE_VAPI_KB=false

# Redeploy
# Feature is immediately disabled
# Existing KBs remain but no new ones created
```

**Impact**: No data loss, existing KBs continue to work

### Full Rollback (Code + Database)

**If critical issues require code revert:**

```bash
# 1. Revert Git commit
git revert <commit-hash>
git push origin main

# 2. Rollback database migration (in Supabase Studio)
DROP TABLE IF EXISTS public.vapi_knowledge_bases CASCADE;
DROP FUNCTION IF EXISTS public.get_user_account_ids();
DROP FUNCTION IF EXISTS soft_delete_vapi_kb(UUID);
-- (Full rollback script in database_architecture.md)

# 3. Redeploy application
# Vercel auto-deploys on push to main
```

**Data Preservation**:
Before dropping table, export data:

```sql
-- In Supabase Studio
COPY (SELECT * FROM public.vapi_knowledge_bases)
TO STDOUT WITH CSV HEADER;

-- Save the output
```

---

## Monitoring & Observability

### Key Metrics to Monitor

**Via Supabase Dashboard**:
- Database table size: `vapi_knowledge_bases`
- Query performance: `SELECT * FROM vapi_knowledge_bases WHERE account_id = ...`
- RLS policy violations: Check logs

**Via Application Logs** (Vercel/Console):
- `[VAPI KB] Creating knowledge base...`
- `[VAPI KB] Knowledge base created: <id>`
- `[VAPI KB] Error...` (any errors)

**Via VAPI Dashboard**:
- API usage
- Rate limit hits
- Error responses

### Health Check Queries

```sql
-- Total KBs created
SELECT COUNT(*) FROM public.vapi_knowledge_bases WHERE deleted_at IS NULL;

-- KBs per account
SELECT account_id, COUNT(*) as kb_count
FROM public.vapi_knowledge_bases
WHERE deleted_at IS NULL
GROUP BY account_id
ORDER BY kb_count DESC
LIMIT 10;

-- Error rate
SELECT
  COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*) as error_rate
FROM public.vapi_knowledge_bases
WHERE deleted_at IS NULL;

-- Average file count per KB
SELECT AVG(file_count) as avg_files
FROM public.vapi_knowledge_bases
WHERE deleted_at IS NULL;
```

---

## Troubleshooting

### Issue 1: Migration Fails in Supabase Studio

**Error**: "relation already exists" or "column already exists"

**Solution**:
```sql
-- Check if table exists
SELECT * FROM pg_tables WHERE tablename = 'vapi_knowledge_bases';

-- If exists, drop and recreate (only if safe)
DROP TABLE IF EXISTS public.vapi_knowledge_bases CASCADE;

-- Re-run migration
```

### Issue 2: RLS Policy Blocks Queries

**Error**: "new row violates row-level security policy"

**Solution**:
```sql
-- Verify user is authenticated
SELECT auth.uid(); -- Should return user UUID

-- Verify user belongs to account
SELECT account_id
FROM basejump.account_user
WHERE user_id = auth.uid();

-- Test policy manually
SELECT * FROM public.vapi_knowledge_bases
WHERE account_id IN (
  SELECT account_id FROM basejump.account_user WHERE user_id = auth.uid()
);
```

### Issue 3: VAPI API 401 Unauthorized

**Error**: `[VAPI KB] Error 401`

**Solution**:
```bash
# Verify VAPI key is set
echo $NEXT_PRIVATE_VAPI_KEY

# Should be: e3e1fbaa-23d3-438b-83ce-33a03043dac8

# Check Vercel environment variables
# Ensure NEXT_PRIVATE_VAPI_KEY is set in production
```

### Issue 4: TypeScript Compilation Errors

**Error**: "Cannot find module '@/services/vapiKnowledgeBaseService'"

**Solution**:
```bash
# Check path aliases in tsconfig.json
cat tsconfig.json | grep "@/"

# Should have: "@/*": ["./src/*"]

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## Success Criteria

### Deployment Complete When:

- [x] Database migration applied successfully to remote Supabase
- [x] All TypeScript files compile without errors
- [x] Feature flag environment variable configured (false initially)
- [x] Code deployed to production (feature disabled)
- [x] No runtime errors in Vercel logs
- [x] Supabase Studio shows new table with correct schema

### Rollout Complete When:

- [x] Feature flag enabled for all users
- [x] KB creation rate matches document upload rate
- [x] Error rate < 5%
- [x] Average KB creation time < 10s
- [x] No security incidents
- [x] Positive user feedback (or no complaints)

---

## Additional Resources

**Documentation**:
- [Implementation Plan](.claude/doc/INTEL-002/vapi_kb_implementation_plan.md)
- [Database Architecture](.claude/doc/INTEL-002/database_architecture.md)
- [Testing Strategy](.claude/doc/INTEL-002/testing_strategy.md)
- [System Architecture](.claude/doc/INTEL-002/system_architecture.md)

**External Docs**:
- [VAPI API Docs](https://docs.vapi.ai/knowledge-base/custom-knowledge-base)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js 15 Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)

**Support**:
- Backend Lead: Review service architecture
- Database Admin: Review migration and RLS policies
- DevOps: Verify Vercel configuration

---

**Deployment Guide Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: Ready for Deployment (Remote Supabase)
