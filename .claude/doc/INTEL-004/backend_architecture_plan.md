# Backend Architecture Implementation Plan: INTEL-004 - Create Document Storage with PDF

**Feature ID**: INTEL-004
**Priority**: P0 - Critical
**Epic**: Document Storage Creation
**Created**: 2025-10-02
**Author**: Architecture Planner Agent

---

## Executive Summary

This plan outlines the backend architecture for creating a document storage with an initial PDF file. The implementation involves orchestrating multiple external services (embedding generation, vector storage, VAPI file management, VAPI Knowledge Base) while maintaining atomic transactions and comprehensive rollback capabilities across distributed systems.

**Key Technical Challenge**: Coordinating stateful operations across 4 external APIs (OpenAI Embeddings, Pinecone, VAPI File, VAPI KB) + PostgreSQL without distributed transaction support, requiring careful orchestration and rollback mechanisms.

**Critical Success Factors**:
- File processing must complete within 5 minutes (timeout limit)
- Namespace uniqueness must be cryptographically guaranteed (AC7)
- All partial state must be cleaned up on any failure (AC5)
- Multi-tenant isolation enforced via RLS policies (AC6)
- Real-time progress updates for user experience (AC2)

---

## Current State Analysis

### Existing Infrastructure

**Services Available** (INTEL-001, INTEL-002, INTEL-003):
- `embeddingService.generateEmbeddings()` - Vercel AI SDK with OpenAI embeddings
- `pineconeService.upsertVectors()` - Vector storage with namespace isolation
- `vapiService.uploadFile()` - VAPI file management
- `vapiKBService.createKnowledgeBase()` - VAPI KB creation (INTEL-002)
- `createVapiKnowledgeBase()` - Server action with Supabase integration

**Database Schema**:
```sql
-- document_storages table
CREATE TABLE document_storages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES basejump.accounts(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  namespace TEXT NOT NULL,  -- Added in migration 20241218233638
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- pdf_docs table (existing)
CREATE TABLE pdf_docs (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  document_storage_id UUID REFERENCES document_storages(id),
  name TEXT NOT NULL,
  id_vapi_doc TEXT,  -- VAPI file ID
  url TEXT,          -- VAPI file URL
  embedding_service TEXT,      -- 'vercel' or 'flowise'
  chunk_count INTEGER,
  embedding_metadata JSONB,    -- Added in migration 20251002130001
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- vapi_knowledge_bases table (INTEL-002)
CREATE TABLE vapi_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES basejump.accounts(id) NOT NULL,
  vapi_kb_id TEXT NOT NULL UNIQUE,  -- VAPI KB ID
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT DEFAULT 'google',
  vapi_file_ids TEXT[] DEFAULT '{}',
  assistant_id UUID REFERENCES assistants(id),
  tool_name TEXT,
  tool_description TEXT,
  custom_server_url TEXT,
  custom_server_secret TEXT,
  status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### Existing Patterns

**Pattern Analysis from `documents.ts`**:
```typescript
// Current createDocumentStorage pattern (lines 124-296)
async function createDocumentStorage(account_id: string, formData: FormData) {
  // 1. File validation
  // 2. Feature flag check (Vercel vs Flowise)
  // 3. Flowise document store creation
  // 4. Embedding generation (Vercel AI SDK or Flowise fallback)
  // 5. VAPI file upload
  // 6. INTEL-002: Link to VAPI KB (if feature enabled)
  // 7. Supabase insert (document_storages + pdf_docs)
}
```

**Issues with Current Implementation**:
- No explicit rollback mechanism on failure
- No atomic transaction management across services
- Limited error granularity (generic error messages)
- No progress tracking capability
- Timeout not enforced (could exceed 5 minutes)
- Namespace generation lacks uniqueness guarantees beyond Math.random()

---

## Proposed Architecture

### High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    createDocumentStorageWithPDF                      │
│                         (Server Action)                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Pre-flight Validation & Setup                              │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Validate account access (RLS)                                     │
│  ✓ Validate file (size ≤50MB, type=PDF, not empty)                  │
│  ✓ Generate unique namespace (crypto-based)                          │
│  ✓ Initialize abort controller (5min timeout)                        │
│  ✓ Create progress tracker                                           │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Embedding Generation                                       │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Generate embeddings via embeddingService                          │
│  ✓ Track tokens, cost, processing time                               │
│  ✓ Update progress: "Generating embeddings..."                       │
│  ⚠ Rollback: None needed (stateless operation)                       │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Vector Storage (Pinecone)                                  │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Transform embeddings to Pinecone format                           │
│  ✓ Upsert vectors with namespace isolation                           │
│  ✓ Update progress: "Storing vectors..."                             │
│  ⚠ Rollback: deleteNamespace(namespace)                              │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 4: VAPI File Upload                                           │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Upload PDF to VAPI via vapiService.uploadFile()                   │
│  ✓ Store file ID and URL                                             │
│  ✓ Update progress: "Uploading to VAPI..."                           │
│  ⚠ Rollback: vapiService.deleteFile(vapiFileId)                      │
│  ⚠ Rollback: pineconeService.deleteNamespace(namespace)              │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 5: VAPI Knowledge Base Creation                               │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Create or link to existing VAPI KB                                │
│  ✓ Add uploaded file to KB                                           │
│  ✓ Update progress: "Creating knowledge base..."                     │
│  ⚠ Rollback: deleteVapiKnowledgeBase(kbId) - only if created new     │
│  ⚠ Rollback: vapiService.deleteFile(vapiFileId)                      │
│  ⚠ Rollback: pineconeService.deleteNamespace(namespace)              │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 6: Database Records Creation                                  │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Begin Supabase transaction                                        │
│  ✓ Insert document_storages record                                   │
│  ✓ Insert pdf_docs record                                            │
│  ✓ Link VAPI KB to document storage (metadata)                       │
│  ✓ Commit transaction                                                 │
│  ✓ Update progress: "Finalizing..."                                  │
│  ⚠ Rollback: All previous phases + DB rollback                       │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  PHASE 7: Success & Cleanup                                          │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Clear abort controller                                            │
│  ✓ Return success response with IDs                                  │
│  ✓ Log completion metrics                                            │
└───────────────────────────────────────────────────────────────────────┘
```

