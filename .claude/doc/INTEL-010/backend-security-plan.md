# INTEL-010: Backend Security Plan - Multi-Tenant Authorization Analysis

**Agent**: backend-business-logic-architect
**Date**: 2025-10-04
**Status**: Analysis Complete - Recommendations Ready

---

## Executive Summary

This analysis examines authorization patterns across server actions and API routes in the IntelliAA application. The application uses **Basejump's account-based multi-tenancy with Supabase RLS** as its primary security mechanism. However, several critical security gaps exist at the **application layer** that could allow cross-account data access and unauthorized operations.

### Critical Findings

1. **RLS Policies Are Incomplete**: Many tables have RLS enabled but lack active policies (all policies commented out)
2. **No Authorization in API Routes**: API routes accept `account_id` from client without validation
3. **Client-Side Supabase Client Used in Server Actions**: Uses anon key instead of service role, reducing security depth
4. **Missing Cross-Account Assignment Validation**: No checks prevent assigning Organization B's storage to Organization A's assistant
5. **Namespace-Based Security Relies on Obscurity**: Namespace isolation depends on client not knowing other namespaces

---

## 1. Current Authorization Architecture

### 1.1 Multi-Tenant Foundation (Basejump)

**How It Works**:
- Every user belongs to one or more accounts via `basejump.account_user` table
- Each account has members with roles: `owner`, `admin`, `member`
- Helper function: `basejump.get_accounts_with_role(role)` returns account IDs where user has role
- All data tables have `account_id` column linking to `basejump.accounts`

**Expected Security Model**:
```sql
-- Expected RLS policy pattern (from Basejump docs)
CREATE POLICY "Account members can select"
ON public.some_table
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);
```

### 1.2 Current Implementation Status

| Table | RLS Enabled | Active Policies | Account Isolation |
|-------|-------------|----------------|-------------------|
| `assistants` | YES | PARTIAL | INCOMPLETE |
| `document_storages` | UNKNOWN | NONE FOUND | UNKNOWN |
| `pdf_docs` | YES | **ALL COMMENTED OUT** | NO |
| `qa_docs` | YES | PERMISSIVE (see below) | WEAK |
| `document_storage-assistants` | UNKNOWN | NONE FOUND | UNKNOWN |
| `report_ws` | YES | UNKNOWN | UNKNOWN |
| `report_voice` | YES | UNKNOWN | UNKNOWN |
| `voice_assistant` | YES | PUBLIC ACCESS | NONE |

**Critical Issue**: `pdf_docs` migration shows all RLS policies are **commented out** (lines 45-111 in `20240626211030_pdf_docs.sql`).

---

## 2. Security Gaps Analysis

### 2.1 Server Actions - Critical Gaps

#### **assistants.ts** (Client-Side Supabase Client)

**File**: `/src/lib/actions/intelliaa/assistants.ts`

**Line 2**:
```typescript
import { createClient } from "@/lib/supabase/client";
```

**CRITICAL ISSUE**: Uses **client-side** Supabase client with anon key instead of server-side client.

**Security Implications**:
- All queries execute with `authenticated` role (not `service_role`)
- Relies 100% on RLS policies (which are incomplete)
- No server-side authorization layer
- Cannot bypass RLS for admin operations

**Affected Functions** (27 total):

| Function | Authorization Check | Cross-Account Risk |
|----------|---------------------|-------------------|
| `GetAllAssistants(account_id)` | FILTER ONLY | Medium - Relies on RLS |
| `GetAssistant(account_id, assistant_id)` | FILTER ONLY | Medium - Relies on RLS |
| `NewAssistant(account_id, ...)` | NONE | **HIGH** - No validation |
| `updateAssistant(account_id, id, data)` | FILTER ONLY | Medium - Relies on RLS |
| `deleteAssistant(assistant_id, namespace, serviceId, accountId)` | FILTER ONLY | Medium - Relies on RLS |
| `addDsAssistant(assistant_id, ds_id)` | **NONE** | **CRITICAL** - See 2.3 |
| `deleteDsAssistant(assistant_id, ds_id)` | **NONE** | **HIGH** |
| `updateDsAssistant(assistant_id, ds_id)` | **NONE** | **HIGH** |
| `getDsAssistant(assistant_id)` | **NONE** | Medium |
| `activateWs(assistant_id, ...)` | **NONE** | **HIGH** |
| `wsStatusActiveUtil(namespace)` | **NONE** | **HIGH** |

**Example - No Authorization**:
```typescript
// Line 555 - addDsAssistant
const addDsAssistant = async (assistant_id: string, ds_id: string) => {
  const supabase = createClient(); // Client-side client (anon key)

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .insert({
      document_storage: ds_id,    // No validation: does ds_id belong to same account?
      assistant: assistant_id,     // No validation: does user have access to assistant?
    })
    .select();
  // ... no account_id check
}
```

**Attack Vector**:
```javascript
// User in Account A can assign Account B's document storage
await addDsAssistant(
  "my-assistant-in-account-a",
  "document-storage-from-account-b" // UNVALIDATED
);
```

#### **documents.ts** (Server-Side Client - Better but Still Gaps)

**File**: `/src/lib/actions/intelliaa/documents.ts`

**Line 3**:
```typescript
import { createClient } from "@/lib/supabase/server";
```

**GOOD**: Uses server-side client (authenticated session from cookies).

**Remaining Issues**:

