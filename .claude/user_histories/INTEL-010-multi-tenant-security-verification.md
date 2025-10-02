# INTEL-010: Verify Multi-tenant Security

**Epic**: Security & Multi-tenancy
**Priority**: P0 - Critical
**Estimate**: 3 points
**Labels**: security, testing, rls, multi-tenancy

## User Story

As a platform administrator, I want to ensure document storages are isolated by organization, so that users cannot access other organizations' data.

## Acceptance Criteria

### AC1: Query Isolation
**Given** I'm logged into organization A
**When** I query document storages
**Then** I only see storages where `account_id` matches my organization and RLS policies enforce this at the database level

### AC2: Direct Access Prevention
**Given** I know a document storage ID from organization B
**When** I try to access it directly via API or URL
**Then** RLS policies block the query and return empty result or error

### AC3: Vector Store Isolation
**Given** embeddings exist in Pinecone for multiple organizations
**When** I query vectors
**Then** namespace isolation prevents cross-organization retrieval

### AC4: Assignment Validation
**Given** I try to assign a document storage from organization B to my assistant in organization A
**When** the system validates the operation
**Then** it blocks the operation with appropriate error message

### AC5: API Route Authorization
**Given** API routes for document operations
**When** any route is called
**Then** middleware validates the user has write permissions to the account before proceeding

### AC6: VAPI Knowledge Base Isolation
**Given** VAPI knowledge bases exist for multiple organizations
**When** an assistant queries a knowledge base
**Then** it can only access knowledge bases created by the same organization

### AC7: File Upload Authorization
**Given** a user attempts to upload a document to a storage
**When** the request is processed
**Then** the system verifies the user has write access to the storage's account

## Technical Notes

### RLS Policy Verification

**document_storages table**:
```sql
-- Verify SELECT policy
CREATE POLICY "Users can view own account storages"
ON document_storages FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- Verify INSERT policy
CREATE POLICY "Users can insert to own accounts"
ON document_storages FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM basejump.account_user
    WHERE user_id = auth.uid()
    AND account_role IN ('owner', 'admin', 'member')
  )
);

-- Verify DELETE policy
CREATE POLICY "Users can delete from own accounts"
ON document_storages FOR DELETE
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM basejump.account_user
    WHERE user_id = auth.uid()
    AND account_role IN ('owner', 'admin')
  )
);
```

**pdf_docs table**:
```sql
-- Should have similar RLS policies
CREATE POLICY "Users can view own account documents"
ON pdf_docs FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);
```

**document_storage-assistants table**:
```sql
-- Ensure junction table has RLS
CREATE POLICY "Users can view own assignments"
ON "document_storage-assistants" FOR SELECT
TO authenticated
USING (
  assistant IN (
    SELECT id FROM assistants
    WHERE account_id IN (
      SELECT account_id FROM basejump.account_user
      WHERE user_id = auth.uid()
    )
  )
);
```

### Testing Checklist

**Database-level tests**:
- [ ] User A cannot SELECT document storages from account B
- [ ] User A cannot INSERT document storage to account B
- [ ] User A cannot UPDATE document storage in account B
- [ ] User A cannot DELETE document storage from account B
- [ ] User A cannot view PDF docs from account B
- [ ] User A cannot view assignments from account B

**Application-level tests**:
- [ ] Direct API calls with account B storage ID fail for user A
- [ ] UI doesn't show account B storages for user A
- [ ] Assignment validation prevents cross-account assignments
- [ ] Namespace queries don't leak data across accounts

**Service-level tests**:
- [ ] Pinecone namespace queries respect namespace isolation
- [ ] VAPI knowledge base queries respect account isolation
- [ ] Document embeddings can't be retrieved across namespaces

### Server Action Authorization Pattern
```typescript
async function someDocumentAction(
  documentStorageId: string,
  accountId: string
) {
  const supabase = await createClient();

  // Verify user has access to this account
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
    .single();

  if (!membership) {
    throw new Error('Unauthorized: No access to this account');
  }

  // Verify storage belongs to this account (RLS will enforce, but double-check)
  const { data: storage } = await supabase
    .from('document_storages')
    .select('account_id')
    .eq('id', documentStorageId)
    .single();

  if (!storage || storage.account_id !== accountId) {
    throw new Error('Unauthorized: Storage not found or access denied');
  }

  // Proceed with action...
}
```

### API Route Middleware
Ensure all API routes use authentication middleware:
```typescript
// Example: src/app/api/documents/create/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get account_id from request
  const { account_id } = await request.json();

  // Verify user is member of account
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', account_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with operation...
}
```

### Namespace Isolation Strategy
Namespaces already provide isolation in Pinecone:
- Each document storage has unique namespace
- Queries are scoped to specific namespace
- No way to query across namespaces in single call
- Even if namespace name is known, user needs separate authorization

### Audit Logging
Consider adding audit logs for sensitive operations:
```typescript
// Log storage creation, deletion, assignments
await supabase.from('audit_logs').insert({
  user_id: user.id,
  account_id: accountId,
  action: 'document_storage_created',
  resource_type: 'document_storage',
  resource_id: storageId,
  metadata: { storage_name: name }
});
```

## Definition of Done

- [ ] All RLS policies verified and tested
- [ ] Database-level security tests written and passing
- [ ] Application-level security tests written and passing
- [ ] Authorization checks in all server actions
- [ ] API route middleware verified
- [ ] Namespace isolation tested
- [ ] Cross-account access attempts blocked
- [ ] Documentation of security model
- [ ] Security review completed
- [ ] Penetration testing performed (if applicable)

## Dependencies

- **Requires**: Existing Basejump RLS policies
- **Requires**: Supabase authentication configured
- **Tests**: All document storage features (INTEL-004 through INTEL-009)

## Related Stories

- **Related**: All other stories (security applies to all features)
- **Critical for**: INTEL-004, INTEL-005, INTEL-006, INTEL-007