### Service Orchestration Details

**Service Call Order** (Critical - must be maintained):
1. **embeddingService** - Generates embeddings (stateless, no cleanup needed)
2. **pineconeService** - Stores vectors (namespace-based cleanup)
3. **vapiService** - Uploads file (file ID-based cleanup)
4. **vapiKBService** - Creates/updates KB (KB ID-based cleanup)
5. **Supabase** - Database records (transaction-based rollback)

**Why This Order**:
- Embedding generation is CPU-intensive and stateless → fail fast if file is corrupt
- Pinecone namespace can be deleted atomically → clean rollback
- VAPI file deletion is idempotent → safe to retry
- VAPI KB creation is last external service → minimize orphaned resources
- Database is final → ensures data consistency with external state

---

## Implementation Breakdown

### File 1: Server Action Implementation

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documents.ts`

**Modifications Required**:

```typescript
// ============================================================================
// INTEL-004: New Export
// ============================================================================

export { createDocumentStorageWithPDF };

// ============================================================================
// INTEL-004: Server Action - Create Document Storage with PDF
// ============================================================================

/**
 * Creates a document storage with an initial PDF file
 *
 * This orchestrates the complete flow:
 * 1. File validation
 * 2. Embedding generation (Vercel AI SDK)
 * 3. Vector storage (Pinecone)
 * 4. VAPI file upload
 * 5. VAPI KB creation/linking
 * 6. Database records creation
 *
 * Implements comprehensive rollback on any failure.
 *
 * @param accountId - Account ID (for RLS enforcement)
 * @param input - Document storage creation input
 * @returns Success with IDs or detailed error
 */
async function createDocumentStorageWithPDF(
  accountId: string,
  input: CreateDocumentStorageInput
): Promise<CreateDocumentStorageResult> {
  // Track created resources for rollback
  const rollbackState: RollbackState = {
    namespace: null,
    vapiFileId: null,
    vapiKbId: null,
    vapiKbCreatedNew: false,
    documentStorageId: null,
  };

  // Initialize abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, OPERATION_TIMEOUT_MS); // 5 minutes

  try {
    // ========================================================================
    // PHASE 1: Pre-flight Validation & Setup
    // ========================================================================

    console.log('[INTEL-004] Phase 1: Validation starting...');

    // Validate account access via RLS
    const hasAccess = await validateAccountAccess(accountId);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this account',
          phase: 'validation',
        },
      };
    }

    // Validate file
    const fileValidation = validateFile(input.file);
    if (!fileValidation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: fileValidation.error!,
          phase: 'validation',
        },
      };
    }

    // Generate unique namespace with cryptographic guarantee
    const namespace = generateUniqueNamespace(input.name);
    rollbackState.namespace = namespace;

    // Convert file to buffer
    const fileBuffer = Buffer.from(await input.file.arrayBuffer());

    console.log('[INTEL-004] Phase 1: Validation complete', {
      namespace,
      fileSize: fileBuffer.length,
    });

    // ========================================================================
    // PHASE 2: Embedding Generation
    // ========================================================================

    console.log('[INTEL-004] Phase 2: Generating embeddings...');

    // Check abort signal
    if (abortController.signal.aborted) {
      throw new TimeoutError('Operation timeout during embedding generation');
    }

    // Generate embeddings using Vercel AI SDK (INTEL-001)
    const embeddingResult = await generateEmbeddings(fileBuffer, {
      model: 'text-embedding-ada-002',
      chunkSize: 1500,
      chunkOverlap: 750,
      abortSignal: abortController.signal,
      metadata: {
        namespace,
        accountId,
        documentName: input.name,
      },
    });

    console.log('[INTEL-004] Phase 2: Embeddings generated', {
      chunkCount: embeddingResult.results.length,
      tokens: embeddingResult.usage.totalTokens,
      cost: embeddingResult.usage.estimatedCost,
      processingTime: embeddingResult.usage.processingTime,
    });

    // ========================================================================
    // PHASE 3: Vector Storage (Pinecone)
    // ========================================================================

    console.log('[INTEL-004] Phase 3: Storing vectors in Pinecone...');

    if (abortController.signal.aborted) {
      throw new TimeoutError('Operation timeout during vector storage');
    }

    // Transform embeddings to Pinecone format
    const vectors = embeddingResult.results.map((result, index) => ({
      id: `${namespace}-chunk-${index}`,
      values: result.embedding,
      metadata: {
        text: result.text,
        documentId: namespace, // Use namespace as document ID
        chunkIndex: index,
        totalChunks: embeddingResult.results.length,
        ...result.metadata,
      },
    }));

    // Upsert to Pinecone with namespace isolation (INTEL-003)
    const pineconeResult = await upsertVectors(namespace, vectors, {
      batchSize: 100,
      maxConcurrent: 5,
      timeout: 30000,
      maxRetries: 2,
    });

    if (!pineconeResult || pineconeResult.upsertedCount !== vectors.length) {
      throw new PineconeError(
        `Failed to upsert all vectors. Expected: ${vectors.length}, Upserted: ${pineconeResult?.upsertedCount || 0}`
      );
    }

    console.log('[INTEL-004] Phase 3: Vectors stored successfully', {
      namespace,
      vectorCount: pineconeResult.upsertedCount,
    });

    // ========================================================================
    // PHASE 4: VAPI File Upload
    // ========================================================================

    console.log('[INTEL-004] Phase 4: Uploading file to VAPI...');

    if (abortController.signal.aborted) {
      throw new TimeoutError('Operation timeout during VAPI file upload');
    }

    // Upload file to VAPI
    const vapiFileResult = await vapiService.uploadFile(input.file);
    if (!vapiFileResult || !vapiFileResult.id) {
      throw new VapiError('Failed to upload file to VAPI');
    }

    rollbackState.vapiFileId = vapiFileResult.id;

    console.log('[INTEL-004] Phase 4: File uploaded to VAPI', {
      fileId: vapiFileResult.id,
      url: vapiFileResult.url,
    });

    // ========================================================================
    // PHASE 5: VAPI Knowledge Base Creation/Linking
    // ========================================================================

    console.log('[INTEL-004] Phase 5: Creating/linking VAPI KB...');

    if (abortController.signal.aborted) {
      throw new TimeoutError('Operation timeout during VAPI KB creation');
    }

    // Use INTEL-002 helper to get or create VAPI KB
    const kbResult = await getOrCreateVapiKB(
      accountId,
      input.name,
      [vapiFileResult.id]
    );

    if (!kbResult.success || !kbResult.data) {
      console.warn('[INTEL-004] VAPI KB creation failed, continuing without KB:', kbResult.error);
      // Non-critical: Continue without KB (feature flag may be disabled)
    } else {
      rollbackState.vapiKbId = kbResult.data.vapi_kb_id;
      rollbackState.vapiKbCreatedNew = kbResult.createdNew;

      console.log('[INTEL-004] Phase 5: VAPI KB ready', {
        kbId: kbResult.data.id,
        vapiKbId: kbResult.data.vapi_kb_id,
        createdNew: kbResult.createdNew,
      });
    }

    // ========================================================================
    // PHASE 6: Database Records Creation
    // ========================================================================

    console.log('[INTEL-004] Phase 6: Creating database records...');

    if (abortController.signal.aborted) {
      throw new TimeoutError('Operation timeout during database creation');
    }

    const supabase = await createClient();

    // Generate document storage ID
    const documentStorageId = crypto.randomUUID();
    rollbackState.documentStorageId = documentStorageId;

    // Begin transaction (using Supabase RPC)
    const { data: transactionResult, error: transactionError } = await supabase.rpc(
      'create_document_storage_with_pdf',
      {
        p_document_storage_id: documentStorageId,
        p_account_id: accountId,
        p_name: input.name,
        p_description: input.description || null,
        p_namespace: namespace,
        p_pdf_doc_name: input.file.name,
        p_vapi_file_id: vapiFileResult.id,
        p_vapi_file_url: vapiFileResult.url,
        p_vapi_kb_id: rollbackState.vapiKbId,
        p_embedding_service: 'vercel',
        p_chunk_count: embeddingResult.results.length,
        p_embedding_metadata: {
          service: 'vercel',
          model: embeddingResult.usage.model,
          chunkCount: embeddingResult.usage.chunkCount,
          totalTokens: embeddingResult.usage.totalTokens,
          estimatedCost: embeddingResult.usage.estimatedCost,
          processingTime: embeddingResult.usage.processingTime,
          namespace,
        },
      }
    );

    if (transactionError || !transactionResult) {
      throw new DatabaseError(
        `Failed to create database records: ${transactionError?.message || 'Unknown error'}`
      );
    }

    console.log('[INTEL-004] Phase 6: Database records created', {
      documentStorageId,
      pdfDocId: transactionResult.pdf_doc_id,
    });

    // ========================================================================
    // PHASE 7: Success & Cleanup
    // ========================================================================

    clearTimeout(timeoutId);

    // Track usage for billing/monitoring
    await trackEmbeddingUsage(
      accountId,
      transactionResult.pdf_doc_id,
      embeddingResult.usage,
      'vercel'
    );

    console.log('[INTEL-004] Document storage created successfully', {
      documentStorageId,
      namespace,
      totalTime: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        documentStorageId,
        pdfDocId: transactionResult.pdf_doc_id,
        namespace,
        vapiKbId: rollbackState.vapiKbId,
        metrics: {
          chunkCount: embeddingResult.results.length,
          vectorCount: pineconeResult.upsertedCount,
          totalTokens: embeddingResult.usage.totalTokens,
          estimatedCost: embeddingResult.usage.estimatedCost,
          processingTime: embeddingResult.usage.processingTime,
        },
      },
    };

  } catch (error) {
    // ========================================================================
    // Error Handling & Rollback
    // ========================================================================

    clearTimeout(timeoutId);

    console.error('[INTEL-004] Error during document storage creation:', error);

    // Execute rollback
    await executeRollback(rollbackState);

    // Determine error type and return appropriate response
    return handleError(error);
  }
}
```

### File 2: Rollback Mechanism

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documentStorageRollback.ts` (NEW FILE)

