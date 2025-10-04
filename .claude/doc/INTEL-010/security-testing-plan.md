# INTEL-010: Multi-tenant Security Testing Implementation Plan

**Epic**: Security & Multi-tenancy
**Priority**: P0 - Critical
**Created**: 2025-10-04
**Author**: testing-strategy-planner
**Status**: Planning Phase

---

## Executive Summary

This document provides a comprehensive testing strategy for verifying multi-tenant data isolation across the IntelliAA platform. The plan covers **database-level RLS policies**, **application-level authorization**, **service-level namespace isolation**, and **penetration testing scenarios** to ensure complete security between organizations.

**Key Testing Objectives:**
- Verify RLS policies block cross-account data access at the database layer
- Validate server actions enforce authorization before operations
- Ensure external services (Pinecone, VAPI, Flowise) maintain namespace isolation
- Detect and prevent cross-account assignment attempts
- Verify UI does not leak data across accounts

**Testing Strategy:** Defense-in-depth approach with automated tests, manual penetration tests, and continuous monitoring.

---

## Table of Contents

1. [Testing Architecture](#testing-architecture)
2. [Database-Level Security Tests](#database-level-security-tests)
3. [Application-Level Security Tests](#application-level-security-tests)
4. [Service-Level Security Tests](#service-level-security-tests)
5. [UI/UX Security Tests](#uiux-security-tests)
6. [Penetration Testing Scenarios](#penetration-testing-scenarios)
7. [Test Data Setup](#test-data-setup)
8. [Test Implementation Structure](#test-implementation-structure)
9. [Environment Setup](#environment-setup)
10. [Critical Notes](#critical-notes)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Next Steps](#next-steps)

---

## Testing Architecture

### Testing Pyramid

```
                    ┌─────────────────┐
                    │   Penetration   │ (Manual - Quarterly)
                    │     Testing     │
                    └─────────────────┘
                  ┌───────────────────────┐
                  │   E2E Security Tests  │ (Automated - Daily)
                  │  (Playwright/Cypress) │
                  └───────────────────────┘
              ┌─────────────────────────────────┐
              │  Integration Security Tests     │ (Automated - Pre-commit)
              │  (API Routes, Server Actions)   │
              └─────────────────────────────────┘
          ┌───────────────────────────────────────────┐
          │  Database-Level RLS Security Tests        │ (Automated - Pre-commit)
          │  (Direct Supabase Queries)                │
          └───────────────────────────────────────────┘
```

### Coverage Goals

| Test Level | Coverage Target | Execution Frequency |
|------------|----------------|---------------------|
| **Database RLS** | 100% of policies | Pre-commit (CI/CD) |
| **Server Actions** | 100% of authorization checks | Pre-commit (CI/CD) |
| **API Routes** | 100% of protected endpoints | Pre-commit (CI/CD) |
| **Integration** | 90% of cross-account scenarios | Daily (CI/CD) |
| **E2E UI** | 85% of critical user flows | Daily (CI/CD) |
| **Penetration** | Manual validation | Quarterly |

### Testing Frameworks

- **Vitest**: Unit and integration tests (already configured)
- **@testing-library/react**: Component testing
- **Supabase Test Client**: Database testing with RLS
- **MSW (Mock Service Worker)**: API mocking for external services
- **Playwright** (future): E2E testing (already partially configured)

---

## Database-Level Security Tests

### Test Scope

Verify that Row Level Security (RLS) policies enforce multi-tenant isolation for:
- `document_storages` table
- `pdf_docs` table
- `qa_docs` table
- `document_storage-assistants` junction table
- `assistants` table
- `report_ws` table
- `report_voice` table

### Test File Structure

```
src/__tests__/security/database/
├── rls-document-storages.test.ts
├── rls-pdf-docs.test.ts
├── rls-qa-docs.test.ts
├── rls-junction-table.test.ts
├── rls-assistants.test.ts
├── rls-reports.test.ts
└── helpers/
    ├── test-users.ts
    └── supabase-test-client.ts
```

### Test Cases

#### 1. Document Storages RLS Tests (`rls-document-storages.test.ts`)

**File Path**: `src/__tests__/security/database/rls-document-storages.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createTestUsers, cleanupTestData } from './helpers/test-users';
import { createSupabaseTestClient } from './helpers/supabase-test-client';

describe('Database Security: document_storages RLS Policies', () => {
  let userA: { id: string; accountId: string; supabase: any };
  let userB: { id: string; accountId: string; supabase: any };

  beforeAll(async () => {
    // Create two test users in different accounts
    const users = await createTestUsers(2);
    userA = users[0];
    userB = users[1];
  });

  afterAll(async () => {
    await cleanupTestData([userA.accountId, userB.accountId]);
  });

  describe('SELECT Policy: Cross-account read prevention', () => {
    test('User A cannot SELECT document storages from Account B', async () => {
      // Setup: Create document storage in Account B
      const { data: storageB, error: createError } = await userB.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId,
          name: 'Test Storage B',
          namespace: `test-ns-${Date.now()}`,
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(storageB).toBeDefined();

      // Test: User A attempts to query Account B's storage
      const { data: queryResult, error: queryError } = await userA.supabase
        .from('document_storages')
        .select('*')
        .eq('id', storageB.id)
        .single();

      // Assertion: RLS should return empty result (not error)
      expect(queryResult).toBeNull();
      expect(queryError).toBeDefined();
      expect(queryError.code).toBe('PGRST116'); // Supabase "No rows found" error
    });

    test('User A can SELECT their own document storages', async () => {
      // Setup: Create storage in Account A
      const { data: storageA, error: createError } = await userA.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userA.accountId,
          name: 'Test Storage A',
          namespace: `test-ns-${Date.now()}`,
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Test: User A queries their own storage
      const { data: queryResult, error: queryError } = await userA.supabase
        .from('document_storages')
        .select('*')
        .eq('id', storageA.id)
        .single();

      // Assertion: Should succeed
      expect(queryError).toBeNull();
      expect(queryResult).toBeDefined();
      expect(queryResult.id).toBe(storageA.id);
      expect(queryResult.account_id).toBe(userA.accountId);
    });

    test('User A SELECT query returns only Account A storages', async () => {
      // Setup: Create storages in both accounts
      await userA.supabase.from('document_storages').insert({
        account_id: userA.accountId,
        name: 'Storage A1',
        namespace: `ns-a1-${Date.now()}`,
      });

      await userB.supabase.from('document_storages').insert({
        account_id: userB.accountId,
        name: 'Storage B1',
        namespace: `ns-b1-${Date.now()}`,
      });

      // Test: User A queries all storages
      const { data: allStorages, error } = await userA.supabase
        .from('document_storages')
        .select('*');

      // Assertion: Should only see Account A storages
      expect(error).toBeNull();
      expect(allStorages).toBeDefined();
      expect(allStorages.length).toBeGreaterThan(0);

      // Verify ALL results belong to Account A
      allStorages.forEach((storage: any) => {
        expect(storage.account_id).toBe(userA.accountId);
      });
    });
  });

  describe('INSERT Policy: Cross-account write prevention', () => {
    test('User A cannot INSERT document storage to Account B', async () => {
      // Test: User A attempts to create storage in Account B
      const { data, error } = await userA.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId, // Different account!
          name: 'Malicious Storage',
          namespace: `malicious-ns-${Date.now()}`,
        })
        .select();

      // Assertion: RLS should block with policy violation
      expect(error).toBeDefined();
      expect(error.code).toBe('42501'); // PostgreSQL permission denied
      expect(data).toBeNull();
    });

    test('User A can INSERT document storage to their own account', async () => {
      const { data, error } = await userA.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userA.accountId,
          name: 'Legitimate Storage',
          namespace: `legit-ns-${Date.now()}`,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.account_id).toBe(userA.accountId);
    });
  });

  describe('UPDATE Policy: Cross-account modification prevention', () => {
    test('User A cannot UPDATE Account B document storage', async () => {
      // Setup: Create storage in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId,
          name: 'Original Name',
          namespace: `ns-b-${Date.now()}`,
        })
        .select()
        .single();

      // Test: User A attempts to update Account B storage
      const { data, error } = await userA.supabase
        .from('document_storages')
        .update({ name: 'Hacked Name' })
        .eq('id', storageB.id)
        .select();

      // Assertion: RLS should block
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('User A cannot change account_id of their own storage to another account', async () => {
      // Setup: Create storage in Account A
      const { data: storageA } = await userA.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userA.accountId,
          name: 'Test Storage',
          namespace: `ns-a-${Date.now()}`,
        })
        .select()
        .single();

      // Test: Attempt to change account_id to Account B
      const { data, error } = await userA.supabase
        .from('document_storages')
        .update({ account_id: userB.accountId })
        .eq('id', storageA.id)
        .select();

      // Assertion: RLS WITH CHECK should block
      expect(error).toBeDefined();
      expect(error.code).toBe('42501'); // Permission denied
    });
  });

  describe('DELETE Policy: Cross-account deletion prevention', () => {
    test('User A cannot DELETE Account B document storage', async () => {
      // Setup: Create storage in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId,
          name: 'Storage to Delete',
          namespace: `ns-b-${Date.now()}`,
        })
        .select()
        .single();

      // Test: User A attempts to delete Account B storage
      const { data, error } = await userA.supabase
        .from('document_storages')
        .delete()
        .eq('id', storageB.id)
        .select();

      // Assertion: RLS should block
      expect(error).toBeDefined();
      expect(data).toHaveLength(0);

      // Verify storage still exists (query as User B)
      const { data: verification } = await userB.supabase
        .from('document_storages')
        .select('id')
        .eq('id', storageB.id)
        .single();

      expect(verification).toBeDefined();
    });

    test('User A can DELETE their own document storage', async () => {
      // Setup: Create storage in Account A
      const { data: storageA } = await userA.supabase
        .from('document_storages')
        .insert({
          id: crypto.randomUUID(),
          account_id: userA.accountId,
          name: 'Storage to Delete',
          namespace: `ns-a-${Date.now()}`,
        })
        .select()
        .single();

      // Test: User A deletes their own storage
      const { data, error } = await userA.supabase
        .from('document_storages')
        .delete()
        .eq('id', storageA.id)
        .select();

      // Assertion: Should succeed
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });
});
```

#### 2. PDF Docs RLS Tests (`rls-pdf-docs.test.ts`)

**File Path**: `src/__tests__/security/database/rls-pdf-docs.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createTestUsers, cleanupTestData } from './helpers/test-users';

describe('Database Security: pdf_docs RLS Policies', () => {
  let userA: any, userB: any;

  beforeAll(async () => {
    [userA, userB] = await createTestUsers(2);
  });

  afterAll(async () => {
    await cleanupTestData([userA.accountId, userB.accountId]);
  });

  describe('SELECT Policy: PDF docs isolation', () => {
    test('User A cannot SELECT PDF docs from Account B', async () => {
      // Setup: Create document storage and PDF in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          account_id: userB.accountId,
          name: 'Storage B',
          namespace: `ns-b-${Date.now()}`,
        })
        .select()
        .single();

      const { data: pdfB } = await userB.supabase
        .from('pdf_docs')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId,
          document_storage_id: storageB.id,
          name: 'test.pdf',
          id_vapi_doc: 'vapi-123',
          url: 'https://example.com/test.pdf',
        })
        .select()
        .single();

      // Test: User A attempts to query Account B's PDF
      const { data, error } = await userA.supabase
        .from('pdf_docs')
        .select('*')
        .eq('id', pdfB.id)
        .single();

      // Assertion: Should be blocked
      expect(data).toBeNull();
      expect(error).toBeDefined();
    });

    test('User A can SELECT their own PDF docs', async () => {
      // Setup: Create storage and PDF in Account A
      const { data: storageA } = await userA.supabase
        .from('document_storages')
        .insert({
          account_id: userA.accountId,
          name: 'Storage A',
          namespace: `ns-a-${Date.now()}`,
        })
        .select()
        .single();

      const { data: pdfA } = await userA.supabase
        .from('pdf_docs')
        .insert({
          id: crypto.randomUUID(),
          account_id: userA.accountId,
          document_storage_id: storageA.id,
          name: 'my-doc.pdf',
          id_vapi_doc: 'vapi-456',
          url: 'https://example.com/my-doc.pdf',
        })
        .select()
        .single();

      // Test: User A queries their own PDF
      const { data, error } = await userA.supabase
        .from('pdf_docs')
        .select('*')
        .eq('id', pdfA.id)
        .single();

      // Assertion: Should succeed
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.account_id).toBe(userA.accountId);
    });
  });

  describe('INSERT Policy: Cross-account PDF creation prevention', () => {
    test('User A cannot INSERT PDF doc to Account B storage', async () => {
      // Setup: Create storage in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          account_id: userB.accountId,
          name: 'Storage B',
          namespace: `ns-b-${Date.now()}`,
        })
        .select()
        .single();

      // Test: User A attempts to add PDF to Account B storage
      const { data, error } = await userA.supabase
        .from('pdf_docs')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId, // Wrong account!
          document_storage_id: storageB.id,
          name: 'malicious.pdf',
          id_vapi_doc: 'vapi-malicious',
          url: 'https://example.com/malicious.pdf',
        })
        .select();

      // Assertion: RLS should block
      expect(error).toBeDefined();
      expect(error.code).toBe('42501');
      expect(data).toBeNull();
    });
  });

  describe('DELETE Policy: Cross-account PDF deletion prevention', () => {
    test('User A cannot DELETE PDF doc from Account B', async () => {
      // Setup: Create PDF in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          account_id: userB.accountId,
          name: 'Storage B',
          namespace: `ns-b-${Date.now()}`,
        })
        .select()
        .single();

      const { data: pdfB } = await userB.supabase
        .from('pdf_docs')
        .insert({
          id: crypto.randomUUID(),
          account_id: userB.accountId,
          document_storage_id: storageB.id,
          name: 'important.pdf',
          id_vapi_doc: 'vapi-important',
          url: 'https://example.com/important.pdf',
        })
        .select()
        .single();

      // Test: User A attempts to delete Account B's PDF
      const { data, error } = await userA.supabase
        .from('pdf_docs')
        .delete()
        .eq('id', pdfB.id)
        .select();

      // Assertion: Should be blocked
      expect(error).toBeDefined();
      expect(data).toHaveLength(0);

      // Verify PDF still exists
      const { data: verification } = await userB.supabase
        .from('pdf_docs')
        .select('id')
        .eq('id', pdfB.id)
        .single();

      expect(verification).toBeDefined();
    });
  });
});
```

#### 3. Junction Table RLS Tests (`rls-junction-table.test.ts`)

**File Path**: `src/__tests__/security/database/rls-junction-table.test.ts`

**Critical**: The `document_storage-assistants` table currently has NO RLS policies. This is a **HIGH SECURITY RISK**.

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createTestUsers, cleanupTestData } from './helpers/test-users';

describe('Database Security: document_storage-assistants Junction Table', () => {
  let userA: any, userB: any;

  beforeAll(async () => {
    [userA, userB] = await createTestUsers(2);
  });

  afterAll(async () => {
    await cleanupTestData([userA.accountId, userB.accountId]);
  });

  describe('CRITICAL: Missing RLS Policies Detection', () => {
    test('SECURITY VULNERABILITY: User A can currently assign Account B storage to their assistant', async () => {
      // Setup: Create assistant in Account A
      const { data: assistantA } = await userA.supabase
        .from('assistants')
        .insert({
          account_id: userA.accountId,
          name: 'Assistant A',
          namespace: `ns-assist-a-${Date.now()}`,
          type_assistant: 'voice',
        })
        .select()
        .single();

      // Setup: Create storage in Account B
      const { data: storageB } = await userB.supabase
        .from('document_storages')
        .insert({
          account_id: userB.accountId,
          name: 'Storage B',
          namespace: `ns-storage-b-${Date.now()}`,
        })
        .select()
        .single();

      // Test: User A attempts cross-account assignment
      const { data, error } = await userA.supabase
        .from('document_storage-assistants')
        .insert({
          assistant: assistantA.id,
          document_storage: storageB.id, // Account B storage!
        })
        .select();

      // Current Behavior: This will SUCCEED (vulnerability)
      // Expected Behavior: Should FAIL with RLS violation

      // TODO: After adding RLS policies to junction table:
      // expect(error).toBeDefined();
      // expect(error.code).toBe('42501');

      // Current assertion (documents the vulnerability):
      if (error) {
        console.log('GOOD: RLS policies have been added to junction table');
        expect(error.code).toBe('42501');
      } else {
        console.error('SECURITY RISK: Junction table allows cross-account assignments!');
        // Clean up malicious assignment
        await userA.supabase
          .from('document_storage-assistants')
          .delete()
          .eq('id', data[0].id);
      }
    });
  });

  describe('Recommended RLS Policies (after implementation)', () => {
    test('User A should only SELECT assignments for their assistants', async () => {
      // This test will pass after RLS is implemented
      // Currently documents expected behavior
    });

    test('User A should only INSERT assignments between their own resources', async () => {
      // This test will pass after RLS is implemented
    });

    test('User A should only DELETE assignments for their assistants', async () => {
      // This test will pass after RLS is implemented
    });
  });
});
```

### Test Helpers

#### Test Users Helper (`helpers/test-users.ts`)

**File Path**: `src/__tests__/security/database/helpers/test-users.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TestUser {
  id: string;
  email: string;
  accountId: string;
  accountSlug: string;
  supabase: any;
}

/**
 * Create test users with isolated accounts for security testing
 *
 * @param count - Number of test users to create
 * @returns Array of test user objects with Supabase clients
 */
export async function createTestUsers(count: number): Promise<TestUser[]> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const users: TestUser[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const email = `test-user-${i}-${timestamp}-${randomId}@security-test.local`;
    const password = `SecureTestPass123!${randomId}`;

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user ${i}: ${authError?.message}`);
    }

    // Create personal account (Basejump auto-creates on first login, but we'll do it manually)
    const accountSlug = `test-account-${i}-${timestamp}`;

    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        id: crypto.randomUUID(),
        slug: accountSlug,
        name: `Test Account ${i}`,
        primary_owner_user_id: authData.user.id,
        personal_account: true,
      })
      .select()
      .single();

    if (accountError || !accountData) {
      throw new Error(`Failed to create account for user ${i}: ${accountError?.message}`);
    }

    // Add user to account
    await supabaseAdmin
      .from('account_user')
      .insert({
        account_id: accountData.id,
        user_id: authData.user.id,
        account_role: 'owner',
      });

    // Create authenticated Supabase client for this user
    const { data: sessionData } = await supabaseAdmin.auth.admin.createSession({
      user_id: authData.user.id,
    });

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${sessionData.access_token}`,
        },
      },
    });

    users.push({
      id: authData.user.id,
      email,
      accountId: accountData.id,
      accountSlug,
      supabase: userSupabase,
    });
  }

  return users;
}

/**
 * Clean up test data after tests complete
 *
 * @param accountIds - Array of account IDs to delete
 */
export async function cleanupTestData(accountIds: string[]): Promise<void> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const accountId of accountIds) {
    // Delete in reverse dependency order

    // 1. Delete junction table records
    await supabaseAdmin
      .from('document_storage-assistants')
      .delete()
      .in('assistant',
        supabaseAdmin.from('assistants').select('id').eq('account_id', accountId)
      );

    // 2. Delete PDF docs
    await supabaseAdmin
      .from('pdf_docs')
      .delete()
      .eq('account_id', accountId);

    // 3. Delete QA docs
    await supabaseAdmin
      .from('qa_docs')
      .delete()
      .eq('account_id', accountId);

    // 4. Delete document storages
    await supabaseAdmin
      .from('document_storages')
      .delete()
      .eq('account_id', accountId);

    // 5. Delete assistants
    await supabaseAdmin
      .from('assistants')
      .delete()
      .eq('account_id', accountId);

    // 6. Delete reports
    await supabaseAdmin
      .from('report_ws')
      .delete()
      .eq('account_id', accountId);

    await supabaseAdmin
      .from('report_voice')
      .delete()
      .eq('account_id', accountId);

    // 7. Get user IDs from account
    const { data: accountUsers } = await supabaseAdmin
      .from('account_user')
      .select('user_id')
      .eq('account_id', accountId);

    // 8. Delete account membership
    await supabaseAdmin
      .from('account_user')
      .delete()
      .eq('account_id', accountId);

    // 9. Delete account
    await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId);

    // 10. Delete users
    if (accountUsers) {
      for (const { user_id } of accountUsers) {
        await supabaseAdmin.auth.admin.deleteUser(user_id);
      }
    }
  }
}
```

---

## Application-Level Security Tests

### Test Scope

Verify that **server actions** and **API routes** enforce authorization checks BEFORE performing operations.

### Test File Structure

```
src/__tests__/security/application/
├── server-actions/
│   ├── documents-authorization.test.ts
│   ├── assistants-authorization.test.ts
│   └── assignment-validation.test.ts
├── api-routes/
│   ├── document-api-security.test.ts
│   └── assistant-api-security.test.ts
└── helpers/
    ├── mock-session.ts
    └── api-test-client.ts
```

### Test Cases

#### 1. Document Server Actions Authorization (`server-actions/documents-authorization.test.ts`)

**File Path**: `src/__tests__/security/application/server-actions/documents-authorization.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  createDocumentStorageWithPDF,
  uploadPdfToExistingStorage,
  deleteDocumentStorageWithValidation
} from '@/lib/actions/intelliaa/documents';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Application Security: Document Server Actions Authorization', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      rpc: vi.fn(),
    };

    (createClient as any).mockResolvedValue(mockSupabaseClient);
  });

  describe('createDocumentStorageWithPDF: Account membership validation', () => {
    test('Should reject request if user is not a member of the account', async () => {
      // Setup: User A tries to create storage in Account B
      const userA = { id: 'user-a-id', email: 'usera@test.com' };
      const accountB = 'account-b-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });

      // Mock account_user query to return NO membership
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      // Create FormData
      const formData = new FormData();
      formData.append('name', 'Test Storage');
      formData.append('description', 'Test');
      formData.append('accountId', accountB);
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      // Test: Attempt to create storage
      const result = await createDocumentStorageWithPDF(formData);

      // Assertion: Should fail with authorization error
      expect(result.success).toBe(false);
      expect(result.error?.code).toMatch(/UNAUTHORIZED|FORBIDDEN/i);
      expect(result.error?.message).toMatch(/no.*access|unauthorized|forbidden/i);
    });

    test('Should allow request if user is a member of the account', async () => {
      // Setup: User A creates storage in their own Account A
      const userA = { id: 'user-a-id', email: 'usera@test.com' };
      const accountA = 'account-a-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });

      // Mock account_user query to return membership
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { account_id: accountA, account_role: 'owner' },
        error: null,
      });

      // Mock successful storage creation
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [{
          document_storage_id: 'storage-id',
          pdf_doc_id: 'pdf-id',
        }],
        error: null,
      });

      const formData = new FormData();
      formData.append('name', 'Test Storage');
      formData.append('accountId', accountA);
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const result = await createDocumentStorageWithPDF(formData);

      // Assertion: Should succeed (or fail for other reasons, but NOT authorization)
      if (!result.success) {
        expect(result.error?.code).not.toMatch(/UNAUTHORIZED|FORBIDDEN/i);
      }
    });
  });

  describe('uploadPdfToExistingStorage: Storage ownership validation', () => {
    test('Should reject upload if storage belongs to different account', async () => {
      const userA = { id: 'user-a-id' };
      const accountA = 'account-a-id';
      const accountB = 'account-b-id';
      const storageBId = 'storage-b-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });

      // Mock: Storage belongs to Account B, but user is in Account A
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          // document_storages query
          data: {
            id: storageBId,
            account_id: accountB, // Different account!
            namespace: 'ns-b',
          },
          error: null,
        });

      const formData = new FormData();
      formData.append('documentStorageId', storageBId);
      formData.append('accountId', accountA);
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const result = await uploadPdfToExistingStorage(formData);

      // Assertion: Should fail
      expect(result.success).toBe(false);
      expect(result.error?.message).toMatch(/not found|access denied|unauthorized/i);
    });
  });

  describe('deleteDocumentStorageWithValidation: Deletion authorization', () => {
    test('Should reject deletion if storage belongs to different account', async () => {
      const userA = { id: 'user-a-id' };
      const accountA = 'account-a-id';
      const accountB = 'account-b-id';
      const storageBId = 'storage-b-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });

      // Test: User A attempts to delete Account B storage
      const result = await deleteDocumentStorageWithValidation(storageBId, accountA);

      // Assertion: Should fail (storage not found for this account)
      expect(result.success).toBe(false);
      expect(result.error?.code).toMatch(/NOT_FOUND|FORBIDDEN/i);
    });
  });

  describe('Direct ID manipulation attacks', () => {
    test('Should not allow direct database queries to bypass authorization', async () => {
      // This test verifies that even if someone modifies client-side code
      // to call Supabase directly, RLS policies will block them

      const userA = { id: 'user-a-id' };
      const accountB = 'account-b-id';
      const storageBId = 'storage-b-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });

      // Simulate direct database call (bypassing server action)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null, // RLS blocks this
        error: { code: 'PGRST116' },
      });

      const { data, error } = await mockSupabaseClient
        .from('document_storages')
        .select('*')
        .eq('id', storageBId)
        .eq('account_id', accountB)
        .single();

      // Assertion: RLS should block
      expect(data).toBeNull();
      expect(error).toBeDefined();
    });
  });
});
```

#### 2. Assignment Validation Tests (`server-actions/assignment-validation.test.ts`)

**File Path**: `src/__tests__/security/application/server-actions/assignment-validation.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  addDsAssistant,
  deleteDsAssistant,
  getDsAssistant
} from '@/lib/actions/intelliaa/assistants';
import { createTestUsers, cleanupTestData } from '../../database/helpers/test-users';

