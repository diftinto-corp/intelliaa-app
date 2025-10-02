# VAPI Knowledge Base Service - System Architecture & Integration Guide

**Feature**: INTEL-002 - Create VAPI Knowledge Base Service
**Document Type**: System Architecture & Integration Analysis
**Created**: 2025-10-02
**Status**: Comprehensive Integration Plan
**Priority**: P0 - Critical

---

## Executive Summary

This document provides a comprehensive architectural analysis of how the VAPI Knowledge Base Service integrates into the existing IntelliAA platform. It covers service integration patterns, multi-tenant architecture, API layer design, error handling strategies, migration planning, and scalability considerations.

### Key Integration Points

1. **VAPI KB Service** ↔ **Existing VAPI File Service** (File upload → KB creation workflow)
2. **VAPI KB Service** ↔ **Flowise Service** (Parallel operation for WhatsApp assistants)
3. **VAPI KB Service** ↔ **Vercel AI SDK Embeddings** (INTEL-001 compatibility)
4. **VAPI KB Service** ↔ **Document Storage** (Multi-tenant document management)
5. **VAPI KB Service** ↔ **Assistant Management** (Query tool attachment)
6. **VAPI KB Service** ↔ **Supabase RLS** (Multi-tenant data isolation)

### Critical Architectural Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **Separate Service Module** | Single responsibility, independent evolution | New file: `vapiKnowledgeBaseService.ts` |
| **Parallel with Flowise** | Different use cases (voice vs WhatsApp) | No conflicts, coexistence |
| **Supabase Metadata Storage** | Multi-tenant tracking, RLS enforcement | New table: `vapi_knowledge_bases` |
| **Feature Flag Rollout** | Gradual deployment, easy rollback | `NEXT_PUBLIC_USE_VAPI_KB` env var |
| **Batch Auto-Split** | Respect VAPI 100-file limit | Automatic KB splitting logic |
| **Retry with Backoff** | Handle transient failures gracefully | Exponential backoff, max 3 attempts |

---

## 1. Service Integration Analysis

### 1.1 VAPI KB Service in Existing Architecture

**Current Architecture** (Before INTEL-002):
```
┌─────────────────────────────────────────────────────────────┐
│                    Document Upload Flow                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────┐
│  Flowise Service  │               │  VAPI File Upload │
│  (WhatsApp Docs)  │               │  (Voice Files)    │
└───────────────────┘               └───────────────────┘
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────┐
│ Vector Embeddings │               │  File Storage     │
│ (Flowise DB)      │               │  (VAPI)           │
└───────────────────┘               └───────────────────┘
```

**New Architecture** (After INTEL-002):
```
┌─────────────────────────────────────────────────────────────┐
│                    Document Upload Flow                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┬───────────────────┐
        │                                       │                   │
        ▼                                       ▼                   ▼
┌───────────────────┐               ┌───────────────────┐  ┌──────────────────┐
│  Flowise Service  │               │  VAPI File Upload │  │ Vercel AI SDK    │
│  (WhatsApp Docs)  │               │  (Voice Files)    │  │ (INTEL-001)      │
└───────────────────┘               └───────────────────┘  └──────────────────┘
        │                                       │                   │
        ▼                                       ▼                   ▼
┌───────────────────┐               ┌───────────────────┐  ┌──────────────────┐
│ Flowise Vector DB │               │  VAPI KB Service  │  │ Embeddings       │
│                   │               │  (NEW - INTEL-002)│  │ (OpenAI)         │
└───────────────────┘               └───────────────────┘  └──────────────────┘
                                            │
                                            ▼
                                    ┌───────────────────┐
                                    │ Query Tools       │
                                    │ (Voice Assistants)│
                                    └───────────────────┘
```

### 1.2 Integration with Flowise (Parallel Operation)

**Use Case Separation**:

| Service | Use Case | Document Type | Assistant Type | Vector Store |
|---------|----------|---------------|----------------|--------------|
| **Flowise** | WhatsApp document queries | All document types | WhatsApp assistants | Flowise Vector DB |
| **VAPI KB** | Voice call document queries | PDFs, Text files | Voice assistants | VAPI Google Provider |

**Integration Pattern**: **Parallel Processing (No Replacement)**

```typescript
// Document Upload Flow (Pseudocode)
async function uploadDocument(file: File, account_id: string) {
  const base64File = Buffer.from(await file.arrayBuffer()).toString("base64");

  // 1. Upload to VAPI Files API
  const vapiFile = await vapiService.uploadFile(file);

  // 2. Process with Flowise (for WhatsApp)
  const flowiseResult = await flowiseService.processFile(documentStorage.id, {
    loader: { name: "pdfFile", config: { ... } },
    // ... config
  });

  // 3. Create VAPI KB (for Voice) - NEW INTEL-002
  if (process.env.NEXT_PUBLIC_USE_VAPI_KB === 'true') {
    const vapiKB = await createVapiKnowledgeBase({
      account_id,
      name: `KB - ${file.name}`,
      vapi_file_ids: [vapiFile.id],
    });
    console.log(`VAPI KB created: ${vapiKB.data?.vapi_kb_id}`);
  }

  // 4. Save metadata to Supabase
  await supabase.from("pdf_docs").insert({
    id_vapi_doc: vapiFile.id,
    vapi_kb_id: vapiKB.data?.vapi_kb_id, // NEW field
    embedding_service: 'flowise', // or 'vercel'
    // ... other fields
  });
}
```

**Key Insight**: Flowise and VAPI KB **coexist peacefully**. They serve different assistant types (WhatsApp vs Voice) and do not conflict.

### 1.3 Integration with Vercel AI SDK Embeddings (INTEL-001)

**INTEL-001 Context** (from `documents.ts`):
- Feature flag: `shouldUseVercelEmbeddings(account_id)`
- Generates embeddings using OpenAI `text-embedding-ada-002`
- Stores usage tracking in `embedding_usage` table
- Replaces Flowise embeddings for accounts that opt-in

**INTEL-002 Compatibility**:
```typescript
// documents.ts - createDocumentStorage()
const useVercelEmbeddings = await shouldUseVercelEmbeddings(account_id);
const embeddingService = useVercelEmbeddings ? 'vercel' : 'flowise';

if (useVercelEmbeddings) {
  // INTEL-001: Generate embeddings with Vercel AI SDK
  const embeddingResult = await generateEmbeddings(fileBuffer, {
    model: 'text-embedding-ada-002',
    chunkSize: 1500,
    // ...
  });

  // Track usage
  await trackEmbeddingUsage(account_id, null, embeddingResult.usage, 'vercel');
}

// INTEL-002: Create VAPI KB (runs regardless of embedding service)
// VAPI handles its own embeddings internally (Google provider)
if (process.env.NEXT_PUBLIC_USE_VAPI_KB === 'true') {
  const vapiKB = await createVapiKnowledgeBase({
    account_id,
    name: `KB - ${file.name}`,
    vapi_file_ids: [vapiFile.id],
    provider: 'google', // VAPI's internal embedding
  });
}
```

**Critical Understanding**:
- **Vercel AI SDK**: Generates embeddings for analysis, cost tracking, future Pinecone integration
- **VAPI KB (Google Provider)**: Generates its **own** embeddings internally
- **No Conflict**: Both can operate on the same document without issues
- **Future State** (INTEL-003): Vercel embeddings → Pinecone, VAPI KB → Voice queries