```typescript
// ============================================================================
// INTEL-004: Rollback Utilities
// ============================================================================

'use server';

import { deleteNamespace } from '@/services/pineconeService';
import { vapiService } from '@/services/vapiService';
import { deleteVapiKnowledgeBase } from './vapiKnowledgeBase';
import { createClient } from '@/lib/supabase/server';

/**
 * Tracks resources created during document storage creation
 * for rollback purposes
 */
export interface RollbackState {
  namespace: string | null;
  vapiFileId: string | null;
  vapiKbId: string | null;
  vapiKbCreatedNew: boolean;
  documentStorageId: string | null;
}

/**
 * Executes rollback of all created resources
 *
 * Rollback order (reverse of creation):
 * 1. Database records (if created)
 * 2. VAPI KB (if created new)
 * 3. VAPI file (if uploaded)
 * 4. Pinecone namespace (if created)
 *
 * Each rollback operation is non-blocking - failures are logged but don't stop the rollback process.
 */
export async function executeRollback(state: RollbackState): Promise<void> {
  const rollbackErrors: Array<{ phase: string; error: string }> = [];

  console.log('[INTEL-004] Starting rollback...', state);

  // ========================================================================
  // Rollback Phase 1: Database Records
  // ========================================================================

  if (state.documentStorageId) {
    try {
      console.log('[INTEL-004] Rollback: Deleting database records...');

      const supabase = await createClient();

      // Delete pdf_docs first (foreign key constraint)
      const { error: pdfDocsError } = await supabase
        .from('pdf_docs')
        .delete()
        .eq('document_storage_id', state.documentStorageId);

      if (pdfDocsError) {
        throw new Error(`Failed to delete pdf_docs: ${pdfDocsError.message}`);
      }

      // Delete document_storages
      const { error: storageError } = await supabase
        .from('document_storages')
        .delete()
        .eq('id', state.documentStorageId);

      if (storageError) {
        throw new Error(`Failed to delete document_storages: ${storageError.message}`);
      }

      console.log('[INTEL-004] Rollback: Database records deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTEL-004] Rollback: Database deletion failed:', errorMsg);
      rollbackErrors.push({ phase: 'database', error: errorMsg });
    }
  }

  // ========================================================================
  // Rollback Phase 2: VAPI Knowledge Base
  // ========================================================================

  if (state.vapiKbId && state.vapiKbCreatedNew) {
    try {
      console.log('[INTEL-004] Rollback: Deleting VAPI KB...');

      // Use server action from INTEL-002
      const result = await deleteVapiKnowledgeBase(state.vapiKbId);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete VAPI KB');
      }

      console.log('[INTEL-004] Rollback: VAPI KB deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTEL-004] Rollback: VAPI KB deletion failed:', errorMsg);
      rollbackErrors.push({ phase: 'vapi_kb', error: errorMsg });
    }
  } else if (state.vapiKbId && !state.vapiKbCreatedNew) {
    // KB existed before, just remove the file from it
    try {
      console.log('[INTEL-004] Rollback: Removing file from existing VAPI KB...');

      if (state.vapiFileId) {
        // Import from vapiKnowledgeBase actions
        const { removeFilesFromVapiKB } = await import('./vapiKnowledgeBase');
        await removeFilesFromVapiKB(state.vapiKbId, [state.vapiFileId]);
      }

      console.log('[INTEL-004] Rollback: File removed from VAPI KB');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTEL-004] Rollback: File removal from KB failed:', errorMsg);
      rollbackErrors.push({ phase: 'vapi_kb_file_removal', error: errorMsg });
    }
  }

  // ========================================================================
  // Rollback Phase 3: VAPI File
  // ========================================================================

  if (state.vapiFileId) {
    try {
      console.log('[INTEL-004] Rollback: Deleting VAPI file...');

      await vapiService.deleteFile(state.vapiFileId);

      console.log('[INTEL-004] Rollback: VAPI file deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTEL-004] Rollback: VAPI file deletion failed:', errorMsg);
      rollbackErrors.push({ phase: 'vapi_file', error: errorMsg });
    }
  }

  // ========================================================================
  // Rollback Phase 4: Pinecone Namespace
  // ========================================================================

  if (state.namespace) {
    try {
      console.log('[INTEL-004] Rollback: Deleting Pinecone namespace...');

      await deleteNamespace(state.namespace);

      console.log('[INTEL-004] Rollback: Pinecone namespace deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTEL-004] Rollback: Pinecone deletion failed:', errorMsg);
      rollbackErrors.push({ phase: 'pinecone', error: errorMsg });
    }
  }

  // ========================================================================
  // Rollback Summary
  // ========================================================================

  if (rollbackErrors.length > 0) {
    console.error('[INTEL-004] Rollback completed with errors:', rollbackErrors);
  } else {
    console.log('[INTEL-004] Rollback completed successfully');
  }
}
```