1. **No Explicit Account Membership Validation**:
```typescript
// Line 156 - createDocumentStorage
async function createDocumentStorage(account_id: string, formData: FormData) {
  // ❌ NO CHECK: Is current user a member of account_id?
  const supabase = await createClient();
  // ... proceeds with insert
}
```

**Expected Pattern**:
```typescript
async function createDocumentStorage(account_id: string, formData: FormData) {
  const supabase = await createClient();

  // ✅ VALIDATE: User is member of account
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', account_id)
    .eq('user_id', user!.id)
    .single();

  if (!membership) {
    throw new Error('Unauthorized: No access to this account');
  }

  // ... proceed with operation
}
```

2. **Assignment Validation Missing**:
```typescript
// Lines 1089-1452 - uploadPdfToExistingStorage
export async function uploadPdfToExistingStorage(formData: FormData) {
  const documentStorageId = formData.get('documentStorageId') as string;
  const accountId = formData.get('accountId') as string;

  // ✅ GOOD: Validates storage belongs to account
  const { data: documentStorageData } = await supabase
    .from('document_storages')
    .select('id, namespace, account_id, name')
    .eq('id', documentStorageId)
    .eq('account_id', accountId)  // Double-checks account ownership
    .single();

  // ❌ MISSING: Validates current user is member of accountId
}
```

3. **Deletion Functions Lack User Validation**:
```typescript
// Line 2196 - deleteDocumentStorageWithValidation
export async function deleteDocumentStorageWithValidation(
  documentStorageId: string,
  accountId: string
): Promise<DeleteDocumentStorageResponse> {
  // ❌ NO CHECK: Is calling user a member of accountId?
  // ❌ NO CHECK: Does user have 'owner' or 'admin' role for deletions?

  const supabase = await createClient();
  // ... proceeds with deletion
}
```

#### **reports.ts** (Minimal Authorization)

**File**: `/src/lib/actions/intelliaa/reports.ts`

**CRITICAL ISSUE**: Uses **client-side** Supabase client (line 1).

**Security Gaps**:
```typescript
// Line 3 - getReportsWs
const getReportsWs = async (account_id: string) => {
  const supabase = createClient(); // Client-side (anon key)

  const { data, error } = await supabase
    .from("report_ws")
    .select("*")
    .eq("account_id", account_id); // FILTER ONLY - No authorization check

  // ❌ NO VALIDATION: Is current user a member of account_id?
  // Relies 100% on RLS policies (if they exist)
}
```

### 2.2 API Routes - No Authorization Layer

**All API routes examined lack authentication and authorization checks.**

#### **Example 1**: `/api/create-assistant-voice/route.ts`

```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { account_id, name, type, template_id, ... } = body;

    // ❌ NO AUTH CHECK: Is request authenticated?
    // ❌ NO VALIDATION: Is user a member of account_id?
    // ❌ NO ROLE CHECK: Does user have permission to create assistants?

    const response = await createAssistantVoiceVapi(
      account_id, // UNVALIDATED - Could be any account
      name,
      type,
      ...
    );

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

**Attack Vector**:
```bash
# Attacker can create assistant in any account by guessing account_id
curl -X POST https://app.com/api/create-assistant-voice \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "00000000-0000-0000-0000-000000000001",
    "name": "Malicious Assistant",
    ...
  }'
```

#### **Example 2**: `/api/railway/route.ts` (Webhook)

```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { status: statusRw, service } = body;

  // ❌ NO VALIDATION: Is this request from Railway (webhook signature)?
  // ❌ NO SANITIZATION: service.name could be malicious input

  if (statusRw === "SUCCESS") {
    await wsStatusActiveUtil(service.name); // Direct database update
  }
}
```

**Security Risk**: Any external actor can send POST requests to activate WhatsApp assistants.

#### **Example 3**: `/api/update-assistant-voice/route.ts`

```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const {
    id_assistant,
    prompt,
    documentStorageId, // ❌ UNVALIDATED
    ...
  } = body;

  // ❌ NO CHECK: Does documentStorageId belong to same account as assistant?

  await updateAssistantVoiceVapi(
    id_assistant,
    prompt,
    ...
    documentStorageId // CROSS-ACCOUNT ASSIGNMENT POSSIBLE
  );
}
```

### 2.3 Cross-Account Assignment Vulnerability

**CRITICAL**: The `document_storage-assistants` junction table has **no validation** to prevent cross-account assignments.

**Vulnerable Flow**:

1. **User in Account A** calls:
```typescript
await addDsAssistant(
  "assistant-id-in-account-a",      // My assistant
  "document-storage-id-in-account-b" // Someone else's storage
);
```

2. **No validation occurs**:
```typescript
// assistants.ts:555
const { data, error } = await supabase
  .from("document_storage-assistants")
  .insert({
    document_storage: ds_id,    // ❌ NOT VALIDATED
    assistant: assistant_id,    // ❌ NOT VALIDATED
  })
  .select();
```

3. **RLS allows operation IF**:
   - Junction table has no RLS policies, OR
   - RLS policy is too permissive (e.g., allows any authenticated user)

4. **Result**: Assistant in Account A can now access vectors/files from Account B's storage.

**Attack Impact**:
- Data breach: Access to other organizations' documents
- Vector namespace pollution: Queries may return wrong data
- VAPI file access: Voice assistants may read other organizations' files

### 2.4 Namespace Isolation - Security by Obscurity

**Current Model**:
```typescript
// documents.ts:177
const documentStorageNamespace = `${name
  ?.toString()
  .replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 8)}`;