### 1.4 Data Flow Between Services

**Complete Document Upload → Voice Assistant Query Flow**:

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Document Upload (User Action)                        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ createDocumentStorage(account, file)  │
        │ (src/lib/actions/intelliaa/documents) │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┬───────────────────┐
        │                                       │                   │
        ▼                                       ▼                   ▼
┌───────────────────┐               ┌───────────────────┐  ┌──────────────────┐
│ Upload to VAPI    │               │ Process Flowise   │  │ Generate Vercel  │
│ vapiService       │               │ flowiseService    │  │ Embeddings       │
│ uploadFile()      │               │ processFile()     │  │ (if feature on)  │
└───────────────────┘               └───────────────────┘  └──────────────────┘
        │                                       │                   │
        │ Returns: vapiFile.id                  │                   │
        └───────────────────┬───────────────────┴───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Create VAPI Knowledge Base (INTEL-002)│
        │ createVapiKnowledgeBase()             │
        │ - account_id                          │
        │ - name: "KB - {filename}"             │
        │ - vapi_file_ids: [vapiFile.id]        │
        │ - provider: 'google'                  │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────┐
│ VAPI API Call     │               │ Supabase Insert   │
│ POST /knowledge-  │               │ vapi_knowledge_   │
│ base              │               │ bases             │
│                   │               │ - vapi_kb_id      │
│ Returns: kb.id    │               │ - account_id      │
└───────────────────┘               │ - vapi_file_ids   │
                                    │ - status: active  │
                                    └───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Save to pdf_docs table                │
        │ - id_vapi_doc: vapiFile.id            │
        │ - vapi_kb_id: kb.id (NEW FIELD)       │
        │ - embedding_service: 'vercel'/'flowise'│
        └───────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Step 2: Attach KB to Voice Assistant                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ attachKnowledgeBaseToAssistant()      │
        │ (src/lib/actions/intelliaa/assistants)│
        │ - assistant_id                        │
        │ - kb_ids: [kb.id]                     │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Generate Query Tool Configuration     │
        │ createQueryToolConfig()               │
        │ - knowledgeBaseId: kb.vapi_kb_id      │
        │ - toolName: 'searchProductDocs'       │
        │ - toolDescription: '...'              │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Update VAPI Assistant                 │
        │ PATCH /assistant/{id}                 │
        │ - model.toolIds: [...]                │
        │ - model.tools: [queryToolConfig]      │
        │ - systemPrompt: "Use searchProductDocs │
        │   tool to answer questions..."        │
        └───────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Step 3: Voice Call Query (Runtime)                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ User asks question via phone call     │
        │ "What is the return policy?"          │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ VAPI Assistant decides to call tool   │
        │ searchProductDocs("return policy")    │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ VAPI Knowledge Base Search            │
        │ (Google Provider - Internal)          │
        │ - Queries vector embeddings           │
        │ - Returns relevant document chunks    │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ VAPI Assistant synthesizes response   │
        │ "Our return policy allows..."         │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ Voice response sent to caller         │
        └───────────────────────────────────────┘
```

---

## 2. Multi-Tenant Architecture

### 2.1 Account-Based Data Isolation Strategy

**Basejump Multi-Tenancy Model**:
- Every user belongs to one or more **accounts** (personal or team)
- All data is scoped to `account_id`
- RLS policies enforce data isolation at the database level
- Application-level checks as defense-in-depth

**VAPI KB Multi-Tenant Design**:

```sql
-- vapi_knowledge_bases table structure
CREATE TABLE public.vapi_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- VAPI KB details
  vapi_kb_id TEXT NOT NULL UNIQUE, -- VAPI's KB ID
  name TEXT NOT NULL,
  vapi_file_ids TEXT[] DEFAULT '{}',

  -- Assistant linkage
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete

  -- Indexes
  CONSTRAINT vapi_kb_account_check CHECK (account_id IS NOT NULL)
);