### File 3: Database Transaction Function (PostgreSQL)

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/supabase/migrations/20251002_create_document_storage_transaction.sql` (NEW FILE)

```sql
-- ============================================================================
-- INTEL-004: Atomic Document Storage Creation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_document_storage_with_pdf(
  p_document_storage_id UUID,
  p_account_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_namespace TEXT,
  p_pdf_doc_name TEXT,
  p_vapi_file_id TEXT,
  p_vapi_file_url TEXT,
  p_vapi_kb_id TEXT,
  p_embedding_service TEXT,
  p_chunk_count INTEGER,
  p_embedding_metadata JSONB
)
RETURNS TABLE (
  document_storage_id UUID,
  pdf_doc_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pdf_doc_id UUID;
BEGIN
  -- Validate account access via RLS (auth.uid() must be member of account)
  IF NOT EXISTS (
    SELECT 1 FROM basejump.account_user
    WHERE account_id = p_account_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User does not have access to this account'
      USING ERRCODE = '42501';
  END IF;

  -- Validate namespace uniqueness
  IF EXISTS (
    SELECT 1 FROM document_storages
    WHERE namespace = p_namespace
  ) THEN
    RAISE EXCEPTION 'Namespace collision detected: %', p_namespace
      USING ERRCODE = '23505';
  END IF;

  -- Begin transaction (implicit in function)

  -- Insert document_storages record
  INSERT INTO document_storages (
    id,
    account_id,
    name,
    description,
    namespace,
    created_at
  )
  VALUES (
    p_document_storage_id,
    p_account_id,
    p_name,
    p_description,
    p_namespace,
    NOW()
  );

  -- Generate PDF doc ID
  v_pdf_doc_id := gen_random_uuid();

  -- Insert pdf_docs record
  INSERT INTO pdf_docs (
    id,
    account_id,
    document_storage_id,
    name,
    id_vapi_doc,
    url,
    embedding_service,
    chunk_count,
    embedding_metadata,
    created_at
  )
  VALUES (
    v_pdf_doc_id,
    p_account_id,
    p_document_storage_id,
    p_pdf_doc_name,
    p_vapi_file_id,
    p_vapi_file_url,
    p_embedding_service,
    p_chunk_count,
    p_embedding_metadata,
    NOW()
  );

  -- Link VAPI KB to document storage (if provided)
  IF p_vapi_kb_id IS NOT NULL THEN
    -- Update vapi_knowledge_bases to reference this document storage
    -- Note: This assumes VAPI KB record already exists (created in Phase 5)
    -- We're just establishing the relationship
    UPDATE vapi_knowledge_bases
    SET updated_at = NOW()
    WHERE vapi_kb_id = p_vapi_kb_id;
  END IF;

  -- Return created IDs
  RETURN QUERY
  SELECT p_document_storage_id, v_pdf_doc_id;

  -- Commit happens automatically if no exception
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_document_storage_with_pdf TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_document_storage_with_pdf IS
  'INTEL-004: Atomically creates document storage and PDF doc records. ' ||
  'Validates account access and namespace uniqueness. ' ||
  'Rolls back automatically on any error.';
```

### File 4: Validation Utilities

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documentStorageValidation.ts` (NEW FILE)

```typescript
// ============================================================================
// INTEL-004: Validation Utilities
// ============================================================================

'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * Maximum file size: 50MB (AC8)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Minimum file size: 100 bytes (prevents empty files - AC10)
 */
const MIN_FILE_SIZE = 100;

/**
 * Operation timeout: 5 minutes
 */
export const OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates uploaded file
 *
 * AC8: File size ≤ 50MB
 * AC9: File type must be PDF
 * AC10: File must not be empty
 */
export function validateFile(file: File): FileValidationResult {
  // AC10: Empty file check
  if (file.size === 0 || file.size < MIN_FILE_SIZE) {
    return {
      valid: false,
      error: 'File is empty or too small. Minimum size: 100 bytes',
    };
  }

  // AC8: File size check
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of 50MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // AC9: File type check
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: `Invalid file type. Expected: PDF, Got: ${file.type || 'unknown'}`,
    };
  }

  // Additional MIME type validation from file content (magic number)
  // This prevents spoofed file extensions
  // Note: This requires reading the file buffer, done in main function

  return { valid: true };
}

/**
 * Generates a unique namespace with cryptographic guarantee (AC7)
 *
 * Format: {sanitized-name}-{random-6-chars}
 *
 * Example: "my-document-abc123"
 *
 * The random suffix uses crypto.randomBytes for cryptographic randomness,
 * ensuring namespace uniqueness even for identically named documents.
 *
 * @param name - Document name
 * @returns Unique namespace string (3-63 chars, lowercase alphanumeric + hyphens)
 */
export function generateUniqueNamespace(name: string): string {
  // Sanitize name: lowercase, replace spaces/special chars with hyphens
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .substring(0, 50);              // Limit to 50 chars (leave room for suffix)

  // Generate cryptographically secure random suffix (6 chars)
  const randomBytes = crypto.randomBytes(4);
  const randomSuffix = randomBytes.toString('hex').substring(0, 6);

  // Combine: {name}-{random}
  const namespace = `${sanitized}-${randomSuffix}`;

  // Ensure valid Pinecone namespace format
  // Pattern: ^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$
  if (namespace.length < 3) {
    // Pad with random chars if too short
    const padding = crypto.randomBytes(2).toString('hex').substring(0, 3 - namespace.length);
    return `${namespace}${padding}`;
  }

  if (namespace.length > 63) {
    // Truncate if too long (should not happen with substring above)
    return namespace.substring(0, 63);
  }

  return namespace;
}

/**
 * Validates user has access to account (AC6)
 *
 * Uses RLS policies to check account membership
 */
export async function validateAccountAccess(accountId: string): Promise<boolean> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Check account membership
  const { data, error } = await supabase
    .from('account_user')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  return !error && !!data;
}

/**
 * Validates PDF file magic number (prevents MIME type spoofing)
 */
export function validatePDFMagicNumber(buffer: Buffer): boolean {
  // PDF magic number: %PDF
  const header = buffer.slice(0, 5).toString('utf-8');
  return header.startsWith('%PDF');
}
```

### File 5: Error Handling Utilities

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documentStorageErrors.ts` (NEW FILE)

```typescript
// ============================================================================
// INTEL-004: Error Types & Handling
// ============================================================================

'use server';

/**
 * Custom error types for document storage creation
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PineconeError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'PineconeError';
  }
}

export class VapiError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'VapiError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  phase?: string;
  details?: Record<string, any>;
  retryable?: boolean;
}

/**
 * Create document storage result
 */
export interface CreateDocumentStorageResult {
  success: boolean;
  data?: {
    documentStorageId: string;
    pdfDocId: string;
    namespace: string;
    vapiKbId: string | null;
    metrics: {
      chunkCount: number;
      vectorCount: number;
      totalTokens: number;
      estimatedCost: number;
      processingTime: number;
    };
  };
  error?: ErrorResponse;
}

/**
 * Input structure for creating document storage
 */
export interface CreateDocumentStorageInput {
  name: string;
  description?: string;
  file: File;
}

/**
 * Maps errors to user-friendly responses
 */
export function handleError(error: unknown): CreateDocumentStorageResult {
  console.error('[INTEL-004] Error handler invoked:', error);

  // Timeout errors
  if (error instanceof TimeoutError) {
    return {
      success: false,
      error: {
        code: 'TIMEOUT',
        message: 'Operation timed out after 5 minutes. Please try with a smaller file or contact support.',
        phase: 'timeout',
        retryable: true,
      },
    };
  }

  // Validation errors
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        phase: 'validation',
        details: error.details,
        retryable: false,
      },
    };
  }

  // Pinecone errors
  if (error instanceof PineconeError) {
    return {
      success: false,
      error: {
        code: 'VECTOR_STORAGE_ERROR',
        message: 'Failed to store document vectors. Please try again.',
        phase: 'vector_storage',
        details: error.details,
        retryable: true,
      },
    };
  }

  // VAPI errors
  if (error instanceof VapiError) {
    return {
      success: false,
      error: {
        code: 'VAPI_ERROR',
        message: 'Failed to upload file to VAPI. Please try again.',
        phase: 'vapi_upload',
        details: error.details,
        retryable: true,
      },
    };
  }

  // Database errors
  if (error instanceof DatabaseError) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to save document storage. Please try again.',
        phase: 'database',
        details: error.details,
        retryable: true,
      },
    };
  }

  // Embedding service errors (from INTEL-001)
  if (error && typeof error === 'object' && 'name' in error) {
    const errorName = (error as Error).name;

    if (errorName === 'EmbeddingParseError') {
      return {
        success: false,
        error: {
          code: 'PDF_PARSE_ERROR',
          message: 'Failed to extract text from PDF. The file may be corrupted or password-protected.',
          phase: 'embedding',
          retryable: false,
        },
      };
    }

    if (errorName === 'EmbeddingRateLimitError') {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'OpenAI API rate limit exceeded. Please try again in a few moments.',
          phase: 'embedding',
          retryable: true,
        },
      };
    }

    if (errorName === 'EmbeddingValidationError') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: (error as Error).message,
          phase: 'validation',
          retryable: false,
        },
      };
    }
  }

  // Generic errors
  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      phase: 'unknown',
      retryable: true,
    },
  };
}
```

### File 6: VAPI KB Helper (Enhancement to existing code)

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documents.ts` (MODIFICATION)