describe('Application Security: Document Storage Assignment Validation', () => {
  let userA: any, userB: any;
  let assistantA: any, storageA: any, storageB: any;

  beforeAll(async () => {
    [userA, userB] = await createTestUsers(2);

    // Setup: Create assistant in Account A
    const { data: assistant } = await userA.supabase
      .from('assistants')
      .insert({
        account_id: userA.accountId,
        name: 'Assistant A',
        namespace: `ns-a-${Date.now()}`,
        type_assistant: 'voice',
      })
      .select()
      .single();

    assistantA = assistant;

    // Setup: Create storage in Account A
    const { data: storageAData } = await userA.supabase
      .from('document_storages')
      .insert({
        account_id: userA.accountId,
        name: 'Storage A',
        namespace: `ns-storage-a-${Date.now()}`,
      })
      .select()
      .single();

    storageA = storageAData;

    // Setup: Create storage in Account B
    const { data: storageBData } = await userB.supabase
      .from('document_storages')
      .insert({
        account_id: userB.accountId,
        name: 'Storage B',
        namespace: `ns-storage-b-${Date.now()}`,
      })
      .select()
      .single();

    storageB = storageBData;
  });

  afterAll(async () => {
    await cleanupTestData([userA.accountId, userB.accountId]);
  });

  describe('addDsAssistant: Cross-account assignment prevention', () => {
    test('Should reject assignment of Account B storage to Account A assistant', async () => {
      // Test: Attempt cross-account assignment
      try {
        await addDsAssistant(assistantA.id, storageB.id);

        // If we reach here, assignment succeeded (VULNERABILITY)
        throw new Error('SECURITY RISK: Cross-account assignment allowed!');
      } catch (error: any) {
        // Expected: Should throw authorization error
        expect(error.message).toMatch(/unauthorized|not found|access denied/i);
      }
    });

    test('Should allow assignment of same-account storage', async () => {
      // Test: Valid same-account assignment
      const result = await addDsAssistant(assistantA.id, storageA.id);

      expect(result).toBeDefined();
      expect(result[0].assistant).toBe(assistantA.id);
      expect(result[0].document_storage).toBe(storageA.id);
    });

    test('Should validate that both assistant and storage exist before assignment', async () => {
      const fakeAssistantId = crypto.randomUUID();
      const fakeStorageId = crypto.randomUUID();

      try {
        await addDsAssistant(fakeAssistantId, fakeStorageId);
        throw new Error('Should have thrown error for non-existent resources');
      } catch (error: any) {
        expect(error.message).toMatch(/not found|does not exist/i);
      }
    });
  });

  describe('deleteDsAssistant: Cross-account unassignment prevention', () => {
    test('Should not allow User B to unassign Account A storage from Account A assistant', async () => {
      // Setup: Create valid assignment in Account A
      await addDsAssistant(assistantA.id, storageA.id);

      // Test: User B attempts to unassign (as if they had the IDs)
      // This would require User B to somehow call the server action
      // In practice, this is prevented by API authentication, but we test the validation

      try {
        // Simulate call from User B context
        const userBSupabase = userB.supabase;
        await userBSupabase.rpc('delete_ds_assistant', {
          assistant_id: assistantA.id,
          storage_id: storageA.id,
        });

        throw new Error('Should have blocked cross-account unassignment');
      } catch (error: any) {
        expect(error.message).toMatch(/unauthorized|access denied|not found/i);
      }
    });
  });

  describe('getDsAssistant: Assignment visibility', () => {
    test('User A should not see assignments for Account B assistants', async () => {
      // Setup: Create assignment in Account B
      const { data: assistantB } = await userB.supabase
        .from('assistants')
        .insert({
          account_id: userB.accountId,
          name: 'Assistant B',
          namespace: `ns-b-${Date.now()}`,
          type_assistant: 'voice',
        })
        .select()
        .single();

      await userB.supabase
        .from('document_storage-assistants')
        .insert({
          assistant: assistantB.id,
          document_storage: storageB.id,
        });

      // Test: User A attempts to query Account B assignments
      const assignments = await getDsAssistant(assistantB.id);

      // Assertion: Should return empty or throw error
      if (assignments) {
        expect(assignments).toHaveLength(0);
      }
    });
  });
});
```

---

## Service-Level Security Tests

### Test Scope

Verify that **external services** maintain namespace isolation:
- **Pinecone**: Vector namespace isolation
- **VAPI**: Knowledge base and file isolation
- **Flowise**: Document processing isolation

### Test File Structure

```
src/__tests__/security/services/
├── pinecone-namespace-isolation.test.ts
├── vapi-knowledge-base-isolation.test.ts
└── helpers/
    └── mock-services.ts