```

**Issues**:

1. **Namespaces are predictable**: Based on sanitized name + 6-char random suffix
2. **No cryptographic guarantee**: `Math.random()` is not secure
3. **Stored in database**: If attacker gains read access to `document_storages`, they know all namespaces
4. **Pinecone has no auth**: If namespace is known, vectors can be queried directly (if API key leaks)

**Better Approach**:
```typescript
import { randomUUID } from 'crypto';

// Use UUIDs for namespaces (cryptographically secure)
const namespace = randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

---

## 3. RLS Policy Gaps

### 3.1 Missing Active Policies

**From migration `20240626211030_pdf_docs.sql`**:

```sql
-- Lines 37-38: RLS is ENABLED
ALTER TABLE public.pdf_docs ENABLE ROW LEVEL SECURITY;

-- Lines 45-111: ALL policies are COMMENTED OUT ❌
-- create policy "Account members can select" on public.pdf_docs
--     for select
--     to authenticated
--     using (
--     (account_id IN ( SELECT basejump.get_accounts_with_role()))
--     );
```

**Impact**: With RLS enabled but no policies, **all queries will fail** by default (PostgreSQL RLS denies by default).

**HOWEVER**: If application uses `service_role` client (bypasses RLS) or if policies were added later via GUI, queries might succeed without authorization.

### 3.2 Permissive Policies Found

**From `fix_permissions.sql`**:

```sql
-- Line 27-32: documents table
create policy "Enable insert for authenticated users only"
on "public"."documents"
as permissive
for insert
to authenticated, anon  -- ❌ ANON allowed
with check (true);       -- ❌ NO CHECK

-- Line 35-40: documents table
create policy "Enable read access for all users"
on "public"."documents"
as permissive
for select
to public                -- ❌ PUBLIC access
using (true);            -- ❌ NO CHECK
```

**Security Issue**: `documents` table allows:
- Anonymous users to insert (no account validation)
- Public read access (no account filtering)

**Expected Policy**:
```sql
CREATE POLICY "Account members can select"
ON public.documents
FOR SELECT
TO authenticated
USING (
  metadata->>'accountId' IN (
    SELECT account_id::text FROM basejump.get_accounts_with_role()
  )
);
```

### 3.3 Weak UPDATE Policy

**From `fix_permissions.sql`**:

```sql
-- Line 51-56: qa_docs table
create policy "Account members can update"
on "public"."qa_docs"
as permissive
for update
to authenticated
using (true);  -- ❌ NO ACCOUNT CHECK
```

**Security Issue**: Any authenticated user can update any `qa_docs` record (no account filtering).

**Expected**:
```sql
CREATE POLICY "Account members can update"
ON public.qa_docs
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);
```

---

## 4. Recommended Authorization Patterns

### 4.1 Server Action Middleware Pattern

**Create**: `/src/lib/auth/serverActionAuth.ts`

```typescript
import { createClient } from "@/lib/supabase/server";

/**
 * Authorization result with user and account context
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
  };
  account: {
    id: string;
    role: 'owner' | 'admin' | 'member';
  };
}

/**
 * Validates user is authenticated and has access to the account
 *
 * @param accountId - Account ID to validate access for
 * @param requiredRole - Minimum role required (defaults to 'member')
 * @returns AuthContext with user and account info
 * @throws Error if unauthorized
 */
export async function requireAccountAccess(
  accountId: string,
  requiredRole: 'owner' | 'admin' | 'member' = 'member'
): Promise<AuthContext> {
  const supabase = await createClient();

  // 1. Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: Authentication required');
  }

  // 2. Verify account membership
  const { data: membership, error: membershipError } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    throw new Error('Forbidden: No access to this account');
  }

  // 3. Verify role (if required)
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const userRoleLevel = roleHierarchy[membership.account_role as keyof typeof roleHierarchy];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    throw new Error(`Forbidden: Requires ${requiredRole} role or higher`);
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
    },
    account: {
      id: accountId,
      role: membership.account_role as 'owner' | 'admin' | 'member',
    },
  };
}

/**
 * Validates resource belongs to the account
 *
 * @param resourceTable - Table name (e.g., 'document_storages')
 * @param resourceId - Resource ID to validate
 * @param accountId - Expected account ID
 * @returns true if resource belongs to account
 * @throws Error if resource not found or doesn't belong to account
 */
export async function requireResourceOwnership(
  resourceTable: string,
  resourceId: string,
  accountId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(resourceTable)
    .select('account_id')
    .eq('id', resourceId)
    .single();

  if (error || !data) {
    throw new Error(`Resource not found: ${resourceTable}/${resourceId}`);
  }

  if (data.account_id !== accountId) {
    throw new Error('Forbidden: Resource belongs to different account');
  }

  return true;
}

/**
 * Validates cross-resource assignment is within same account
 *
 * Example: Prevent assigning Account B's document storage to Account A's assistant
 *
 * @param resources - Array of [table, id, accountId] tuples to validate
 * @throws Error if resources belong to different accounts
 */
export async function requireSameAccountResources(
  resources: Array<{ table: string; id: string; accountId: string }>
): Promise<boolean> {
  const supabase = await createClient();

  // Fetch all resources in parallel
  const queries = resources.map(({ table, id }) =>
    supabase
      .from(table)
      .select('id, account_id')
      .eq('id', id)
      .single()
  );

  const results = await Promise.all(queries);

  // Check all belong to same account
  const expectedAccountId = resources[0].accountId;

  for (let i = 0; i < results.length; i++) {
    const { data, error } = results[i];
    const { table, id } = resources[i];

    if (error || !data) {
      throw new Error(`Resource not found: ${table}/${id}`);
    }

    if (data.account_id !== expectedAccountId) {
      throw new Error(
        `Forbidden: Resource ${table}/${id} belongs to different account (${data.account_id} vs ${expectedAccountId})`
      );
    }
  }

  return true;
}
```