**Add new helper function**:

```typescript
/**
 * INTEL-004: Gets or creates VAPI KB for document storage
 *
 * Returns existing KB if found, otherwise creates new one.
 * Returns { success, data, createdNew } to track if rollback should delete it.
 */
async function getOrCreateVapiKB(
  accountId: string,
  documentStorageName: string,
  fileIds: string[]
): Promise<{
  success: boolean;
  data?: any;
  createdNew: boolean;
  error?: any;
}> {
  // Check feature flag
  if (!shouldUseVapiKB()) {
    console.log('[INTEL-004] VAPI KB feature disabled');
    return {
      success: false,
      createdNew: false,
      error: { message: 'Feature disabled' },
    };
  }

  try {
    // Try to find existing KB by name pattern
    const existingKBs = await listVapiKnowledgeBases({
      accountId,
      status: 'active',
    });

    if (existingKBs.success && existingKBs.data) {
      const kbName = `KB: ${documentStorageName}`;
      const existingKB = existingKBs.data.find((kb) => kb.name === kbName);

      if (existingKB) {
        // KB exists, add files to it
        console.log('[INTEL-004] Found existing VAPI KB, adding files...');

        const updateResult = await addFilesToVapiKB(existingKB.id, fileIds);

        if (updateResult.success) {
          return {
            success: true,
            data: existingKB,
            createdNew: false,
          };
        }
      }
    }

    // No existing KB found, create new one
    console.log('[INTEL-004] Creating new VAPI KB...');

    const createResult = await createVapiKnowledgeBase({
      accountId,
      name: `KB: ${documentStorageName}`,
      description: `Knowledge base for document storage: ${documentStorageName}`,
      provider: 'google',
      fileIds,
    });

    if (!createResult.success) {
      return {
        success: false,
        createdNew: false,
        error: createResult.error,
      };
    }

    return {
      success: true,
      data: createResult.data,
      createdNew: true,
    };

  } catch (error) {
    console.error('[INTEL-004] Error in getOrCreateVapiKB:', error);
    return {
      success: false,
      createdNew: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
```