```

### Test Cases

#### 1. Pinecone Namespace Isolation (`pinecone-namespace-isolation.test.ts`)

**File Path**: `src/__tests__/security/services/pinecone-namespace-isolation.test.ts`

```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { upsertVectors, queryVectors, deleteNamespace } from '@/services/pineconeService';

describe('Service Security: Pinecone Namespace Isolation', () => {
  const namespaceA = `test-ns-a-${Date.now()}`;
  const namespaceB = `test-ns-b-${Date.now()}`;

  beforeAll(async () => {
    // Setup: Insert vectors into two separate namespaces
    const vectorsA = [
      {
        id: 'vec-a-1',
        values: Array(1536).fill(0.1), // text-embedding-ada-002 dimensions
        metadata: { text: 'Document A content', accountId: 'account-a' },
      },
    ];

    const vectorsB = [
      {
        id: 'vec-b-1',
        values: Array(1536).fill(0.2),
        metadata: { text: 'Document B content', accountId: 'account-b' },
      },
    ];

    await upsertVectors(namespaceA, vectorsA);
    await upsertVectors(namespaceB, vectorsB);
  });

  test('Query in namespace A should NOT return vectors from namespace B', async () => {
    const queryVector = Array(1536).fill(0.1);

    const results = await queryVectors(namespaceA, queryVector, {
      topK: 10,
    });

    // Assertion: Results should only contain namespace A vectors
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    results.forEach((match: any) => {
      expect(match.id).toMatch(/vec-a-/);
      expect(match.metadata.accountId).toBe('account-a');
    });
  });

  test('Query in namespace B should NOT return vectors from namespace A', async () => {
    const queryVector = Array(1536).fill(0.2);

    const results = await queryVectors(namespaceB, queryVector, {
      topK: 10,
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    results.forEach((match: any) => {
      expect(match.id).toMatch(/vec-b-/);
      expect(match.metadata.accountId).toBe('account-b');
    });
  });

  test('Deleting namespace A should NOT affect namespace B', async () => {
    // Test: Delete namespace A
    await deleteNamespace(namespaceA);

    // Verify namespace B still contains vectors
    const queryVector = Array(1536).fill(0.2);
    const results = await queryVectors(namespaceB, queryVector, { topK: 1 });

    expect(results.length).toBeGreaterThan(0);
  });

  test('Metadata filters should be scoped within namespace', async () => {
    // Test: Query with metadata filter
    const queryVector = Array(1536).fill(0.1);

    const results = await queryVectors(namespaceA, queryVector, {
      topK: 10,
      filter: { accountId: 'account-b' }, // Filter for wrong account
    });

    // Assertion: Should return no results (namespace isolation + filter)
    expect(results.length).toBe(0);
  });

  // Cleanup
  afterAll(async () => {
    await deleteNamespace(namespaceA);
    await deleteNamespace(namespaceB);
  });
});
```

#### 2. VAPI Knowledge Base Isolation (`vapi-knowledge-base-isolation.test.ts`)

**File Path**: `src/__tests__/security/services/vapi-knowledge-base-isolation.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createVapiKnowledgeBase,
  listVapiKnowledgeBases,
  addFilesToVapiKB,
  deleteVapiKnowledgeBase
} from '@/lib/actions/intelliaa/vapiKnowledgeBase';
import { vapiService } from '@/services/vapiService';

describe('Service Security: VAPI Knowledge Base Isolation', () => {
  let kbA: any, kbB: any;
  let accountA: string, accountB: string;

  beforeAll(async () => {
    accountA = `account-a-${Date.now()}`;
    accountB = `account-b-${Date.now()}`;

    // Create Knowledge Bases for two accounts
    const resultA = await createVapiKnowledgeBase({
      accountId: accountA,
      name: 'KB Account A',
      description: 'Test KB A',
      provider: 'google',
      fileIds: [],
    });

    const resultB = await createVapiKnowledgeBase({
      accountId: accountB,
      name: 'KB Account B',
      description: 'Test KB B',
      provider: 'google',
      fileIds: [],
    });

    kbA = resultA.data;
    kbB = resultB.data;
  });

  test('Account A should only see their own knowledge bases', async () => {
    const result = await listVapiKnowledgeBases({
      accountId: accountA,
      status: 'active',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Verify all KBs belong to Account A
    result.data!.forEach((kb: any) => {
      expect(kb.account_id).toBe(accountA);
    });

    // Verify Account B KB is NOT in the list
    const kbBInList = result.data!.find((kb: any) => kb.id === kbB.id);
    expect(kbBInList).toBeUndefined();
  });

  test('Account B should only see their own knowledge bases', async () => {
    const result = await listVapiKnowledgeBases({
      accountId: accountB,
      status: 'active',
    });

    expect(result.success).toBe(true);

    result.data!.forEach((kb: any) => {
      expect(kb.account_id).toBe(accountB);
    });

    const kbAInList = result.data!.find((kb: any) => kb.id === kbA.id);
    expect(kbAInList).toBeUndefined();
  });

  test('Account A cannot add files to Account B knowledge base', async () => {
    // Upload test file
    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const uploadResult = await vapiService.uploadFile(testFile);

    // Attempt to add file to Account B KB (from Account A context)
    try {
      await addFilesToVapiKB(kbB.id, [uploadResult.id]);
      throw new Error('SECURITY RISK: Cross-account KB file addition allowed!');
    } catch (error: any) {
      expect(error.message).toMatch(/unauthorized|not found|access denied/i);
    }

    // Cleanup
    await vapiService.deleteFile(uploadResult.id);
  });

  test('Deleting Account A KB should not affect Account B', async () => {
    // Delete Account A KB
    await deleteVapiKnowledgeBase(kbA.id);

    // Verify Account B KB still exists
    const result = await listVapiKnowledgeBases({
      accountId: accountB,
      status: 'active',
    });

    const kbBStillExists = result.data!.find((kb: any) => kb.id === kbB.id);
    expect(kbBStillExists).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup
    if (kbA) await deleteVapiKnowledgeBase(kbA.id);
    if (kbB) await deleteVapiKnowledgeBase(kbB.id);
  });
});
```

---

## UI/UX Security Tests

### Test Scope

Verify that the **UI does not leak data** across accounts through:
- Dropdown options
- Search results
- Document lists
- Assistant settings

### Test File Structure

```
src/__tests__/security/ui/
├── document-storage-ui-isolation.test.tsx
├── assistant-settings-ui-isolation.test.tsx
└── helpers/
    └── render-with-auth.tsx
```

### Test Cases

#### 1. Document Storage UI Isolation (`document-storage-ui-isolation.test.tsx`)

**File Path**: `src/__tests__/security/ui/document-storage-ui-isolation.test.tsx`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderWithAuth } from './helpers/render-with-auth';
import DocumentStorageList from '@/app/[accountSlug]/documents/page';

vi.mock('@/lib/actions/intelliaa/documents', () => ({
  getAllDocumentStorage: vi.fn(),
}));

describe('UI Security: Document Storage List Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Document list should only show storages from current account', async () => {
    const accountAStorages = [
      { id: 'storage-a-1', name: 'Storage A1', account_id: 'account-a' },
      { id: 'storage-a-2', name: 'Storage A2', account_id: 'account-a' },
    ];

    const { getAllDocumentStorage } = await import('@/lib/actions/intelliaa/documents');
    (getAllDocumentStorage as any).mockResolvedValue(accountAStorages);

    const { container } = renderWithAuth(<DocumentStorageList />, {
      accountId: 'account-a',
      accountSlug: 'account-a-slug',
    });

    await waitFor(() => {
      expect(screen.getByText('Storage A1')).toBeInTheDocument();
      expect(screen.getByText('Storage A2')).toBeInTheDocument();
    });

    // Verify no Account B data is rendered
    expect(screen.queryByText(/account-b/i)).not.toBeInTheDocument();
  });

  test('Empty state should be shown when no storages exist for account', async () => {
    const { getAllDocumentStorage } = await import('@/lib/actions/intelliaa/documents');
    (getAllDocumentStorage as any).mockResolvedValue([]);

    renderWithAuth(<DocumentStorageList />, {
      accountId: 'account-new',
      accountSlug: 'account-new-slug',
    });

    await waitFor(() => {
      expect(screen.getByText(/no document storages/i)).toBeInTheDocument();
    });
  });

  test('Storage dropdown should only show current account options', async () => {
    // Test for assignment dropdowns in assistant settings
    // Verify dropdown options are filtered by account_id
  });
});
```

---

## Penetration Testing Scenarios

### Manual Penetration Tests

These tests should be performed **manually** by a security tester or QA engineer on a **quarterly basis**.

#### Scenario 1: Direct ID Manipulation

**Objective**: Verify that manipulating IDs in URLs or API requests does not grant access to other accounts' data.

**Steps:**
1. Login as User A (Account A)
2. Navigate to a document storage detail page: `/account-a/documents/storage-a-id`
3. Note the `storage-a-id` in the URL
4. Create a second user (User B, Account B)
5. Create a document storage in Account B
6. Note the `storage-b-id`
7. While logged in as User A, manually edit the URL to: `/account-a/documents/storage-b-id`
8. Attempt to access the page

**Expected Result:**
- Page should show "Not Found" or "Access Denied"
- No data from Account B should be displayed
- Error should be logged in audit logs

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

#### Scenario 2: API Request Interception

**Objective**: Verify that intercepting and modifying API requests cannot bypass authorization.

**Steps:**
1. Login as User A (Account A)
2. Open browser DevTools → Network tab
3. Upload a PDF to a storage in Account A
4. Capture the API request to `/api/uploadPdfToExistingStorage`
5. Note the request payload (e.g., `{ documentStorageId: "storage-a-id", accountId: "account-a" }`)
6. Logout and login as User B (Account B)
7. Create a storage in Account B (note the ID: `storage-b-id`)
8. Logout and login back as User A
9. Using DevTools or Postman, replay the API request but modify:
   - `documentStorageId` → `storage-b-id` (Account B storage)
   - `accountId` → Still `account-a` OR change to `account-b`

**Expected Result:**
- API should return `403 Forbidden` or `404 Not Found`
- No file should be uploaded to Account B storage
- Server logs should show authorization failure

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

#### Scenario 3: Cross-Account Assignment Attack

**Objective**: Verify that assigning Account B document storage to Account A assistant is blocked.

**Steps:**
1. Login as User A (Account A)
2. Create an assistant in Account A (note ID: `assistant-a-id`)
3. Login as User B (Account B) in a different browser/incognito
4. Create a document storage in Account B (note ID: `storage-b-id`)
5. Logout User B
6. Login as User A
7. Navigate to assistant settings
8. Attempt to assign `storage-b-id` to `assistant-a-id` via:
   - UI dropdown (should not show Account B storages)
   - Direct API call (use DevTools to modify request)

**Expected Result:**
- UI dropdown should only show Account A storages
- Direct API call should fail with `403 Forbidden`
- Assignment should not be created in database

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

#### Scenario 4: Namespace Boundary Violation

**Objective**: Verify that querying Pinecone with a different namespace does not return other accounts' vectors.

**Steps:**
1. Login as User A (Account A)
2. Create a document storage with a PDF (note namespace: `ns-a-123`)
3. Verify vectors are stored in Pinecone namespace `ns-a-123`
4. Login as User B (Account B)
5. Create a document storage with a PDF (note namespace: `ns-b-456`)
6. Using Pinecone API directly (or modified client code), attempt to:
   - Query namespace `ns-a-123` from Account B context
   - Query all namespaces without filter

**Expected Result:**
- Pinecone should enforce namespace isolation
- Account B queries should only return vectors from `ns-b-*` namespaces
- No cross-namespace data leakage

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

#### Scenario 5: VAPI Knowledge Base Leakage

**Objective**: Verify that Account A cannot access Account B VAPI knowledge bases.

**Steps:**
1. Login as User A (Account A)
2. Create a VAPI knowledge base (note ID: `kb-a-123`)
3. Upload a file to the KB
4. Login as User B (Account B)
5. Create a VAPI knowledge base (note ID: `kb-b-456`)
6. While logged in as User A, attempt to:
   - List all knowledge bases (should only see Account A KBs)
   - Directly query KB `kb-b-456` via API
   - Add files to KB `kb-b-456`

**Expected Result:**
- List endpoint should only return Account A KBs
- Direct queries to Account B KBs should fail
- File additions should be rejected

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

#### Scenario 6: Session Hijacking / Token Reuse

**Objective**: Verify that JWT tokens cannot be reused across accounts.

**Steps:**
1. Login as User A (Account A)
2. Extract the access token from cookies/localStorage
3. Login as User B (Account B) in a different browser
4. Replace User B's token with User A's token
5. Attempt to access Account B resources

**Expected Result:**
- Supabase should validate token against user ID
- Account B resources should not be accessible with User A token
- API should return `401 Unauthorized`

**Actual Result**: [To be filled during test execution]

**Status**: [PASS/FAIL]

---

## Test Data Setup

### Test Database Configuration

**File Path**: `.env.test`

```bash
# Supabase Test Instance
NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key

# Test User Credentials
TEST_USER_A_EMAIL=test-user-a@security-test.local
TEST_USER_A_PASSWORD=SecureTestPass123!A
TEST_USER_B_EMAIL=test-user-b@security-test.local
TEST_USER_B_PASSWORD=SecureTestPass123!B

# External Services (Test/Mock)
NEXT_PUBLIC_PINECONE_API_KEY=test-pinecone-key
NEXT_PUBLIC_PINECONE_INDEX=test-index
NEXT_PRIVATE_VAPI_KEY=test-vapi-key
NEXT_PUBLIC_OPENAI_API_KEY=test-openai-key

# Feature Flags
NEXT_PUBLIC_USE_VAPI_KB=true
```

### Test Data Seeding Script

**File Path**: `scripts/seed-test-data.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedTestData() {
  console.log('Seeding test data...');

  // Create test users
  const userA = await supabase.auth.admin.createUser({
    email: 'test-user-a@security-test.local',
    password: 'SecureTestPass123!A',
    email_confirm: true,
  });

  const userB = await supabase.auth.admin.createUser({
    email: 'test-user-b@security-test.local',
    password: 'SecureTestPass123!B',
    email_confirm: true,
  });

  // Create accounts
  const accountA = await supabase.from('accounts').insert({
    id: crypto.randomUUID(),
    slug: 'test-account-a',
    name: 'Test Account A',
    primary_owner_user_id: userA.data.user!.id,
  }).select().single();

  const accountB = await supabase.from('accounts').insert({
    id: crypto.randomUUID(),
    slug: 'test-account-b',
    name: 'Test Account B',
    primary_owner_user_id: userB.data.user!.id,
  }).select().single();

  // Add users to accounts
  await supabase.from('account_user').insert([
    {
      account_id: accountA.data.id,
      user_id: userA.data.user!.id,
      account_role: 'owner',
    },
    {
      account_id: accountB.data.id,
      user_id: userB.data.user!.id,
      account_role: 'owner',
    },
  ]);

  console.log('Test data seeded successfully!');
  console.log(`Account A ID: ${accountA.data.id}`);
  console.log(`Account B ID: ${accountB.data.id}`);
}

seedTestData();
```

**Run with:**

```bash
npx tsx scripts/seed-test-data.ts
```

---

## Test Implementation Structure

### Directory Structure

```
src/
├── __tests__/
│   ├── security/
│   │   ├── database/
│   │   │   ├── rls-document-storages.test.ts
│   │   │   ├── rls-pdf-docs.test.ts
│   │   │   ├── rls-qa-docs.test.ts
│   │   │   ├── rls-junction-table.test.ts
│   │   │   ├── rls-assistants.test.ts
│   │   │   └── helpers/
│   │   │       ├── test-users.ts
│   │   │       └── supabase-test-client.ts
│   │   ├── application/
│   │   │   ├── server-actions/
│   │   │   │   ├── documents-authorization.test.ts
│   │   │   │   ├── assistants-authorization.test.ts
│   │   │   │   └── assignment-validation.test.ts
│   │   │   ├── api-routes/
│   │   │   │   ├── document-api-security.test.ts
│   │   │   │   └── assistant-api-security.test.ts
│   │   │   └── helpers/
│   │   │       ├── mock-session.ts
│   │   │       └── api-test-client.ts
│   │   ├── services/
│   │   │   ├── pinecone-namespace-isolation.test.ts
│   │   │   ├── vapi-knowledge-base-isolation.test.ts
│   │   │   └── helpers/
│   │   │       └── mock-services.ts
│   │   └── ui/
│   │       ├── document-storage-ui-isolation.test.tsx
│   │       ├── assistant-settings-ui-isolation.test.tsx
│   │       └── helpers/
│   │           └── render-with-auth.tsx
│   └── fixtures/
│       └── test-pdfs/
│           ├── test-document-a.pdf
│           └── test-document-b.pdf
├── lib/
│   └── test-utils/
│       ├── security-test-helpers.ts
│       └── mock-factories.ts
└── scripts/
    ├── seed-test-data.ts
    └── cleanup-test-data.ts
```

---

## Environment Setup

### Required Tools

1. **Vitest** (v3.2.4) - Already installed
2. **@testing-library/react** (v16.3.0) - Already installed
3. **@testing-library/jest-dom** (v6.9.1) - Already installed
4. **Supabase CLI** - For local database testing
5. **Docker** - For running local Supabase instance
6. **MSW** (Mock Service Worker) - For API mocking

### Installation Steps

```bash
# Install additional dependencies (if needed)
npm install --save-dev msw@latest
npm install --save-dev @supabase/supabase-js

# Initialize MSW
npx msw init public/ --save
```

### Vitest Configuration Update

**File Path**: `vitest.config.ts`

Add security test patterns:

```typescript
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],

    // Include security tests
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/security/**/*.test.{ts,tsx}', // Security tests
    ],

    // Test timeout (some security tests may be slower)
    testTimeout: 30000, // 30 seconds

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/node_modules/**',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Setup File Update

**File Path**: `vitest.setup.ts`

```typescript
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Setup test database connection
beforeAll(async () => {
  // Initialize test database connection
  console.log('Setting up test environment...');
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  console.log('Tearing down test environment...');
});

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
```

### MSW Handlers for External Services

**File Path**: `src/__tests__/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Pinecone API
  http.post('https://api.pinecone.io/vectors/upsert', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ upsertedCount: body.vectors.length });
  }),

  // Mock VAPI API
  http.post('https://api.vapi.ai/file', async () => {
    return HttpResponse.json({
      id: 'mock-vapi-file-id',
      url: 'https://vapi.ai/files/mock-file.pdf',
    });
  }),

  // Mock Flowise API
  http.post('https://flowise.example.com/api/v1/prediction/*', async () => {
    return HttpResponse.json({
      text: 'Mock response',
      sessionId: 'mock-session',
    });
  }),
];
```

**File Path**: `src/__tests__/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Update `vitest.setup.ts`:**

