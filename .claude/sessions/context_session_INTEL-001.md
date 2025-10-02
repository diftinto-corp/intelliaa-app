# Session Context: INTEL-001 - Vercel AI SDK Embedding Service

## Feature Overview
Creating a new embedding service using Vercel AI SDK to replace Flowise dependency for document embedding generation.

## Initial Analysis

### Current State
- The application currently uses Flowise for document processing and vector embeddings
- Flowise service is located at [src/services/flowiseService.ts](src/services/flowiseService.ts)
- Documents are processed for RAG (Retrieval-Augmented Generation) functionality
- Assistants can have document stores linked via `document_storage-assistants` junction table

### Target State
- New independent embedding service using Vercel AI SDK
- Direct OpenAI integration for text-embedding-ada-002 model
- Self-contained document chunking and processing
- No external Flowise dependency for embedding generation

### Key Requirements from User Story
1. PDF file processing with buffer input
2. Document chunking (1500 chars, 750 overlap)
3. OpenAI embeddings generation (text-embedding-ada-002)
4. Retry logic with exponential backoff
5. Rate limit handling (429 status)
6. Batch processing optimization (embedMany for up to 50 chunks)
7. File type validation
8. Proper error handling

### Technical Stack
- **Package**: `ai` from Vercel AI SDK v4+
- **Provider**: `@ai-sdk/openai`
- **PDF Parser**: `pdf-parse`
- **Location**: `src/services/embeddingService.ts`

### Dependencies to Install
```bash
npm install ai @ai-sdk/openai pdf-parse --legacy-peer-deps
```

### Environment Variables Required
- `OPENAI_API_KEY` (already exists in the project)

### Architecture Considerations
1. **Next.js 15 Compatibility**: Service will be used in both Server Components and API Routes
2. **Async Pattern**: All functions must be async to work with Next.js 15
3. **Error Handling**: Must handle OpenAI API errors, rate limits, and validation
4. **Type Safety**: Full TypeScript interfaces for config and results
5. **Testing**: Unit tests with mocks + integration tests (skipped in CI)

### Integration Points
1. **Document Actions** ([src/lib/actions/intelliaa/documents.ts](src/lib/actions/intelliaa/documents.ts))
   - Will use this service when creating/updating documents
2. **Assistant Management** ([src/lib/actions/intelliaa/assistants.ts](src/lib/actions/intelliaa/assistants.ts))
   - May use embeddings for RAG functionality
3. **Potential Replacement Path**
   - Current: Flowise → Vector Store
   - New: Vercel AI SDK Embeddings → Pinecone (INTEL-003)

### Subagents to Consult
1. **backend-business-logic-architect**: For service design, error handling patterns, retry logic
2. **backend-test-architect**: For comprehensive test strategy including mocks and integration tests
3. **architecture-planner**: For integration with existing Flowise service and migration path

## Next Steps
1. Consult subagents in parallel for recommendations
2. Review and consolidate feedback
3. Create detailed implementation plan
4. Begin implementation following the plan
5. Write tests according to test strategy
6. Document usage examples

---
## Subagent Consultations

### Pending
None

### Completed
- [x] architecture-planner - Comprehensive integration strategy and migration plan documented
- [x] vercel-ai-sdk-architect - Vercel AI SDK best practices and design patterns documented
- [x] testing-strategy-planner - Complete testing implementation plan created

### Key Findings Summary

**Architecture (architecture-planner):**
- ✅ Parallel migration pattern - run alongside Flowise with feature flags
- ✅ Database-driven feature flags for gradual rollout (0% → 10% → 50% → 100%)
- ✅ Use Server Actions (not API routes) for consistency with existing patterns
- ✅ Synchronous processing for MVP (background processing deferred)
- ✅ Service-level retry only - no app-level retry needed
- ✅ Cost tracking essential - track usage per account with monthly limits

**Vercel AI SDK Design (vercel-ai-sdk-architect):**
- ✅ Use `embedMany` as primary function (not `embed`) for batch processing
- ✅ Functional service design (not class-based) for better testing and tree-shaking
- ✅ SDK's built-in retry logic handles rate limits (don't implement custom retry)
- ✅ Custom text chunking (no LangChain dependency) reduces bundle size
- ✅ Comprehensive type system with AI SDK integration
- ✅ Pinecone-ready interface design for INTEL-003

**Testing Strategy (testing-strategy-planner):**
- ✅ Vitest framework recommended (better Next.js 15 compatibility than Jest)
- ✅ Unit tests with mocked OpenAI API (~30 tests, <5 seconds)
- ✅ Integration tests with real API (local-only, ~7 tests, 2-5 minutes)
- ✅ Target coverage: >80% overall, >90% for critical paths
- ✅ 8 test fixtures for edge cases (empty, corrupted, Unicode, large PDFs)
- ✅ CI/CD split: unit tests in CI, integration tests local-only

---
## Implementation Plan

### Phase 1: Setup & Dependencies (Estimated: 30 minutes)

**1.1 Install Dependencies**
```bash
npm install ai @ai-sdk/openai pdf-parse --legacy-peer-deps
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths jsdom --legacy-peer-deps
```

**1.2 Environment Variables**
Add to `.env.local` and `.env.example`:
```bash
# Vercel AI SDK Embedding Service (INTEL-001)
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false
```

**1.3 Database Migration**
Create `supabase/migrations/YYYYMMDD_add_embedding_metadata.sql`:
```sql
ALTER TABLE pdf_docs
  ADD COLUMN IF NOT EXISTS embedding_service TEXT DEFAULT 'flowise',
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_pdf_docs_embedding_service ON pdf_docs(embedding_service);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS use_vercel_embeddings BOOLEAN DEFAULT false;

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT UNIQUE NOT NULL,
  enabled_percentage INTEGER DEFAULT 0,
  enabled_accounts UUID[] DEFAULT '{}',
  disabled_accounts UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (feature_name, enabled_percentage)
VALUES ('vercel_embeddings', 0);
```

### Phase 2: Core Service Implementation (Estimated: 3-4 hours)

**2.1 Create Type Definitions** - [src/types/embeddings.ts](src/types/embeddings.ts)
```typescript
export type EmbeddingService = 'flowise' | 'vercel';

export interface EmbeddingServiceConfig {
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small';
  chunkSize?: number;
  chunkOverlap?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    totalChunks: number;
    documentId?: string;
    [key: string]: any;
  };
}

export interface EmbeddingUsageStats {
  totalTokens: number;
  estimatedCost: number;
  processingTime: number;
}

export interface GenerateEmbeddingsResponse {
  results: EmbeddingResult[];
  usage: EmbeddingUsageStats;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public cause?: Error
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}
```

**2.2 Implement Text Chunking** - [src/services/embeddingService.ts](src/services/embeddingService.ts) (Part 1)
```typescript
interface ChunkText {
  text: string;
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
  };
}

function splitTextRecursive(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[] = ['\n\n', '\n', '. ', ' ', '']
): string[] {
  // Implementation of RecursiveCharacterTextSplitter
  // Custom implementation (no LangChain dependency)
}

async function chunkDocument(
  fileBuffer: Buffer,
  config: EmbeddingServiceConfig
): Promise<ChunkText[]> {
  // Use pdf-parse to extract text and metadata
  // Apply text chunking algorithm
  // Return chunks with metadata
}
```

**2.3 Implement Embedding Generation** - [src/services/embeddingService.ts](src/services/embeddingService.ts) (Part 2)
```typescript
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  // Validate file
  // Chunk document
  // Generate embeddings using embedMany
  // Track usage and costs
  // Return results with metadata
}
```

**2.4 Implement Error Handling**
- Custom error classes: `EmbeddingValidationError`, `EmbeddingRateLimitError`
- Error sanitization for user-facing messages
- Proper cause chain preservation

### Phase 3: Integration with Existing System (Estimated: 2-3 hours)

**3.1 Create Feature Flag Utility** - [src/lib/featureFlags.ts](src/lib/featureFlags.ts)
```typescript
export async function shouldUseVercelEmbeddings(accountId: string): Promise<boolean> {
  // Check account-specific override
  // Check global rollout percentage
  // Return decision
}
```

**3.2 Modify Document Actions** - [src/lib/actions/intelliaa/documents.ts](src/lib/actions/intelliaa/documents.ts)
Update `createDocumentStorage()` and `uploadPdf()` to:
- Check feature flag
- Route to new service if enabled
- Store metadata appropriately
- Maintain backward compatibility

**3.3 Create Usage Tracking** - [src/lib/actions/intelliaa/embeddings.ts](src/lib/actions/intelliaa/embeddings.ts)
```typescript
export async function trackEmbeddingUsage(
  accountId: string,
  documentId: string,
  usage: EmbeddingUsageStats
) {
  // Insert into embedding_usage table
  // Check monthly limits
  // Alert if threshold exceeded
}
```

### Phase 4: Testing Implementation (Estimated: 4-5 hours)

**4.1 Setup Vitest Configuration** - [vitest.config.ts](vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
    },
  },
});
```

**4.2 Create Test Fixtures** - [src/services/__tests__/fixtures/](src/services/__tests__/fixtures/)
- empty.pdf
- small.pdf (5 pages)
- medium.pdf (20 pages)
- large.pdf (100 pages)
- unicode.pdf (special characters)
- corrupted.pdf (invalid PDF)

**4.3 Write Unit Tests** - [src/services/__tests__/embeddingService.test.ts](src/services/__tests__/embeddingService.test.ts)
- File validation tests (type, size, empty, corrupted)
- Text chunking tests (algorithm, overlap, Unicode)
- PDF parsing tests (multi-page, metadata)
- Mocked OpenAI API tests (embedMany, usage tracking)
- Error handling tests (rate limits, validation, sanitization)

**4.4 Write Integration Tests** - [src/services/__tests__/embeddingService.integration.test.ts](src/services/__tests__/embeddingService.integration.test.ts)
- Real OpenAI API tests (skip in CI)
- End-to-end document processing
- Cost verification

### Phase 5: Documentation & Deployment (Estimated: 1-2 hours)

**5.1 Update .env.example**
Add all new environment variables with clear documentation

**5.2 Create Usage Documentation** - [src/services/README.md](src/services/README.md)
- Service overview
- Usage examples
- Configuration options
- Error handling guide
- Cost estimation

**5.3 Database Migration**
```bash
supabase db push
```

**5.4 Deploy with Feature Flag OFF**
```bash
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false npm run build
# Deploy to production
```

### Phase 6: Gradual Rollout (Estimated: 2-4 weeks)

**Week 1:** Enable for test accounts only
```sql
UPDATE accounts SET use_vercel_embeddings = true
WHERE email IN ('test@example.com', 'admin@example.com');
```

**Week 2:** 10% rollout
```sql
UPDATE feature_flags SET enabled_percentage = 10
WHERE feature_name = 'vercel_embeddings';
```

**Week 3:** 50% rollout (monitor errors and costs)
```sql
UPDATE feature_flags SET enabled_percentage = 50
WHERE feature_name = 'vercel_embeddings';
```

**Week 4:** 100% rollout
```sql
UPDATE feature_flags SET enabled_percentage = 100
WHERE feature_name = 'vercel_embeddings';
```

### Acceptance Criteria Checklist

From user story INTEL-001:

- [ ] AC1: Basic embedding generation with text-embedding-ada-002
- [ ] AC2: Document chunking (1500 chars, 750 overlap)
- [ ] AC3: Error handling with retry (max 3 attempts via SDK)
- [ ] AC4: Response format with proper structure
- [ ] AC5: File type validation (PDF only)
- [ ] AC6: Rate limit handling (429 with exponential backoff)
- [ ] AC7: Batch processing optimization (embedMany up to 50 chunks)

### Definition of Done

- [ ] Service file created at [src/services/embeddingService.ts](src/services/embeddingService.ts)
- [ ] Dependencies installed and configured
- [ ] Unit tests written with mock OpenAI responses
- [ ] Integration test with real OpenAI API (skipped in CI)
- [ ] Error handling tested for all failure scenarios
- [ ] Documentation added with usage examples
- [ ] Code reviewed and approved
- [ ] Environment variables documented in `.env.example`

### Rollback Plan

If issues occur during rollout:
```sql
-- Emergency rollback (one SQL query)
UPDATE feature_flags SET enabled_percentage = 0 WHERE feature_name = 'vercel_embeddings';