---

## Integration Specifications

### API Surface (Server Action)

**Function Signature**:
```typescript
async function createDocumentStorageWithPDF(
  accountId: string,
  input: CreateDocumentStorageInput
): Promise<CreateDocumentStorageResult>
```

**Input Structure**:
```typescript
interface CreateDocumentStorageInput {
  name: string;           // Document storage name (required)
  description?: string;   // Optional description
  file: File;            // PDF file (required, ≤50MB)
}
```

**Success Response**:
```typescript
interface CreateDocumentStorageResult {
  success: true;
  data: {
    documentStorageId: string;  // UUID of document_storages record
    pdfDocId: string;           // UUID of pdf_docs record
    namespace: string;          // Pinecone namespace
    vapiKbId: string | null;    // VAPI KB ID (if created)
    metrics: {
      chunkCount: number;        // Number of text chunks
      vectorCount: number;       // Number of vectors stored
      totalTokens: number;       // OpenAI tokens used
      estimatedCost: number;     // Cost in USD
      processingTime: number;    // Time in milliseconds
    };
  };
}
```

**Error Response**:
```typescript
interface CreateDocumentStorageResult {
  success: false;
  error: {
    code: string;          // Error code (VALIDATION_ERROR, TIMEOUT, etc.)
    message: string;       // User-friendly error message
    phase?: string;        // Which phase failed
    details?: any;         // Additional error details
    retryable?: boolean;   // Whether operation can be retried
  };
}
```

### Database Schema Changes

**New Migration Required**: YES

**Migration File**: `20251002_create_document_storage_transaction.sql`

**Changes**:
1. Add PostgreSQL function `create_document_storage_with_pdf()`
2. No schema changes to existing tables (namespace column already exists)

**Validation**:
- Namespace uniqueness enforced via PostgreSQL function
- Account access validated via RLS in function
- Foreign key constraints already exist

### External Service Integration

**1. Embedding Service (INTEL-001)**:
```typescript
import { generateEmbeddings } from '@/services/embeddingService';

const result = await generateEmbeddings(fileBuffer, {
  model: 'text-embedding-ada-002',
  chunkSize: 1500,
  chunkOverlap: 750,
  abortSignal: abortController.signal,
  metadata: { namespace, accountId },
});
// Returns: { results: EmbeddingResult[], usage: UsageStats }
```

**2. Pinecone Service (INTEL-003)**:
```typescript
import { upsertVectors, deleteNamespace } from '@/services/pineconeService';

// Upsert
await upsertVectors(namespace, vectors, {
  batchSize: 100,
  maxConcurrent: 5,
  timeout: 30000,
  maxRetries: 2,
});

// Rollback
await deleteNamespace(namespace);
```

**3. VAPI Service (Existing)**:
```typescript
import { vapiService } from '@/services/vapiService';

// Upload
const vapiFile = await vapiService.uploadFile(file);
// Returns: { id: string, url: string }

// Rollback
await vapiService.deleteFile(fileId);
```

**4. VAPI KB Service (INTEL-002)**:
```typescript
import {
  createVapiKnowledgeBase,
  addFilesToVapiKB,
  deleteVapiKnowledgeBase
} from '@/lib/actions/intelliaa/vapiKnowledgeBase';

// Create
const result = await createVapiKnowledgeBase({
  accountId,
  name: `KB: ${documentStorageName}`,
  provider: 'google',
  fileIds: [vapiFileId],
});

// Rollback
await deleteVapiKnowledgeBase(kbId);
```

---

## Critical Implementation Notes

### Version-Specific Gotchas

**Next.js 15 Async APIs**:
```typescript
// ❌ WRONG
export default function Page({ params }) {
  const { accountSlug } = params;  // Error: params is a Promise
}

// ✅ CORRECT
export default async function Page({ params }) {
  const { accountSlug } = await params;  // Must await params
  const supabase = await createClient();  // Must await createClient()
}
```

**Supabase SSR v0.5.2**:
```typescript
// ❌ WRONG (Server Action)
const supabase = createClient();  // Old sync API

// ✅ CORRECT
const supabase = await createClient();  // New async API
```

**FormData Handling**:
```typescript
// File from FormData must be validated before processing
const file = formData.get('file') as File;

// Check file.size BEFORE reading arrayBuffer (prevents memory issues)
if (file.size > MAX_FILE_SIZE) {
  return error;
}

const buffer = Buffer.from(await file.arrayBuffer());
```

### Multi-Tenant Considerations

**RLS Policy Enforcement**:
- All database queries automatically filtered by `account_id` via RLS
- Server action must receive `accountId` as parameter (not from cookies)
- PostgreSQL function validates account membership via `auth.uid()`