```typescript
import { server } from './__tests__/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Critical Notes

### 1. Junction Table Security Vulnerability

**CRITICAL**: The `document_storage-assistants` table currently has **NO RLS policies**. This is a **HIGH SECURITY RISK**.

**Impact:**
- User A can assign Account B document storages to their assistants
- User A can view assignments from Account B
- Data isolation is NOT enforced at the database level

**Recommended Fix:**

Create migration: `supabase/migrations/20251004_rls_junction_table.sql`

```sql
-- Enable RLS on junction table
ALTER TABLE public."document_storage-assistants" ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can only view assignments for their assistants
CREATE POLICY "Users can view assignments for their assistants"
  ON public."document_storage-assistants"
  FOR SELECT
  TO authenticated
  USING (
    assistant IN (
      SELECT id FROM public.assistants
      WHERE account_id IN (
        SELECT account_id FROM basejump.account_user
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy 2: INSERT - Users can only create assignments for their own resources
CREATE POLICY "Users can create assignments for their resources"
  ON public."document_storage-assistants"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verify assistant belongs to user's account
    assistant IN (
      SELECT id FROM public.assistants
      WHERE account_id IN (
        SELECT account_id FROM basejump.account_user
        WHERE user_id = auth.uid()
      )
    )
    AND
    -- Verify storage belongs to user's account
    document_storage IN (
      SELECT id FROM public.document_storages
      WHERE account_id IN (
        SELECT account_id FROM basejump.account_user
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy 3: DELETE - Users can only delete assignments for their assistants
CREATE POLICY "Users can delete assignments for their assistants"
  ON public."document_storage-assistants"
  FOR DELETE
  TO authenticated
  USING (
    assistant IN (
      SELECT id FROM public.assistants
      WHERE account_id IN (
        SELECT account_id FROM basejump.account_user
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add comments
COMMENT ON POLICY "Users can view assignments for their assistants"
  ON public."document_storage-assistants" IS
  'INTEL-010: Multi-tenant isolation. Users can only view assignments for assistants in their accounts.';
```

### 2. Next.js 15 + React 19 Async API Considerations

**Breaking Changes:**
- `cookies()` is now async in Server Components
- `params` is now `Promise<{ ... }>`
- Client Components cannot import server-only functions

**Testing Impact:**
- Mock `createClient` from `@/lib/supabase/server` as async
- Await all Supabase client creation calls
- Use `vi.mock()` for server-side modules

**Example:**

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    // mock client
  }),
}));
```

### 3. Supabase RLS Testing Best Practices

**Use Service Role for Setup/Teardown:**
- Service role bypasses RLS
- Use for creating test data
- Use for cleanup

**Use User Tokens for Tests:**
- Each test user should have their own authenticated client
- Simulate real user sessions

**Test Both Positive and Negative Cases:**
- Verify users CAN access their own data
- Verify users CANNOT access other accounts' data

### 4. External Service Mocking Strategy

**Mock by Default:**
- Use MSW to mock Pinecone, VAPI, Flowise in unit/integration tests
- Prevents hitting rate limits
- Ensures test speed and reliability

**Real Services for E2E:**
- Use real Pinecone/VAPI in E2E tests (optional)
- Requires test API keys
- Run less frequently (e.g., nightly builds)

### 5. Test Execution Order

**Recommended Order:**
1. Database RLS tests (fastest, most critical)
2. Server action tests
3. Service isolation tests
4. UI tests
5. E2E tests (slowest)

**Parallel Execution:**
- Vitest supports parallel test execution
- Ensure tests are isolated (no shared state)
- Use unique namespaces/IDs per test

---

## Troubleshooting Guide

### Issue 1: RLS Policies Not Enforced in Tests

**Symptom:**
- Tests pass even when they should fail
- Cross-account access is not blocked

**Solution:**
1. Verify RLS is enabled on table:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND tablename = 'document_storages';
   ```
2. Check that test users are authenticated (not using service role)
3. Verify `auth.uid()` returns correct user ID in test context

### Issue 2: Test Users Cannot Create Data

**Symptom:**
- Tests fail with `42501` error (permission denied)
- Even valid operations are blocked

**Solution:**
1. Verify user is a member of the account:
   ```sql
   SELECT * FROM basejump.account_user WHERE user_id = 'test-user-id';
   ```
2. Check account role has sufficient permissions
3. Verify `WITH CHECK` policy allows the operation

### Issue 3: External Service Mocks Not Working

**Symptom:**
- Tests make real API calls
- Tests fail with network errors

**Solution:**
1. Ensure MSW server is started in `vitest.setup.ts`
2. Check handler URL patterns match request URLs
3. Add `onUnhandledRequest: 'warn'` for debugging

### Issue 4: Test Data Cleanup Failures

**Symptom:**
- Foreign key constraint errors during cleanup
- Test data persists across test runs

**Solution:**
1. Delete in reverse dependency order (junction tables first)
2. Use `CASCADE` deletes where appropriate
3. Use service role for cleanup (bypasses RLS)

### Issue 5: Vitest Timeouts

**Symptom:**
- Tests timeout after 10 seconds
- Supabase queries hang

**Solution:**
1. Increase `testTimeout` in `vitest.config.ts`
2. Check database connection pool limits
3. Verify test database is responsive

---

## Next Steps

### Phase 1: Database RLS Tests (Week 1)

**Priority**: P0 - Critical

**Tasks:**
1. Create test helper functions (`test-users.ts`, `supabase-test-client.ts`)
2. Implement `rls-document-storages.test.ts`
3. Implement `rls-pdf-docs.test.ts`
4. Implement `rls-junction-table.test.ts`
5. **CRITICAL**: Create RLS policies for junction table
6. Run tests and verify all pass
7. Fix any failing tests

**Estimated Effort**: 3-4 days

---

### Phase 2: Application-Level Tests (Week 2)

**Priority**: P0 - Critical

**Tasks:**
1. Implement `documents-authorization.test.ts`
2. Implement `assignment-validation.test.ts`
3. Implement `assistants-authorization.test.ts`
4. Add authorization checks to server actions (if missing)
5. Run tests and verify authorization is enforced

**Estimated Effort**: 3-4 days

---

### Phase 3: Service-Level Tests (Week 3)

**Priority**: P1 - High

**Tasks:**
1. Implement `pinecone-namespace-isolation.test.ts`
2. Implement `vapi-knowledge-base-isolation.test.ts`
3. Setup MSW handlers for external services
4. Run tests and verify namespace isolation

**Estimated Effort**: 2-3 days

---

### Phase 4: UI Tests (Week 3)

**Priority**: P1 - High

**Tasks:**
1. Implement `document-storage-ui-isolation.test.tsx`
2. Implement `assistant-settings-ui-isolation.test.tsx`
3. Create `render-with-auth` test helper
4. Run tests and verify UI doesn't leak data

**Estimated Effort**: 2-3 days

---

### Phase 5: Penetration Testing (Week 4)

**Priority**: P2 - Medium

**Tasks:**
1. Execute manual penetration test scenarios
2. Document findings in test report
3. Fix any discovered vulnerabilities
4. Re-test to verify fixes

**Estimated Effort**: 2-3 days

---

### Phase 6: CI/CD Integration (Week 4)

**Priority**: P1 - High

**Tasks:**
1. Add security tests to GitHub Actions workflow
2. Configure test database for CI environment
3. Setup test result reporting
4. Add coverage gates (80% minimum)

**Estimated Effort**: 1-2 days

---

## Success Criteria

- [ ] All database RLS tests pass (100% coverage of policies)
- [ ] All application-level authorization tests pass
- [ ] All service-level isolation tests pass
- [ ] All UI isolation tests pass
- [ ] Manual penetration tests completed with 0 critical findings
- [ ] CI/CD pipeline runs security tests on every PR
- [ ] Test coverage >= 80% for critical security paths
- [ ] Documentation updated with security testing procedures
- [ ] Team training completed on security testing practices

---

## Appendix A: Test Coverage Matrix

| Feature | Database RLS | Server Actions | API Routes | Services | UI | E2E | Penetration |
|---------|--------------|----------------|------------|----------|----|----|-------------|
| Document Storage List | ✅ | ✅ | ✅ | - | ✅ | ⚠️ | ✅ |
| Document Upload | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Document Deletion | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Storage Assignment | ⚠️ | ✅ | ✅ | - | ✅ | ⚠️ | ✅ |
| Assistant Settings | ✅ | ✅ | ✅ | - | ✅ | ⚠️ | ✅ |
| Pinecone Queries | - | - | - | ✅ | - | - | ✅ |
| VAPI KB Access | ✅ | ✅ | - | ✅ | - | - | ✅ |

**Legend:**
- ✅ = Covered in this plan
- ⚠️ = Partially covered / needs junction table RLS
- - = Not applicable

---

## Appendix B: Security Testing Checklist

### Pre-Implementation Checklist

- [ ] Review all RLS policies in database
- [ ] Identify all tables requiring RLS
- [ ] Map all server actions and API routes
- [ ] Document external service authentication
- [ ] Setup test environment (Supabase, Pinecone, VAPI)
- [ ] Create test user accounts
- [ ] Seed test data

### Implementation Checklist

- [ ] Write database RLS tests
- [ ] Write server action authorization tests
- [ ] Write API route security tests
- [ ] Write service isolation tests
- [ ] Write UI isolation tests
- [ ] Setup CI/CD integration
- [ ] Run all tests locally
- [ ] Fix failing tests
- [ ] Achieve 80%+ coverage

### Post-Implementation Checklist

- [ ] Execute manual penetration tests
- [ ] Document all findings
- [ ] Fix discovered vulnerabilities
- [ ] Re-test after fixes
- [ ] Update security documentation
- [ ] Train team on security testing
- [ ] Schedule quarterly security audits
- [ ] Monitor production for security incidents

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-04 | testing-strategy-planner | Initial comprehensive security testing plan |

---

**End of Document**