-- Or disable specific accounts
UPDATE accounts SET use_vercel_embeddings = false WHERE id = 'problem-account-id';
```

No data loss - Flowise path remains fully functional.

---
## Architecture & Integration Plan

### 1. Integration Strategy

#### Current Architecture Analysis
The existing system uses Flowise as an external service for:
- Document store creation (Flowise-managed metadata)
- File processing (PDF parsing, chunking, embedding generation)
- Vector storage coordination (Pinecone integration via Flowise)
- Record management (PostgreSQL record manager through Flowise)

**Key Dependencies:**
- `NEXT_PUBLIC_FLOWISE` - Flowise API endpoint
- `NEXT_PUBLIC_FLOWISE_KEY` - Flowise authentication
- `NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE` - OpenAI key used by Flowise
- `NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE` - Pinecone key used by Flowise
- `NEXT_PUBLIC_PINECONE_INDEX` - Pinecone index name

**Current Data Flow:**
```
User uploads PDF → Flowise createDocumentStore() → Flowise processFile()
  → OpenAI embeddings (via Flowise) → Pinecone (via Flowise)
  → Supabase metadata (document_storages, pdf_docs)
```

#### Recommended Integration Approach: **Parallel Migration Pattern**

The new Vercel AI SDK embedding service should run **alongside Flowise initially** for safety and gradual migration:

**Phase 1: Parallel Operation (INTEL-001)**
- New service generates embeddings independently
- Existing Flowise integration remains unchanged
- Results stored in new database fields for comparison
- Feature flag controls which service is used
- **No breaking changes to existing functionality**

**Phase 2: Vector Store Integration (INTEL-003)**
- Direct Pinecone integration replaces Flowise vector storage
- New service connects to same Pinecone index
- Namespace-based isolation maintained

**Phase 3: Complete Migration (Future)**
- Flowise dependency removed entirely
- Environment variables cleaned up
- Legacy code paths removed

#### Service Relationship with Flowise

**Option A: Parallel Services (RECOMMENDED for INTEL-001)**
```typescript
// Feature flag-based selection
const embeddingService = useNewEmbeddings
  ? await vercelEmbeddingService.generateEmbeddings(buffer, config)
  : await flowiseService.processFile(storeId, flowiseConfig);
```

**Benefits:**
- Zero risk to existing functionality
- A/B testing capability
- Gradual rollout per account/assistant
- Easy rollback if issues occur
- Can compare quality/performance side-by-side

**Implementation Location:**
- `src/services/embeddingService.ts` - New service (this story)
- `src/lib/actions/intelliaa/documents.ts` - Modified to support both paths
- Feature flag in environment: `NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false` (default)

#### Impact on Assistant Document Linking

**Current Linking:**
- `document_storage-assistants` junction table links assistants to document stores
- Assistants reference document stores by ID, not individual files
- Multiple assistants can share the same document storage

**No Changes Required:**
- Junction table structure remains identical
- Document storage ID abstraction works for both services
- Assistants don't need to know which embedding service was used
- Namespace isolation continues to work

**Data Model Compatibility:**
```sql
-- Existing structure (unchanged)
document_storages (id, account_id, name, description, namespace)
pdf_docs (id, account_id, document_storage_id, name, id_vapi_doc, url)
document_storage-assistants (document_storage, assistant)

-- New fields (additive only)
ALTER TABLE pdf_docs ADD COLUMN embedding_metadata JSONB;
ALTER TABLE pdf_docs ADD COLUMN embedding_service TEXT DEFAULT 'flowise';
ALTER TABLE pdf_docs ADD COLUMN chunk_count INTEGER;
```

### 2. Migration Path

#### Can Services Run Alongside?

**YES** - This is the recommended approach:

**Coexistence Strategy:**
1. **Infrastructure Level:**
   - Both services write to same database tables
   - New columns distinguish which service was used
   - Pinecone namespace prevents collision

2. **Application Level:**
   - Feature flag per account: `accounts` table gets `use_vercel_embeddings` column
   - Per-document tracking: `pdf_docs.embedding_service` = 'flowise' | 'vercel'
   - Runtime selection in `createDocumentStorage()` and `uploadPdf()`

3. **API Compatibility:**
   - Both services return embeddings (arrays of numbers)
   - Both respect same chunking parameters (1500 chars, 750 overlap)
   - Both use same model (text-embedding-ada-002)

#### Safest Switch Approach

**Step-by-Step Migration:**

**Week 1-2: Deploy New Service (INTEL-001)**
```typescript
// Add service but don't use it yet
export async function generateEmbeddings(file: Buffer, config?: EmbeddingServiceConfig) {
  // Implementation
}
```

**Week 3: Soft Launch with Testing Accounts**
```typescript
// In documents.ts
const account = await getAccountSettings(account_id);
const useVercelEmbeddings = account.use_vercel_embeddings || false;

if (useVercelEmbeddings) {
  // New path - Vercel AI SDK
  const embeddings = await embeddingService.generateEmbeddings(fileBuffer, {
    chunkSize: 1500,
    chunkOverlap: 750,
  });
  // Store in Supabase with embedding_service = 'vercel'
} else {
  // Existing path - Flowise (unchanged)
  await flowiseService.processFile(documentStorage.id, flowiseConfig);
}
```

**Week 4-6: Gradual Rollout**
- Enable for 10% of accounts
- Monitor error rates, performance metrics
- Compare embedding quality (if possible)
- Increase to 50%, then 100%

**Week 7+: Deprecation Planning**
- Once 100% migrated, plan Flowise removal
- Keep flag for 1-2 months for easy rollback
- Remove Flowise code in future sprint

#### Backward Compatibility Considerations

**Database Schema:**
- All new columns nullable with defaults
- No foreign key changes
- Existing queries continue to work

**API Contracts:**
- `createDocumentStorage()` signature unchanged
- `uploadPdf()` signature unchanged
- Internal implementation differs, external interface identical

**Vector Store:**
- Same Pinecone index, different namespaces if needed
- Or same namespace - embeddings are compatible (same model)
- Document deletion works regardless of source

**Rollback Plan:**
```typescript
// Emergency rollback: Set all accounts to use_vercel_embeddings = false
UPDATE accounts SET use_vercel_embeddings = false;
// No data loss - Flowise path still functional
```

### 3. Data Flow

#### Where to Trigger Embedding Generation

**Current Triggers:**
1. **New Document Storage Creation** (`createDocumentStorage`)
   - User uploads initial PDF with storage name/description
   - Location: `src/lib/actions/intelliaa/documents.ts:13`

2. **Add PDF to Existing Storage** (`uploadPdf`)
   - User adds another PDF to existing storage
   - Location: `src/lib/actions/intelliaa/documents.ts:380`

**Recommended Trigger Points (No Changes):**
- Keep same triggers - maintain UX consistency
- Embedding generation happens synchronously during upload
- User sees loading state, gets success/error feedback

**New Implementation:**
```typescript
// In createDocumentStorage()
async function createDocumentStorage(account_id: string, formData: FormData) {
  const file = formData.get("file") as File;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Feature flag check
  const useVercelEmbeddings = await shouldUseVercelEmbeddings(account_id);

  if (useVercelEmbeddings) {
    // NEW PATH: Vercel AI SDK
    const embeddings = await embeddingService.generateEmbeddings(fileBuffer, {
      model: 'text-embedding-ada-002',
      chunkSize: 1500,
      chunkOverlap: 750,
      maxRetries: 3,
    });

    // Store metadata in Supabase
    await supabase.from('pdf_docs').insert({
      id: generateId(),
      account_id,
      document_storage_id: documentStorageId,
      name: file.name,
      embedding_service: 'vercel',
      chunk_count: embeddings.length,
      embedding_metadata: {
        model: 'text-embedding-ada-002',
        totalChunks: embeddings.length,
        generatedAt: new Date().toISOString(),
      },
    });

    // TODO (INTEL-003): Store embeddings in Pinecone
    // await pineconeService.upsert(namespace, embeddings);

  } else {
    // EXISTING PATH: Flowise (unchanged)
    await flowiseService.processFile(documentStorage.id, flowiseConfig);
  }
}
```

#### Storing Embedding Results

**Immediate Storage (INTEL-001):**
```sql
-- New columns in pdf_docs table
ALTER TABLE pdf_docs ADD COLUMN IF NOT EXISTS embedding_service TEXT DEFAULT 'flowise';
ALTER TABLE pdf_docs ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE pdf_docs ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

-- Example metadata structure:
{
  "model": "text-embedding-ada-002",
  "totalChunks": 45,
  "generatedAt": "2025-10-02T12:00:00Z",
  "chunkConfig": {
    "size": 1500,
    "overlap": 750
  }
}
```

**Future Storage (INTEL-003 - Pinecone Integration):**
```typescript
// New table to track vector storage
CREATE TABLE embedding_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_doc_id UUID REFERENCES pdf_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  vector_id TEXT NOT NULL, -- Pinecone vector ID
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_embedding_vectors_pdf_doc ON embedding_vectors(pdf_doc_id);
CREATE INDEX idx_embedding_vectors_vector ON embedding_vectors(vector_id);
```

**Why Not Store Vectors in PostgreSQL?**
- Vectors are 1536 dimensions (OpenAI ada-002)
- Large storage footprint (45 chunks × 1536 floats = ~270KB per document)
- Pinecone provides optimized similarity search
- Keeps PostgreSQL focused on metadata

#### Connection to Pinecone (INTEL-003)

**Data Flow Bridge:**
```
INTEL-001 (This Story)          INTEL-003 (Future)
----------------------          ------------------
Generate embeddings    →        Store in Pinecone
Store metadata in PG   →        Link vector IDs to PG
Track chunk count      →        Enable similarity search
```

**Preparation for INTEL-003:**
```typescript
// embeddingService.ts - Design for future integration
export interface EmbeddingResult {
  text: string;
  embedding: number[]; // 1536 dimensions
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    totalChunks: number;
    documentId?: string; // For future Pinecone namespace
    [key: string]: any;
  };
}

// These results will be consumable by Pinecone service
// pineconeService.upsert(namespace, embeddings.map(e => ({
//   id: `${docId}-chunk-${e.metadata.chunkIndex}`,
//   values: e.embedding,
//   metadata: { text: e.text, ...e.metadata }
// })))
```

**Namespace Strategy:**
- Keep existing namespace pattern: `${name}-${randomId}`
- Stored in `document_storages.namespace`
- Use same namespace for both Flowise and Vercel paths
- Enables smooth migration without namespace conflicts

### 4. API Design

#### Exposure Pattern: **Server Action (Recommended)**

**Option A: Server Action (RECOMMENDED)**
```typescript
// src/lib/actions/intelliaa/embeddings.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { embeddingService } from "@/services/embeddingService";