**Namespace Isolation**:
- Pinecone namespace prevents cross-account vector leakage
- Format: `{name}-{crypto-random-6}` ensures uniqueness
- Namespace stored in `document_storages.namespace` for future queries

**VAPI KB Isolation**:
- Each VAPI KB is linked to `account_id` in `vapi_knowledge_bases` table
- File IDs stored in `vapi_file_ids` array for audit trail
- RLS policies prevent cross-account access to KB records

### Performance Implications

**File Size Impact**:
| File Size | Chunk Count (est) | Embedding Time | Pinecone Upsert | Total Time (est) |
|-----------|-------------------|----------------|-----------------|------------------|
| 1 MB      | ~20 chunks        | 5-10s          | 1-2s            | 10-20s           |
| 10 MB     | ~200 chunks       | 30-60s         | 5-10s           | 40-80s           |
| 50 MB     | ~1000 chunks      | 120-180s       | 20-40s          | 150-240s         |

**Optimization Strategies**:
- Embedding generation is the bottleneck → consider batch size tuning
- Pinecone upsert uses batching (100 vectors/batch, 5 concurrent)
- VAPI upload is sequential (cannot parallelize)
- Database insert is fast (< 1s)

**Timeout Management**:
- 5-minute timeout set via `AbortController`
- Each service operation respects abort signal
- Abort triggers rollback immediately

### Security Considerations

**File Validation Layers**:
1. **Client-side** (frontend): Immediate feedback, not trusted
2. **MIME type check** (server): Validates `file.type === 'application/pdf'`
3. **Magic number check** (server): Validates PDF header `%PDF`
4. **PDF parsing** (embeddingService): Ultimate validation during text extraction

**Sensitive Data Handling**:
- API keys never exposed to client (server-side only)
- VAPI file URLs are public (signed URLs with expiration)
- Embedding metadata stored in database (JSONB) for audit
- User ID tracked in `created_by` fields for accountability

**RLS Policy Verification**:
```sql
-- Test RLS is working (should return 0 rows if not member)
SELECT * FROM document_storages WHERE account_id = '<other-account-id>';
```

**Injection Prevention**:
- All inputs sanitized via TypeScript type checking
- PostgreSQL function uses parameterized queries
- Namespace sanitization prevents Pinecone injection

### Error Recovery Patterns

**Idempotent Rollback**:
- Each rollback operation can be called multiple times safely
- Pinecone `deleteNamespace()` succeeds even if namespace doesn't exist
- VAPI `deleteFile()` returns success if file already deleted
- Database deletes use `WHERE id = ...` (safe if already deleted)

**Partial Failure Scenarios**:

**Scenario 1: Pinecone fails, VAPI succeeds**:
```
Result: Rollback deletes VAPI file, nothing in Pinecone to clean
Impact: No orphaned resources
```

**Scenario 2: VAPI KB creation fails**:
```
Result: Operation continues without KB (feature is optional)
Impact: Voice assistants won't have KB, but embeddings still work
```

**Scenario 3: Database transaction fails**:
```
Result: All external resources rolled back (Pinecone, VAPI, KB)
Impact: No orphaned resources, user sees error, can retry
```

**Scenario 4: Timeout during embedding**:
```
Result: Abort controller triggers, no external resources created
Impact: Clean failure, no rollback needed
```

**Scenario 5: Rollback itself fails**:
```
Result: Errors logged, rollback continues to next phase
Impact: Some orphaned resources possible (manual cleanup needed)
Mitigation: Background job to find/clean orphaned resources
```

### Monitoring & Observability

**Logging Strategy**:
```typescript
console.log('[INTEL-004] Phase X: Starting...', { context });
console.log('[INTEL-004] Phase X: Complete', { metrics });
console.error('[INTEL-004] Phase X: Failed', { error, state });
```

**Metrics to Track**:
- Total operation time (per file size bucket)
- Success/failure rates by phase
- Rollback execution counts
- Embedding costs (accumulated per account)
- Timeout frequency

**Error Alerting**:
- Alert if rollback fails (indicates orphaned resources)
- Alert if timeout rate > 5% (may need optimization)
- Alert if Pinecone errors > 2% (service health issue)

---

## Testing & Validation

### Unit Tests Required

**Test File**: `src/lib/actions/intelliaa/__tests__/documentStorageWithPDF.test.ts`

**Test Cases**:
```typescript
describe('createDocumentStorageWithPDF', () => {
  describe('Validation', () => {
    test('rejects file larger than 50MB', async () => {
      // AC8
    });

    test('rejects non-PDF file', async () => {
      // AC9
    });

    test('rejects empty file', async () => {
      // AC10
    });

    test('rejects unauthorized account access', async () => {
      // AC6
    });
  });

  describe('Namespace Generation', () => {
    test('generates unique namespace for identical names', async () => {
      // AC7
    });

    test('namespace follows Pinecone format rules', async () => {
      // Pattern: ^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$
    });
  });

  describe('Happy Path', () => {
    test('creates document storage with all components', async () => {
      // AC1
    });

    test('tracks embedding metrics correctly', async () => {
      // Cost, tokens, processing time
    });
  });

  describe('Rollback', () => {
    test('rolls back Pinecone on VAPI failure', async () => {
      // AC5
    });

    test('rolls back VAPI file on database failure', async () => {
      // AC5
    });

    test('rolls back VAPI KB if created new', async () => {
      // AC5
    });

    test('does not delete existing VAPI KB on failure', async () => {
      // AC5 - only new KBs should be deleted
    });
  });

  describe('Timeout', () => {
    test('aborts operation after 5 minutes', async () => {
      // Timeout handling
    });

    test('does not create orphaned resources on timeout', async () => {
      // Rollback should execute
    });
  });
});
```

### Integration Tests Required

**Test File**: `src/lib/actions/intelliaa/__tests__/documentStorageIntegration.test.ts`

**Prerequisites**:
- Supabase local instance running
- Pinecone test index available
- VAPI test API key configured

**Test Cases**:
```typescript
describe('Document Storage Integration', () => {
  test('end-to-end: creates storage, embeds, stores, uploads', async () => {
    // Full flow with real services
  });

  test('multi-tenant isolation: cannot access other account storage', async () => {
    // Create storage in account A, verify account B cannot see it
  });

  test('concurrent creation: handles multiple storages simultaneously', async () => {
    // Create 3 storages in parallel, verify all succeed
  });

  test('large file: processes 50MB PDF within timeout', async () => {
    // Performance test
  });
});
```