-- Performance indexes
CREATE INDEX idx_vapi_kb_account ON vapi_knowledge_bases(account_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_vapi_kb_assistant ON vapi_knowledge_bases(assistant_id)
  WHERE deleted_at IS NULL;
```

### 2.2 RLS Enforcement Across Service Boundaries

**Row Level Security Policies**:

```sql
-- SELECT Policy
CREATE POLICY "Users can view knowledge bases for their accounts"
  ON vapi_knowledge_bases
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id
      FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- INSERT Policy
CREATE POLICY "Users can create knowledge bases for their accounts"
  ON vapi_knowledge_bases
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE Policy
CREATE POLICY "Users can update knowledge bases for their accounts"
  ON vapi_knowledge_bases
  FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id
      FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- DELETE Policy
CREATE POLICY "Users can delete knowledge bases for their accounts"
  ON vapi_knowledge_bases
  FOR DELETE
  USING (
    account_id IN (
      SELECT account_id
      FROM account_user
      WHERE user_id = auth.uid()
    )
  );
```

**Application-Level Enforcement**:

```typescript
// Server Action - ALWAYS filter by account_id
export async function listVapiKnowledgeBases(
  account_id: string
): Promise<{ data?: VapiKBRecord[]; error?: string }> {
  try {
    const supabase = await createClient();

    // RLS policy enforces this, but we ALWAYS include it explicitly
    const { data, error } = await supabase
      .from('vapi_knowledge_bases')
      .select('*')
      .eq('account_id', account_id) // CRITICAL: Always filter
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    return { error: 'Unknown error occurred' };
  }
}
```

### 2.3 Namespace/Slug Handling for KB Identification

**Current Namespace Pattern** (Assistants):
```typescript
// From assistants.ts
const namespace = `${Math.random().toString(36).substring(2, 15)}`;
```

**Proposed KB Namespace Pattern**:
```typescript
// Deterministic namespace based on document name and account
const kbNamespace = `${name.toString().replace(/\s+/g, '-')}-${account_id.substring(0, 8)}-${Math.random().toString(36).substring(2, 6)}`;

// Example: "product-docs-a1b2c3d4-x9y8"
```

**Why Different from Assistant Namespace?**:
- **Assistant Namespace**: Used for deleting related records (documents, QA, reports)
- **KB Namespace**: Used for identifying KB in multi-tenant context, linking to VAPI KB ID
- **Collision Risk**: Minimal due to random component + account ID prefix

### 2.4 Cross-Account Security Validation Patterns

**Security Validation Checklist**:

```typescript
// ✅ CORRECT: Validate account ownership before operations
async function getVapiKnowledgeBase(kb_id: string, account_id: string) {
  const supabase = await createClient();

  // Step 1: Fetch with account_id filter
  const { data, error } = await supabase
    .from('vapi_knowledge_bases')
    .select('*')
    .eq('id', kb_id)
    .eq('account_id', account_id) // REQUIRED
    .is('deleted_at', null)
    .single();

  // Step 2: RLS policy also enforces this (defense-in-depth)
  if (error || !data) {
    return { error: 'KB not found or access denied' };
  }

  return { data };
}

// ❌ WRONG: Fetch by ID without account_id check
async function getVapiKnowledgeBaseWRONG(kb_id: string) {
  const supabase = await createClient();

  // SECURITY RISK: No account_id validation
  const { data } = await supabase
    .from('vapi_knowledge_bases')
    .select('*')
    .eq('id', kb_id)
    .single();

  // RLS policy will block this, but application should NEVER rely solely on RLS
  return { data };
}
```

**Test Case for Cross-Account Access**:
```typescript
// Integration test
describe('RLS Policy Enforcement', () => {
  it('should block access to KB from different account', async () => {
    // Create KB for Account A
    const kbA = await createVapiKnowledgeBase({
      account_id: 'account-a-uuid',
      name: 'KB A',
      vapi_file_ids: ['file-1'],
    });

    // Try to access from Account B
    const result = await getVapiKnowledgeBase(kbA.data!.id, 'account-b-uuid');

    // Should be blocked
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});
```

---

## 3. API Layer Design

### 3.1 API Routes vs Server Actions

**Decision: Server Actions Only (No API Routes Needed)**

**Rationale**:
- Server actions provide direct server-side execution with Next.js 15
- RLS policies enforce security at database level
- API routes add unnecessary complexity for internal operations
- VAPI KB operations are server-side only (no client-side API needed)

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│           Client Components (UI)                        │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Calls server actions
                        ▼
┌─────────────────────────────────────────────────────────┐
│     Server Actions (src/lib/actions/intelliaa/)         │
│     - createVapiKnowledgeBase()                         │
│     - updateVapiKnowledgeBase()                         │
│     - deleteVapiKnowledgeBase()                         │
│     - listVapiKnowledgeBases()                          │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│ VAPI KB Service  │          │ Supabase Client  │
│ (vapiKnowledge   │          │ (createClient)   │
│  BaseService)    │          │                  │
└──────────────────┘          └──────────────────┘
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│ VAPI API         │          │ PostgreSQL +     │
│ /knowledge-base  │          │ RLS Policies     │
└──────────────────┘          └──────────────────┘
```

**When API Routes ARE Needed** (Not applicable for INTEL-002):
- Public-facing endpoints (webhooks)
- Third-party integrations requiring REST API
- Custom knowledge base provider webhooks (future enhancement)

### 3.2 Client-Side vs Server-Side KB Management

**Server-Side Operations** (Recommended for INTEL-002):
```typescript
"use server";

// Server Action - Runs on server, access to env vars and Supabase
export async function createVapiKnowledgeBase(params: CreateKBParams) {
  // Access to NEXT_PRIVATE_VAPI_KEY
  const supabase = await createClient(); // Server-side client

  // Create KB in VAPI
  const vapiKB = await vapiKnowledgeBaseService.createKnowledgeBase({
    name: params.name,
    fileIds: params.vapi_file_ids,
  });

  // Store in Supabase with RLS enforcement
  const { data, error } = await supabase
    .from('vapi_knowledge_bases')
    .insert({ ... })
    .select()
    .single();

  return { data, error: error?.message };
}
```

**Client-Side Access** (UI Components):
```typescript
"use client";

import { createVapiKnowledgeBase } from '@/lib/actions/intelliaa/vapiKnowledgeBase';

export function DocumentUploadForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    // Call server action (no direct VAPI API access from client)
    const result = await createVapiKnowledgeBase({
      account_id: accountId,
      name: formData.get('name') as string,
      vapi_file_ids: fileIds,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Knowledge base created!');
    }

    setLoading(false);
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 3.3 Real-Time Updates Strategy

**Current Approach**: **Polling (No Real-Time Required)**

**Rationale**:
- KB creation is infrequent (per document upload)
- User expects delay for document processing
- Real-time updates add complexity for minimal benefit

**Future Enhancement** (If Needed):
```typescript
// Supabase Realtime Subscription (Example - Not Implemented)
useEffect(() => {
  const supabase = createClient();

  const channel = supabase
    .channel('vapi-kb-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'vapi_knowledge_bases',
        filter: `account_id=eq.${accountId}`,
      },
      (payload) => {
        console.log('KB changed:', payload);
        // Update UI
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [accountId]);
```

**Recommendation**: **Do NOT implement real-time updates** for INTEL-002. Use simple refresh/polling if needed.

### 3.4 Webhook Handling Architecture (Custom KB Provider)

**VAPI Custom Knowledge Base Provider** (Optional - Not Primary Focus):

```
┌─────────────────────────────────────────────────────────┐
│              VAPI Voice Call                            │
└─────────────────────────────────────────────────────────┘
                        │
                        │ User asks question
                        ▼
┌─────────────────────────────────────────────────────────┐
│         VAPI Assistant (with Query Tool)                │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Calls custom KB webhook
                        ▼
┌─────────────────────────────────────────────────────────┐
│    POST /api/vapi/custom-knowledge-base (Webhook)       │
│    - Receives query request from VAPI                   │
│    - Validates VAPI signature                           │
│    - Queries custom vector DB (e.g., Pinecone)          │
│    - Returns documents or direct message                │
└─────────────────────────────────────────────────────────┘
```

**Implementation** (If Custom KB Provider Needed):

```typescript
// src/app/api/vapi/custom-knowledge-base/route.ts (Future)
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const signature = request.headers.get('x-vapi-signature');

  // Step 1: Verify VAPI signature
  const secret = process.env.VAPI_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  if (signature !== `sha256=${expectedSignature}`) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // Step 2: Extract query from VAPI request
  const { message } = body;
  const query = message.messages[message.messages.length - 1].content;

  // Step 3: Query custom vector DB (e.g., Pinecone)
  const results = await queryPinecone(query, {
    topK: 5,
    namespace: 'account-specific-namespace',
  });

  // Step 4: Return documents to VAPI
  return NextResponse.json({
    documents: results.map(r => ({
      content: r.text,
      similarity: r.score,
      uuid: r.id,
    })),
  });
}
```

**Recommendation for INTEL-002**: Use **Google Provider** (default). Custom KB provider is a **future enhancement** (not required for MVP).

---

## 4. Error Handling & Observability

### 4.1 Logging Strategy Across Service Boundaries

**Logging Levels**:

| Level | Use Case | Example |
|-------|----------|---------|
| **DEBUG** | Detailed debugging info | `console.log('[VAPI KB] Request payload:', payload)` |
| **INFO** | Successful operations | `console.log('[VAPI KB] KB created: kb-123')` |
| **WARN** | Recoverable errors | `console.warn('[VAPI KB] Retry attempt 2/3')` |
| **ERROR** | Failures requiring attention | `console.error('[VAPI KB] Failed to create KB:', error)` |

**Logging Pattern**:
```typescript
// vapiKnowledgeBaseService.ts
export async function createKnowledgeBase(config: KnowledgeBaseConfig) {
  console.log(`[VAPI KB] Creating knowledge base: ${config.name}`);

  try {
    const response = await vapiRequest<KnowledgeBaseResponse>(
      '/knowledge-base',
      { method: 'POST', body: JSON.stringify(config) }
    );

    console.log(`[VAPI KB] ✅ Knowledge base created: ${response.id}`);
    return response;
  } catch (error) {
    console.error(`[VAPI KB] ❌ Error creating KB "${config.name}":`, error);
    throw error;
  }
}

// Server Action
export async function createVapiKnowledgeBase(params: CreateKBParams) {
  console.log(`[VAPI KB Action] Creating KB for account: ${params.account_id}`);

  try {
    // VAPI API call
    const vapiKB = await vapiKnowledgeBaseService.createKnowledgeBase({ ... });
    console.log(`[VAPI KB Action] VAPI KB created: ${vapiKB.id}`);

    // Supabase insert
    const { data, error } = await supabase.from('vapi_knowledge_bases').insert({ ... });

    if (error) {
      console.error(`[VAPI KB Action] Database error:`, error);
      // Rollback: Delete KB from VAPI
      await vapiKnowledgeBaseService.deleteKnowledgeBase(vapiKB.id);
      console.warn(`[VAPI KB Action] Rollback: Deleted VAPI KB ${vapiKB.id}`);
      return { error: error.message };
    }

    console.log(`[VAPI KB Action] ✅ KB metadata saved to Supabase`);
    return { data };
  } catch (error) {
    console.error(`[VAPI KB Action] Unexpected error:`, error);
    return { error: 'Unknown error occurred' };
  }
}
```

**Production Logging Enhancement** (Future):
- Replace `console.log` with structured logging (e.g., Pino, Winston)
- Send logs to centralized service (Datadog, Sentry, CloudWatch)
- Include request IDs for tracing across services

### 4.2 Error Propagation and User Feedback Patterns

**Error Propagation Layers**:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: VAPI API (External Service)                    │
│ - Network errors, 4xx/5xx responses                     │
│ - Error: VapiKnowledgeBaseError                         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Catch & Retry
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Service Layer (vapiKnowledgeBaseService)       │
│ - Retry logic with exponential backoff                  │
│ - Log errors, throw sanitized error                     │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Catch & Store
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Server Actions (vapiKnowledgeBase.ts)          │
│ - Database operations (Supabase)                        │
│ - Rollback on failure (delete VAPI KB)                  │
│ - Return { data?, error? }                              │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Display to User
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Client Component (React)                       │
│ - Display error message with toast/alert                │
│ - Provide retry button if applicable                    │
└─────────────────────────────────────────────────────────┘
```

**User-Facing Error Messages**:

```typescript
// Server Action Error Response
export async function createVapiKnowledgeBase(params: CreateKBParams) {
  try {
    // ... operations
  } catch (error) {
    // Sanitize error for user display
    if (error instanceof VapiKnowledgeBaseError) {
      if (error.statusCode === 400) {
        return { error: 'Invalid document files. Please check file types and sizes.' };
      } else if (error.statusCode === 429) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
      } else if (error.statusCode && error.statusCode >= 500) {
        return { error: 'Service temporarily unavailable. Please try again later.' };
      }
    }

    // Generic error for unexpected failures
    return { error: 'Failed to create knowledge base. Please contact support.' };
  }
}

// Client Component Usage
async function handleCreateKB() {
  const result = await createVapiKnowledgeBase({ ... });

  if (result.error) {
    toast.error(result.error); // User-friendly message
  } else {
    toast.success('Knowledge base created successfully!');
  }
}
```

### 4.3 Monitoring and Alerting Recommendations

**Metrics to Monitor**:

| Metric | Description | Threshold | Alert |
|--------|-------------|-----------|-------|
| **KB Creation Rate** | KBs created per hour | >100/hour | Investigate unusual activity |
| **VAPI API Error Rate** | % of failed VAPI requests | >5% | Check VAPI API status |
| **Retry Rate** | % of requests requiring retry | >10% | Investigate transient failures |
| **Database Error Rate** | % of failed Supabase operations | >2% | Check RLS policies, DB health |
| **Batch Operation Success** | % of successful batch operations | <95% | Check batch splitting logic |
| **Average KB Creation Time** | Time from upload to KB ready | >10s | Investigate performance bottleneck |

**Monitoring Implementation** (Future Enhancement):

```typescript
// Metrics tracking service (Example)
export async function trackKBCreation(
  account_id: string,
  kb_id: string,
  duration: number,
  success: boolean,
  retry_count: number
) {
  // Send to monitoring service (e.g., Datadog, Prometheus)
  await fetch('https://metrics-api.example.com/kb-creation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id,
      kb_id,
      duration,
      success,
      retry_count,
      timestamp: new Date().toISOString(),
    }),
  });
}

// Usage in server action
export async function createVapiKnowledgeBase(params: CreateKBParams) {
  const startTime = Date.now();
  let retryCount = 0;

  try {
    const vapiKB = await vapiKnowledgeBaseService.createKnowledgeBase({ ... });
    const duration = Date.now() - startTime;

    await trackKBCreation(params.account_id, vapiKB.id, duration, true, retryCount);
    return { data: vapiKB };
  } catch (error) {
    const duration = Date.now() - startTime;
    await trackKBCreation(params.account_id, '', duration, false, retryCount);
    return { error: 'Failed to create KB' };
  }
}
```

**Recommended Monitoring Tools**:
- **Application Monitoring**: Sentry (error tracking), Datadog (APM)
- **Infrastructure Monitoring**: Vercel Analytics, Uptime Robot
- **Database Monitoring**: Supabase Dashboard, pg_stat_statements
- **VAPI Monitoring**: VAPI Dashboard (usage, rate limits)

### 4.4 Debugging Approach for Multi-Service Failures

**Debugging Checklist**:

1. **Check VAPI API Status**:
   - VAPI Dashboard: https://dashboard.vapi.ai
   - Check rate limits, API key validity

2. **Check Supabase Logs**:
   - Supabase Dashboard → Logs → Postgres Logs
   - Look for RLS policy violations, constraint errors

3. **Check Server Logs**:
   - Vercel Dashboard → Logs → Functions
   - Search for `[VAPI KB]` prefix

4. **Verify Environment Variables**:
   ```bash
   # Production
   vercel env pull
   grep VAPI .env.local

   # Local
   echo $NEXT_PRIVATE_VAPI_KEY
   ```

5. **Test VAPI API Directly**:
   ```bash
   # Create KB via curl
   curl -X POST https://api.vapi.ai/knowledge-base \
     -H "Authorization: Bearer $VAPI_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test KB","fileIds":["file-123"]}'
   ```

6. **Check Database State**:
   ```sql
   -- Check KB records
   SELECT * FROM vapi_knowledge_bases
   WHERE account_id = 'account-uuid'
   ORDER BY created_at DESC LIMIT 10;

   -- Check for failed operations
   SELECT * FROM vapi_knowledge_bases
   WHERE status = 'error';
   ```

**Common Failure Scenarios**:

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "VAPI KB created but not in Supabase" | Database insert failed | Check logs, verify RLS policies |
| "Supabase record but no VAPI KB" | VAPI API failure after DB insert | Check VAPI logs, verify rollback logic |
| "Retry loop (>3 attempts)" | Persistent VAPI API issue | Check VAPI status page, API key |
| "KB created but assistant can't query" | Query tool not attached | Verify assistant.model.toolIds |
| "Cross-account access error" | RLS policy blocking | Verify account_id in request |

---

## 5. Migration & Rollout Strategy

### 5.1 Feature Flag Implementation Approach

**Feature Flag Configuration**:

```bash
# .env.local / Vercel Environment Variables
NEXT_PUBLIC_USE_VAPI_KB=false  # Default: disabled
```

**Usage in Code**:

```typescript
// documents.ts - createDocumentStorage()
async function createDocumentStorage(account_id: string, formData: FormData) {
  // ... existing code (file upload, Flowise, Vercel embeddings) ...

  // Feature Flag Check
  const useVapiKB = process.env.NEXT_PUBLIC_USE_VAPI_KB === 'true';

  if (useVapiKB) {
    console.log('[INTEL-002] VAPI KB feature enabled - creating knowledge base');

    try {
      const vapiKB = await createVapiKnowledgeBase({
        account_id,
        name: `KB - ${name}`,
        vapi_file_ids: [vapiFile.id],
        tool_name: `search${name?.toString().replace(/\s+/g, '')}`,
        tool_description: `Search ${name} for relevant information`,
      });

      if (vapiKB.error) {
        console.error('[INTEL-002] Failed to create VAPI KB:', vapiKB.error);
        // Don't fail the entire upload - KB is optional
      } else {
        console.log('[INTEL-002] VAPI KB created:', vapiKB.data?.vapi_kb_id);
      }
    } catch (error) {
      console.error('[INTEL-002] VAPI KB creation error:', error);
      // Don't fail the entire upload
    }
  } else {
    console.log('[INTEL-002] VAPI KB feature disabled - skipping KB creation');
  }

  // ... rest of document upload flow ...
}
```

**Gradual Rollout Plan**:

```
Phase 1: Development Testing
┌─────────────────────────────────────────────────────────┐
│ Environment: Local / Staging                            │
│ Feature Flag: NEXT_PUBLIC_USE_VAPI_KB=true              │
│ Users: Developers only                                  │
│ Duration: 1-2 weeks                                     │
│ Goals:                                                  │
│ - Validate VAPI API integration                         │
│ - Test retry logic and error handling                   │
│ - Verify RLS policies                                   │
│ - Performance benchmarking                              │
└─────────────────────────────────────────────────────────┘

Phase 2: Beta Testing (Select Accounts)
┌─────────────────────────────────────────────────────────┐
│ Environment: Production                                 │
│ Feature Flag: NEXT_PUBLIC_USE_VAPI_KB=true (beta accounts) │
│ Users: 2-3 beta test accounts                           │
│ Duration: 1 week                                        │
│ Goals:                                                  │
│ - Real-world usage validation                           │
│ - Monitor KB creation rate and costs                    │
│ - Gather user feedback on voice queries                 │
│ - Identify edge cases                                   │
└─────────────────────────────────────────────────────────┘

Phase 3: Canary Rollout (10% of Accounts)
┌─────────────────────────────────────────────────────────┐
│ Environment: Production                                 │
│ Feature Flag: NEXT_PUBLIC_USE_VAPI_KB=true (10% accounts) │
│ Users: Randomly selected 10% of active accounts          │
│ Duration: 3-5 days                                      │
│ Goals:                                                  │
│ - Monitor error rates at scale                          │
│ - Verify rate limit handling                            │
│ - Compare costs vs. expected                            │
│ - A/B test voice assistant performance                  │
└─────────────────────────────────────────────────────────┘

Phase 4: Full Production Rollout
┌─────────────────────────────────────────────────────────┐
│ Environment: Production                                 │
│ Feature Flag: NEXT_PUBLIC_USE_VAPI_KB=true (all accounts) │
│ Users: All accounts                                     │
│ Duration: Ongoing                                       │
│ Goals:                                                  │
│ - Monitor long-term stability                           │
│ - Optimize costs and performance                        │
│ - Gather feedback for future enhancements               │
└─────────────────────────────────────────────────────────┘
```

**Rollout Validation Gates**:

Before progressing to next phase, validate:
- [ ] Error rate <2% for KB creation operations
- [ ] Average KB creation time <5 seconds
- [ ] No RLS policy violations detected
- [ ] VAPI API costs within budget (<$10/month per 1000 docs)
- [ ] Zero reports of cross-account data leakage
- [ ] Voice assistant query accuracy >90% (user feedback)

### 5.2 Gradual Rollout Phases and Validation Gates

**Phase 1: Development Testing** (Week 1-2)

```bash
# Local development
NEXT_PUBLIC_USE_VAPI_KB=true npm run dev

# Staging deployment
vercel deploy --env NEXT_PUBLIC_USE_VAPI_KB=true
```

**Validation Checklist**:
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Manual test cases completed (8 scenarios)
- [ ] Database migration applied successfully
- [ ] RLS policies verified
- [ ] No TypeScript errors
- [ ] Build succeeds (`npm run build`)

**Phase 2: Beta Testing** (Week 3)

```bash
# Production deployment with beta flag
vercel --prod
vercel env add NEXT_PUBLIC_USE_VAPI_KB
# Enter: true (for beta accounts only)
```

**Beta Account Selection**:
- Internal testing account (Intelliaa team)
- Trusted customer (high engagement, tech-savvy)
- Low-volume account (minimize risk)

**Validation Metrics**:
- KB creation success rate: >95%
- Average KB creation time: <5s
- Zero RLS violations
- User satisfaction: NPS >8/10

**Phase 3: Canary Rollout** (Week 4)

```typescript
// Account-level feature flag (server-side logic)
export async function shouldUseVapiKB(account_id: string): Promise<boolean> {
  // Global flag
  if (process.env.NEXT_PUBLIC_USE_VAPI_KB !== 'true') {
    return false;
  }

  // Canary: Enable for 10% of accounts (deterministic)
  const hash = crypto.createHash('md5').update(account_id).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  return hashInt % 10 === 0; // 10% probability
}

// Usage in document upload
const useVapiKB = await shouldUseVapiKB(account_id);
if (useVapiKB) {
  await createVapiKnowledgeBase({ ... });
}
```

**Monitoring During Canary**:
- Real-time dashboard: KB creation rate, error rate, latency
- Alert on error rate >5%
- Compare canary accounts vs. control group (voice query accuracy)

**Phase 4: Full Rollout** (Week 5+)

```bash
# Enable for all accounts
vercel env rm NEXT_PUBLIC_USE_VAPI_KB
vercel env add NEXT_PUBLIC_USE_VAPI_KB=true
vercel --prod
```

**Post-Rollout Validation**:
- [ ] Error rate <2% (7-day average)
- [ ] VAPI API costs within budget
- [ ] No performance degradation (P95 latency)
- [ ] User feedback positive (NPS >7/10)
- [ ] Zero critical bugs reported

### 5.3 Rollback Procedures and Safety Mechanisms

**Immediate Rollback** (Feature Flag Toggle):

```bash
# Step 1: Disable feature flag (takes effect immediately)
vercel env rm NEXT_PUBLIC_USE_VAPI_KB
vercel env add NEXT_PUBLIC_USE_VAPI_KB=false
vercel --prod

# Step 2: Verify rollback
curl https://intelliaa-app.vercel.app/api/health

# Step 3: Monitor for 15 minutes
# - Check error logs for new errors
# - Verify document uploads working without KB creation
```

**Impact of Feature Flag Rollback**:
- ✅ New document uploads work normally (no KB creation)
- ✅ Existing VAPI KBs remain functional
- ✅ Voice assistants with attached KBs continue to work
- ✅ No data loss
- ⚠️ New documents won't be queryable via voice assistants

**Full Code Rollback** (Revert Git Commit):

```bash
# Step 1: Identify commit to revert
git log --oneline | grep "INTEL-002"

# Step 2: Revert code changes
git revert <commit-hash>
git push origin main

# Step 3: Trigger deployment
vercel --prod

# Step 4: Rollback database migration (if needed)
supabase db reset --version <previous-migration>
```

**Impact of Full Rollback**:
- ✅ All INTEL-002 code removed
- ⚠️ Existing VAPI KBs remain in VAPI account (orphaned)
- ⚠️ Supabase table `vapi_knowledge_bases` remains (can be dropped manually)
- ⚠️ Voice assistants with KB tools may fail (tool references orphaned KBs)

**Rollback Safety Checklist**:
- [ ] Backup `vapi_knowledge_bases` table before rollback
- [ ] Export VAPI KB IDs for potential restoration
- [ ] Notify team of rollback decision
- [ ] Update incident log with rollback details
- [ ] Schedule post-mortem to identify root cause

### 5.4 Data Migration Considerations

**Current State** (Pre-INTEL-002):
- Documents uploaded to VAPI Files API
- Metadata stored in `pdf_docs` table
- No VAPI KBs exist

**Migration Path** (Post-INTEL-002):

```
Option 1: New Documents Only (Recommended)
┌─────────────────────────────────────────────────────────┐
│ - Existing documents: No KB created                      │
│ - New documents: KB created automatically                │
│ - Pros: Simple, no migration needed                      │
│ - Cons: Inconsistent state (old docs have no KBs)        │
└─────────────────────────────────────────────────────────┘

Option 2: Backfill Existing Documents (Advanced)
┌─────────────────────────────────────────────────────────┐
│ - Migration script creates KBs for all existing docs     │
│ - Pros: Consistent state across all documents            │
│ - Cons: Complex, VAPI API costs, potential failures      │
└─────────────────────────────────────────────────────────┘
```

**Recommendation**: **Option 1 (New Documents Only)** for MVP. Backfill can be done later if needed.

**Backfill Script** (If Option 2 Chosen):

```typescript
// scripts/backfill-vapi-kbs.ts
import { createClient } from '@/lib/supabase/server';
import { vapiKnowledgeBaseService } from '@/services/vapiKnowledgeBaseService';
import { createVapiKnowledgeBase } from '@/lib/actions/intelliaa/vapiKnowledgeBase';

async function backfillVapiKBs() {
  const supabase = await createClient();

  // Fetch all documents without VAPI KBs
  const { data: documents, error } = await supabase
    .from('pdf_docs')
    .select('*')
    .is('vapi_kb_id', null) // Only documents without KBs
    .limit(100); // Process in batches

  if (error || !documents) {
    console.error('Error fetching documents:', error);
    return;
  }

  console.log(`Backfilling ${documents.length} documents...`);

  for (const doc of documents) {
    try {
      // Create VAPI KB
      const result = await createVapiKnowledgeBase({
        account_id: doc.account_id,
        name: `KB - ${doc.name}`,
        vapi_file_ids: [doc.id_vapi_doc],
      });

      if (result.error) {
        console.error(`Failed to create KB for ${doc.id}:`, result.error);
        continue;
      }

      // Update pdf_docs record
      await supabase
        .from('pdf_docs')
        .update({ vapi_kb_id: result.data?.vapi_kb_id })
        .eq('id', doc.id);

      console.log(`✅ Created KB for ${doc.name}`);

      // Rate limiting: Wait 500ms between creations
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing ${doc.id}:`, error);
    }
  }

  console.log('Backfill complete!');
}