### 4.2 Updated Server Action Example

**Before (Vulnerable)**:
```typescript
const addDsAssistant = async (assistant_id: string, ds_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .insert({ document_storage: ds_id, assistant: assistant_id })
    .select();

  return data;
};
```

**After (Secure)**:
```typescript
import { requireAccountAccess, requireSameAccountResources } from "@/lib/auth/serverActionAuth";
import { createClient } from "@/lib/supabase/server";

const addDsAssistant = async (
  assistant_id: string,
  ds_id: string,
  account_id: string // ✅ ADDED: Explicit account parameter
) => {
  // ✅ STEP 1: Verify user has access to account
  await requireAccountAccess(account_id, 'member');

  // ✅ STEP 2: Verify both resources belong to same account
  await requireSameAccountResources([
    { table: 'assistants', id: assistant_id, accountId: account_id },
    { table: 'document_storages', id: ds_id, accountId: account_id },
  ]);

  // ✅ STEP 3: Proceed with assignment (now safe)
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .insert({ document_storage: ds_id, assistant: assistant_id })
    .select();

  if (error) {
    throw new Error(`Failed to assign document storage: ${error.message}`);
  }

  return data;
};
```

### 4.3 API Route Middleware Pattern

**Create**: `/src/lib/auth/apiRouteAuth.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ApiAuthContext {
  user: {
    id: string;
    email: string;
  };
  accountId?: string;
  accountRole?: 'owner' | 'admin' | 'member';
}

/**
 * API Route authentication middleware
 *
 * Usage:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const auth = await withApiAuth(req);
 *   if (auth instanceof NextResponse) return auth; // Error response
 *
 *   // auth.user is now available
 * }
 * ```
 */
export async function withApiAuth(
  req: NextRequest
): Promise<ApiAuthContext | NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required' },
      { status: 401 }
    );
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
    },
  };
}

/**
 * API Route with account validation
 *
 * Validates user has access to the account specified in request body
 */
export async function withApiAccountAuth(
  req: NextRequest,
  accountId: string,
  requiredRole: 'owner' | 'admin' | 'member' = 'member'
): Promise<ApiAuthContext | NextResponse> {
  const auth = await withApiAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  // Verify account membership
  const { data: membership, error } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', auth.user.id)
    .single();

  if (error || !membership) {
    return NextResponse.json(
      { error: 'Forbidden: No access to this account' },
      { status: 403 }
    );
  }

  // Verify role
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const userRoleLevel = roleHierarchy[membership.account_role as keyof typeof roleHierarchy];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    return NextResponse.json(
      { error: `Forbidden: Requires ${requiredRole} role or higher` },
      { status: 403 }
    );
  }

  return {
    ...auth,
    accountId,
    accountRole: membership.account_role as 'owner' | 'admin' | 'member',
  };
}
```

**Updated API Route Example**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withApiAccountAuth } from "@/lib/auth/apiRouteAuth";
import { createAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { account_id, name, type, template_id, ... } = body;

    // ✅ VALIDATE: User is authenticated and has access to account
    const auth = await withApiAccountAuth(req, account_id, 'member');
    if (auth instanceof NextResponse) return auth; // Return error response

    // ✅ SECURE: Proceed with operation
    const response = await createAssistantVoiceVapi(
      account_id, // Now validated
      name,
      type,
      template_id,
      ...
    );

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error("Error creating assistant:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

### 4.4 Webhook Signature Validation

**For `/api/railway/route.ts` webhook**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * Validates Railway webhook signature
 *
 * Railway sends webhook with signature in header:
 * X-Railway-Signature: sha256=<signature>
 */
function validateRailwaySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ✅ STEP 1: Validate webhook signature
    const signature = req.headers.get('X-Railway-Signature') || '';
    const rawBody = await req.text();
    const secret = process.env.RAILWAY_WEBHOOK_SECRET!;

    if (!validateRailwaySignature(rawBody, signature, secret)) {
      console.error('[Railway Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // ✅ STEP 2: Parse and validate payload
    const body = JSON.parse(rawBody);
    const { status: statusRw, service } = body;

    if (!statusRw || !service?.name) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    // ✅ STEP 3: Sanitize namespace (prevent injection)
    const namespace = service.name.replace(/[^a-zA-Z0-9-_]/g, '');

    if (statusRw === "SUCCESS") {
      await wsStatusActiveUtil(namespace);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("Railway webhook error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

---

## 5. Database-Level Security (RLS Policies)

### 5.1 Required RLS Policies

**Apply these policies immediately** (uncomment from migrations or create via SQL editor):

#### **assistants table**:

```sql
-- SELECT: Account members can view assistants
CREATE POLICY "Account members can select assistants"
ON public.assistants
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- INSERT: Account members can create assistants
CREATE POLICY "Account members can insert assistants"
ON public.assistants
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- UPDATE: Account members can update assistants
CREATE POLICY "Account members can update assistants"
ON public.assistants
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- DELETE: Only owners/admins can delete assistants
CREATE POLICY "Account owners can delete assistants"
ON public.assistants
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role('owner'))
  OR account_id IN (SELECT basejump.get_accounts_with_role('admin'))
);
```

#### **document_storages table**:

```sql
-- SELECT: Account members can view storages
CREATE POLICY "Account members can select document_storages"
ON public.document_storages
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- INSERT: Account members can create storages
CREATE POLICY "Account members can insert document_storages"
ON public.document_storages
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- UPDATE: Account members can update storages
CREATE POLICY "Account members can update document_storages"
ON public.document_storages
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- DELETE: Only owners/admins can delete storages
CREATE POLICY "Account owners can delete document_storages"
ON public.document_storages
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role('owner'))
  OR account_id IN (SELECT basejump.get_accounts_with_role('admin'))
);
```

#### **pdf_docs table**:

```sql
-- SELECT: Account members can view PDFs
CREATE POLICY "Account members can select pdf_docs"
ON public.pdf_docs
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- INSERT: Account members can upload PDFs
CREATE POLICY "Account members can insert pdf_docs"
ON public.pdf_docs
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- DELETE: Account members can delete PDFs
CREATE POLICY "Account members can delete pdf_docs"
ON public.pdf_docs
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);
```

#### **document_storage-assistants table**:

```sql
-- SELECT: Users can view assignments for their assistants
CREATE POLICY "Users can select assignments for their assistants"
ON public."document_storage-assistants"
FOR SELECT
TO authenticated
USING (
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);