export async function generateDocumentEmbeddings(
  account_id: string,
  file: File
) {
  // Auth check
  const supabase = await createClient();
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', account_id)
    .single();

  if (!account) throw new Error('Unauthorized');

  // Generate embeddings
  const buffer = Buffer.from(await file.arrayBuffer());
  return await embeddingService.generateEmbeddings(buffer);
}
```

**Why Server Action?**
- Consistent with existing codebase pattern (`documents.ts` uses "use server")
- Automatic RLS enforcement through Supabase client
- No new API routes needed
- Simpler error handling
- Better TypeScript integration with client components

**Option B: API Route (Alternative)**
```typescript
// src/app/api/embeddings/generate/route.ts
export async function POST(request: Request) {
  // Manual auth required
  // Manual file handling
  // More boilerplate
}
```

**Decision: Use Server Action** - Better alignment with existing architecture.

#### Authentication & Authorization

**Multi-Tenant Security:**
```typescript
// Server Action with RLS
"use server";

export async function generateDocumentEmbeddings(
  account_id: string,
  documentStorageId: string,
  file: File
) {
  const supabase = await createClient(); // Uses user's session

  // RLS policy automatically checks:
  // - User is member of account_id
  // - Document storage belongs to account_id
  const { data: storage } = await supabase
    .from('document_storages')
    .select('id')
    .eq('id', documentStorageId)
    .eq('account_id', account_id)
    .single();

  if (!storage) throw new Error('Document storage not found or unauthorized');

  // Proceed with embedding generation
  const buffer = Buffer.from(await file.arrayBuffer());
  return await embeddingService.generateEmbeddings(buffer, {
    metadata: {
      accountId: account_id,
      storageId: documentStorageId,
    }
  });
}
```

**Security Checklist:**
- ✅ RLS policies on `document_storages` table
- ✅ Account membership verified by Supabase
- ✅ File validation (type, size) in service
- ✅ Error messages don't leak sensitive info
- ✅ OpenAI API key server-side only

#### Rate Limiting Strategy

**Application-Level Rate Limiting:**

**Option 1: Per-Account Limits (RECOMMENDED)**
```typescript
// src/lib/rateLimiter.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function checkEmbeddingRateLimit(accountId: string) {
  const key = `embedding:${accountId}`;
  const limit = 50; // 50 requests per hour
  const window = 3600; // 1 hour

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, window);
  }

  if (current > limit) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  return { remaining: limit - current, resetAt: Date.now() + window * 1000 };
}

// Usage in server action
export async function generateDocumentEmbeddings(account_id: string, file: File) {
  await checkEmbeddingRateLimit(account_id);
  // ... proceed
}
```

**Option 2: Database-Based (No Redis)**
```typescript
// Using Supabase for rate limiting
const { data } = await supabase
  .from('embedding_requests')
  .select('count')
  .eq('account_id', account_id)
  .gte('created_at', new Date(Date.now() - 3600000).toISOString());

if (data.length >= 50) {
  throw new Error('Rate limit exceeded');
}

await supabase.from('embedding_requests').insert({ account_id });
```

**Option 3: OpenAI SDK Handles It (SIMPLEST for MVP)**
- OpenAI SDK has built-in retry with exponential backoff
- Service-level retry logic catches 429 errors
- No additional infrastructure needed
- **RECOMMENDED for INTEL-001** - simplest implementation

**Decision for INTEL-001:** Use Option 3 (OpenAI SDK + Service retry logic)
- Future: Add Redis-based rate limiting if abuse occurs

### 5. Configuration & Environment

#### New Environment Variables

```bash
# .env.local (and .env.example)

# ==========================================
# Vercel AI SDK Embedding Service (INTEL-001)
# ==========================================

# OpenAI API Key for direct embedding generation
# NOTE: This may be same as NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE but used directly
OPENAI_API_KEY=sk-...

# Feature flag to enable new embedding service (default: false)
# Set to 'true' to use Vercel AI SDK instead of Flowise
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false

# Optional: Custom chunk size (default: 1500)
EMBEDDING_CHUNK_SIZE=1500

# Optional: Custom chunk overlap (default: 750)
EMBEDDING_CHUNK_OVERLAP=750

# Optional: Max retries for embedding generation (default: 3)
EMBEDDING_MAX_RETRIES=3
```

#### Configuration Files to Update

**1. `.env.example`**
```bash
# Add new section for embedding service
# Document above with clear comments
```

**2. `next.config.js`** (if needed for runtime config)
```javascript
// Not needed - using environment variables directly
```

**3. `package.json`**
```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "pdf-parse": "^1.1.1"
  }
}
```

**4. Database Migration**
```sql
-- supabase/migrations/YYYYMMDD_add_embedding_metadata.sql

-- Add columns to track embedding service used
ALTER TABLE pdf_docs
  ADD COLUMN IF NOT EXISTS embedding_service TEXT DEFAULT 'flowise',
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

-- Add index for querying by service
CREATE INDEX IF NOT EXISTS idx_pdf_docs_embedding_service
  ON pdf_docs(embedding_service);

-- Add feature flag to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS use_vercel_embeddings BOOLEAN DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN pdf_docs.embedding_service IS
  'Service used to generate embeddings: flowise or vercel';
COMMENT ON COLUMN pdf_docs.embedding_metadata IS
  'Metadata about embedding generation (model, config, timestamp)';
```

**5. TypeScript Configuration**
```typescript
// src/types/embeddings.ts (new file)

export type EmbeddingService = 'flowise' | 'vercel';

export interface EmbeddingMetadata {
  model: string;
  totalChunks: number;
  generatedAt: string;
  chunkConfig: {
    size: number;
    overlap: number;
  };
  error?: string;
}

// Extend existing types
declare module '@/lib/types' {
  interface PdfDoc {
    embedding_service?: EmbeddingService;
    chunk_count?: number;
    embedding_metadata?: EmbeddingMetadata;
  }

  interface Account {
    use_vercel_embeddings?: boolean;
  }
}
```

#### Feature Flags for Gradual Rollout

**Database-Driven Flags (RECOMMENDED):**
```sql
-- Feature flag per account
ALTER TABLE accounts ADD COLUMN use_vercel_embeddings BOOLEAN DEFAULT false;

-- Can also track rollout percentage
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT UNIQUE NOT NULL,
  enabled_percentage INTEGER DEFAULT 0, -- 0-100
  enabled_accounts UUID[] DEFAULT '{}',
  disabled_accounts UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (feature_name, enabled_percentage)
VALUES ('vercel_embeddings', 0); -- Start at 0%
```

**Application Logic:**
```typescript
// src/lib/featureFlags.ts
export async function shouldUseVercelEmbeddings(accountId: string): Promise<boolean> {
  const supabase = await createClient();

  // Check account-specific override
  const { data: account } = await supabase
    .from('accounts')
    .select('use_vercel_embeddings')
    .eq('id', accountId)
    .single();

  if (account?.use_vercel_embeddings !== null) {
    return account.use_vercel_embeddings;
  }

  // Check global rollout percentage
  const { data: flag } = await supabase
    .from('feature_flags')
    .select('enabled_percentage, enabled_accounts, disabled_accounts')
    .eq('feature_name', 'vercel_embeddings')
    .single();

  if (flag?.disabled_accounts?.includes(accountId)) return false;
  if (flag?.enabled_accounts?.includes(accountId)) return true;

  // Percentage-based rollout (deterministic hash)
  const hash = hashAccountId(accountId); // Simple hash function
  return (hash % 100) < (flag?.enabled_percentage || 0);
}