// Run with: ts-node scripts/backfill-vapi-kbs.ts
backfillVapiKBs().catch(console.error);
```

**Migration Risks**:
- **VAPI API Rate Limits**: May hit rate limits with large backfills
- **Cost**: Creating KBs for 1000s of documents incurs costs
- **Failures**: Partial failures require retry logic
- **Rollback**: Difficult to undo once KBs are created

**Recommendation**: Only backfill if **>80% of users request it** after initial rollout.

---

## 6. Scalability Considerations

### 6.1 VAPI API Rate Limiting Strategy (Known Limits)

**VAPI API Rate Limits** (Estimated - Not Publicly Documented):
- **Requests per minute**: ~100 requests/minute
- **Concurrent requests**: ~10 simultaneous requests
- **File upload**: 100MB max per file
- **Files per KB**: 100 files max

**Rate Limit Handling Strategy**:

```typescript
// vapiKnowledgeBaseService.ts - Retry logic
async function vapiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  try {
    const response = await fetch(`${VAPI_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 429) {
      // Rate limit exceeded
      const retryAfter = response.headers.get('retry-after'); // Seconds
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : calculateBackoff(retryCount);

      console.warn(`[VAPI KB] Rate limit exceeded. Retrying in ${delay}ms...`);

      if (retryCount < MAX_RETRIES) {
        await sleep(delay);
        return vapiRequest<T>(endpoint, options, retryCount + 1);
      }

      throw new VapiKnowledgeBaseError(
        'Rate limit exceeded. Please try again later.',
        429
      );
    }

    // ... rest of logic
  } catch (error) {
    // ... error handling
  }
}
```

**Batch Operation Rate Limiting**:

```typescript
// createKnowledgeBaseBatch - Sequential with delays
export async function createKnowledgeBaseBatch(
  name: string,
  description: string,
  fileIds: string[]
): Promise<KnowledgeBaseResponse[]> {
  const batches: string[][] = [];
  for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
    batches.push(fileIds.slice(i, i + BATCH_SIZE));
  }

  const results: KnowledgeBaseResponse[] = [];

  for (let i = 0; i < batches.length; i++) {
    const kb = await createKnowledgeBase({
      name: batches.length > 1 ? `${name} - Part ${i + 1}` : name,
      fileIds: batches[i],
    });
    results.push(kb);

    // Delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await sleep(500); // 500ms delay
    }
  }

  return results;
}
```

**Scalability Thresholds**:

| Scenario | Threshold | Strategy |
|----------|-----------|----------|
| **Concurrent users uploading** | >10 users | Queue uploads, process sequentially |
| **Large batch uploads** | >500 files | Split into 5 KBs, process overnight |
| **API rate limit hit** | 429 errors >5% | Increase delay between requests |
| **High KB creation volume** | >1000 KBs/day | Contact VAPI support for limit increase |

### 6.2 Caching Opportunities Across Services

**Caching Strategy**:

```
┌─────────────────────────────────────────────────────────┐
│ Cache Layer 1: Client-Side (React Query / SWR)          │
│ - KB list for account (TTL: 5 minutes)                  │
│ - Reduces server action calls                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Cache Layer 2: Server-Side (Redis / Vercel KV)          │
│ - VAPI KB metadata (TTL: 1 hour)                        │
│ - Reduces Supabase queries                              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Cache Layer 3: Database (Supabase Materialized Views)   │
│ - Aggregate KB stats (TTL: 1 day)                       │
│ - Reduces expensive JOIN queries                        │
└─────────────────────────────────────────────────────────┘
```

**Client-Side Caching** (SWR Example):

```typescript
"use client";

import useSWR from 'swr';
import { listVapiKnowledgeBases } from '@/lib/actions/intelliaa/vapiKnowledgeBase';

export function useVapiKnowledgeBases(account_id: string) {
  const { data, error, isLoading } = useSWR(
    `/vapi-kb/${account_id}`,
    () => listVapiKnowledgeBases(account_id),
    {
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      revalidateOnFocus: false,
    }
  );

  return {
    knowledgeBases: data?.data || [],
    isLoading,
    error: data?.error || error,
  };
}
```

**Server-Side Caching** (Vercel KV Example):

```typescript
import { kv } from '@vercel/kv';

export async function listVapiKnowledgeBasesCached(account_id: string) {
  const cacheKey = `vapi-kb:${account_id}`;

  // Check cache
  const cached = await kv.get(cacheKey);
  if (cached) {
    console.log('[VAPI KB] Cache hit');
    return { data: cached };
  }

  // Cache miss - fetch from Supabase
  const result = await listVapiKnowledgeBases(account_id);

  if (result.data) {
    // Store in cache for 1 hour
    await kv.set(cacheKey, result.data, { ex: 3600 });
  }

  return result;
}
```

**Cache Invalidation Strategy**:

```typescript
// Invalidate cache after KB creation
export async function createVapiKnowledgeBase(params: CreateKBParams) {
  const result = await vapiKnowledgeBaseService.createKnowledgeBase({ ... });

  // Invalidate cache
  await kv.del(`vapi-kb:${params.account_id}`);

  return result;
}
```

**Caching Recommendation for INTEL-002**:
- **Phase 1 (MVP)**: No caching (simple implementation)
- **Phase 2 (Optimization)**: Client-side caching with SWR
- **Phase 3 (Scale)**: Server-side caching with Redis/Vercel KV

### 6.3 Background Job Processing Requirements

**Background Job Use Cases**:

1. **Batch KB Creation** (for large document sets)
2. **KB Cleanup** (delete orphaned KBs)
3. **Usage Analytics** (aggregate KB stats)
4. **Backfill Migration** (create KBs for existing documents)

**Background Job Architecture** (Future Enhancement):

```
┌──────��──────────────────────────────────────────────────┐
│ Job Queue (BullMQ / Inngest)                            │
│ - Job: createKnowledgeBaseBatch                         │
│ - Payload: { account_id, file_ids[] }                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Worker (Vercel Serverless Function)                     │
│ - Poll queue for jobs                                   │
│ - Execute createVapiKnowledgeBase()                     │
│ - Update job status                                     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Job Results Storage (Supabase)                          │
│ - job_id, status, result, error                         │
└─────────────────────────────────────────────────────────┘
```

**Example: Inngest Job** (Not Implemented for INTEL-002):

```typescript
// src/jobs/createKnowledgeBaseBatch.ts
import { inngest } from '@/lib/inngest';
import { createVapiKnowledgeBaseBatch } from '@/lib/actions/intelliaa/vapiKnowledgeBase';

export const createKBBatchJob = inngest.createFunction(
  { id: 'create-kb-batch' },
  { event: 'vapi-kb/create-batch' },
  async ({ event, step }) => {
    const { account_id, name, file_ids } = event.data;

    // Step 1: Validate inputs
    await step.run('validate', async () => {
      if (file_ids.length > 500) {
        throw new Error('Too many files');
      }
    });

    // Step 2: Create KBs in batches
    const result = await step.run('create-kbs', async () => {
      return await createVapiKnowledgeBaseBatch({
        account_id,
        name,
        vapi_file_ids: file_ids,
      });
    });

    // Step 3: Notify user
    await step.run('notify', async () => {
      // Send email or in-app notification
    });

    return { success: true, kb_count: result.data?.length };
  }
);
```

**Recommendation for INTEL-002**: **No background jobs needed for MVP**. Synchronous KB creation is sufficient for <100 files per upload. Background jobs can be added in **Phase 3 (Scale)** if needed.

### 6.4 Database Scaling for High Document Volumes

**Current Database Schema Performance**:

```sql
-- Indexes (already included in migration)
CREATE INDEX idx_vapi_kb_account ON vapi_knowledge_bases(account_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_vapi_kb_assistant ON vapi_knowledge_bases(assistant_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_vapi_kb_vapi_id ON vapi_knowledge_bases(vapi_kb_id);
```

**Query Performance Estimates**:

| Query | Expected Volume | Index Used | Est. Time |
|-------|-----------------|------------|-----------|
| List KBs by account | 100 KBs | `idx_vapi_kb_account` | <50ms |
| Get KB by ID | 1 KB | `idx_vapi_kb_vapi_id` | <10ms |
| List KBs by assistant | 5 KBs | `idx_vapi_kb_assistant` | <20ms |

**Scaling Strategies** (for >10,000 KBs):

1. **Partitioning** (by account_id):
   ```sql
   -- Partition table by account_id hash
   CREATE TABLE vapi_knowledge_bases_partitioned (
     LIKE vapi_knowledge_bases INCLUDING ALL
   ) PARTITION BY HASH (account_id);

   -- Create partitions
   CREATE TABLE vapi_kbs_p0 PARTITION OF vapi_knowledge_bases_partitioned
     FOR VALUES WITH (MODULUS 4, REMAINDER 0);
   CREATE TABLE vapi_kbs_p1 PARTITION OF vapi_knowledge_bases_partitioned
     FOR VALUES WITH (MODULUS 4, REMAINDER 1);
   -- ... p2, p3
   ```

2. **Archival** (soft-deleted records):
   ```sql
   -- Move old deleted records to archive table
   CREATE TABLE vapi_knowledge_bases_archive AS
   SELECT * FROM vapi_knowledge_bases
   WHERE deleted_at < NOW() - INTERVAL '90 days';

   DELETE FROM vapi_knowledge_bases
   WHERE deleted_at < NOW() - INTERVAL '90 days';
   ```

3. **Read Replicas** (Supabase Pro):
   - Route read queries to replica
   - Write queries to primary
   - Reduces load on primary database

**Recommendation**: Current design is sufficient for **up to 100,000 KBs**. Implement partitioning only if exceeding this threshold.

---

## 7. Security & Compliance

### 7.1 API Key Management

**VAPI API Key Security**:
- ✅ Stored in environment variable (`NEXT_PRIVATE_VAPI_KEY`)
- ✅ Never exposed to client-side code
- ✅ Used only in server-side functions
- ⚠️ **TODO**: Rotate API key every 90 days

**Supabase Service Role Key**:
- ✅ Used for RLS bypass in admin operations (if needed)
- ❌ **Do NOT use** for regular KB operations (use user JWT)

### 7.2 Data Encryption

**Data at Rest**:
- ✅ VAPI: Encrypts files and embeddings (VAPI-managed)
- ✅ Supabase: Encrypts database at rest (AES-256)
- ✅ Vercel: Encrypts environment variables

**Data in Transit**:
- ✅ VAPI API: HTTPS only (TLS 1.2+)
- ✅ Supabase: HTTPS only (TLS 1.2+)
- ✅ Client ↔ Server: HTTPS only

### 7.3 RLS Policy Security

**Defense-in-Depth Strategy**:
1. **Application Layer**: Filter by `account_id` in server actions
2. **Database Layer**: RLS policies enforce access control
3. **Network Layer**: Supabase connection pooling, IP allowlisting (optional)

**Security Audit Checklist**:
- [ ] All queries include `account_id` filter
- [ ] RLS policies tested with different accounts
- [ ] No public access to `vapi_knowledge_bases` table
- [ ] Soft delete prevents data leakage (deleted_at check)
- [ ] No SQL injection vulnerabilities (parameterized queries)

### 7.4 Compliance Considerations

**GDPR Compliance**:
- ✅ User can delete documents (cascade delete KBs)
- ✅ Data export: Query all KBs for account
- ⚠️ **TODO**: VAPI data residency (check VAPI DPA)

**Data Retention**:
- Soft-deleted KBs retained for 90 days (recovery window)
- Hard delete after 90 days (automated cleanup job)

---

## 8. Summary & Recommendations

### 8.1 Critical Architectural Decisions Summary

| Decision | Rationale | Risk Mitigation |
|----------|-----------|-----------------|
| **Parallel with Flowise** | Different use cases (voice vs WhatsApp) | No conflicts, coexistence validated |
| **Feature Flag Rollout** | Gradual deployment, easy rollback | Immediate rollback via flag toggle |
| **Batch Auto-Split** | Respect VAPI 100-file limit | Automatic splitting, user-transparent |
| **Retry with Backoff** | Handle transient failures gracefully | Max 3 attempts, exponential backoff |
| **RLS + App-Level Checks** | Multi-tenant security | Defense-in-depth strategy |
| **Server Actions Only** | Simplify API surface | No API routes, direct Supabase access |

### 8.2 Integration Patterns Summary

1. **VAPI KB ↔ VAPI Files**: Sequential (upload file → create KB)
2. **VAPI KB ↔ Flowise**: Parallel (both process documents)
3. **VAPI KB ↔ Vercel Embeddings**: Compatible (different purposes)
4. **VAPI KB ↔ Assistants**: Attachment via query tools
5. **VAPI KB ↔ Supabase**: Metadata persistence with RLS

### 8.3 Rollout Phases Summary

| Phase | Duration | Accounts | Success Criteria |
|-------|----------|----------|------------------|
| **Dev Testing** | 1-2 weeks | Developers | Tests pass, no errors |
| **Beta Testing** | 1 week | 2-3 beta accounts | NPS >8/10, success rate >95% |
| **Canary Rollout** | 3-5 days | 10% of accounts | Error rate <2%, no incidents |
| **Full Rollout** | Ongoing | All accounts | Cost within budget, positive feedback |

### 8.4 Monitoring Metrics Summary

| Metric | Threshold | Alert |
|--------|-----------|-------|
| **KB Creation Rate** | >100/hour | Investigate unusual activity |
| **Error Rate** | >5% | Check VAPI API status |
| **Retry Rate** | >10% | Investigate transient failures |
| **Avg Creation Time** | >10s | Investigate bottleneck |

### 8.5 Next Steps & Action Items

**Immediate (Pre-Implementation)**:
1. Review this architecture document with team
2. Clarify any open questions with VAPI support (rate limits, best practices)
3. Finalize feature flag rollout schedule
4. Set up monitoring dashboards (Datadog, Sentry)

**Implementation Phase**:
1. Create feature branch: `feature/INTEL-002-vapi-kb-service`
2. Implement core service (`vapiKnowledgeBaseService.ts`)
3. Apply database migration (`20251002_vapi_knowledge_bases.sql`)
4. Implement server actions (`vapiKnowledgeBase.ts`)
5. Integrate with document upload flow (`documents.ts`)
6. Write tests (unit, integration, manual)
7. Deploy to staging with feature flag disabled

**Post-Implementation**:
1. Enable feature flag for dev environment
2. Run full test suite
3. Begin beta testing with selected accounts
4. Monitor metrics and error rates
5. Iterate based on feedback
6. Plan canary and full rollout

---

## 9. Appendix

### 9.1 VAPI API Endpoint Reference

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/knowledge-base` | Create KB | `{ name, description, fileIds[], provider }` | `{ id, name, createdAt, ... }` |
| `GET` | `/knowledge-base/{id}` | Get KB | N/A | `{ id, name, fileIds[], ... }` |
| `PATCH` | `/knowledge-base/{id}` | Update KB | `{ name?, fileIds[]? }` | `{ id, name, updatedAt, ... }` |
| `DELETE` | `/knowledge-base/{id}` | Delete KB | N/A | `204 No Content` |
| `GET` | `/knowledge-base` | List KBs | N/A | `[{ id, name, ... }]` |

### 9.2 Database Schema Reference

```sql
-- Full table schema
CREATE TABLE public.vapi_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  vapi_kb_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  vapi_file_ids TEXT[] DEFAULT '{}',
  file_count INTEGER DEFAULT 0,
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  tool_name TEXT,
  tool_description TEXT,
  custom_server_url TEXT,
  custom_server_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT vapi_kb_account_check CHECK (account_id IS NOT NULL),
  CONSTRAINT vapi_kb_provider_check CHECK (provider IN ('google', 'custom-knowledge-base'))
);
```

### 9.3 Error Code Reference

| Code | Meaning | Retry? | User Message |
|------|---------|--------|--------------|
| `400` | Bad Request (validation) | ❌ No | "Invalid document files. Please check file types." |
| `401` | Unauthorized (bad API key) | ❌ No | "Authentication error. Please contact support." |
| `403` | Forbidden (permissions) | ❌ No | "Access denied. Please contact support." |
| `429` | Rate Limit Exceeded | ✅ Yes | "Too many requests. Please try again in a few minutes." |
| `500` | Internal Server Error | ✅ Yes | "Service temporarily unavailable. Please try again later." |
| `502` | Bad Gateway | ✅ Yes | "Service temporarily unavailable. Please try again later." |
| `503` | Service Unavailable | ✅ Yes | "Service temporarily unavailable. Please try again later." |

### 9.4 Useful Commands Reference

```bash
# Development
npm run dev                      # Start dev server
npm test                         # Run tests
npm run test:coverage            # Run tests with coverage

# Database
supabase start                   # Start local Supabase
supabase db push                 # Apply migrations
supabase db diff                 # Show schema changes

# Deployment
vercel deploy                    # Deploy to preview
vercel --prod                    # Deploy to production
vercel env pull                  # Pull env vars

# VAPI API Testing
curl -X POST https://api.vapi.ai/knowledge-base \
  -H "Authorization: Bearer $VAPI_KEY" \
  -d '{"name":"Test KB","fileIds":["file-123"]}'
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: Comprehensive Integration Plan Ready
**Next Step**: Team Review → Implementation → Rollout

---

**Key Contacts**:
- **VAPI Support**: support@vapi.ai
- **Supabase Support**: https://supabase.com/support
- **Basejump Docs**: https://usebasejump.com/docs

**Related Documents**:
- [Implementation Plan](vapi_kb_implementation_plan.md)
- [Database Architecture](database_architecture.md)
- [Testing Strategy](testing_strategy.md)
- [User Stories](../../user_histories/INTEL-002-vapi-knowledge-base-service.md)
- [Context Session](../../sessions/context_session_INTEL-002.md)