-- INSERT: Users can only assign storages to their own assistants
-- AND only storages from the same account
CREATE POLICY "Users can assign storages to their assistants"
ON public."document_storage-assistants"
FOR INSERT
TO authenticated
WITH CHECK (
  -- Both assistant and storage must belong to user's account
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
  AND document_storage IN (
    SELECT id FROM public.document_storages
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);

-- DELETE: Users can remove assignments from their assistants
CREATE POLICY "Users can delete assignments from their assistants"
ON public."document_storage-assistants"
FOR DELETE
TO authenticated
USING (
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);
```

#### **qa_docs table**:

```sql
-- FIX: Replace permissive policies

DROP POLICY IF EXISTS "Account members can update" ON public.qa_docs;

CREATE POLICY "Account members can select qa_docs"
ON public.qa_docs
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can insert qa_docs"
ON public.qa_docs
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can update qa_docs"
ON public.qa_docs
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can delete qa_docs"
ON public.qa_docs
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);
```

#### **report_ws & report_voice tables**:

```sql
-- SELECT only (reports should be read-only for users)
CREATE POLICY "Account members can select report_ws"
ON public.report_ws
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can select report_voice"
ON public.report_voice
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);
```

### 5.2 Database Function for Cross-Account Validation

**Create PostgreSQL function to validate cross-account assignments**:

```sql
CREATE OR REPLACE FUNCTION public.validate_same_account_assignment(
  p_assistant_id uuid,
  p_document_storage_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assistant_account_id uuid;
  v_storage_account_id uuid;
BEGIN
  -- Get assistant account_id
  SELECT account_id INTO v_assistant_account_id
  FROM public.assistants
  WHERE id = p_assistant_id;

  IF v_assistant_account_id IS NULL THEN
    RAISE EXCEPTION 'Assistant not found: %', p_assistant_id;
  END IF;

  -- Get document storage account_id
  SELECT account_id INTO v_storage_account_id
  FROM public.document_storages
  WHERE id = p_document_storage_id;

  IF v_storage_account_id IS NULL THEN
    RAISE EXCEPTION 'Document storage not found: %', p_document_storage_id;
  END IF;

  -- Validate same account
  IF v_assistant_account_id != v_storage_account_id THEN
    RAISE EXCEPTION 'Cross-account assignment blocked: assistant account % != storage account %',
      v_assistant_account_id, v_storage_account_id;
  END IF;

  RETURN true;
END;
$$;
```

**Add CHECK constraint to junction table**:

```sql
-- Add constraint to document_storage-assistants table
ALTER TABLE public."document_storage-assistants"
ADD CONSTRAINT check_same_account_assignment
CHECK (public.validate_same_account_assignment(assistant, document_storage));
```

**Benefits**:
- Database-level enforcement (can't be bypassed by application code)
- Works even if RLS is bypassed via service_role
- Centralized validation logic

---

## 6. Implementation Checklist

### Phase 1: Critical Fixes (P0 - Immediate)

- [ ] **RLS Policies**: Uncomment and apply all RLS policies from migrations
  - [ ] `assistants` table (SELECT, INSERT, UPDATE, DELETE)
  - [ ] `document_storages` table (all operations)
  - [ ] `pdf_docs` table (all operations)
  - [ ] `document_storage-assistants` table (critical for cross-account prevention)
  - [ ] `qa_docs` table (fix permissive UPDATE policy)
  - [ ] `report_ws` and `report_voice` (SELECT only)

- [ ] **Cross-Account Assignment Prevention**:
  - [ ] Create `validate_same_account_assignment()` PostgreSQL function
  - [ ] Add CHECK constraint to `document_storage-assistants` table
  - [ ] Test: Attempt to assign Account B's storage to Account A's assistant (should fail)

- [ ] **Server Action Authorization**:
  - [ ] Create `/src/lib/auth/serverActionAuth.ts` middleware
  - [ ] Update `addDsAssistant()` to use `requireSameAccountResources()`
  - [ ] Update `updateDsAssistant()` to use `requireSameAccountResources()`
  - [ ] Update `deleteDsAssistant()` to validate account access

### Phase 2: API Route Security (P0 - Immediate)

- [ ] **API Route Middleware**:
  - [ ] Create `/src/lib/auth/apiRouteAuth.ts`
  - [ ] Implement `withApiAuth()` and `withApiAccountAuth()`

- [ ] **Update API Routes**:
  - [ ] `/api/create-assistant-voice/route.ts` - Add `withApiAccountAuth()`
  - [ ] `/api/update-assistant-voice/route.ts` - Add `withApiAccountAuth()` + validate `documentStorageId`
  - [ ] `/api/delete-assistant-voice/route.ts` - Add `withApiAccountAuth()`
  - [ ] `/api/update-assistant-number/route.ts` - Add `withApiAccountAuth()`
  - [ ] `/api/update-active-number/route.ts` - Add `withApiAccountAuth()`

- [ ] **Webhook Security**:
  - [ ] `/api/railway/route.ts` - Implement signature validation
  - [ ] Add `RAILWAY_WEBHOOK_SECRET` to `.env`

### Phase 3: Server Actions Migration (P1 - High Priority)

- [ ] **Migrate Client-Side to Server-Side Supabase Client**:
  - [ ] Update `assistants.ts` (line 2): Change to `import { createClient } from "@/lib/supabase/server"`
  - [ ] Update `reports.ts` (line 1): Change to server-side client
  - [ ] Update all functions to be `async` and `await createClient()`

- [ ] **Add Authorization to Server Actions**:
  - [ ] `assistants.ts`:
    - [ ] `NewAssistant()` - Add `requireAccountAccess()`
    - [ ] `updateAssistant()` - Add `requireAccountAccess()` + `requireResourceOwnership()`
    - [ ] `deleteAssistant()` - Add `requireAccountAccess()` with `owner` or `admin` role
    - [ ] `activateWs()` - Add `requireAccountAccess()` + `requireResourceOwnership()`

  - [ ] `documents.ts`:
    - [ ] `createDocumentStorage()` - Add `requireAccountAccess()` at start
    - [ ] `uploadPdfToExistingStorage()` - Add `requireAccountAccess()` + validate storage ownership
    - [ ] `deleteDocumentStorageWithValidation()` - Add `requireAccountAccess()` with `owner` or `admin` role
    - [ ] `deletePdfDocument()` - Add `requireAccountAccess()` + validate pdf ownership

  - [ ] `reports.ts`:
    - [ ] `getReportsWs()` - Add `requireAccountAccess()`
    - [ ] `getReportsVoice()` - Add `requireAccountAccess()`

### Phase 4: Enhanced Security (P2 - Medium Priority)

- [ ] **Cryptographic Namespaces**:
  - [ ] Replace `Math.random()` with `crypto.randomUUID()` for namespace generation
  - [ ] Update existing namespaces (migration script)

- [ ] **Audit Logging**:
  - [ ] Create `audit_logs` table with RLS
  - [ ] Log sensitive operations (document storage assignment, deletion, etc.)
  - [ ] Add audit trail to authorization middleware

- [ ] **Rate Limiting**:
  - [ ] Implement rate limiting on API routes (prevent abuse)
  - [ ] Add to webhook endpoints (prevent DDoS)

### Phase 5: Testing & Validation (P0 - Immediate)

- [ ] **Security Test Suite**:
  - [ ] Test RLS policies block cross-account access
  - [ ] Test API routes reject unauthenticated requests
  - [ ] Test cross-account assignment prevention
  - [ ] Test role-based access control (owner vs member)

- [ ] **Integration Tests**:
  - [ ] Create test accounts (Account A, Account B)
  - [ ] Verify User A cannot access Account B's data
  - [ ] Verify User A cannot assign Account B's storage to Account A's assistant

- [ ] **Documentation**:
  - [ ] Document authorization patterns for future developers
  - [ ] Create security checklist for new features
  - [ ] Update CLAUDE.md with security best practices

---

## 7. Risk Assessment

### 7.1 Current Risk Matrix

| Vulnerability | Likelihood | Impact | Risk Level | Status |
|--------------|------------|--------|------------|--------|
| Cross-account data access via missing RLS policies | **HIGH** | **CRITICAL** | **P0** | UNMITIGATED |
| Cross-account document storage assignment | **HIGH** | **CRITICAL** | **P0** | UNMITIGATED |
| Unauthenticated API route access | **MEDIUM** | **HIGH** | **P0** | UNMITIGATED |
| Webhook spoofing (Railway) | **MEDIUM** | **MEDIUM** | **P1** | UNMITIGATED |
| Namespace prediction | **LOW** | **MEDIUM** | **P2** | PARTIAL |
| Excessive permissions on `documents` table | **LOW** | **LOW** | **P2** | UNMITIGATED |

### 7.2 Post-Implementation Risk Matrix

| Vulnerability | Likelihood | Impact | Risk Level | Status |
|--------------|------------|--------|------------|--------|
| Cross-account data access via missing RLS policies | **LOW** | **CRITICAL** | **P2** | MITIGATED (RLS + app-layer) |
| Cross-account document storage assignment | **VERY LOW** | **CRITICAL** | **P2** | MITIGATED (DB constraint) |
| Unauthenticated API route access | **VERY LOW** | **HIGH** | **P2** | MITIGATED (middleware) |
| Webhook spoofing (Railway) | **VERY LOW** | **MEDIUM** | **P3** | MITIGATED (signature) |
| Namespace prediction | **VERY LOW** | **MEDIUM** | **P3** | MITIGATED (UUID) |
| Excessive permissions on `documents` table | **LOW** | **LOW** | **P3** | MITIGATED (RLS update) |

---

## 8. Testing Strategy

### 8.1 RLS Policy Tests (Database-Level)

**Test File**: `/supabase/tests/rls_policies.test.sql`

```sql
-- Setup: Create test accounts and users
BEGIN;

-- Create test user A
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'user-a@test.com');