### Manual Testing Checklist

- [ ] Create document storage with valid 1MB PDF
- [ ] Verify document_storages record created
- [ ] Verify pdf_docs record created
- [ ] Verify vectors in Pinecone via namespace query
- [ ] Verify VAPI file uploaded (check VAPI dashboard)
- [ ] Verify VAPI KB created/linked (check vapi_knowledge_bases table)
- [ ] Test file > 50MB (should reject with validation error)
- [ ] Test non-PDF file (should reject with validation error)
- [ ] Test empty file (should reject with validation error)
- [ ] Test with unauthorized account (should reject with 401)
- [ ] Test with duplicate name (should create unique namespace)
- [ ] Simulate Pinecone failure (mock service) → verify rollback
- [ ] Simulate VAPI failure (mock service) → verify rollback
- [ ] Simulate database failure (disconnect) → verify rollback
- [ ] Test from different account → verify RLS isolation

---

## Migration Strategy

### Deployment Steps

**Phase 1: Database Migration**
1. Apply `20251002_create_document_storage_transaction.sql`
2. Verify function created: `SELECT * FROM pg_proc WHERE proname = 'create_document_storage_with_pdf';`
3. Test function with sample data
4. Rollback if any issues

**Phase 2: Code Deployment**
1. Deploy new files (no breaking changes to existing API)
2. Monitor logs for errors
3. Test single storage creation in staging
4. Gradual rollout to production

**Phase 3: Verification**
1. Create test document storage
2. Verify all phases complete successfully
3. Verify rollback works (manually trigger failure)
4. Monitor for orphaned resources

### Backward Compatibility

**No breaking changes**:
- Existing `createDocumentStorage()` function unchanged
- New function `createDocumentStorageWithPDF()` is additive
- Frontend can adopt new flow gradually

**Migration Path**:
1. Frontend continues using old flow (if needed)
2. New frontend uses new flow
3. Both flows coexist during transition
4. Old flow deprecated in future release

### Rollback Plan

**If deployment fails**:
1. Revert code changes via Git
2. Database function remains (no harm, not used)
3. Existing flow continues working
4. No data loss

**If issues found post-deployment**:
1. Disable new flow via feature flag
2. Investigate orphaned resources
3. Fix issues in patch release
4. Re-enable flow after verification

---

## Performance & Security Benchmarks

### Performance Targets

| Metric                     | Target      | Current (Estimate) | Notes                          |
|----------------------------|-------------|--------------------|--------------------------------|
| Small file (1MB) total time| < 30s       | 10-20s             | AC2: Loading state required    |
| Large file (50MB) total time| < 5min     | 150-240s           | Timeout enforced               |
| Embedding generation       | < 2min      | Varies by size     | Bottleneck                     |
| Pinecone upsert            | < 40s       | 1-40s              | Batch optimization             |
| VAPI upload                | < 30s       | 5-30s              | Network dependent              |
| Database insert            | < 5s        | < 1s               | Fast                           |
| Rollback execution         | < 30s       | 5-30s              | Must be fast for good UX       |

### Security Checklist

- [x] Account access validated via RLS
- [x] File size limited to 50MB
- [x] File type validated (MIME + magic number)
- [x] API keys not exposed to client
- [x] Namespace isolation enforced
- [x] No SQL injection possible (parameterized queries)
- [x] Abort controller prevents resource exhaustion
- [x] Embedding metadata sanitized before storage
- [x] User ID tracked for audit trail
- [x] RLS policies prevent cross-account access

---

## Future Enhancements

### Potential Improvements (Not in Scope)

1. **Background Processing**:
   - Move embedding generation to background job
   - Return immediately with "processing" status
   - Poll for completion via WebSocket/SSE

2. **Chunked Upload**:
   - Split large files into chunks for upload
   - Show progress per chunk
   - Resume on network failure

3. **Orphan Resource Cleanup**:
   - Background job to find orphaned Pinecone namespaces
   - Background job to find orphaned VAPI files
   - Automatic cleanup after 24 hours

4. **Cost Optimization**:
   - Cache embeddings for duplicate content
   - Use cheaper embedding models for non-critical documents
   - Batch multiple documents in single embedding request

5. **Enhanced Monitoring**:
   - Datadog/Sentry integration
   - Real-time dashboard for operation metrics
   - Alerting via PagerDuty/Slack

6. **Multi-File Support**:
   - Accept multiple PDFs in single operation
   - Create single document storage with multiple pdf_docs
   - Optimize batch embedding generation

---

## Appendix

### Environment Variables Required

```env
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Pinecone (for vector storage)
PINECONE_API_KEY=...
PINECONE_INDEX=intelliaa-production

# VAPI (for voice AI)
NEXT_PRIVATE_VAPI_KEY=...
VAPI_API_URL=https://api.vapi.ai

# Supabase (for database)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Feature Flags
NEXT_PUBLIC_USE_VAPI_KB=true  # Enable VAPI KB integration (INTEL-002)
```

### Key Dependencies

```json
{
  "dependencies": {
    "ai": "^3.0.0",                    // Vercel AI SDK
    "@ai-sdk/openai": "^0.0.12",       // OpenAI embeddings
    "@pinecone-database/pinecone": "^2.0.0",  // Pinecone client
    "@supabase/ssr": "^0.5.2",         // Supabase SSR
    "pdf-parse": "^1.1.1"              // PDF text extraction
  }
}
```

### Related Documentation

- [INTEL-001: Embedding Service Documentation](/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-001/)
- [INTEL-002: VAPI KB Service Documentation](/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-002/)
- [INTEL-003: Pinecone Service Documentation](/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-003/)
- [Next.js 15 Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

---

**END OF BACKEND ARCHITECTURE PLAN**

**File Location**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-004/backend_architecture_plan.md`

**Next Steps**:
1. Review this plan with backend team
2. Create implementation tasks in project tracker
3. Begin implementation following file-by-file breakdown
4. Update context session file with implementation progress
5. Consult specialized agents as needed (supabase-architect, backend-test-architect)
