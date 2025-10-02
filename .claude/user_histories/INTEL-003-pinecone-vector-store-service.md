# INTEL-003: Create Pinecone Vector Store Service

**Epic**: Backend Service Migration
**Priority**: P0 - Critical
**Estimate**: 5 points
**Labels**: backend, infrastructure, pinecone, vector-store

## User Story

As a backend developer, I want to create a Pinecone management service, so that I can store and retrieve document embeddings with namespace isolation.

## Acceptance Criteria

### AC1: Upsert Vectors with Namespace
**Given** an array of embeddings with metadata and a namespace
**When** I call `upsertVectors` with the data
**Then** the service stores vectors in Pinecone with the correct namespace isolation

### AC2: Query Vectors within Namespace
**Given** a namespace and query embedding
**When** I call `queryVectors` with the parameters
**Then** the service retrieves the top K most similar vectors only from that specific namespace

### AC3: Delete Namespace
**Given** a namespace exists in Pinecone
**When** I call `deleteNamespace` with the namespace identifier
**Then** the service removes all vectors in that namespace without affecting other namespaces

### AC4: Upsert with Deduplication
**Given** vectors with duplicate IDs are uploaded
**When** upserting to Pinecone
**Then** the service handles upsert logic correctly, updating existing vectors instead of creating duplicates

### AC5: Namespace Validation
**Given** an invalid namespace format (e.g., contains special characters)
**When** attempting any operation
**Then** the service validates namespace format and returns a descriptive error

### AC6: Batch Upsert Optimization
**Given** more than 100 vectors need to be upserted
**When** upserting
**Then** the service batches vectors into groups of 100 for optimal performance

### AC7: Index Statistics
**Given** a namespace exists
**When** I call `getNamespaceStats`
**Then** the service returns statistics including vector count and dimension size

## Technical Notes

### Implementation Details
- **Package**: Use `@pinecone-database/pinecone` SDK
- **File Location**: Create `src/services/pineconeService.ts`
- **Index**: Use existing Pinecone index from environment variables

### Dependencies to Install
```bash
npm install @pinecone-database/pinecone --legacy-peer-deps
```

### Environment Variables
```
PINECONE_API_KEY=xxx (from NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE)
PINECONE_INDEX=xxx (from NEXT_PUBLIC_PINECONE_INDEX)
PINECONE_ENVIRONMENT=xxx (e.g., us-east-1-aws)
```

### Service Interface
```typescript
import { Pinecone } from '@pinecone-database/pinecone';

interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    text: string;
    documentId: string;
    pageNumber?: number;
    chunkIndex: number;
    [key: string]: any;
  };
}

interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export async function upsertVectors(
  namespace: string,
  vectors: VectorRecord[]
): Promise<void>

export async function queryVectors(
  namespace: string,
  queryEmbedding: number[],
  topK?: number
): Promise<QueryResult[]>

export async function deleteNamespace(
  namespace: string
): Promise<void>

export async function deleteVectorsByIds(
  namespace: string,
  ids: string[]
): Promise<void>

export async function getNamespaceStats(
  namespace: string
): Promise<{
  vectorCount: number;
  dimension: number;
}>
```

### Namespace Format Validation
- Pattern: `^[a-z0-9-]+$` (lowercase alphanumeric and hyphens only)
- Length: 3-63 characters
- Must start and end with alphanumeric character
- No consecutive hyphens

### Vector ID Generation
Generate unique IDs for vectors using pattern:
```typescript
const vectorId = `${documentId}-chunk-${chunkIndex}`;
```

### Pinecone Client Initialization
```typescript
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index(process.env.PINECONE_INDEX!);
```

### Error Handling
- Connection errors: Retry with backoff
- Validation errors: Don't retry, return descriptive message
- Quota exceeded: Return clear error about plan limits
- Index not found: Check environment configuration

### Performance Considerations
- Batch upserts in groups of 100 vectors
- Use parallel requests for multiple batches (max 5 concurrent)
- Implement connection pooling for high-volume operations
- Add timeout of 30s per request

## Definition of Done

- [ ] Service file created at `src/services/pineconeService.ts`
- [ ] Pinecone SDK installed and configured
- [ ] Unit tests with mocked Pinecone client
- [ ] Integration test with real Pinecone index (manual)
- [ ] Namespace validation logic implemented
- [ ] Batch processing logic implemented
- [ ] Error handling for all failure scenarios
- [ ] Documentation with usage examples
- [ ] Code reviewed and approved
- [ ] Environment variables updated in `.env.example`

## Dependencies

- Pinecone API key and index must be configured
- Package installation must be completed
- No blocking dependencies from other stories

## Related Stories

- **Blocks**: INTEL-004 (Create Document Storage with Initial PDF)
- **Blocks**: INTEL-005 (Add PDF Documents to Existing Storage)
- **Blocks**: INTEL-006 (Delete PDF Document from Storage)
- **Related**: INTEL-001 (Vercel AI SDK Embedding Service)