-- Create test user B
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000002', 'user-b@test.com');

-- Create test account A
INSERT INTO basejump.accounts (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Account A');

-- Create test account B
INSERT INTO basejump.accounts (id, name) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Account B');

-- Add user A to account A
INSERT INTO basejump.account_user (user_id, account_id, account_role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner');

-- Add user B to account B
INSERT INTO basejump.account_user (user_id, account_id, account_role) VALUES
  ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');

-- Create document storage in account A
INSERT INTO public.document_storages (id, account_id, name, namespace) VALUES
  ('ddddddd1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Storage A', 'namespace-a');

-- Create document storage in account B
INSERT INTO public.document_storages (id, account_id, name, namespace) VALUES
  ('ddddddd2-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Storage B', 'namespace-b');

-- TEST 1: User A can SELECT their own storage
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001"}';

SELECT id FROM public.document_storages WHERE id = 'ddddddd1-0000-0000-0000-000000000001';
-- Expected: 1 row

-- TEST 2: User A CANNOT SELECT account B's storage
SELECT id FROM public.document_storages WHERE id = 'ddddddd2-0000-0000-0000-000000000001';
-- Expected: 0 rows (RLS blocks)

-- TEST 3: User A CANNOT INSERT storage to account B
INSERT INTO public.document_storages (id, account_id, name, namespace) VALUES
  (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000001', 'Malicious Storage', 'evil-namespace');
-- Expected: ERROR (RLS blocks WITH CHECK)

ROLLBACK;
```

### 8.2 Application-Level Authorization Tests

**Test File**: `/tests/auth/server-action-auth.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { requireAccountAccess, requireSameAccountResources } from '@/lib/auth/serverActionAuth';

describe('Server Action Authorization', () => {
  describe('requireAccountAccess', () => {
    it('should allow access for account member', async () => {
      const context = await requireAccountAccess('account-a-id');
      expect(context.user.id).toBeDefined();
      expect(context.account.id).toBe('account-a-id');
    });

    it('should reject access for non-member', async () => {
      await expect(
        requireAccountAccess('account-b-id')
      ).rejects.toThrow('Forbidden: No access to this account');
    });

    it('should enforce role requirement', async () => {
      await expect(
        requireAccountAccess('account-a-id', 'owner')
      ).rejects.toThrow('Forbidden: Requires owner role or higher');
    });
  });

  describe('requireSameAccountResources', () => {
    it('should allow assignment within same account', async () => {
      const result = await requireSameAccountResources([
        { table: 'assistants', id: 'assistant-a', accountId: 'account-a' },
        { table: 'document_storages', id: 'storage-a', accountId: 'account-a' },
      ]);
      expect(result).toBe(true);
    });

    it('should block cross-account assignment', async () => {
      await expect(
        requireSameAccountResources([
          { table: 'assistants', id: 'assistant-a', accountId: 'account-a' },
          { table: 'document_storages', id: 'storage-b', accountId: 'account-a' }, // storage-b belongs to account-b
        ])
      ).rejects.toThrow('Forbidden: Resource belongs to different account');
    });
  });
});
```

### 8.3 API Route Authorization Tests

**Test File**: `/tests/api/api-route-auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/create-assistant-voice/route';
import { NextRequest } from 'next/server';

describe('API Route Authorization', () => {
  it('should reject unauthenticated requests', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-assistant-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: 'account-a', name: 'Test' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('should reject requests for unauthorized account', async () => {
    // Authenticated as user-a, but trying to access account-b
    const req = new NextRequest('http://localhost:3000/api/create-assistant-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sb-access-token=user-a-token',
      },
      body: JSON.stringify({ account_id: 'account-b', name: 'Test' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Forbidden');
  });

  it('should allow requests for authorized account', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-assistant-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sb-access-token=user-a-token',
      },
      body: JSON.stringify({ account_id: 'account-a', name: 'Test' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
```

---

## 9. Migration Script

**Create**: `/supabase/migrations/20251004_fix_authorization.sql`

```sql
-- INTEL-010: Fix Multi-Tenant Authorization (Backend Security Plan)
-- Priority: P0 - CRITICAL
-- Date: 2025-10-04

BEGIN;

-- ============================================================================
-- PHASE 1: RLS Policies for Assistants Table
-- ============================================================================

CREATE POLICY "Account members can select assistants"
ON public.assistants
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can insert assistants"
ON public.assistants
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can update assistants"
ON public.assistants
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account owners can delete assistants"
ON public.assistants
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role('owner'))
  OR account_id IN (SELECT basejump.get_accounts_with_role('admin'))
);

-- ============================================================================
-- PHASE 2: RLS Policies for Document Storages Table
-- ============================================================================

CREATE POLICY "Account members can select document_storages"
ON public.document_storages
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can insert document_storages"
ON public.document_storages
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can update document_storages"
ON public.document_storages
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account owners can delete document_storages"
ON public.document_storages
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role('owner'))
  OR account_id IN (SELECT basejump.get_accounts_with_role('admin'))
);

-- ============================================================================
-- PHASE 3: RLS Policies for PDF Docs Table
-- ============================================================================

CREATE POLICY "Account members can select pdf_docs"
ON public.pdf_docs
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can insert pdf_docs"
ON public.pdf_docs
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can delete pdf_docs"
ON public.pdf_docs
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- ============================================================================
-- PHASE 4: RLS Policies for Junction Table (CRITICAL)
-- ============================================================================

CREATE POLICY "Users can select assignments for their assistants"
ON public."document_storage-assistants"
FOR SELECT
TO authenticated
USING (
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);

CREATE POLICY "Users can assign storages to their assistants"
ON public."document_storage-assistants"
FOR INSERT
TO authenticated
WITH CHECK (
  -- Both assistant and storage must belong to user's account
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
  AND document_storage IN (
    SELECT id FROM public.document_storages
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);

CREATE POLICY "Users can delete assignments from their assistants"
ON public."document_storage-assistants"
FOR DELETE
TO authenticated
USING (
  assistant IN (
    SELECT id FROM public.assistants
    WHERE account_id IN (SELECT basejump.get_accounts_with_role())
  )
);

-- ============================================================================
-- PHASE 5: Fix QA Docs Permissive Policies
-- ============================================================================

DROP POLICY IF EXISTS "Account members can update" ON public.qa_docs;

CREATE POLICY "Account members can select qa_docs"
ON public.qa_docs
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can insert qa_docs"
ON public.qa_docs
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can update qa_docs"
ON public.qa_docs
FOR UPDATE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can delete qa_docs"
ON public.qa_docs
FOR DELETE
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- ============================================================================
-- PHASE 6: Reports Tables (Read-Only)
-- ============================================================================

CREATE POLICY "Account members can select report_ws"
ON public.report_ws
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

CREATE POLICY "Account members can select report_voice"
ON public.report_voice
FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT basejump.get_accounts_with_role())
);

-- ============================================================================
-- PHASE 7: Cross-Account Assignment Validation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_same_account_assignment(
  p_assistant_id uuid,
  p_document_storage_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assistant_account_id uuid;
  v_storage_account_id uuid;
BEGIN
  -- Get assistant account_id
  SELECT account_id INTO v_assistant_account_id
  FROM public.assistants
  WHERE id = p_assistant_id;

  IF v_assistant_account_id IS NULL THEN
    RAISE EXCEPTION 'Assistant not found: %', p_assistant_id;
  END IF;

  -- Get document storage account_id
  SELECT account_id INTO v_storage_account_id
  FROM public.document_storages
  WHERE id = p_document_storage_id;

  IF v_storage_account_id IS NULL THEN
    RAISE EXCEPTION 'Document storage not found: %', p_document_storage_id;
  END IF;

  -- Validate same account
  IF v_assistant_account_id != v_storage_account_id THEN
    RAISE EXCEPTION 'Cross-account assignment blocked: assistant account % != storage account %',
      v_assistant_account_id, v_storage_account_id;
  END IF;

  RETURN true;
END;
$$;

-- Add CHECK constraint to junction table
ALTER TABLE public."document_storage-assistants"
ADD CONSTRAINT check_same_account_assignment
CHECK (public.validate_same_account_assignment(assistant, document_storage));

COMMIT;
```

---

## 10. Summary & Next Steps

### Critical Security Gaps Identified

1. **Missing RLS Policies**: Most tables lack active policies despite RLS being enabled
2. **No API Route Authorization**: All API routes accept `account_id` without validation
3. **Cross-Account Assignment Vulnerability**: Junction table allows linking resources from different accounts
4. **Client-Side Supabase Client in Server Actions**: Reduces defense-in-depth
5. **Permissive Policies**: Some tables allow public/anon access without account filtering

### Immediate Actions Required (P0)

1. Apply RLS policies migration (`20251004_fix_authorization.sql`)
2. Implement server action authorization middleware
3. Implement API route authorization middleware
4. Add cross-account assignment validation
5. Execute security test suite

### Expected Outcomes

After implementing this plan:
- **Defense in Depth**: 3 layers of security (RLS + app-layer + DB constraints)
- **Zero Trust**: Every operation validates user identity and account membership
- **Fail-Safe**: Even if one layer fails, other layers prevent unauthorized access
- **Auditability**: All authorization decisions are logged and traceable

### Estimated Effort

- **Phase 1 (RLS Policies)**: 2 hours - Apply migration, test policies
- **Phase 2 (API Routes)**: 4 hours - Implement middleware, update 8 routes
- **Phase 3 (Server Actions)**: 8 hours - Migrate clients, add authorization to 20+ functions
- **Phase 4 (Testing)**: 4 hours - Write and execute security tests
- **Total**: ~18 hours (2-3 days)

### Risk of NOT Implementing

- **Data Breach**: Organizations can access other organizations' documents, assistants, reports
- **Compliance Violation**: GDPR, SOC 2, HIPAA violations (if applicable)
- **Reputation Damage**: Security incident could destroy customer trust
- **Financial Loss**: Potential lawsuits, regulatory fines, customer churn

---

## Appendix A: References

- **Basejump Documentation**: https://usebasejump.com/docs
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Next.js 15 Security**: https://nextjs.org/docs/app/building-your-application/authentication
- **OWASP Top 10 (Broken Access Control)**: https://owasp.org/Top10/A01_2021-Broken_Access_Control/

---

## Appendix B: Contact

For questions about this security plan, contact:
- **Created By**: backend-business-logic-architect agent
- **Date**: 2025-10-04
- **Session**: INTEL-010

**Reviewed By**: (To be filled after implementation review)