function hashAccountId(accountId: string): number {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = ((hash << 5) - hash) + accountId.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

**Rollout Steps:**
```sql
-- Week 1: Enable for testing accounts
UPDATE accounts SET use_vercel_embeddings = true
WHERE email IN ('test@example.com', 'admin@example.com');

-- Week 2: 10% rollout
UPDATE feature_flags SET enabled_percentage = 10
WHERE feature_name = 'vercel_embeddings';

-- Week 3: 50% rollout
UPDATE feature_flags SET enabled_percentage = 50
WHERE feature_name = 'vercel_embeddings';

-- Week 4: 100% rollout
UPDATE feature_flags SET enabled_percentage = 100
WHERE feature_name = 'vercel_embeddings';

-- Week 8: Remove flag (future migration)
-- All accounts migrated, remove feature flag logic
```

### 6. Error Recovery

#### Partial Failure Handling

**Scenario 1: Embedding Fails Midway Through Document**

**Problem:**
- Large PDF with 100 pages → 67 chunks
- OpenAI API fails at chunk 45 due to rate limit
- Result: Partial embeddings, incomplete document

**Solution: Transactional Processing with Checkpoints**

```typescript
// embeddingService.ts
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<EmbeddingResult[]> {
  const chunks = await chunkDocument(file, config);
  const results: EmbeddingResult[] = [];
  const batchSize = 50; // OpenAI limit for embedMany

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      // Retry logic built into this function
      const embeddings = await generateBatchWithRetry(batch, config?.maxRetries || 3);
      results.push(...embeddings);

      // Optional: Save checkpoint to database
      await saveEmbeddingProgress({
        documentId: config?.metadata?.documentId,
        completedChunks: i + batch.length,
        totalChunks: chunks.length,
      });

    } catch (error) {
      // All retries exhausted
      throw new EmbeddingError(
        `Failed to generate embeddings for chunks ${i}-${i + batch.length}`,
        {
          failedBatch: i / batchSize,
          completedChunks: results.length,
          totalChunks: chunks.length,
          cause: error,
        }
      );
    }
  }

  return results;
}

async function generateBatchWithRetry(
  chunks: ChunkText[],
  maxRetries: number
): Promise<EmbeddingResult[]> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-ada-002'),
        values: chunks.map(c => c.text),
      });

      return embeddings.map((embedding, idx) => ({
        text: chunks[idx].text,
        embedding,
        metadata: chunks[idx].metadata,
      }));

    } catch (error) {
      lastError = error as Error;

      // Check if retryable
      if (isRateLimitError(error)) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }

      // Non-retryable error
      throw error;
    }
  }

  throw lastError!;
}
```

**Database Tracking:**
```sql
-- Track partial uploads for recovery
CREATE TABLE embedding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  completed_chunks INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'in_progress', 'completed', 'failed'
  error_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resume from checkpoint
SELECT * FROM embedding_progress
WHERE document_id = $1
  AND status = 'in_progress'
ORDER BY updated_at DESC
LIMIT 1;
```

**User Experience:**
```typescript
// Client-side (React component)
const [progress, setProgress] = useState({ completed: 0, total: 0 });

async function uploadDocument(file: File) {
  try {
    const result = await createDocumentStorage(accountId, formData);
    toast.success('Document uploaded successfully');
  } catch (error) {
    if (error instanceof EmbeddingError) {
      // Show partial progress
      toast.error(
        `Upload partially failed: ${error.details.completedChunks}/${error.details.totalChunks} chunks processed. ` +
        `Please retry or contact support.`
      );

      // Offer retry option
      setShowRetryButton(true);
    } else {
      toast.error('Upload failed');
    }
  }
}
```

#### Retry Strategy: Application vs Service Level

**Service-Level Retry (IMPLEMENTED in embeddingService.ts):**
```typescript
// Built into the service
const config: EmbeddingServiceConfig = {
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff
};

// Handles:
// - Transient network errors
// - OpenAI rate limits (429)
// - Temporary API unavailability (503)
```

**Application-Level Retry (OPTIONAL in documents.ts):**
```typescript
// Wrapper for entire operation
async function createDocumentStorageWithRetry(
  account_id: string,
  formData: FormData,
  maxRetries = 2
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await createDocumentStorage(account_id, formData);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Only retry on specific errors
      if (isRetryableError(error)) {
        await sleep(5000 * (attempt + 1));
        continue;
      }

      throw error;
    }
  }
}
```

**Decision for INTEL-001:**
- **Service-level retry:** REQUIRED - handles OpenAI API issues
- **Application-level retry:** OPTIONAL - may add later if needed
- **Start with service-level only** to keep complexity low

#### User Feedback Mechanisms

**Progress Indicators:**
```typescript
// Server Action with streaming progress (advanced)
export async function* generateEmbeddingsWithProgress(
  account_id: string,
  file: File
) {
  const chunks = await chunkDocument(fileBuffer, config);
  const total = chunks.length;

  for (let i = 0; i < total; i += 50) {
    yield { type: 'progress', completed: i, total };

    const batch = await generateBatch(chunks.slice(i, i + 50));

    yield { type: 'progress', completed: i + batch.length, total };
  }

  yield { type: 'complete', embeddings };
}

// Client-side
for await (const update of generateEmbeddingsWithProgress(accountId, file)) {
  if (update.type === 'progress') {
    setProgress(update.completed / update.total * 100);
  }
}
```

**Simple Feedback (RECOMMENDED for MVP):**
```typescript
// Loading state during upload
const [isUploading, setIsUploading] = useState(false);

async function handleUpload() {
  setIsUploading(true);
  try {
    await createDocumentStorage(accountId, formData);
    toast.success('Document uploaded and processed successfully');
  } catch (error) {
    toast.error('Failed to process document: ' + error.message);
  } finally {
    setIsUploading(false);
  }
}

// UI shows spinner + estimated time
{isUploading && (
  <div>Processing document (this may take 1-2 minutes)...</div>
)}
```

**Error Messages:**
```typescript
// Descriptive errors for users
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public details: {
      code: string;
      userMessage: string;
      completedChunks?: number;
      totalChunks?: number;
    }
  ) {
    super(message);
  }
}

// Usage
throw new EmbeddingError('Rate limit exceeded', {
  code: 'RATE_LIMIT',
  userMessage: 'Our AI service is currently busy. Please try again in a few minutes.',
});

throw new EmbeddingError('Invalid file', {
  code: 'INVALID_FILE',
  userMessage: 'Please upload a valid PDF file (max 10MB).',
});
```

### 7. Performance Impact

#### Expected Latency for Typical Documents

**Benchmarks (Estimated):**

**Small Document (5 pages, ~10 chunks):**
- PDF parsing: ~200ms
- Chunking: ~50ms
- Embedding generation: ~2-3 seconds (OpenAI API)
- Total: **~2.5-3.5 seconds**

**Medium Document (20 pages, ~40 chunks):**
- PDF parsing: ~500ms
- Chunking: ~100ms
- Embedding generation: ~5-8 seconds (batch processing)
- Total: **~6-9 seconds**

**Large Document (100 pages, ~200 chunks):**
- PDF parsing: ~2 seconds
- Chunking: ~500ms
- Embedding generation: ~20-30 seconds (4 batches × 50 chunks)
- Total: **~22-33 seconds**

**Comparison with Flowise:**
- Flowise adds HTTP overhead: ~500ms-1s per request
- Flowise has similar OpenAI embedding time (same API)
- **Expected improvement: 10-30% faster** (direct API calls, less network hops)

#### Background Processing vs Synchronous

**Current Pattern: Synchronous (Flowise)**
```typescript
// User waits for entire process
const result = await flowiseService.processFile(storeId, config);
// UI blocks until complete
```

**Option 1: Keep Synchronous (RECOMMENDED for MVP)**

**Pros:**
- Simpler implementation
- Immediate feedback (success/failure)
- Consistent with existing UX
- No job queue infrastructure needed

**Cons:**
- User waits 5-30 seconds for large docs
- HTTP timeout risk for very large documents
- Not ideal for mobile/slow connections

**Implementation:**
```typescript
// Same as current - no changes to UX
await createDocumentStorage(accountId, formData);
```

**Option 2: Background Processing (Future Enhancement)**

**Pros:**
- Better UX for large documents
- No timeout risk
- Can process multiple documents in parallel

**Cons:**
- Requires job queue (BullMQ, Inngest, or Supabase Edge Functions)
- More complex error handling
- Need websocket/polling for status updates

**Implementation (Future):**
```typescript
// Enqueue job
const jobId = await embeddingQueue.add({
  accountId,
  documentId,
  fileUrl,
});

// Return immediately
return { status: 'processing', jobId };

// Client polls for status
const interval = setInterval(async () => {
  const status = await getEmbeddingStatus(jobId);
  if (status === 'completed') {
    clearInterval(interval);
    toast.success('Document ready!');
  }
}, 2000);
```

**Decision for INTEL-001:**
- Start with **synchronous processing**
- Add timeout safeguards (5-minute Next.js route timeout)
- Future: Move to background processing if users complain

#### Cost Implications (OpenAI API Calls)

**Pricing (OpenAI text-embedding-ada-002):**
- $0.0001 per 1,000 tokens
- ~750 tokens per chunk (1500 chars ÷ 2)

**Cost per Document:**
- Small (10 chunks): 10 × 750 = 7,500 tokens = **$0.00075** (~$0.0008)
- Medium (40 chunks): 40 × 750 = 30,000 tokens = **$0.003**
- Large (200 chunks): 200 × 750 = 150,000 tokens = **$0.015**

**Monthly Cost Estimates:**
- 100 medium docs/month: **$0.30**
- 1,000 medium docs/month: **$3.00**
- 10,000 medium docs/month: **$30.00**

**Comparison with Flowise:**
- **Same cost** - both use OpenAI API
- Flowise may charge hosting fee (depends on plan)
- **Potential savings:** Eliminate Flowise subscription if that exists

**Optimization Strategies:**
```typescript
// 1. Cache frequently embedded documents
const cachedEmbedding = await getCachedEmbedding(fileHash);
if (cachedEmbedding) return cachedEmbedding;

// 2. Deduplicate chunks (if same text appears multiple times)
const uniqueChunks = deduplicateChunks(chunks);

// 3. Use smaller chunks for less important documents
const config = document.isPremium ?
  { chunkSize: 1500 } :
  { chunkSize: 1000 }; // ~33% cost reduction

// 4. Rate limiting prevents abuse
await checkEmbeddingRateLimit(accountId);
```

**Monitoring:**
```sql
-- Track usage per account
CREATE TABLE embedding_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  document_id UUID,
  total_chunks INTEGER,
  estimated_tokens INTEGER,
  estimated_cost NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly report
SELECT
  account_id,
  COUNT(*) as total_documents,
  SUM(total_chunks) as total_chunks,
  SUM(estimated_cost) as total_cost
FROM embedding_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY account_id
ORDER BY total_cost DESC;
```

**Decision for INTEL-001:**
- Track usage in database
- Set per-account monthly limits (e.g., 1000 chunks/month for free tier)
- Alert if cost exceeds $50/month per account

---

## Critical Implementation Notes

### Next.js 15 Compatibility Considerations

**1. Async Server Actions:**
```typescript
// CORRECT: Server actions must be async
"use server";

export async function generateEmbeddings(file: File) {
  const supabase = await createClient(); // Must await
  // ... implementation
}
```

**2. File Handling in Server Components:**
```typescript
// Files from FormData are already File objects
const file = formData.get("file") as File;
const buffer = Buffer.from(await file.arrayBuffer()); // Works in Node.js runtime
```

**3. Import Restrictions:**
```typescript
// ❌ WRONG: Can't import 'fs' in edge runtime
import fs from 'fs';

// ✅ CORRECT: Use Buffer for file processing
const buffer = Buffer.from(await file.arrayBuffer());
```

### Multi-Tenant RLS Policy Enforcement

**Critical: All Embedding Operations Must Respect RLS**

```sql
-- Verify RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('document_storages', 'pdf_docs');

-- Required policies:
-- 1. Users can only read documents from their accounts
-- 2. Users can only insert documents to their accounts
-- 3. Service role can bypass for admin operations
```

**Application Code:**
```typescript
// ALWAYS use user's Supabase client (not service role)
const supabase = await createClient(); // From server.ts - has user context

// This query automatically filtered by RLS
const { data } = await supabase
  .from('document_storages')
  .select('*')
  .eq('account_id', account_id); // RLS ensures user has access
```

### Breaking Changes from Flowise

**What Changes:**
1. **API calls:** Direct to OpenAI instead of Flowise proxy
2. **Error formats:** OpenAI errors vs Flowise errors
3. **Metadata structure:** Different JSON schema
4. **Processing time:** Slightly different (faster expected)

**What Stays the Same:**
1. **Database schema:** Same tables, only new columns added
2. **User API:** Same server action signatures
3. **UI:** No changes to upload flow
4. **Results:** Same embedding model, same vector dimensions

**Migration Checklist:**
```typescript
// Before deploying:
✅ Feature flag defaulted to false
✅ Database migration applied
✅ Environment variables set
✅ RLS policies tested
✅ Error handling tested with mock failures
✅ Rollback plan documented

// After deploying:
✅ Monitor error rates
✅ Compare embedding quality (spot check)
✅ Track API costs
✅ Gradual rollout (10% → 50% → 100%)
```

### Performance Optimization Opportunities

**1. Parallel Batch Processing:**
```typescript
// Process multiple documents in parallel
const results = await Promise.all(
  files.map(file => generateEmbeddings(file, config))
);
```

**2. Streaming Responses (Future):**
```typescript
// Stream chunks as they're embedded
for await (const chunk of generateEmbeddingsStream(file)) {
  yield chunk; // Send to client progressively
}
```

**3. Edge Function Deployment (Future):**
```typescript
// Deploy embedding service to Vercel Edge for lower latency
export const config = { runtime: 'edge' };
```

### Security Hardening Checklist

**1. Input Validation:**
```typescript
// File type whitelist
const ALLOWED_TYPES = ['application/pdf'];
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Only PDF files allowed');
}

// File size limit
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_SIZE) {
  throw new Error('File too large (max 10MB)');
}
```

**2. API Key Protection:**
```typescript
// ❌ NEVER expose in client
// NEXT_PUBLIC_OPENAI_API_KEY - WRONG!

// ✅ Server-side only
// OPENAI_API_KEY - CORRECT
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Server env only
});
```

**3. Rate Limiting:**
```typescript
// Prevent abuse
const limit = await checkRateLimit(accountId);
if (limit.exceeded) {
  throw new Error('Rate limit exceeded');
}
```

**4. Error Sanitization:**
```typescript
// Don't leak sensitive info in errors
catch (error) {
  // ❌ WRONG: Exposes API key in error
  throw error;

  // ✅ CORRECT: Sanitized error
  throw new Error('Failed to generate embeddings. Please try again.');

  // Log full error server-side
  console.error('[Embedding Error]', error);
}
```

### Deployment Strategy

**1. Database Migration First:**
```bash
# Apply schema changes before code deploy
supabase db push
```

**2. Code Deployment:**
```bash
# Deploy with feature flag off
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=false npm run build
vercel deploy --prod
```

**3. Gradual Activation:**
```sql
-- Enable for test accounts
UPDATE accounts SET use_vercel_embeddings = true
WHERE email = 'test@example.com';

-- Monitor for 24 hours

-- Increase to 10%
UPDATE feature_flags SET enabled_percentage = 10;

-- Monitor for 1 week

-- Full rollout
UPDATE feature_flags SET enabled_percentage = 100;
```

**4. Rollback Procedure:**
```sql
-- Emergency rollback
UPDATE feature_flags SET enabled_percentage = 0;
-- OR
UPDATE accounts SET use_vercel_embeddings = false;

-- All new requests use Flowise
-- No data loss - just switch back
```

---

---

## Vercel AI SDK Design Recommendations

### Date: 2025-10-02
### Reviewed by: vercel-ai-sdk-architect

Based on the latest Vercel AI SDK documentation (v4+), official patterns, and project requirements, here are comprehensive design recommendations for the embedding service implementation.

---

## 1. Vercel AI SDK Best Practices

### 1.1 `embed` vs `embedMany` - When to Use Each

**Official Guidance from SDK:**

```typescript
// Use `embed` for SINGLE values
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embedding } = await embed({
  model: openai.textEmbeddingModel('text-embedding-3-small'),
  value: 'sunny day at the beach',
});
```

```typescript
// Use `embedMany` for BATCH processing (RAG use cases)
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embeddings } = await embedMany({
  model: openai.textEmbeddingModel('text-embedding-3-small'),
  values: [
    'sunny day at the beach',
    'rainy afternoon in the city',
    'snowy night in the mountains',
  ],
});
```

**RECOMMENDATION for INTEL-001:**

**Use `embedMany` as the PRIMARY function** because:
1. Document processing ALWAYS results in multiple chunks (even small PDFs have 5+ chunks)
2. OpenAI's API supports batch processing up to 2,048 embeddings per request
3. SDK optimizes network calls automatically
4. Better performance and cost efficiency
5. Built-in parallel processing support

**Implementation Pattern:**
```typescript
// src/services/embeddingService.ts

import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<EmbeddingResult[]> {
  // 1. Parse PDF and extract text
  const pdfText = await parsePDF(file);

  // 2. Chunk text into segments
  const chunks = chunkText(pdfText, {
    chunkSize: config?.chunkSize || 1500,
    chunkOverlap: config?.chunkOverlap || 750,
  });

  // 3. Use embedMany for batch processing
  const { embeddings, usage } = await embedMany({
    model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
    values: chunks.map(chunk => chunk.text),
    maxRetries: config?.maxRetries || 2, // SDK default
    abortSignal: config?.abortSignal,
  });

  // 4. Combine embeddings with chunk metadata
  return embeddings.map((embedding, index) => ({
    text: chunks[index].text,
    embedding,
    metadata: {
      chunkIndex: index,
      totalChunks: chunks.length,
      pageNumber: chunks[index].pageNumber,
    },
  }));
}
```

**Key Insight:** The SDK documentation specifically mentions RAG as a use case for `embedMany`:
> "When loading data, e.g. when preparing a data store for retrieval-augmented generation (RAG), it is often useful to embed many values at once (batch embedding)."

---

### 1.2 OpenAI Provider Configuration Patterns

**Official Provider Setup:**

```typescript
// RECOMMENDED: Configure provider once, reuse across service
import { openai } from '@ai-sdk/openai';

// Option 1: Use environment variable (RECOMMENDED)
// Automatically reads OPENAI_API_KEY from process.env
const embeddingModel = openai.textEmbeddingModel('text-embedding-ada-002');

// Option 2: Explicit API key (for testing or multiple keys)
import { createOpenAI } from '@ai-sdk/openai';

const customOpenAI = createOpenAI({
  apiKey: process.env.CUSTOM_OPENAI_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // Optional: for Azure or proxies
});

const model = customOpenAI.textEmbeddingModel('text-embedding-ada-002');
```

**RECOMMENDATION for INTEL-001:**

**Use the simple `openai` import with environment variables:**

```typescript
// src/services/embeddingService.ts
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

// Create model instance (lightweight, can be called multiple times)
function getEmbeddingModel(modelName: string = 'text-embedding-ada-002') {
  return openai.textEmbeddingModel(modelName);
}

// Use in service
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<EmbeddingResult[]> {
  const model = getEmbeddingModel(config?.model);

  const { embeddings, usage } = await embedMany({
    model,
    values: chunkTexts,
    maxRetries: config?.maxRetries || 2,
  });

  // Track usage for cost monitoring
  console.log(`Embedding tokens used: ${usage.tokens}`);

  return embeddings;
}
```

**Why this pattern:**
- ✅ Simple and idiomatic
- ✅ Automatically uses `OPENAI_API_KEY` env variable
- ✅ No manual client management
- ✅ Easy to test with mocks
- ✅ Follows official SDK examples

**Model Options for Future:**
```typescript
// Current: text-embedding-ada-002 (1536 dimensions, $0.0001/1K tokens)
openai.textEmbeddingModel('text-embedding-ada-002')

// Future upgrade: text-embedding-3-small (same dimensions, better quality)
openai.textEmbeddingModel('text-embedding-3-small')

// Future upgrade: text-embedding-3-large (3072 dimensions, highest quality)
openai.textEmbeddingModel('text-embedding-3-large')
```

---

### 1.3 Error Handling Specific to Vercel AI SDK

**Official Error Handling Pattern:**

The SDK documentation shows that errors should be handled with `try/catch`:

```typescript
import { embedMany } from 'ai';

try {
  const { embeddings } = await embedMany({
    model: openai.textEmbeddingModel('text-embedding-ada-002'),
    values: chunks,
  });
} catch (error) {
  // Handle error
  console.error('Embedding failed:', error);
}
```

**SDK Error Types (from @ai-sdk/core):**

```typescript
// Import error types for type-safe error handling
import {
  APICallError,
  InvalidResponseDataError,
  RetryError,
} from '@ai-sdk/core';

// Type-safe error handling
try {
  const { embeddings } = await embedMany({ ... });
} catch (error) {
  if (error instanceof APICallError) {
    // Network or API errors (429, 500, etc.)
    console.error('API Error:', error.statusCode, error.message);

    // Check for rate limiting
    if (error.statusCode === 429) {
      // Rate limit exceeded
      throw new EmbeddingRateLimitError('OpenAI rate limit exceeded', error);
    }
  } else if (error instanceof InvalidResponseDataError) {
    // Malformed response from API
    console.error('Invalid response:', error.message);
  } else if (error instanceof RetryError) {
    // All retries exhausted
    console.error('Retries exhausted:', error.message);
  }

  throw error;
}
```

**RECOMMENDATION for INTEL-001:**

**Create custom error classes that wrap SDK errors:**

```typescript
// src/services/embeddingService.ts

// Custom error classes
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class EmbeddingRateLimitError extends EmbeddingError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, { retryable: true });
    this.name = 'EmbeddingRateLimitError';
  }
}

export class EmbeddingValidationError extends EmbeddingError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, { retryable: false });
    this.name = 'EmbeddingValidationError';
  }
}

// Error handling in service
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<EmbeddingResult[]> {
  // Validation errors (non-retryable)
  if (!file || file.length === 0) {
    throw new EmbeddingValidationError('File buffer is empty');
  }

  if (file.length > 10 * 1024 * 1024) {
    throw new EmbeddingValidationError('File too large (max 10MB)');
  }

  try {
    const chunks = await chunkDocument(file, config);

    const { embeddings, usage } = await embedMany({
      model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
      values: chunks.map(c => c.text),
      maxRetries: config?.maxRetries || 2,
    });

    return embeddings.map((embedding, index) => ({
      text: chunks[index].text,
      embedding,
      metadata: {
        chunkIndex: index,
        totalChunks: chunks.length,
        pageNumber: chunks[index].pageNumber,
      },
    }));

  } catch (error) {
    // SDK errors are already thrown, wrap them for context
    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new EmbeddingRateLimitError(
          'OpenAI rate limit exceeded. Please try again in a few minutes.',
          error
        );
      }

      throw new EmbeddingError(
        'Failed to generate embeddings',
        error,
        { fileSize: file.length }
      );
    }

    throw error;
  }
}
```

**Why this pattern:**
- ✅ Clear error types for consumers
- ✅ Preserves original error via `cause`
- ✅ Distinguishes retryable vs non-retryable errors
- ✅ User-friendly error messages
- ✅ Server-side logs retain technical details

---

### 1.4 Type Safety with AI SDK Types

**Official SDK Type Patterns:**

```typescript
// SDK provides strong typing for embeddings
import { embedMany, type EmbedManyResult } from 'ai';

// Result type includes:
// - embeddings: number[][]
// - usage: { tokens: number }
// - response: provider-specific response object
const result: EmbedManyResult<string> = await embedMany({
  model: openai.textEmbeddingModel('text-embedding-ada-002'),
  values: ['text1', 'text2'],
});

// Embeddings are strongly typed as number[][]
const embeddings: number[][] = result.embeddings;
const tokenUsage: number = result.usage.tokens;
```

**RECOMMENDATION for INTEL-001:**

**Define comprehensive TypeScript interfaces that integrate with SDK types:**

```typescript
// src/services/embeddingService.ts
import { type EmbedManyResult } from 'ai';

// Configuration interface with sensible defaults
export interface EmbeddingServiceConfig {
  /** OpenAI model name (default: 'text-embedding-ada-002') */
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';

  /** Chunk size in characters (default: 1500) */
  chunkSize?: number;

  /** Overlap between chunks in characters (default: 750) */
  chunkOverlap?: number;

  /** Maximum retries for API calls (default: 2) */
  maxRetries?: number;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Additional metadata to attach to results */
  metadata?: Record<string, any>;
}

// Result interface with rich metadata
export interface EmbeddingResult {
  /** The chunk text that was embedded */
  text: string;

  /** The embedding vector (1536 dimensions for ada-002) */
  embedding: number[];

  /** Metadata about this embedding */
  metadata: {
    /** Index of this chunk in the document */
    chunkIndex: number;

    /** Total number of chunks in document */
    totalChunks: number;

    /** Page number in PDF (if available) */
    pageNumber?: number;

    /** Character start position in original document */
    startPosition?: number;

    /** Character end position in original document */
    endPosition?: number;

    /** Any additional custom metadata */
    [key: string]: any;
  };
}

// Usage statistics interface
export interface EmbeddingUsageStats {
  /** Total tokens used (for cost calculation) */
  totalTokens: number;

  /** Number of chunks processed */
  totalChunks: number;

  /** Estimated cost in USD */
  estimatedCost: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// Complete service response
export interface GenerateEmbeddingsResponse {
  /** Array of embedding results */
  results: EmbeddingResult[];

  /** Usage statistics */
  usage: EmbeddingUsageStats;
}

// Main service function with full type safety
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  const startTime = Date.now();

  // ... processing logic ...

  const sdkResult: EmbedManyResult<string> = await embedMany({
    model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
    values: chunks.map(c => c.text),
    maxRetries: config?.maxRetries || 2,
  });

  const results: EmbeddingResult[] = sdkResult.embeddings.map((embedding, index) => ({
    text: chunks[index].text,
    embedding,
    metadata: {
      chunkIndex: index,
      totalChunks: chunks.length,
      pageNumber: chunks[index].pageNumber,
      ...config?.metadata,
    },
  }));

  const usage: EmbeddingUsageStats = {
    totalTokens: sdkResult.usage.tokens,
    totalChunks: results.length,
    estimatedCost: (sdkResult.usage.tokens / 1000) * 0.0001, // ada-002 pricing
    processingTimeMs: Date.now() - startTime,
  };

  return { results, usage };
}
```

**Type Safety Benefits:**
- ✅ IntelliSense autocomplete for all config options
- ✅ Compile-time validation of metadata structure
- ✅ Clear documentation via JSDoc comments
- ✅ Easy to extend for future features
- ✅ Type-safe integration with Pinecone (INTEL-003)

---

## 2. Service Architecture Best Practices

### 2.1 Functional vs Class-based Service Design

**RECOMMENDATION: Functional Approach**

Based on the SDK documentation and modern TypeScript patterns, use a **functional service** design:

```typescript
// src/services/embeddingService.ts

/**
 * Embedding Service using Vercel AI SDK
 *
 * Provides document embedding generation for RAG workflows.
 * Uses OpenAI's text-embedding-ada-002 model by default.
 */

import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import pdf from 'pdf-parse';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EmbeddingServiceConfig {
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  chunkSize?: number;
  chunkOverlap?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    pageNumber?: number;
    [key: string]: any;
  };
}

export interface GenerateEmbeddingsResponse {
  results: EmbeddingResult[];
  usage: {
    totalTokens: number;
    totalChunks: number;
    estimatedCost: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<EmbeddingServiceConfig, 'abortSignal' | 'metadata'>> = {
  model: 'text-embedding-ada-002',
  chunkSize: 1500,
  chunkOverlap: 750,
  maxRetries: 2,
};

const PRICING_PER_1K_TOKENS = 0.0001; // ada-002 pricing

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate embeddings for a PDF document
 *
 * @param file - PDF file as Buffer
 * @param config - Optional configuration
 * @returns Embedding results and usage statistics
 */
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate input
  validateFileInput(file);

  // Parse PDF
  const pdfData = await parsePDF(file);

  // Chunk text
  const chunks = chunkText(pdfData.text, {
    chunkSize: mergedConfig.chunkSize,
    chunkOverlap: mergedConfig.chunkOverlap,
    pageBreaks: pdfData.pageBreaks,
  });

  // Generate embeddings using AI SDK
  const { embeddings, usage } = await embedMany({
    model: openai.textEmbeddingModel(mergedConfig.model),
    values: chunks.map(c => c.text),
    maxRetries: mergedConfig.maxRetries,
    abortSignal: config?.abortSignal,
  });

  // Combine results with metadata
  const results: EmbeddingResult[] = embeddings.map((embedding, index) => ({
    text: chunks[index].text,
    embedding,
    metadata: {
      chunkIndex: index,
      totalChunks: chunks.length,
      pageNumber: chunks[index].pageNumber,
      ...config?.metadata,
    },
  }));

  return {
    results,
    usage: {
      totalTokens: usage.tokens,
      totalChunks: results.length,
      estimatedCost: (usage.tokens / 1000) * PRICING_PER_1K_TOKENS,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS (Internal)
// ============================================================================

function validateFileInput(file: Buffer): void {
  if (!file || file.length === 0) {
    throw new EmbeddingValidationError('File buffer is empty');
  }

  if (file.length > 10 * 1024 * 1024) {
    throw new EmbeddingValidationError('File too large (max 10MB)');
  }
}

async function parsePDF(file: Buffer): Promise<{ text: string; pageBreaks: number[] }> {
  // Implementation...
}

function chunkText(text: string, options: ChunkOptions): Chunk[] {
  // Implementation...
}
```

**Why Functional > Class-based:**
- ✅ Simpler to test (no `this` context issues)
- ✅ Tree-shakeable (Next.js can optimize bundle)
- ✅ Easier to compose and reuse functions
- ✅ Matches SDK's functional API style
- ✅ No state management complexity
- ✅ Better for server-side environments (stateless)

---

### 2.2 Configuration Management with Defaults

**RECOMMENDATION: Merged Configuration Pattern**

```typescript
// Define defaults as a constant
const DEFAULT_CONFIG: Required<Omit<EmbeddingServiceConfig, 'abortSignal' | 'metadata'>> = {
  model: 'text-embedding-ada-002',
  chunkSize: 1500,
  chunkOverlap: 750,
  maxRetries: 2,
};

// Merge with user-provided config
export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  // Merge configs with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Use merged config throughout
  const chunks = chunkText(text, {
    chunkSize: mergedConfig.chunkSize,
    chunkOverlap: mergedConfig.chunkOverlap,
  });
}
```

**Environment Variable Override:**

```typescript
// Allow environment variables to override defaults
const DEFAULT_CONFIG: Required<Omit<EmbeddingServiceConfig, 'abortSignal' | 'metadata'>> = {
  model: (process.env.EMBEDDING_MODEL as any) || 'text-embedding-ada-002',
  chunkSize: Number(process.env.EMBEDDING_CHUNK_SIZE) || 1500,
  chunkOverlap: Number(process.env.EMBEDDING_CHUNK_OVERLAP) || 750,
  maxRetries: Number(process.env.EMBEDDING_MAX_RETRIES) || 2,
};
```

---

### 2.3 Performance Optimization for Batch Processing

**SDK Built-in Optimization:**

The `embedMany` function has built-in optimizations:

```typescript
// From SDK docs: Parallel processing support
const { embeddings, usage } = await embedMany({
  model: openai.textEmbeddingModel('text-embedding-ada-002'),
  values: chunks.map(c => c.text),
  maxParallelCalls: 2, // Control concurrency (default: 1)
});
```

**RECOMMENDATION for INTEL-001:**

**For initial implementation, use SDK defaults (no `maxParallelCalls`):**

```typescript
// PHASE 1: Simple implementation
const { embeddings, usage } = await embedMany({
  model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
  values: chunks.map(c => c.text),
  maxRetries: config?.maxRetries || 2,
});
```

**FUTURE OPTIMIZATION (if needed):**

```typescript
// PHASE 2: If processing is slow for large documents
const { embeddings, usage } = await embedMany({
  model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
  values: chunks.map(c => c.text),
  maxRetries: config?.maxRetries || 2,
  maxParallelCalls: 3, // Process 3 batches in parallel
});
```

**Key Insight:** OpenAI's API already supports batch processing of up to 2,048 embeddings per request. The SDK handles this automatically, so we don't need manual batching logic for documents under ~3 million characters.

---

## 3. Text Chunking Implementation

### 3.1 RecursiveCharacterTextSplitter Pattern

**RECOMMENDATION: Implement Custom Chunker (Not Using LangChain)**

Since this project doesn't use LangChain, implement a custom text splitter following the recursive character splitting pattern:

```typescript
// src/services/embeddingService.ts

interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  pageBreaks?: number[]; // Character positions where pages break
}

interface Chunk {
  text: string;
  pageNumber?: number;
  startPosition: number;
  endPosition: number;
}

/**
 * Split text into overlapping chunks using recursive character splitting
 *
 * Algorithm:
 * 1. Try to split on double newlines (\n\n)
 * 2. If chunks still too large, split on single newlines (\n)
 * 3. If still too large, split on sentences (. )
 * 4. If still too large, split on words ( )
 * 5. Last resort: split on characters
 */
function chunkText(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, chunkOverlap, pageBreaks = [] } = options;

  // Separators in order of preference
  const separators = ['\n\n', '\n', '. ', ' ', ''];

  const chunks: Chunk[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    let chunkEnd = Math.min(currentPosition + chunkSize, text.length);

    // Try to split at a natural boundary
    if (chunkEnd < text.length) {
      // Find the last occurrence of any separator within the chunk
      let bestSplit = chunkEnd;

      for (const separator of separators) {
        if (!separator) {
          // Empty separator means character-level split (fallback)
          bestSplit = chunkEnd;
          break;
        }

        const lastIndex = text.lastIndexOf(separator, chunkEnd);
        if (lastIndex > currentPosition && lastIndex <= chunkEnd) {
          bestSplit = lastIndex + separator.length;
          break;
        }
      }

      chunkEnd = bestSplit;
    }

    const chunkText = text.slice(currentPosition, chunkEnd).trim();

    if (chunkText.length > 0) {
      // Determine page number from pageBreaks
      const pageNumber = pageBreaks.findIndex(breakPos => breakPos > currentPosition) + 1 || undefined;

      chunks.push({
        text: chunkText,
        pageNumber,
        startPosition: currentPosition,
        endPosition: chunkEnd,
      });
    }

    // Move to next chunk with overlap
    currentPosition = chunkEnd - chunkOverlap;

    // Ensure we always make progress
    if (currentPosition <= chunks[chunks.length - 1]?.startPosition) {
      currentPosition = chunkEnd;
    }
  }

  return chunks;
}
```

**Why Custom Implementation:**
- ✅ No LangChain dependency (reduces bundle size)
- ✅ Full control over splitting logic
- ✅ Can optimize for PDF-specific patterns
- ✅ Easier to debug and test
- ✅ Page number tracking built-in

**Separator Priority Explanation:**
1. `\n\n` - Split on paragraphs (preserves context best)
2. `\n` - Split on lines
3. `. ` - Split on sentences
4. ` ` - Split on words
5. `''` - Character-level split (last resort)

---

### 3.2 Memory Management for Large PDFs

**RECOMMENDATION: Stream Processing is Not Needed for MVP**

For documents up to 10MB (our limit), in-memory processing is fine:

```typescript
async function parsePDF(file: Buffer): Promise<{ text: string; pageBreaks: number[] }> {
  const data = await pdf(file);

  // Extract text with page tracking
  let fullText = '';
  const pageBreaks: number[] = [];

  for (let i = 1; i <= data.numpages; i++) {
    const pageText = data.text; // pdf-parse provides full text
    // Note: pdf-parse doesn't provide per-page text directly
    // For MVP, we'll track approximate page breaks
    pageBreaks.push(fullText.length);
    fullText += pageText;
  }

  return { text: fullText, pageBreaks };
}
```

**FUTURE: If Memory Becomes an Issue (100MB+ PDFs):**

```typescript
// Use streaming PDF parsing
import { PDFExtract } from 'pdf.js-extract';

async function parsePDFStream(file: Buffer): AsyncGenerator<{ text: string; pageNumber: number }> {
  const pdfExtract = new PDFExtract();
  const data = await pdfExtract.extractBuffer(file);

  for (const page of data.pages) {
    yield {
      text: page.content.map(item => item.str).join(' '),
      pageNumber: page.pageNumber,
    };
  }
}
```

---

### 3.3 Efficient Text Processing Patterns

**Text Cleaning:**

```typescript
function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Trim
    .trim();
}
```

**Token Estimation (for cost calculation):**

```typescript
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English
  // More accurate than counting words
  return Math.ceil(text.length / 4);
}
```

---

## 4. Retry Logic with Vercel AI SDK

### 4.1 SDK Built-in Retry Mechanism

**Official SDK Behavior:**

From the documentation:
> Both `embed` and `embedMany` accept an optional `maxRetries` parameter of type `number` that you can use to set the maximum number of retries for the embedding process. **It defaults to `2` retries (3 attempts in total)**. You can set it to `0` to disable retries.

**RECOMMENDATION: Use SDK's Built-in Retry**

```typescript
// The SDK handles retries automatically!
const { embeddings, usage } = await embedMany({
  model: openai.textEmbeddingModel('text-embedding-ada-002'),
  values: chunks.map(c => c.text),
  maxRetries: 2, // 3 total attempts (1 initial + 2 retries)
});
```

**What the SDK Retries Automatically:**
- ✅ Network failures (ECONNRESET, ETIMEDOUT)
- ✅ 429 Rate Limit errors
- ✅ 500, 502, 503, 504 Server errors
- ✅ Temporary API unavailability

**What the SDK Does NOT Retry:**
- ❌ 400 Bad Request (invalid input)
- ❌ 401 Unauthorized (bad API key)
- ❌ 403 Forbidden (quota exceeded)
- ❌ 404 Not Found (invalid model)

---

### 4.2 Custom Retry Wrapper (Not Needed for INTEL-001)

**The SDK's retry logic is sufficient for our use case.** However, if you need custom retry behavior in the future:

```typescript
// FUTURE: Only if SDK retry logic is insufficient
async function embedManyWithCustomRetry(
  model: any,
  values: string[],
  maxRetries: number = 3
): Promise<EmbedManyResult<string>> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await embedMany({
        model,
        values,
        maxRetries: 0, // Disable SDK retry, use custom logic
      });
    } catch (error) {
      lastError = error as Error;

      // Custom retry decision logic
      if (shouldRetry(error, attempt)) {
        const delay = calculateBackoff(attempt);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}

function shouldRetry(error: unknown, attempt: number): boolean {
  if (!(error instanceof Error)) return false;

  // Custom retry conditions
  return (
    error.message.includes('rate limit') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNRESET')
  );
}

function calculateBackoff(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s
  return Math.min(1000 * Math.pow(2, attempt), 10000);
}
```

**DECISION for INTEL-001: Use SDK's built-in retry.**

---

### 4.3 Rate Limit Handling Strategy

**SDK Automatic Rate Limit Handling:**

The SDK automatically retries 429 errors with exponential backoff. From testing and community reports:
- First retry: ~1 second delay
- Second retry: ~2 seconds delay
- Pattern follows exponential backoff

**RECOMMENDATION: Trust the SDK + Add Application-Level Limits**

```typescript
// src/services/embeddingService.ts

export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  try {
    // SDK handles rate limit retries automatically
    const { embeddings, usage } = await embedMany({
      model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
      values: chunks.map(c => c.text),
      maxRetries: config?.maxRetries || 2, // SDK default
    });

    return { results, usage };

  } catch (error) {
    // If all retries exhausted, provide helpful error message
    if (error instanceof Error && error.message.includes('rate limit')) {
      throw new EmbeddingRateLimitError(
        'OpenAI rate limit exceeded after retries. Please try again in a few minutes.',
        error
      );
    }

    throw error;
  }
}
```

**Application-Level Rate Limiting (Optional for Future):**

```typescript
// src/lib/rateLimiter.ts (FUTURE - not needed for MVP)
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// 50 embedding requests per account per hour
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 h'),
});

export async function checkEmbeddingRateLimit(accountId: string): Promise<void> {
  const { success, remaining } = await ratelimit.limit(`embedding:${accountId}`);

  if (!success) {
    throw new EmbeddingRateLimitError(
      'Account rate limit exceeded. Maximum 50 embedding requests per hour.'
    );
  }
}
```

---

## 5. Type Safety & Interfaces

### 5.1 Complete Type System

**Recommendation: Comprehensive Type Definitions**

```typescript
// src/services/embeddingService.ts

// ============================================================================
// ERROR TYPES
// ============================================================================

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class EmbeddingValidationError extends EmbeddingError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, { retryable: false });
    this.name = 'EmbeddingValidationError';
  }
}

export class EmbeddingRateLimitError extends EmbeddingError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, { retryable: true });
    this.name = 'EmbeddingRateLimitError';
  }
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/** Supported OpenAI embedding models */
export type EmbeddingModel =
  | 'text-embedding-ada-002'      // 1536 dims, $0.0001/1K tokens
  | 'text-embedding-3-small'      // 1536 dims, $0.00002/1K tokens (cheaper!)
  | 'text-embedding-3-large';     // 3072 dims, $0.00013/1K tokens

/** Configuration for embedding service */
export interface EmbeddingServiceConfig {
  /** OpenAI embedding model (default: 'text-embedding-ada-002') */
  model?: EmbeddingModel;

  /** Chunk size in characters (default: 1500) */
  chunkSize?: number;

  /** Overlap between chunks in characters (default: 750) */
  chunkOverlap?: number;

  /** Maximum retries for API calls (default: 2 = 3 total attempts) */
  maxRetries?: number;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Additional metadata to attach to all embeddings */
  metadata?: Record<string, any>;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/** Single embedding result with metadata */
export interface EmbeddingResult {
  /** The chunk text that was embedded */
  text: string;

  /** The embedding vector (dimensions depend on model) */
  embedding: number[];

  /** Metadata about this embedding */
  metadata: {
    /** Index of this chunk in the document (0-based) */
    chunkIndex: number;

    /** Total number of chunks in the document */
    totalChunks: number;

    /** Page number in PDF (1-based, if available) */
    pageNumber?: number;

    /** Character start position in original document */
    startPosition?: number;

    /** Character end position in original document */
    endPosition?: number;

    /** Document ID (for Pinecone namespace) */
    documentId?: string;

    /** Additional custom metadata */
    [key: string]: any;
  };
}

/** Usage statistics for cost tracking */
export interface EmbeddingUsageStats {
  /** Total tokens consumed by OpenAI API */
  totalTokens: number;

  /** Number of chunks processed */
  totalChunks: number;

  /** Estimated cost in USD */
  estimatedCost: number;

  /** Total processing time in milliseconds */
  processingTimeMs: number;

  /** Model used for embeddings */
  model: EmbeddingModel;
}

/** Complete response from generateEmbeddings */
export interface GenerateEmbeddingsResponse {
  /** Array of embedding results */
  results: EmbeddingResult[];

  /** Usage statistics */
  usage: EmbeddingUsageStats;
}

// ============================================================================
// INTERNAL TYPES (not exported)
// ============================================================================

interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  pageBreaks?: number[];
}

interface Chunk {
  text: string;
  pageNumber?: number;
  startPosition: number;
  endPosition: number;
}

interface PDFParseResult {
  text: string;
  pageBreaks: number[];
  metadata?: {
    title?: string;
    author?: string;
    pages?: number;
  };
}
```

---

### 5.2 Integration with Vercel AI SDK Types

```typescript
// Leverage SDK types for type safety
import { embedMany, type EmbedManyResult } from 'ai';

export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<GenerateEmbeddingsResponse> {
  // ... processing ...

  // SDK result is strongly typed
  const sdkResult: EmbedManyResult<string> = await embedMany({
    model: openai.textEmbeddingModel(config?.model || 'text-embedding-ada-002'),
    values: chunks.map(c => c.text),
  });

  // TypeScript knows:
  // - sdkResult.embeddings is number[][]
  // - sdkResult.usage.tokens is number
  // - sdkResult.response is provider-specific

  const results: EmbeddingResult[] = sdkResult.embeddings.map((embedding, index) => ({
    text: chunks[index].text,
    embedding, // Type: number[]
    metadata: {
      chunkIndex: index,
      totalChunks: chunks.length,
      pageNumber: chunks[index].pageNumber,
    },
  }));

  return { results, usage };
}
```

---

### 5.3 Type-Safe Error Handling

```typescript
// Type guards for error handling
export function isEmbeddingError(error: unknown): error is EmbeddingError {
  return error instanceof EmbeddingError;
}

export function isRateLimitError(error: unknown): error is EmbeddingRateLimitError {
  return error instanceof EmbeddingRateLimitError;
}

export function isValidationError(error: unknown): error is EmbeddingValidationError {
  return error instanceof EmbeddingValidationError;
}

// Usage in server actions
export async function createDocumentStorage(
  account_id: string,
  formData: FormData
) {
  try {
    const file = formData.get("file") as File;
    const buffer = Buffer.from(await file.arrayBuffer());

    const response = await embeddingService.generateEmbeddings(buffer);

    return { success: true, data: response };

  } catch (error) {
    if (isValidationError(error)) {
      return { success: false, error: error.message, retryable: false };
    }

    if (isRateLimitError(error)) {
      return { success: false, error: error.message, retryable: true };
    }

    if (isEmbeddingError(error)) {
      console.error('[Embedding Error]', error.cause);
      return { success: false, error: 'Failed to process document', retryable: false };
    }

    throw error; // Unexpected error
  }
}
```

---

## 6. Future Pinecone Integration Preparation (INTEL-003)

### 6.1 Pinecone-Ready EmbeddingResult Structure

**Current Design is Already Pinecone-Compatible:**

```typescript
export interface EmbeddingResult {
  text: string;
  embedding: number[]; // ✅ Pinecone vector
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    pageNumber?: number;
    documentId?: string; // ✅ For Pinecone namespace
    [key: string]: any;  // ✅ Custom Pinecone metadata
  };
}
```

**Pinecone Upsert Mapping (INTEL-003):**

```typescript
// Future: src/services/pineconeService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import type { EmbeddingResult } from './embeddingService';

export async function upsertEmbeddings(
  namespace: string,
  embeddings: EmbeddingResult[]
): Promise<void> {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index(process.env.PINECONE_INDEX!);

  // Convert EmbeddingResult to Pinecone vectors
  const vectors = embeddings.map(result => ({
    id: `${result.metadata.documentId}-chunk-${result.metadata.chunkIndex}`,
    values: result.embedding, // ✅ Already correct format
    metadata: {
      text: result.text,
      chunkIndex: result.metadata.chunkIndex,
      totalChunks: result.metadata.totalChunks,
      pageNumber: result.metadata.pageNumber,
      // ... other metadata
    },
  }));

  await index.namespace(namespace).upsert(vectors);
}
```

**Integration Point:**

```typescript
// src/lib/actions/intelliaa/documents.ts (INTEL-004)
export async function createDocumentStorage(
  account_id: string,
  formData: FormData
) {
  // Generate embeddings
  const { results, usage } = await embeddingService.generateEmbeddings(fileBuffer);

  // Store in Supabase
  await supabase.from('pdf_docs').insert({ ... });

  // TODO (INTEL-003): Store in Pinecone
  // await pineconeService.upsertEmbeddings(namespace, results);
}
```

---

### 6.2 Vector Metadata Best Practices

**Pinecone Metadata Recommendations:**

```typescript
// Metadata to include for optimal retrieval
export interface PineconeMetadata {
  // ✅ REQUIRED for display
  text: string; // The chunk text (Pinecone has 40KB limit per metadata)

  // ✅ REQUIRED for filtering
  documentId: string;
  accountId: string;
  assistantId?: string;

  // ✅ RECOMMENDED for context
  chunkIndex: number;
  totalChunks: number;
  pageNumber?: number;

  // ✅ OPTIONAL for advanced filtering
  documentTitle?: string;
  createdAt?: string;
  fileType?: string;
}
```

**Metadata Size Limits:**
- Pinecone: 40KB per vector metadata
- Our chunk text: ~1500 characters = ~1.5KB
- Plenty of room for additional metadata

---

### 6.3 Namespace Patterns for Multi-Tenancy

**RECOMMENDATION: Account + Document Scoped Namespaces**

```typescript
// Pattern 1: Account-level namespace (CURRENT APPROACH)
const namespace = `account-${accountId}`;

// Pattern 2: Document-level namespace (MORE GRANULAR)
const namespace = `account-${accountId}-doc-${documentId}`;

// Pattern 3: Assistant-level namespace (FUTURE)
const namespace = `account-${accountId}-assistant-${assistantId}`;
```

**Tradeoffs:**

| Pattern | Pros | Cons |
|---------|------|------|
| Account-level | Simple, fewer namespaces | Harder to delete individual docs |
| Document-level | Easy deletion, isolation | More namespaces to manage |
| Assistant-level | Perfect for RAG | Complex if docs shared across assistants |

**DECISION for INTEL-001:**
Use **document-level namespaces** for better isolation and easier deletion:

```typescript
// src/lib/actions/intelliaa/documents.ts
export async function createDocumentStorage(
  account_id: string,
  name: string
) {
  const documentId = crypto.randomUUID();
  const namespace = `doc-${documentId}`;

  // Store namespace in database
  await supabase.from('document_storages').insert({
    id: documentId,
    account_id,
    name,
    namespace, // ✅ Store for future Pinecone operations
  });

  // Future: Use this namespace in Pinecone
  // await pineconeService.upsertEmbeddings(namespace, results);
}
```

---

## 7. Implementation Checklist

### Phase 1: Core Service (INTEL-001)
- [ ] Install dependencies: `ai`, `@ai-sdk/openai`, `pdf-parse`
- [ ] Create `src/services/embeddingService.ts` with type definitions
- [ ] Implement `parsePDF()` function using `pdf-parse`
- [ ] Implement `chunkText()` with recursive character splitting
- [ ] Implement `generateEmbeddings()` using AI SDK's `embedMany`
- [ ] Add custom error classes (`EmbeddingError`, `EmbeddingRateLimitError`, etc.)
- [ ] Add input validation (file type, size)
- [ ] Add usage tracking and cost estimation
- [ ] Write unit tests with mocked AI SDK calls
- [ ] Write integration test with real OpenAI API (skip in CI)
- [ ] Document usage examples in code comments

### Phase 2: Integration (INTEL-004)
- [ ] Update `src/lib/actions/intelliaa/documents.ts` to use new service
- [ ] Add feature flag: `use_vercel_embeddings` column in `accounts` table
- [ ] Add metadata columns to `pdf_docs` table
- [ ] Implement parallel service selection (Flowise vs Vercel)
- [ ] Add server action for embedding generation
- [ ] Test with sample PDFs
- [ ] Monitor OpenAI API costs

### Phase 3: Pinecone Integration (INTEL-003)
- [ ] Create `src/services/pineconeService.ts`
- [ ] Implement `upsertEmbeddings()` function
- [ ] Implement `queryEmbeddings()` function
- [ ] Implement `deleteEmbeddings()` function
- [ ] Update document deletion to clean up Pinecone
- [ ] Add Pinecone connection tests
- [ ] Update RAG workflow to use Pinecone

---

## 8. Key Takeaways & Critical Notes

### DO's ✅
1. **Use `embedMany` for all document processing** - It's designed for RAG workflows
2. **Trust the SDK's built-in retry mechanism** - It handles 429 errors automatically
3. **Use functional service design** - Simpler, more testable, better for Next.js
4. **Implement custom text chunking** - No need for LangChain dependency
5. **Track usage statistics** - Essential for cost monitoring
6. **Use type-safe error handling** - Custom error classes with helpful messages
7. **Design for Pinecone compatibility** - Structure metadata appropriately
8. **Use environment variables for API keys** - Never expose in client code

### DON'Ts ❌
1. **Don't use `embed` for single chunks** - Always batch with `embedMany`
2. **Don't implement custom retry logic** - SDK handles it better
3. **Don't use class-based service** - Functional is simpler for this use case
4. **Don't load LangChain** - We can implement chunking ourselves
5. **Don't process PDFs in-memory above 10MB** - Add file size validation
6. **Don't expose OpenAI API key to client** - Server-side only
7. **Don't skip input validation** - Validate file type and size first
8. **Don't forget usage tracking** - Monitor costs from day 1

### Performance Notes
- Small doc (5 pages): ~2.5-3.5 seconds
- Medium doc (20 pages): ~6-9 seconds
- Large doc (100 pages): ~22-33 seconds
- Cost: ~$0.003 per medium document (40 chunks)

### Security Checklist
- ✅ API key in server environment only (`OPENAI_API_KEY`)
- ✅ File type validation (PDF only)
- ✅ File size limit (10MB max)
- ✅ RLS policies on database tables
- ✅ Sanitized error messages to client
- ✅ Rate limiting (future enhancement)

---

## 9. Next Steps

1. **Review this analysis** with the implementation team
2. **Create implementation plan document** at `.claude/doc/INTEL-001/vercel_ai_sdk_implementation_plan.md`
3. **Consult backend-business-logic-architect** for service design validation
4. **Consult backend-test-architect** for comprehensive test strategy
5. **Begin implementation** following the documented patterns

---

## Testing Strategy

### Date: 2025-10-02
### Reviewed by: testing-strategy-planner

A comprehensive testing implementation plan has been created for the Vercel AI SDK embedding service. The strategy emphasizes high test coverage (>80%) with fast unit tests and real API integration tests.

**Testing Framework Decision: Vitest**
- Chosen over Jest for better Next.js 15 compatibility
- Faster execution with Vite-powered HMR
- Native TypeScript and ESM support
- Jest-compatible API for easy migration

**Testing Coverage:**

| Test Type | Count | Execution Time | Purpose |
|-----------|-------|----------------|---------|
| Unit Tests (Mocked) | ~30 tests | <5 seconds | Fast feedback, CI/CD |
| Integration Tests (Real API) | ~7 tests | 2-5 minutes | Real-world validation (local only) |
| Edge Case Tests | Included in unit | N/A | Error scenarios, boundaries |

**Key Testing Areas:**
1. **File Validation Tests** (100% coverage required)
   - PDF type validation
   - File size limits (max 10MB)
   - Empty file handling
   - Corrupted PDF detection
   - Magic number validation

2. **Text Chunking Tests** (95% coverage required)
   - Default configuration (1500 chars, 750 overlap)
   - Custom chunk sizes
   - Overlap correctness
   - Word boundary preservation
   - Unicode character handling
   - Very short/long text edge cases

3. **PDF Parsing Tests** (90% coverage required)
   - Text extraction from PDFs
   - Multi-page documents
   - Page number tracking
   - Metadata extraction
   - Corrupted PDF errors
   - Image-only PDFs (no text)

4. **OpenAI API Integration Tests** (85% coverage required)
   - Batch processing with `embedMany`
   - Correct embedding dimensions (1536)
   - Model selection (ada-002, 3-small, 3-large)
   - Usage token tracking
   - Cost estimation

5. **Retry Logic Tests** (90% coverage required)
   - Rate limit handling (429 errors)
   - Exponential backoff verification
   - Max retries exhaustion
   - Network error retries (ECONNREFUSED, ETIMEDOUT)
   - Non-retryable errors (400, 401)

6. **Error Handling Tests** (80% coverage required)
   - Descriptive error messages
   - Error sanitization (no API keys in messages)
   - Partial progress tracking on failure
   - Custom error types (EmbeddingError, EmbeddingRateLimitError)

**Mock Strategies:**

**OpenAI SDK Mocking:**
```typescript
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn(() => ({ modelId: 'text-embedding-ada-002' })),
  },
}));

vi.mock('ai', () => ({
  embedMany: vi.fn(async ({ values }) => ({
    embeddings: values.map(() => Array(1536).fill(0.5)),
    usage: { tokens: values.length * 750 },
  })),
}));
```

**PDF-Parse Mocking:**
```typescript
vi.mock('pdf-parse', () => ({
  default: vi.fn(async (buffer: Buffer) => ({
    text: 'Mocked extracted text from PDF',
    numpages: 5,
    info: { Title: 'Test Document' },
  })),
}));
```

**Test Fixtures:**
- `sample-small.pdf` - 5 pages, ~10 chunks
- `sample-medium.pdf` - 20 pages, ~40 chunks
- `sample-large.pdf` - 100 pages, ~200 chunks
- `empty.pdf` - Empty document (0 bytes)
- `corrupted.pdf` - Malformed PDF structure
- `images-only.pdf` - No extractable text
- `unicode-test.pdf` - Multi-language content (Chinese, Arabic, Emoji)
- `complex-layout.pdf` - Tables, multi-column text

**CI/CD Configuration:**

**Run in CI:**
- All unit tests (mocked OpenAI)
- Fast (<5 seconds)
- No API costs
- Coverage reporting to Codecov

**Skip in CI:**
- Integration tests (real OpenAI API)
- Require real `OPENAI_API_KEY`
- Cost money ($0.0247 estimated per run)
- Run locally only

**Environment Variables for Tests:**
```bash
# CI (.env.test)
OPENAI_API_KEY=sk-test-mock-key  # Fake key
CI=true

# Local (.env.test.local - gitignored)
OPENAI_API_KEY=sk-real-key-here  # Real key for integration tests
CI=false
```

**Installation:**
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths jsdom --legacy-peer-deps
```

**Test Commands:**
```bash
npm run test              # Run all tests (watch mode)
npm run test:coverage     # Generate coverage report
npm run test:integration  # Run integration tests (local only)
```

**Critical Notes for Implementers:**

1. **Next.js 15 Async APIs:** All Server Actions and `cookies()` calls must be awaited in tests
2. **Supabase RLS Testing:** Use user's Supabase client (not service role) to verify RLS policies
3. **Mock Cleanup:** Always use `beforeEach(() => vi.clearAllMocks())` to prevent test pollution
4. **Fake Timers:** Use `vi.useFakeTimers()` to speed up retry logic tests with exponential backoff
5. **Integration Test Costs:** Be mindful of OpenAI API costs when running integration tests locally

**Test File Structure:**
```
src/
├── services/
│   ├── embeddingService.ts
│   └── __tests__/
│       ├── embeddingService.unit.test.ts       # Unit tests (mocked)
│       ├── embeddingService.integration.test.ts # Integration tests (real API)
│       ├── fixtures/                           # Test PDF files
│       └── mocks/                              # Mock response structures
└── __tests__/
    └── setup.ts                                # Global test configuration
```

**Full Implementation Plan:**
Detailed file-by-file testing plan available at:
`/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-001/testing_implementation_plan.md`

**Performance Benchmarks:**
- Small PDF (5 pages): <5 seconds
- Medium PDF (20 pages): <15 seconds
- Large PDF (100 pages): <60 seconds
- Unit test suite: <5 seconds
- Integration test suite: 2-5 minutes

**Coverage Thresholds (vitest.config.ts):**
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

**Next Steps:**
1. Review testing plan with team
2. Install Vitest dependencies
3. Create test configuration files
4. Generate test fixtures (PDFs)
5. Implement unit tests with mocks
6. Implement integration tests (local-only)
7. Set up CI/CD pipeline with coverage reporting

---

## Implementation Log

### Phase 1: Setup & Dependencies ✅ (Completed)
**Date:** 2025-10-02
**Duration:** ~30 minutes

Dependencies installed, .env.example created, database migration created.

### Phase 2: Core Service Implementation ✅ (Completed)
**Date:** 2025-10-02
**Duration:** ~3 hours

Type definitions, embedding service with text chunking, error handling implemented.

### Phase 3: Integration ✅ (Completed)
**Date:** 2025-10-02
**Duration:** ~2 hours

Feature flags, usage tracking, document actions integration completed with fallback logic.

### Phase 4: Testing ✅ (Completed)
**Date:** 2025-10-02
**Duration:** ~2 hours

Vitest configuration, 25 unit tests with mocks, 7 integration tests, test fixtures documented.

### Phase 5: Documentation ✅ (Completed)
**Date:** 2025-10-02
**Duration:** ~1 hour

Usage guide and rollout guide created in `.claude/doc/INTEL-001/`.
