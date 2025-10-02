# Architecture Implementation Plan: Pinecone Vector Store Service (INTEL-003)

## Executive Summary

This plan outlines the implementation of a production-ready Pinecone Vector Store Service that will manage document embeddings with namespace isolation. The service will integrate with the existing Vercel AI SDK embedding service (INTEL-001/INTEL-002) and replace direct Flowise vector operations while maintaining backward compatibility with the existing namespace pattern used throughout the IntelliAA platform.

**Key Design Principles:**
- **Namespace Isolation**: Multi-tenant architecture with strict namespace validation
- **Performance Optimization**: Batch processing (100 vectors/batch), connection pooling, parallel operations (max 5 concurrent)
- **Resilience**: Comprehensive error handling, retry logic with exponential backoff, timeout management (30s)
- **Security**: API key management, input validation, sanitized error messages
- **Observability**: Detailed logging, usage statistics, operation metrics

---

## Current State Analysis

### Existing Architecture

**Embedding Generation (INTEL-001/INTEL-002):**
- Service: `src/services/embeddingService.ts`
- Uses Vercel AI SDK with OpenAI embeddings
- Produces `EmbeddingResult[]` with text, vectors, and metadata
- Supports chunk sizes: 1500 chars, overlap: 750 chars
- Models: `text-embedding-ada-002`, `text-embedding-3-small`, `text-embedding-3-large`

**Current Vector Storage (Flowise):**
- Service: `src/services/flowiseService.ts`
- Handles document store creation, file processing, and vector upserts
- Uses Pinecone indirectly through Flowise API
- Operations: `createDocumentStore()`, `processFile()`, `saveVectorStore()`, `deleteLoader()`

**Multi-Tenant System:**
- Assistant namespace pattern: `Math.random().toString(36).substring(2, 15)` (13 chars, alphanumeric)
- Namespace used for: document isolation, deletion cascades, WhatsApp bot identification
- Tables: `assistants`, `documents`, `qa_docs`, `embedded_pdfs`, `document_storage-assistants`

**Environment Variables (Available):**
```bash
NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE=pc-xxx  # Pinecone API key
NEXT_PUBLIC_PINECONE_INDEX=intelliaa-index    # Index name
# Note: PINECONE_ENVIRONMENT not in .env.example but may be needed
```

**Technology Stack:**
- Next.js 15.5.4 with App Router
- React 19.1.1
- TypeScript 5.7.2
- Node.js runtime (Vercel/Railway)
- No Pinecone SDK currently installed

### Gap Analysis

**What's Missing:**
1. Direct Pinecone integration via `@pinecone-database/pinecone` SDK
2. Namespace validation and isolation logic
3. Batch processing and concurrency control
4. Connection pooling for high-volume operations
5. Retry logic with exponential backoff for transient failures
6. Vector deduplication handling
7. Namespace statistics and monitoring
8. Type definitions for Pinecone operations
9. Comprehensive error handling for Pinecone-specific errors
10. Testing infrastructure for vector operations

**Migration Considerations:**
- Must maintain compatibility with existing namespace format (13-char alphanumeric)
- Need to validate namespace format while supporting legacy namespaces
- Must handle both Flowise and direct Pinecone operations during transition
- Should track usage and costs for migration validation

---

## Proposed Architecture

### Service Design Pattern: Singleton with Lazy Initialization

**Rationale:**
- Pinecone client initialization is expensive (API call to get index metadata)
- Multiple service calls should reuse the same client instance
- Supports connection pooling at the SDK level
- Enables graceful degradation if Pinecone is temporarily unavailable

```typescript
// Singleton pattern with lazy initialization
class PineconeVectorStore {
  private static instance: PineconeVectorStore | null = null;
  private pinecone: Pinecone | null = null;
  private index: Index | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): PineconeVectorStore {
    if (!PineconeVectorStore.instance) {
      PineconeVectorStore.instance = new PineconeVectorStore();
    }
    return PineconeVectorStore.instance;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.pinecone && this.index) return;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    // Implementation
  }
}

// Functional API exports for backward compatibility
export async function upsertVectors(...) {
  const service = PineconeVectorStore.getInstance();
  await service.initialize();
  return service.upsertVectors(...);
}
```

**Alternative Considered: Factory Pattern**
- Rejected because: Creates multiple client instances, no connection pooling benefits
- Use case: Only if we need multiple Pinecone indexes (not current requirement)

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  (Server Actions, API Routes, Document Management)              │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ├──> src/lib/actions/intelliaa/documents.ts
                │    (Document CRUD, namespace management)
                │
                ├──> src/app/api/documents/route.ts
                │    (API endpoints for document operations)
                │
                v
┌─────────────────────────────────────────────────────────────────┐
│              Vector Store Service (pineconeService.ts)           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Public API                                               │  │
│  │  - upsertVectors(namespace, vectors[])                   │  │
│  │  - queryVectors(namespace, embedding, topK)              │  │
│  │  - deleteNamespace(namespace)                            │  │
│  │  - deleteVectorsByIds(namespace, ids[])                  │  │
│  │  - getNamespaceStats(namespace)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Internal Components                                      │  │
│  │  - PineconeVectorStore (singleton class)                 │  │
│  │  - BatchProcessor (batch operations)                     │  │
│  │  - NamespaceValidator (validation logic)                 │  │
│  │  - RetryManager (exponential backoff)                    │  │
│  │  - ErrorHandler (error normalization)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────────────────────────┘
                │
                v
┌─────────────────────────────────────────────────────────────────┐
│           Pinecone SDK (@pinecone-database/pinecone)             │
│                                                                   │
│  - Pinecone Client (API authentication)                          │
│  - Index Operations (upsert, query, delete)                      │
│  - Namespace Management (isolation, statistics)                  │
│  - Built-in: Connection pooling, retry logic, rate limiting     │
└───────────────┬─────────────────────────────────────────────────┘
                │
                v
┌─────────────────────────────────────────────────────────────────┐
│                    Pinecone Cloud API                            │
│            (Serverless or Pod-based Index)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. Upsert Vectors Flow:**
```
Document Upload
    │
    ├──> embeddingService.generateEmbeddings(pdf)
    │    └──> Returns: EmbeddingResult[] with vectors & metadata
    │
    ├──> Transform to VectorRecord[]
    │    └──> Add: id, values, metadata {text, documentId, chunkIndex}
    │
    ├──> pineconeService.upsertVectors(namespace, vectors)
    │    │
    │    ├──> Validate namespace format
    │    ├──> Batch vectors (100 per batch)
    │    ├──> Process batches concurrently (max 5)
    │    │    │
    │    │    └──> For each batch:
    │    │         ├──> index.namespace(ns).upsert(batch)
    │    │         ├──> Retry on transient errors (3 attempts)
    │    │         └──> Timeout: 30s per request
    │    │
    │    └──> Return: { upsertedCount, errors[] }
    │
    └──> Update Supabase: document_storage table
         └──> Fields: vector_count, status, updated_at
```

**2. Query Vectors Flow:**
```
RAG Query Request
    │
    ├──> embeddingService.generateEmbeddings(query)
    │    └──> Returns: single embedding vector
    │
    ├──> pineconeService.queryVectors(namespace, embedding, topK=5)
    │    │
    │    ├──> Validate namespace
    │    ├──> index.namespace(ns).query({vector, topK})
    │    ├──> Retry on transient errors
    │    └──> Timeout: 30s
    │
    └──> Return: QueryResult[] {id, score, metadata}
         └──> Extract text chunks and scores
              └──> Send to LLM for answer generation
```

**3. Delete Namespace Flow:**
```
Delete Assistant/Document
    │
    ├──> pineconeService.deleteNamespace(namespace)
    │    │
    │    ├──> Validate namespace exists
    │    ├──> index.namespace(ns).deleteAll()
    │    ├──> Retry on transient errors
    │    └──> Timeout: 30s
    │
    ├──> Cascade delete from Supabase
    │    ├──> documents table (WHERE namespace = ?)
    │    ├──> qa_docs table (WHERE namespace = ?)
    │    └──> embedded_pdfs table (WHERE assistant_id = ?)
    │
    └──> Return: { deleted: true, namespace }
```

---

## Implementation Breakdown

### 1. Files to Create

#### **File: `src/services/pineconeService.ts`** (Primary Service File)

**Purpose:** Main Pinecone vector store service with all public APIs

**Complete Implementation:**

```typescript
/**
 * Pinecone Vector Store Service (INTEL-003)
 *
 * Provides direct Pinecone integration for storing and retrieving document
 * embeddings with namespace isolation. Replaces Flowise vector operations
 * while maintaining compatibility with existing multi-tenant architecture.
 *
 * Features:
 * - Namespace-based multi-tenant isolation
 * - Batch upsert optimization (100 vectors per batch)
 * - Concurrent processing (max 5 parallel requests)
 * - Retry logic with exponential backoff
 * - Connection pooling via singleton pattern
 * - Comprehensive error handling and timeout management
 */

import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import type {
  VectorRecord,
  QueryResult,
  NamespaceStats,
  UpsertResponse,
  PineconeServiceConfig,
} from '@/types/pinecone';
import {
  PineconeError,
  PineconeValidationError,
  PineconeConnectionError,
  PineconeTimeoutError,
  PineconeQuotaError,
} from '@/types/pinecone';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<PineconeServiceConfig> = {
  batchSize: 100,
  maxConcurrent: 5,
  timeout: 30000, // 30 seconds
  maxRetries: 2, // 3 total attempts
  initialRetryDelay: 1000, // 1 second
};

/**
 * Namespace validation regex
 * - Pattern: lowercase alphanumeric and hyphens only
 * - Length: 3-63 characters
 * - Must start and end with alphanumeric
 * - No consecutive hyphens
 */
const NAMESPACE_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Singleton Pinecone Vector Store Service
 *
 * Uses lazy initialization to avoid creating connections until needed.
 * Provides connection pooling and instance reuse across multiple operations.
 */
class PineconeVectorStore {
  private static instance: PineconeVectorStore | null = null;
  private pinecone: Pinecone | null = null;
  private index: Index | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PineconeVectorStore {
    if (!PineconeVectorStore.instance) {
      PineconeVectorStore.instance = new PineconeVectorStore();
    }
    return PineconeVectorStore.instance;
  }

  /**
   * Initialize Pinecone client and index
   * Uses promise to ensure single initialization even with concurrent calls
   */
  async initialize(): Promise<void> {
    // Return immediately if already initialized
    if (this.isInitialized && this.pinecone && this.index) {
      return;
    }

    // Wait for in-progress initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this._initialize();
    await this.initPromise;
    this.initPromise = null;
  }

  /**
   * Internal initialization logic
   */
  private async _initialize(): Promise<void> {
    try {
      // Validate environment variables
      const apiKey = process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE ||
                     process.env.PINECONE_API_KEY;
      const indexName = process.env.NEXT_PUBLIC_PINECONE_INDEX ||
                        process.env.PINECONE_INDEX;

      if (!apiKey) {
        throw new PineconeConnectionError(
          'Pinecone API key not configured',
          {
            requiredEnvVars: [
              'NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE',
              'PINECONE_API_KEY'
            ]
          }
        );
      }

      if (!indexName) {
        throw new PineconeConnectionError(
          'Pinecone index name not configured',
          {
            requiredEnvVars: [
              'NEXT_PUBLIC_PINECONE_INDEX',
              'PINECONE_INDEX'
            ]
          }
        );
      }

      // Initialize Pinecone client
      this.pinecone = new Pinecone({
        apiKey,
      });

      // Get index reference
      this.index = this.pinecone.index(indexName);

      // Verify index exists by checking stats (optional, adds latency)
      // await this.index.describeIndexStats();

      this.isInitialized = true;
    } catch (error) {
      this.pinecone = null;
      this.index = null;
      this.isInitialized = false;

      if (error instanceof PineconeError) {
        throw error;
      }

      throw new PineconeConnectionError(
        'Failed to initialize Pinecone client',
        {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get initialized index instance
   * @throws {PineconeConnectionError} If not initialized
   */
  private getIndex(): Index {
    if (!this.index) {
      throw new PineconeConnectionError(
        'Pinecone service not initialized. Call initialize() first.'
      );
    }
    return this.index;
  }

  /**
   * Validate namespace format
   * Supports both new format (3-63 chars) and legacy format (13 chars)
   *
   * @param namespace - Namespace to validate
   * @throws {PineconeValidationError} If namespace is invalid
   */
  private validateNamespace(namespace: string): void {
    if (!namespace || typeof namespace !== 'string') {
      throw new PineconeValidationError('Namespace is required', {
        namespace,
      });
    }

    const trimmed = namespace.trim();

    // Check length
    if (trimmed.length < 3 || trimmed.length > 63) {
      throw new PineconeValidationError(
        'Namespace must be between 3 and 63 characters',
        {
          namespace: trimmed,
          length: trimmed.length,
          minLength: 3,
          maxLength: 63,
        }
      );
    }

    // Check pattern
    if (!NAMESPACE_PATTERN.test(trimmed)) {
      throw new PineconeValidationError(
        'Namespace must contain only lowercase alphanumeric characters and hyphens, ' +
        'start and end with alphanumeric, and have no consecutive hyphens',
        {
          namespace: trimmed,
          pattern: NAMESPACE_PATTERN.source,
          exampleValid: 'assistant-abc123',
          exampleInvalid: ['Assistant-123', 'assistant--123', '-assistant'],
        }
      );
    }
  }

  /**
   * Validate vector records before upsert
   *
   * @param vectors - Vector records to validate
   * @throws {PineconeValidationError} If vectors are invalid
   */
  private validateVectors(vectors: VectorRecord[]): void {
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new PineconeValidationError('Vectors array is required and must not be empty', {
        vectorsType: typeof vectors,
        vectorsLength: Array.isArray(vectors) ? vectors.length : 0,
      });
    }

    // Validate first vector structure (sample validation)
    const firstVector = vectors[0];
    if (!firstVector.id || !firstVector.values || !Array.isArray(firstVector.values)) {
      throw new PineconeValidationError('Invalid vector structure', {
        expectedFields: ['id', 'values', 'metadata'],
        receivedFields: Object.keys(firstVector),
        sample: {
          id: 'string',
          values: 'number[]',
          metadata: 'object',
        },
      });
    }

    // Validate embedding dimensions (should be consistent)
    const expectedDimensions = firstVector.values.length;
    if (expectedDimensions === 0) {
      throw new PineconeValidationError('Embedding vectors must have non-zero dimensions', {
        dimensions: expectedDimensions,
      });
    }

    // Check for common dimension sizes (1536 for ada-002, 3072 for 3-large)
    const validDimensions = [1536, 3072];
    if (!validDimensions.includes(expectedDimensions)) {
      console.warn(
        `Warning: Embedding dimensions ${expectedDimensions} are not standard. ` +
        `Expected ${validDimensions.join(' or ')}.`
      );
    }
  }

  /**
   * Execute operation with retry logic and timeout
   *
   * @param operation - Async operation to execute
   * @param config - Service configuration
   * @returns Operation result
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: PineconeServiceConfig = {}
  ): Promise<T> {
    const maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
    const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;
    const initialDelay = config.initialRetryDelay ?? DEFAULT_CONFIG.initialRetryDelay;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new PineconeTimeoutError(
              `Operation timed out after ${timeout}ms`,
              { timeout, attempt: attempt + 1 }
            ));
          }, timeout);
        });

        // Race between operation and timeout
        const result = await Promise.race([
          operation(),
          timeoutPromise,
        ]);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors
        if (error instanceof PineconeValidationError) {
          throw error;
        }

        // Don't retry on quota errors
        if (error instanceof PineconeQuotaError) {
          throw error;
        }

        // Check if this is the last attempt
        if (attempt >= maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(
          `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`,
          { error: lastError.message }
        );

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    // All retries exhausted
    throw new PineconeError(
      `Operation failed after ${maxRetries + 1} attempts`,
      'MAX_RETRIES_EXCEEDED',
      {
        attempts: maxRetries + 1,
        lastError: lastError?.message,
      },
      lastError || undefined
    );
  }

  /**
   * Batch array into chunks of specified size
   *
   * @param items - Array to batch
   * @param batchSize - Size of each batch
   * @returns Array of batches
   */
  private batchArray<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process batches with concurrency control
   *
   * @param batches - Array of batches to process
   * @param processor - Function to process each batch
   * @param maxConcurrent - Maximum concurrent operations
   * @returns Array of results
   */
  private async processBatchesConcurrently<T, R>(
    batches: T[][],
    processor: (batch: T[], index: number) => Promise<R>,
    maxConcurrent: number
  ): Promise<R[]> {
    const results: R[] = [];
    const errors: Error[] = [];

    // Process batches in chunks of maxConcurrent
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const batchChunk = batches.slice(i, i + maxConcurrent);

      const promises = batchChunk.map((batch, idx) =>
        processor(batch, i + idx).catch((error) => {
          errors.push(error);
          return null;
        })
      );

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter((r): r is R => r !== null));
    }

    // If all operations failed, throw the first error
    if (errors.length > 0 && results.length === 0) {
      throw errors[0];
    }

    return results;
  }

  /**
   * Upsert vectors into Pinecone with namespace isolation
   *
   * Supports:
   * - Batch processing (100 vectors per batch)
   * - Concurrent uploads (max 5 batches at once)
   * - Automatic retry on transient failures
   * - Timeout handling (30s per batch)
   *
   * @param namespace - Namespace for multi-tenant isolation
   * @param vectors - Array of vector records to upsert
   * @param config - Optional service configuration
   * @returns Upsert response with statistics
   */
  async upsertVectors(
    namespace: string,
    vectors: VectorRecord[],
    config: PineconeServiceConfig = {}
  ): Promise<UpsertResponse> {
    await this.initialize();
    this.validateNamespace(namespace);
    this.validateVectors(vectors);

    const batchSize = config.batchSize ?? DEFAULT_CONFIG.batchSize;
    const maxConcurrent = config.maxConcurrent ?? DEFAULT_CONFIG.maxConcurrent;

    const index = this.getIndex();
    const ns = index.namespace(namespace);

    // Split vectors into batches
    const batches = this.batchArray(vectors, batchSize);

    console.log(
      `Upserting ${vectors.length} vectors in ${batches.length} batches ` +
      `to namespace "${namespace}" (max ${maxConcurrent} concurrent)`
    );

    const startTime = Date.now();
    let totalUpserted = 0;
    const errors: Error[] = [];

    try {
      // Process batches concurrently with retry logic
      const batchProcessor = async (batch: VectorRecord[], batchIndex: number) => {
        return this.executeWithRetry(async () => {
          const response = await ns.upsert(batch);
          totalUpserted += batch.length;

          console.log(
            `Batch ${batchIndex + 1}/${batches.length}: ` +
            `Upserted ${batch.length} vectors (upsertedCount: ${response.upsertedCount})`
          );

          return response;
        }, config);
      };

      await this.processBatchesConcurrently(
        batches,
        batchProcessor,
        maxConcurrent
      );

      const processingTime = Date.now() - startTime;

      return {
        upsertedCount: totalUpserted,
        namespace,
        processingTime,
        batchCount: batches.length,
        errors: errors.length > 0 ? errors.map(e => e.message) : undefined,
      };
    } catch (error) {
      throw new PineconeError(
        'Failed to upsert vectors',
        'UPSERT_ERROR',
        {
          namespace,
          vectorCount: vectors.length,
          upsertedCount: totalUpserted,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Query vectors by similarity within a namespace
   *
   * @param namespace - Namespace to query
   * @param queryEmbedding - Query vector (same dimensions as stored vectors)
   * @param topK - Number of results to return (default: 5)
   * @param config - Optional service configuration
   * @returns Array of query results with scores
   */
  async queryVectors(
    namespace: string,
    queryEmbedding: number[],
    topK: number = 5,
    config: PineconeServiceConfig = {}
  ): Promise<QueryResult[]> {
    await this.initialize();
    this.validateNamespace(namespace);

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new PineconeValidationError('Query embedding must be a non-empty array', {
        embeddingType: typeof queryEmbedding,
        embeddingLength: Array.isArray(queryEmbedding) ? queryEmbedding.length : 0,
      });
    }

    if (topK < 1 || topK > 10000) {
      throw new PineconeValidationError('topK must be between 1 and 10000', {
        topK,
      });
    }

    const index = this.getIndex();
    const ns = index.namespace(namespace);

    try {
      const response = await this.executeWithRetry(async () => {
        return ns.query({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
          includeValues: false, // Don't return vectors to save bandwidth
        });
      }, config);

      // Transform Pinecone response to QueryResult format
      const results: QueryResult[] = (response.matches || []).map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: (match.metadata as Record<string, any>) || {},
      }));

      console.log(
        `Query returned ${results.length} results from namespace "${namespace}" ` +
        `(topK: ${topK})`
      );

      return results;
    } catch (error) {
      throw new PineconeError(
        'Failed to query vectors',
        'QUERY_ERROR',
        {
          namespace,
          topK,
          embeddingDimensions: queryEmbedding.length,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete all vectors in a namespace
   *
   * WARNING: This operation is irreversible
   *
   * @param namespace - Namespace to delete
   * @param config - Optional service configuration
   * @returns Deletion confirmation
   */
  async deleteNamespace(
    namespace: string,
    config: PineconeServiceConfig = {}
  ): Promise<{ deleted: true; namespace: string }> {
    await this.initialize();
    this.validateNamespace(namespace);

    const index = this.getIndex();
    const ns = index.namespace(namespace);

    try {
      await this.executeWithRetry(async () => {
        await ns.deleteAll();
      }, config);

      console.log(`Deleted all vectors in namespace "${namespace}"`);

      return {
        deleted: true,
        namespace,
      };
    } catch (error) {
      throw new PineconeError(
        'Failed to delete namespace',
        'DELETE_NAMESPACE_ERROR',
        {
          namespace,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete specific vectors by IDs within a namespace
   *
   * @param namespace - Namespace containing the vectors
   * @param ids - Array of vector IDs to delete
   * @param config - Optional service configuration
   * @returns Deletion confirmation
   */
  async deleteVectorsByIds(
    namespace: string,
    ids: string[],
    config: PineconeServiceConfig = {}
  ): Promise<{ deleted: true; namespace: string; count: number }> {
    await this.initialize();
    this.validateNamespace(namespace);

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new PineconeValidationError('IDs array is required and must not be empty', {
        idsType: typeof ids,
        idsLength: Array.isArray(ids) ? ids.length : 0,
      });
    }

    const index = this.getIndex();
    const ns = index.namespace(namespace);

    try {
      // Pinecone recommends batching deletes in groups of 1000
      const batchSize = 1000;
      const batches = this.batchArray(ids, batchSize);

      await this.executeWithRetry(async () => {
        for (const batch of batches) {
          await ns.deleteMany(batch);
        }
      }, config);

      console.log(
        `Deleted ${ids.length} vectors from namespace "${namespace}" ` +
        `in ${batches.length} batches`
      );

      return {
        deleted: true,
        namespace,
        count: ids.length,
      };
    } catch (error) {
      throw new PineconeError(
        'Failed to delete vectors by IDs',
        'DELETE_VECTORS_ERROR',
        {
          namespace,
          idCount: ids.length,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get statistics for a namespace
   *
   * @param namespace - Namespace to get stats for
   * @param config - Optional service configuration
   * @returns Namespace statistics
   */
  async getNamespaceStats(
    namespace: string,
    config: PineconeServiceConfig = {}
  ): Promise<NamespaceStats> {
    await this.initialize();
    this.validateNamespace(namespace);

    const index = this.getIndex();

    try {
      const stats = await this.executeWithRetry(async () => {
        return index.describeIndexStats();
      }, config);

      const namespaceStats = stats.namespaces?.[namespace];

      if (!namespaceStats) {
        return {
          vectorCount: 0,
          dimension: 0, // Will be set from index stats if available
          namespace,
        };
      }

      return {
        vectorCount: namespaceStats.recordCount || 0,
        dimension: stats.dimension || 0,
        namespace,
      };
    } catch (error) {
      throw new PineconeError(
        'Failed to get namespace statistics',
        'STATS_ERROR',
        {
          namespace,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
    }
  }
}

// ============================================================================
// Public API - Functional Exports
// ============================================================================

/**
 * Upsert vectors into Pinecone with namespace isolation
 *
 * @example
 * ```typescript
 * const vectors = embeddingResults.map((result, idx) => ({
 *   id: `doc-${documentId}-chunk-${idx}`,
 *   values: result.embedding,
 *   metadata: {
 *     text: result.text,
 *     documentId,
 *     chunkIndex: idx,
 *   },
 * }));
 *
 * await upsertVectors('assistant-abc123', vectors);
 * ```
 */
export async function upsertVectors(
  namespace: string,
  vectors: VectorRecord[],
  config?: PineconeServiceConfig
): Promise<UpsertResponse> {
  const service = PineconeVectorStore.getInstance();
  return service.upsertVectors(namespace, vectors, config);
}

/**
 * Query vectors by similarity within a namespace
 *
 * @example
 * ```typescript
 * const queryEmbedding = await generateEmbeddings(userQuery);
 * const results = await queryVectors(
 *   'assistant-abc123',
 *   queryEmbedding,
 *   5
 * );
 *
 * const relevantTexts = results.map(r => r.metadata.text);
 * ```
 */
export async function queryVectors(
  namespace: string,
  queryEmbedding: number[],
  topK?: number,
  config?: PineconeServiceConfig
): Promise<QueryResult[]> {
  const service = PineconeVectorStore.getInstance();
  return service.queryVectors(namespace, queryEmbedding, topK, config);
}

/**
 * Delete all vectors in a namespace
 *
 * WARNING: This operation is irreversible
 *
 * @example
 * ```typescript
 * await deleteNamespace('assistant-abc123');
 * ```
 */
export async function deleteNamespace(
  namespace: string,
  config?: PineconeServiceConfig
): Promise<{ deleted: true; namespace: string }> {
  const service = PineconeVectorStore.getInstance();
  return service.deleteNamespace(namespace, config);
}

/**
 * Delete specific vectors by IDs within a namespace
 *
 * @example
 * ```typescript
 * const idsToDelete = ['doc-1-chunk-0', 'doc-1-chunk-1'];
 * await deleteVectorsByIds('assistant-abc123', idsToDelete);
 * ```
 */
export async function deleteVectorsByIds(
  namespace: string,
  ids: string[],
  config?: PineconeServiceConfig
): Promise<{ deleted: true; namespace: string; count: number }> {
  const service = PineconeVectorStore.getInstance();
  return service.deleteVectorsByIds(namespace, ids, config);
}

/**
 * Get statistics for a namespace
 *
 * @example
 * ```typescript
 * const stats = await getNamespaceStats('assistant-abc123');
 * console.log(`Namespace has ${stats.vectorCount} vectors`);
 * ```
 */
export async function getNamespaceStats(
  namespace: string,
  config?: PineconeServiceConfig
): Promise<NamespaceStats> {
  const service = PineconeVectorStore.getInstance();
  return service.getNamespaceStats(namespace, config);
}

/**
 * Initialize Pinecone service
 *
 * Optional: Call this during app startup to pre-initialize the connection.
 * Otherwise, initialization happens lazily on first use.
 *
 * @example
 * ```typescript
 * // In app startup or middleware
 * await initializePineconeService();
 * ```
 */
export async function initializePineconeService(): Promise<void> {
  const service = PineconeVectorStore.getInstance();
  await service.initialize();
}
```

#### **File: `src/types/pinecone.ts`** (Type Definitions)

**Purpose:** TypeScript type definitions for Pinecone service

```typescript
/**
 * Type definitions for Pinecone Vector Store Service (INTEL-003)
 */

/**
 * Vector record for upserting to Pinecone
 */
export interface VectorRecord {
  /**
   * Unique identifier for the vector
   * Recommended format: `${documentId}-chunk-${chunkIndex}`
   */
  id: string;

  /**
   * Embedding vector (dimensions must match index configuration)
   * - 1536 for text-embedding-ada-002 and text-embedding-3-small
   * - 3072 for text-embedding-3-large
   */
  values: number[];

  /**
   * Metadata associated with the vector
   * Used for filtering and retrieval context
   */
  metadata: {
    /**
     * Original text chunk that was embedded
     */
    text: string;

    /**
     * Document ID for linking back to source
     */
    documentId: string;

    /**
     * Page number in the source document (if applicable)
     */
    pageNumber?: number;

    /**
     * Index of this chunk within the document (0-based)
     */
    chunkIndex: number;

    /**
     * Total number of chunks in the document
     */
    totalChunks?: number;

    /**
     * Account ID for multi-tenant tracking
     */
    accountId?: string;

    /**
     * Additional custom metadata
     */
    [key: string]: any;
  };
}

/**
 * Query result from Pinecone
 */
export interface QueryResult {
  /**
   * Vector ID that matched
   */
  id: string;

  /**
   * Similarity score (0-1, higher is more similar)
   */
  score: number;

  /**
   * Metadata associated with the matched vector
   */
  metadata: Record<string, any>;
}

/**
 * Response from upsert operation
 */
export interface UpsertResponse {
  /**
   * Number of vectors successfully upserted
   */
  upsertedCount: number;

  /**
   * Namespace where vectors were upserted
   */
  namespace: string;

  /**
   * Processing time in milliseconds
   */
  processingTime: number;

  /**
   * Number of batches processed
   */
  batchCount: number;

  /**
   * Errors encountered during upsert (if any)
   */
  errors?: string[];
}

/**
 * Namespace statistics
 */
export interface NamespaceStats {
  /**
   * Number of vectors in the namespace
   */
  vectorCount: number;

  /**
   * Dimension size of vectors
   */
  dimension: number;

  /**
   * Namespace identifier
   */
  namespace: string;
}

/**
 * Configuration options for Pinecone service
 */
export interface PineconeServiceConfig {
  /**
   * Number of vectors per batch (default: 100)
   */
  batchSize?: number;

  /**
   * Maximum concurrent batch operations (default: 5)
   */
  maxConcurrent?: number;

  /**
   * Timeout per request in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Maximum retry attempts (default: 2)
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds (default: 1000)
   */
  initialRetryDelay?: number;
}

/**
 * Base error class for Pinecone service errors
 */
export class PineconeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PineconeError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PineconeError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation error for invalid input
 * Non-retryable
 */
export class PineconeValidationError extends PineconeError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'VALIDATION_ERROR', details, cause);
    this.name = 'PineconeValidationError';
  }
}

/**
 * Connection error for initialization failures
 * May be retryable
 */
export class PineconeConnectionError extends PineconeError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'CONNECTION_ERROR', details, cause);
    this.name = 'PineconeConnectionError';
  }
}

/**
 * Timeout error for operations exceeding time limit
 * Retryable
 */
export class PineconeTimeoutError extends PineconeError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'TIMEOUT_ERROR', details, cause);
    this.name = 'PineconeTimeoutError';
  }
}

/**
 * Quota error for exceeding plan limits
 * Non-retryable
 */
export class PineconeQuotaError extends PineconeError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'QUOTA_ERROR', details, cause);
    this.name = 'PineconeQuotaError';
  }
}
```

#### **File: `src/services/__tests__/pineconeService.test.ts`** (Unit Tests)

**Purpose:** Comprehensive unit tests with mocked Pinecone client

```typescript
/**
 * Unit Tests for Pinecone Service (INTEL-003)
 *
 * These tests use mocks to avoid real API calls.
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  deleteVectorsByIds,
  getNamespaceStats,
} from '../pineconeService';
import {
  PineconeValidationError,
  PineconeConnectionError,
  PineconeTimeoutError,
} from '@/types/pinecone';

// Mock Pinecone SDK
vi.mock('@pinecone-database/pinecone', () => {
  const mockNamespace = {
    upsert: vi.fn().mockResolvedValue({ upsertedCount: 100 }),
    query: vi.fn().mockResolvedValue({
      matches: [
        { id: 'test-1', score: 0.95, metadata: { text: 'Test 1' } },
        { id: 'test-2', score: 0.85, metadata: { text: 'Test 2' } },
      ],
    }),
    deleteAll: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
  };

  const mockIndex = {
    namespace: vi.fn().mockReturnValue(mockNamespace),
    describeIndexStats: vi.fn().mockResolvedValue({
      dimension: 1536,
      namespaces: {
        'test-namespace': { recordCount: 100 },
      },
    }),
  };

  return {
    Pinecone: vi.fn().mockImplementation(() => ({
      index: vi.fn().mockReturnValue(mockIndex),
    })),
  };
});

// Store original env vars
const originalEnv = process.env;

describe('pineconeService - Namespace Validation', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should accept valid namespace (lowercase alphanumeric)', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('assistant123', vectors)
    ).resolves.toBeDefined();
  });

  it('should accept valid namespace with hyphens', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('assistant-abc-123', vectors)
    ).resolves.toBeDefined();
  });

  it('should reject namespace with uppercase letters', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('Assistant-123', vectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject namespace shorter than 3 characters', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('ab', vectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject namespace longer than 63 characters', async () => {
    const longNamespace = 'a'.repeat(64);
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors(longNamespace, vectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject namespace with consecutive hyphens', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('assistant--123', vectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject namespace starting with hyphen', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('-assistant', vectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject empty namespace', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('', vectors)
    ).rejects.toThrow(PineconeValidationError);
  });
});

describe('pineconeService - Vector Validation', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should reject empty vectors array', async () => {
    await expect(
      upsertVectors('test-namespace', [])
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject vectors without id field', async () => {
    const invalidVectors = [{
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }] as any;

    await expect(
      upsertVectors('test-namespace', invalidVectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject vectors without values field', async () => {
    const invalidVectors = [{
      id: 'test-1',
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }] as any;

    await expect(
      upsertVectors('test-namespace', invalidVectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject vectors with zero-dimension embeddings', async () => {
    const invalidVectors = [{
      id: 'test-1',
      values: [],
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('test-namespace', invalidVectors)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should accept vectors with standard dimensions (1536)', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('test-namespace', vectors)
    ).resolves.toBeDefined();
  });

  it('should accept vectors with 3072 dimensions', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(3072).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('test-namespace', vectors)
    ).resolves.toBeDefined();
  });
});

describe('pineconeService - Upsert Vectors', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should upsert vectors successfully', async () => {
    const vectors = Array.from({ length: 50 }, (_, i) => ({
      id: `test-${i}`,
      values: new Array(1536).fill(0.1),
      metadata: {
        text: `Test ${i}`,
        documentId: 'doc-1',
        chunkIndex: i,
      },
    }));

    const response = await upsertVectors('test-namespace', vectors);

    expect(response.upsertedCount).toBe(50);
    expect(response.namespace).toBe('test-namespace');
    expect(response.processingTime).toBeGreaterThan(0);
  });

  it('should batch vectors correctly', async () => {
    const { Pinecone } = await import('@pinecone-database/pinecone');
    const mockPinecone = new Pinecone({ apiKey: 'test' });
    const mockIndex = mockPinecone.index('test');
    const mockNamespace = mockIndex.namespace('test');
    const upsertSpy = vi.spyOn(mockNamespace, 'upsert');

    // Create 250 vectors (should create 3 batches: 100, 100, 50)
    const vectors = Array.from({ length: 250 }, (_, i) => ({
      id: `test-${i}`,
      values: new Array(1536).fill(0.1),
      metadata: {
        text: `Test ${i}`,
        documentId: 'doc-1',
        chunkIndex: i,
      },
    }));

    await upsertVectors('test-namespace', vectors, { batchSize: 100 });

    // Should have called upsert 3 times
    expect(upsertSpy).toHaveBeenCalledTimes(3);
  });

  it('should include metadata in response', async () => {
    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: {
        text: 'Test',
        documentId: 'doc-1',
        chunkIndex: 0,
        accountId: 'acc-123',
      },
    }];

    const response = await upsertVectors('test-namespace', vectors);

    expect(response).toHaveProperty('upsertedCount');
    expect(response).toHaveProperty('namespace');
    expect(response).toHaveProperty('processingTime');
    expect(response).toHaveProperty('batchCount');
  });
});

describe('pineconeService - Query Vectors', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should query vectors successfully', async () => {
    const queryEmbedding = new Array(1536).fill(0.1);

    const results = await queryVectors('test-namespace', queryEmbedding, 5);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('metadata');
  });

  it('should respect topK parameter', async () => {
    const queryEmbedding = new Array(1536).fill(0.1);

    const results = await queryVectors('test-namespace', queryEmbedding, 2);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should reject invalid query embedding', async () => {
    await expect(
      queryVectors('test-namespace', [], 5)
    ).rejects.toThrow(PineconeValidationError);
  });

  it('should reject invalid topK values', async () => {
    const queryEmbedding = new Array(1536).fill(0.1);

    await expect(
      queryVectors('test-namespace', queryEmbedding, 0)
    ).rejects.toThrow(PineconeValidationError);

    await expect(
      queryVectors('test-namespace', queryEmbedding, 10001)
    ).rejects.toThrow(PineconeValidationError);
  });
});

describe('pineconeService - Delete Operations', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should delete namespace successfully', async () => {
    const result = await deleteNamespace('test-namespace');

    expect(result.deleted).toBe(true);
    expect(result.namespace).toBe('test-namespace');
  });

  it('should delete vectors by IDs successfully', async () => {
    const ids = ['test-1', 'test-2', 'test-3'];

    const result = await deleteVectorsByIds('test-namespace', ids);

    expect(result.deleted).toBe(true);
    expect(result.namespace).toBe('test-namespace');
    expect(result.count).toBe(3);
  });

  it('should reject empty IDs array', async () => {
    await expect(
      deleteVectorsByIds('test-namespace', [])
    ).rejects.toThrow(PineconeValidationError);
  });
});

describe('pineconeService - Namespace Statistics', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should get namespace stats successfully', async () => {
    const stats = await getNamespaceStats('test-namespace');

    expect(stats).toHaveProperty('vectorCount');
    expect(stats).toHaveProperty('dimension');
    expect(stats).toHaveProperty('namespace');
    expect(stats.namespace).toBe('test-namespace');
  });

  it('should return zero counts for empty namespace', async () => {
    const { Pinecone } = await import('@pinecone-database/pinecone');
    const mockPinecone = new Pinecone({ apiKey: 'test' });
    const mockIndex = mockPinecone.index('test');

    vi.spyOn(mockIndex, 'describeIndexStats').mockResolvedValue({
      dimension: 1536,
      namespaces: {},
    } as any);

    const stats = await getNamespaceStats('empty-namespace');

    expect(stats.vectorCount).toBe(0);
  });
});

describe('pineconeService - Error Handling', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should throw ConnectionError when API key is missing', async () => {
    delete process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE;
    delete process.env.PINECONE_API_KEY;

    // Reset singleton to force re-initialization
    const { PineconeVectorStore } = await import('../pineconeService') as any;
    PineconeVectorStore.instance = null;

    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('test-namespace', vectors)
    ).rejects.toThrow(PineconeConnectionError);
  });

  it('should throw ConnectionError when index name is missing', async () => {
    delete process.env.NEXT_PUBLIC_PINECONE_INDEX;
    delete process.env.PINECONE_INDEX;

    // Reset singleton
    const { PineconeVectorStore } = await import('../pineconeService') as any;
    PineconeVectorStore.instance = null;

    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    await expect(
      upsertVectors('test-namespace', vectors)
    ).rejects.toThrow(PineconeConnectionError);
  });
});

describe('pineconeService - Retry Logic', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE: 'test-key',
      NEXT_PUBLIC_PINECONE_INDEX: 'test-index',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should retry on transient errors', async () => {
    const { Pinecone } = await import('@pinecone-database/pinecone');
    const mockPinecone = new Pinecone({ apiKey: 'test' });
    const mockIndex = mockPinecone.index('test');
    const mockNamespace = mockIndex.namespace('test');

    // Fail twice, then succeed
    let attempts = 0;
    vi.spyOn(mockNamespace, 'upsert').mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return Promise.resolve({ upsertedCount: 1 });
    });

    const vectors = [{
      id: 'test-1',
      values: new Array(1536).fill(0.1),
      metadata: { text: 'Test', documentId: 'doc-1', chunkIndex: 0 },
    }];

    const response = await upsertVectors('test-namespace', vectors, {
      maxRetries: 3,
    });

    expect(response.upsertedCount).toBe(1);
    expect(attempts).toBe(3);
  });
});
```

#### **File: `src/services/__tests__/pineconeService.integration.test.ts`** (Integration Tests)

**Purpose:** Optional integration tests with real Pinecone API (manual execution)

```typescript
/**
 * Integration Tests for Pinecone Service (INTEL-003)
 *
 * These tests make real API calls to Pinecone.
 * Only run manually when testing against a real Pinecone index.
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  getNamespaceStats,
  initializePineconeService,
} from '../pineconeService';

// Skip these tests by default
const SKIP_INTEGRATION_TESTS = !process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(SKIP_INTEGRATION_TESTS)('pineconeService - Integration Tests', () => {
  const testNamespace = `test-${Date.now()}`;

  beforeAll(async () => {
    // Initialize service
    await initializePineconeService();
  });

  afterAll(async () => {
    // Cleanup: delete test namespace
    try {
      await deleteNamespace(testNamespace);
    } catch (error) {
      console.warn('Failed to cleanup test namespace:', error);
    }
  });

  it('should perform full upsert-query-delete cycle', async () => {
    // Step 1: Upsert vectors
    const vectors = Array.from({ length: 10 }, (_, i) => ({
      id: `test-doc-${i}`,
      values: Array.from({ length: 1536 }, () => Math.random()),
      metadata: {
        text: `This is test document ${i}`,
        documentId: 'test-doc',
        chunkIndex: i,
      },
    }));

    const upsertResponse = await upsertVectors(testNamespace, vectors);
    expect(upsertResponse.upsertedCount).toBe(10);

    // Wait for vectors to be indexed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Query vectors
    const queryEmbedding = Array.from({ length: 1536 }, () => Math.random());
    const queryResults = await queryVectors(testNamespace, queryEmbedding, 5);

    expect(queryResults.length).toBeGreaterThan(0);
    expect(queryResults.length).toBeLessThanOrEqual(5);
    expect(queryResults[0]).toHaveProperty('id');
    expect(queryResults[0]).toHaveProperty('score');

    // Step 3: Get stats
    const stats = await getNamespaceStats(testNamespace);
    expect(stats.vectorCount).toBe(10);

    // Step 4: Delete namespace
    const deleteResponse = await deleteNamespace(testNamespace);
    expect(deleteResponse.deleted).toBe(true);
  }, 30000); // 30 second timeout

  it('should handle large batch upserts', async () => {
    const largeNamespace = `test-large-${Date.now()}`;

    try {
      // Create 500 vectors
      const vectors = Array.from({ length: 500 }, (_, i) => ({
        id: `large-test-${i}`,
        values: Array.from({ length: 1536 }, () => Math.random()),
        metadata: {
          text: `Large test document ${i}`,
          documentId: 'large-test',
          chunkIndex: i,
        },
      }));

      const response = await upsertVectors(largeNamespace, vectors);

      expect(response.upsertedCount).toBe(500);
      expect(response.batchCount).toBeGreaterThan(1);
    } finally {
      await deleteNamespace(largeNamespace);
    }
  }, 60000); // 60 second timeout
});
```

### 2. Files to Modify

#### **File: `.env.example`**

**Add new environment variables:**

```bash
# Pinecone Vector Store Configuration (INTEL-003)
# Direct Pinecone integration for vector storage (replaces Flowise vector operations)
# API Key from Pinecone console (pc-xxx format)
PINECONE_API_KEY=pc-your_pinecone_api_key
# Index name in Pinecone (must be created first)
PINECONE_INDEX=your_pinecone_index_name
# Optional: Pinecone environment (auto-detected from API key if not provided)
# PINECONE_ENVIRONMENT=us-east-1-aws

# Legacy: These are kept for backward compatibility with Flowise
# Can be migrated to use PINECONE_API_KEY and PINECONE_INDEX
NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE=pc-your_pinecone_api_key
NEXT_PUBLIC_PINECONE_INDEX=your_pinecone_index_name
```

#### **File: `package.json`**

**Add Pinecone SDK dependency:**

```json
{
  "dependencies": {
    "@pinecone-database/pinecone": "^3.0.3",
    // ... existing dependencies
  }
}
```

#### **File: `vitest.config.ts`** (if exists, or create if not)

**Configure test environment:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/services/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/services/__tests__/',
        '**/*.test.ts',
        '**/*.integration.test.ts',
      ],
    },
  },
});
```

#### **File: `src/services/__tests__/setup.ts`** (create if not exists)

**Test setup and global mocks:**

```typescript
/**
 * Global test setup for service tests
 */

import { beforeEach } from 'vitest';

// Set test environment variables
beforeEach(() => {
  process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE = 'test-api-key';
  process.env.NEXT_PUBLIC_PINECONE_INDEX = 'test-index';
  process.env.OPENAI_API_KEY = 'test-openai-key';
});
```

### 3. Configuration Changes

#### **Environment Variables Setup**

**Local Development (`.env.local`):**
```bash
# Use existing Flowise Pinecone credentials
PINECONE_API_KEY=pc-xxx  # Copy from NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE
PINECONE_INDEX=your-index-name  # Copy from NEXT_PUBLIC_PINECONE_INDEX

# Or keep using the public prefixed versions
NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE=pc-xxx
NEXT_PUBLIC_PINECONE_INDEX=your-index-name
```

**Production (Vercel/Railway):**
```bash
# Add these to your deployment platform's environment variables
PINECONE_API_KEY=pc-xxx
PINECONE_INDEX=production-index-name
```

#### **TypeScript Configuration**

No changes needed to `tsconfig.json` - path aliases already configured.

#### **Package Installation**

```bash
npm install @pinecone-database/pinecone@^3.0.3 --legacy-peer-deps
```

---

## Integration Points

### 1. Integration with Embedding Service (INTEL-001/INTEL-002)

**Current State:**
- `embeddingService.generateEmbeddings()` returns `EmbeddingResult[]`
- Each result contains: `text`, `embedding`, `metadata`

**Integration Pattern:**

```typescript
// Example: Document upload flow
import { generateEmbeddings } from '@/services/embeddingService';
import { upsertVectors } from '@/services/pineconeService';

async function processDocument(
  pdfBuffer: Buffer,
  documentId: string,
  namespace: string,
  accountId: string
) {
  // Step 1: Generate embeddings using Vercel AI SDK
  const embeddingResult = await generateEmbeddings(pdfBuffer, {
    model: 'text-embedding-ada-002',
    metadata: {
      documentId,
      accountId,
      namespace,
    },
  });

  // Step 2: Transform to Pinecone format
  const vectors = embeddingResult.results.map((result, idx) => ({
    id: `${documentId}-chunk-${idx}`,
    values: result.embedding,
    metadata: {
      text: result.text,
      documentId,
      chunkIndex: idx,
      totalChunks: embeddingResult.results.length,
      accountId,
    },
  }));

  // Step 3: Upsert to Pinecone with namespace isolation
  const upsertResponse = await upsertVectors(namespace, vectors);

  return {
    embeddingStats: embeddingResult.usage,
    vectorStats: upsertResponse,
  };
}
```

### 2. Integration with Document Management (Supabase)

**Affected Tables:**
- `documents` - Document metadata and status
- `document_storage-assistants` - Junction table linking docs to assistants
- `assistants` - Assistant configuration with namespace

**Integration Pattern:**

```typescript
// Example: Update document status after vector upload
import { createClient } from '@/lib/supabase/server';
import { upsertVectors } from '@/services/pineconeService';

async function uploadDocumentVectors(
  documentId: string,
  namespace: string,
  vectors: VectorRecord[]
) {
  const supabase = await createClient();

  try {
    // Upload to Pinecone
    const response = await upsertVectors(namespace, vectors);

    // Update Supabase with success status
    await supabase
      .from('documents')
      .update({
        status: 'ready',
        vector_count: response.upsertedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return response;
  } catch (error) {
    // Update Supabase with error status
    await supabase
      .from('documents')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    throw error;
  }
}
```

### 3. Integration with Assistant Deletion Flow

**Current Deletion Flow (from `src/lib/actions/intelliaa/assistants.ts`):**

```typescript
// Existing flow - ADD Pinecone deletion
import { deleteNamespace } from '@/services/pineconeService';

async function deleteAssistant(assistantId: string) {
  const assistant = await getAssistantById(assistantId);
  const namespace = assistant.namespace;

  try {
    // Step 1: Delete vectors from Pinecone (NEW)
    await deleteNamespace(namespace);

    // Step 2: Delete documents by namespace (EXISTING)
    await deleteDocumentsByNamespace("documents", namespace);

    // Step 3: Delete QA records (EXISTING)
    await deleteRecordsByNamespace("qa_docs", namespace);

    // Step 4: Delete embedded PDFs (EXISTING)
    await deleteRecordsByAssistantId("embedded_pdfs", assistantId);

    // Step 5: Delete reports (EXISTING)
    await deleteRecordsByAssistantId("report_ws", assistantId);

    // Step 6: Call external cleanup (EXISTING)
    if (assistant.service_id_rw) {
      await deleteAssistantWs(assistant.service_id_rw);
    }

    // Step 7: Delete assistant record (EXISTING)
    await supabase
      .from('assistants')
      .delete()
      .eq('id', assistantId);

    return { success: true };
  } catch (error) {
    console.error('Failed to delete assistant:', error);
    throw error;
  }
}
```

### 4. Integration with RAG Query Flow

**Example: RAG query with Pinecone**

```typescript
// Example: Query assistant knowledge base
import { generateEmbeddings } from '@/services/embeddingService';
import { queryVectors } from '@/services/pineconeService';

async function queryAssistantKnowledge(
  namespace: string,
  userQuery: string,
  topK: number = 5
) {
  // Step 1: Generate embedding for user query
  const queryBuffer = Buffer.from(userQuery, 'utf-8');
  const embeddingResult = await generateEmbeddings(queryBuffer);
  const queryEmbedding = embeddingResult.results[0].embedding;

  // Step 2: Query Pinecone for similar vectors
  const results = await queryVectors(namespace, queryEmbedding, topK);

  // Step 3: Extract text chunks
  const relevantTexts = results.map(r => ({
    text: r.metadata.text,
    score: r.score,
    documentId: r.metadata.documentId,
  }));

  return relevantTexts;
}
```

---

## Migration Strategy

### Phase 1: Development & Testing (Week 1)

**Goal:** Implement service, write tests, validate functionality

1. Install Pinecone SDK: `npm install @pinecone-database/pinecone --legacy-peer-deps`
2. Create service files:
   - `src/services/pineconeService.ts`
   - `src/types/pinecone.ts`
3. Write unit tests: `src/services/__tests__/pineconeService.test.ts`
4. Run tests: `npm test`
5. Manual validation with integration tests (optional)

**Success Criteria:**
- All unit tests passing
- Service can connect to Pinecone
- Can upsert, query, and delete vectors
- Namespace validation working

### Phase 2: Integration (Week 1-2)

**Goal:** Integrate with existing systems without breaking Flowise

1. Update document upload flow to use Pinecone service
2. Add Pinecone deletion to assistant deletion flow
3. Create feature flag: `NEXT_PUBLIC_USE_PINECONE_DIRECT=false`
4. Test dual-write scenario (both Flowise and Pinecone)
5. Validate data consistency between Flowise and Pinecone

**Implementation:**

```typescript
// Feature flag wrapper
async function upsertDocumentVectors(namespace: string, vectors: VectorRecord[]) {
  const usePineconeDirect = process.env.NEXT_PUBLIC_USE_PINECONE_DIRECT === 'true';

  if (usePineconeDirect) {
    // New implementation
    return upsertVectors(namespace, vectors);
  } else {
    // Existing Flowise implementation
    return flowiseService.insertVectorStore(...);
  }
}
```

**Success Criteria:**
- Feature flag toggles between Flowise and Pinecone
- Both paths produce correct results
- No breaking changes to existing functionality

### Phase 3: Migration (Week 2-3)

**Goal:** Migrate existing vectors from Flowise to direct Pinecone

**Migration Script:**

```typescript
// Example migration script (pseudo-code)
async function migrateFlowiseVectorsToPinecone() {
  const supabase = await createClient();

  // Get all assistants with documents
  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, namespace')
    .not('namespace', 'is', null);

  for (const assistant of assistants) {
    try {
      // Check if vectors already exist in Pinecone
      const stats = await getNamespaceStats(assistant.namespace);

      if (stats.vectorCount > 0) {
        console.log(`Namespace ${assistant.namespace} already migrated`);
        continue;
      }

      // Get documents for this assistant
      const { data: documents } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('assistant_id', assistant.id);

      for (const document of documents) {
        // Re-process document through new pipeline
        const pdfBuffer = await downloadFromS3(document.file_path);
        await processDocument(
          pdfBuffer,
          document.id,
          assistant.namespace,
          assistant.account_id
        );
      }

      console.log(`Migrated ${documents.length} documents for assistant ${assistant.id}`);
    } catch (error) {
      console.error(`Failed to migrate assistant ${assistant.id}:`, error);
    }
  }
}
```

**Success Criteria:**
- All existing documents migrated to Pinecone
- Vector counts match between Flowise and Pinecone
- No data loss during migration

### Phase 4: Cutover (Week 3-4)

**Goal:** Switch to Pinecone exclusively, deprecate Flowise vector operations

1. Enable feature flag: `NEXT_PUBLIC_USE_PINECONE_DIRECT=true`
2. Monitor for errors and performance issues
3. Validate RAG query quality (compare with Flowise baseline)
4. Remove Flowise vector operations code (keep document store for now)

**Rollback Plan:**
- Set `NEXT_PUBLIC_USE_PINECONE_DIRECT=false`
- Vectors remain in both systems during transition
- Can fall back to Flowise if issues arise

**Success Criteria:**
- All operations using Pinecone service
- No increase in error rates
- RAG query quality maintained or improved
- Response times within acceptable range

---

## Critical Implementation Notes

### 1. Next.js 15 & React 19 Compatibility

**CRITICAL: Async Request APIs**
- This service is designed for Server Components and API Routes
- If calling from Server Components, ensure `createClient()` is awaited
- Client Components CANNOT import this service directly (uses Node.js APIs)

**Solution:**
```typescript
// ✅ CORRECT: Server Component
export default async function DocumentUploadPage() {
  const supabase = await createClient(); // MUST await
  // Can call pineconeService here
}

// ✅ CORRECT: API Route Handler
export async function POST(request: Request) {
  // Can call pineconeService here
}

// ❌ INCORRECT: Client Component
"use client";
import { upsertVectors } from '@/services/pineconeService'; // Will fail!
```

**Workaround for Client Components:**
```typescript
// Create API route wrapper
// File: src/app/api/vectors/upsert/route.ts
export async function POST(request: Request) {
  const { namespace, vectors } = await request.json();
  const response = await upsertVectors(namespace, vectors);
  return Response.json(response);
}

// Client component calls API route
async function uploadVectors() {
  const response = await fetch('/api/vectors/upsert', {
    method: 'POST',
    body: JSON.stringify({ namespace, vectors }),
  });
}
```

### 2. Multi-Tenant Namespace Considerations

**CRITICAL: Namespace Isolation**
- Each assistant MUST have a unique namespace
- Namespace format: lowercase alphanumeric + hyphens (3-63 chars)
- Current assistant namespace: `Math.random().toString(36).substring(2, 15)` (13 chars)

**Legacy Namespace Support:**
```typescript
// Existing namespaces may not follow strict validation
// Service accepts 3-63 char alphanumeric namespaces
// Legacy format (13 chars, alphanumeric) is supported
// Example: "abc123def456"
```

**Migration Note:**
- Existing namespaces are compatible with Pinecone
- No need to regenerate namespaces
- New namespaces should follow best practices: `assistant-${randomId}`

### 3. Pinecone SDK Version Compatibility

**CRITICAL: SDK Version 3.x Breaking Changes**

From Pinecone SDK v3.x documentation:
- `Index.upsert()` requires namespace via `.namespace()` method
- Cannot pass namespace as parameter anymore
- Must use: `index.namespace(ns).upsert(vectors)`

**Correct Pattern:**
```typescript
// ✅ CORRECT: v3.x
const index = pinecone.index('index-name');
const ns = index.namespace('my-namespace');
await ns.upsert(vectors);

// ❌ INCORRECT: v2.x (deprecated)
await index.upsert({
  namespace: 'my-namespace',
  vectors,
});
```

### 4. Batch Processing Performance

**CRITICAL: Pinecone Rate Limits**

Pinecone API limits:
- **Starter plan**: 5 requests/sec, 1000 vectors/request
- **Standard plan**: 10 requests/sec, 1000 vectors/request
- **Enterprise plan**: Custom limits

**Service Configuration:**
```typescript
// Default: 100 vectors/batch, 5 concurrent batches
// This ensures we stay under rate limits while maximizing throughput
{
  batchSize: 100,      // Balance between throughput and payload size
  maxConcurrent: 5,    // Stay under rate limit
  timeout: 30000,      // 30s per batch (generous for retries)
}
```

**Optimization for Large Uploads:**
```typescript
// For 1000 vectors:
// - 10 batches of 100 vectors
// - 2 rounds of 5 concurrent batches
// - ~6-10 seconds total (with network latency)

// For 10,000 vectors:
// - 100 batches
// - 20 rounds of 5 concurrent batches
// - ~60-100 seconds total
```

### 5. Connection Pooling and Singleton Pattern

**CRITICAL: Avoid Multiple Pinecone Clients**

Problem:
- Creating new `Pinecone` client on every request wastes connections
- Initialization requires API call to validate credentials
- Multiple instances can cause rate limit issues

**Solution: Singleton Pattern**
```typescript
// Service uses singleton with lazy initialization
// First call: initializes client (~500ms)
// Subsequent calls: reuse client (~0ms overhead)

// Initialize at app startup (optional)
import { initializePineconeService } from '@/services/pineconeService';
await initializePineconeService();
```

**Next.js Deployment Consideration:**
- Vercel Serverless: Each function instance has its own singleton
- Railway Container: Singleton persists across requests (best performance)
- Consider warming up connection on first request per instance

### 6. Error Handling and Retry Logic

**CRITICAL: Distinguish Retryable vs Non-Retryable Errors**

**Retryable Errors (3 attempts with exponential backoff):**
- Network timeouts
- 5xx server errors
- Rate limit errors (429)
- Temporary connection issues

**Non-Retryable Errors (fail fast):**
- Validation errors (400)
- Authentication errors (401, 403)
- Quota exceeded errors
- Malformed data errors

**Implementation:**
```typescript
// Service automatically retries transient errors
// No need for application-level retry logic
try {
  await upsertVectors(namespace, vectors);
} catch (error) {
  if (error instanceof PineconeValidationError) {
    // User error - fix input and retry
  } else if (error instanceof PineconeQuotaError) {
    // Plan limit - upgrade or reduce usage
  } else {
    // Unexpected error - log and alert
  }
}
```

### 7. Security Considerations

**CRITICAL: API Key Protection**

**Environment Variable Security:**
```bash
# ✅ CORRECT: Server-side only (no NEXT_PUBLIC_ prefix)
PINECONE_API_KEY=pc-xxx

# ❌ INCORRECT: Exposed to client (has NEXT_PUBLIC_)
NEXT_PUBLIC_PINECONE_API_KEY=pc-xxx  # DO NOT USE FOR NEW CODE
```

**Note on Legacy Variables:**
- `NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE` exists for Flowise compatibility
- Service prioritizes server-side `PINECONE_API_KEY` if available
- Plan to migrate away from public-prefixed variables

**Error Message Sanitization:**
- Service sanitizes error messages before logging
- API keys and sensitive data removed
- Safe to log error messages to application logs

### 8. Testing Strategy

**CRITICAL: Mock Pinecone Client in Tests**

**Unit Tests (Fast, No API Calls):**
```typescript
// All operations mocked
// Test: validation logic, batching, error handling
npm test
```

**Integration Tests (Slow, Real API Calls):**
```typescript
// Optional: requires real Pinecone credentials
// Test: end-to-end functionality
RUN_INTEGRATION_TESTS=true npm run test:integration
```

**Recommendation:**
- Run unit tests in CI/CD pipeline
- Run integration tests manually before major releases
- Use dedicated test index for integration tests

### 9. Performance Benchmarks

**Expected Performance:**

| Operation | Vectors | Batches | Time | Notes |
|-----------|---------|---------|------|-------|
| Upsert | 100 | 1 | 0.5-1s | Single batch |
| Upsert | 1,000 | 10 | 5-10s | 2 rounds, 5 concurrent |
| Upsert | 10,000 | 100 | 60-100s | 20 rounds, 5 concurrent |
| Query | 1 | 1 | 0.2-0.5s | Single query |
| Delete Namespace | - | 1 | 0.5-1s | Single API call |
| Get Stats | - | 1 | 0.5-1s | Single API call |

**Optimization Opportunities:**
- Increase `maxConcurrent` for higher-tier Pinecone plans
- Increase `batchSize` up to 1000 for fewer API calls
- Pre-initialize service at app startup to avoid cold start

### 10. Cost Considerations

**Pinecone Pricing (as of 2025):**
- **Starter**: $0.096/hour/pod (~$70/month), 100K vectors
- **Standard**: $0.096/hour/pod, unlimited vectors, dedicated resources
- **Enterprise**: Custom pricing, SLA, support

**Cost Factors:**
- Storage: Number of vectors × dimensions × 4 bytes
- Compute: Pod uptime (charged hourly)
- Requests: Included in pod cost (no per-request charge)

**Optimization:**
- Use efficient embedding models (1536 dims vs 3072 dims = 50% storage savings)
- Delete unused namespaces regularly
- Monitor vector counts per namespace

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

**Scenario:** Critical issues after deployment

**Steps:**
1. Set feature flag: `NEXT_PUBLIC_USE_PINECONE_DIRECT=false`
2. Restart application/redeploy previous version
3. Monitor error rates return to baseline

**Impact:**
- Falls back to Flowise vector operations
- No data loss (vectors exist in both systems during transition)
- RAG functionality continues with Flowise

### Partial Rollback (< 30 minutes)

**Scenario:** Issues with specific operations

**Steps:**
1. Identify problematic operation (upsert/query/delete)
2. Comment out Pinecone service call
3. Restore Flowise equivalent
4. Deploy updated code

**Example:**
```typescript
// Temporarily disable Pinecone upsert
async function uploadVectors(namespace: string, vectors: VectorRecord[]) {
  // TODO: Fix Pinecone issue
  // return upsertVectors(namespace, vectors);

  // Fallback to Flowise
  return flowiseService.insertVectorStore(...);
}
```

### Data Recovery (< 2 hours)

**Scenario:** Data corruption or loss in Pinecone

**Steps:**
1. Stop all write operations to Pinecone
2. Run data validation script to identify affected namespaces
3. Re-process documents through embedding pipeline
4. Validate vector counts match expected values

**Prevention:**
- Keep Flowise vector store as backup during migration
- Implement data validation in migration script
- Run test migrations on staging environment first

---

## Testing & Validation

### Unit Test Coverage

**Required Test Cases:**

1. **Namespace Validation:**
   - Valid formats: `assistant123`, `assistant-abc-123`
   - Invalid formats: `Assistant-123`, `ab`, `a`.repeat(64), `--assistant`
   - Edge cases: empty string, null, special characters

2. **Vector Validation:**
   - Valid vectors with proper structure
   - Missing fields (id, values, metadata)
   - Zero-dimension embeddings
   - Standard dimensions (1536, 3072)

3. **Upsert Operations:**
   - Single batch (< 100 vectors)
   - Multiple batches (> 100 vectors)
   - Concurrent batch processing
   - Metadata preservation

4. **Query Operations:**
   - Valid queries with topK
   - Invalid query embeddings (empty array)
   - Invalid topK values (0, > 10000)
   - Result format validation

5. **Delete Operations:**
   - Delete namespace
   - Delete by IDs
   - Empty IDs array rejection

6. **Error Handling:**
   - Missing API key
   - Missing index name
   - Retry logic on transient errors
   - Validation error fast-fail

**Run Tests:**
```bash
npm test                           # All unit tests
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report
```

### Integration Test Checklist

**Manual Integration Tests:**

1. **Environment Setup:**
   - [ ] Pinecone API key configured
   - [ ] Pinecone index exists and is accessible
   - [ ] Test namespace created

2. **Upsert-Query-Delete Cycle:**
   - [ ] Upsert 100 vectors successfully
   - [ ] Query returns relevant results
   - [ ] Get stats shows correct count
   - [ ] Delete namespace removes all vectors

3. **Large Batch Test:**
   - [ ] Upsert 1000+ vectors
   - [ ] Verify batch processing
   - [ ] Check processing time < 20s

4. **Error Recovery:**
   - [ ] Simulate network error during upsert
   - [ ] Verify retry logic works
   - [ ] Confirm partial success handling

**Run Integration Tests:**
```bash
RUN_INTEGRATION_TESTS=true npm run test:integration
```

### Validation Checkpoints

**After Deployment:**

1. **Functionality Check:**
   - [ ] Can upload new documents
   - [ ] Vectors appear in Pinecone dashboard
   - [ ] RAG queries return relevant results
   - [ ] Document deletion removes vectors

2. **Performance Check:**
   - [ ] Average upsert time < 10s for 1000 vectors
   - [ ] Average query time < 1s
   - [ ] No timeout errors in logs

3. **Data Integrity Check:**
   - [ ] Vector counts match expectations
   - [ ] Metadata preserved correctly
   - [ ] No duplicate vectors in Pinecone

4. **Error Monitoring:**
   - [ ] No increase in error rates
   - [ ] Retry logic working as expected
   - [ ] Validation errors caught early

---

## Performance & Security Considerations

### Performance Optimization Techniques

1. **Connection Pooling:**
   - Singleton pattern reuses Pinecone client
   - Lazy initialization on first use
   - Pre-initialize at app startup for best performance

2. **Batch Optimization:**
   - Default: 100 vectors per batch (configurable)
   - Balance between API call overhead and payload size
   - Larger batches = fewer API calls but longer timeout risk

3. **Concurrent Processing:**
   - Default: 5 concurrent batches (configurable)
   - Respects Pinecone rate limits
   - Can be increased for higher-tier plans

4. **Retry Strategy:**
   - Exponential backoff: 1s → 2s → 4s
   - Reduces load on Pinecone during issues
   - Improves success rate for transient failures

5. **Timeout Management:**
   - 30s default timeout per operation
   - Prevents hanging requests
   - Allows time for retries

### Security Best Practices

1. **API Key Management:**
   - Store in server-side environment variables only
   - Never use `NEXT_PUBLIC_` prefix for new code
   - Rotate keys periodically

2. **Input Validation:**
   - Validate namespace format before API calls
   - Validate vector structure before processing
   - Sanitize error messages before logging

3. **Rate Limiting:**
   - Service respects Pinecone rate limits
   - Concurrent processing limits prevent abuse
   - Exponential backoff on rate limit errors

4. **Error Handling:**
   - No sensitive data in error messages
   - API keys sanitized from logs
   - Detailed errors for debugging, safe errors for users

5. **Access Control:**
   - Service runs server-side only (no client exposure)
   - Namespace isolation prevents cross-tenant access
   - RLS policies in Supabase enforce account boundaries

### Monitoring and Observability

**Recommended Metrics:**

1. **Operation Metrics:**
   - Upsert count per hour
   - Query latency (p50, p95, p99)
   - Error rate by operation type
   - Retry rate

2. **Resource Metrics:**
   - Pinecone index utilization
   - Vector count per namespace
   - Storage usage
   - API request rate

3. **Cost Metrics:**
   - Pinecone pod hours
   - Estimated monthly cost
   - Cost per document processed

**Logging Strategy:**

```typescript
// Service includes structured logging
console.log({
  operation: 'upsert',
  namespace: 'assistant-abc123',
  vectorCount: 100,
  batchCount: 1,
  processingTime: 500,
  timestamp: new Date().toISOString(),
});
```

---

## Risk Assessment

### High Risk Items

1. **Pinecone API Availability**
   - **Risk**: Service outage blocks document uploads
   - **Mitigation**: Implement retry logic, queue failed operations, fallback to Flowise
   - **Impact**: High (critical functionality)

2. **Rate Limit Exceeds**
   - **Risk**: High traffic exceeds Pinecone plan limits
   - **Mitigation**: Concurrent processing limits, exponential backoff, upgrade plan
   - **Impact**: Medium (temporary degradation)

3. **Data Migration Errors**
   - **Risk**: Vectors lost or corrupted during Flowise → Pinecone migration
   - **Mitigation**: Dual-write during transition, validation scripts, rollback plan
   - **Impact**: High (data loss)

### Medium Risk Items

1. **Performance Degradation**
   - **Risk**: Direct Pinecone calls slower than Flowise
   - **Mitigation**: Batch optimization, concurrent processing, performance monitoring
   - **Impact**: Medium (user experience)

2. **Cost Overruns**
   - **Risk**: Pinecone costs exceed budget
   - **Mitigation**: Monitor usage, optimize storage, delete unused namespaces
   - **Impact**: Medium (operational cost)

3. **Namespace Collision**
   - **Risk**: Same namespace used for multiple assistants
   - **Mitigation**: Validation logic, unique namespace generation, database constraints
   - **Impact**: Medium (data integrity)

### Low Risk Items

1. **API Key Exposure**
   - **Risk**: API key leaked in logs or client code
   - **Mitigation**: Server-side only, sanitized errors, environment variable best practices
   - **Impact**: High (security) but Low probability

2. **SDK Breaking Changes**
   - **Risk**: Pinecone SDK update breaks service
   - **Mitigation**: Pin SDK version, test before upgrading, follow changelog
   - **Impact**: Low (controlled upgrades)

---

## Deployment Strategy

### Pre-Deployment Checklist

- [ ] Pinecone SDK installed: `@pinecone-database/pinecone@^3.0.3`
- [ ] Environment variables configured (dev, staging, prod)
- [ ] Unit tests passing (100% coverage for critical paths)
- [ ] Integration tests run manually (optional)
- [ ] Code reviewed and approved
- [ ] Documentation updated

### Deployment Steps

1. **Deploy to Staging:**
   - Deploy service code
   - Run smoke tests
   - Validate with test documents
   - Monitor for errors

2. **Deploy to Production:**
   - Enable feature flag: `NEXT_PUBLIC_USE_PINECONE_DIRECT=false` (off initially)
   - Deploy service code
   - Verify no errors in logs
   - Enable feature flag: `NEXT_PUBLIC_USE_PINECONE_DIRECT=true`
   - Monitor closely for 24 hours

3. **Post-Deployment:**
   - Validate RAG query quality
   - Monitor performance metrics
   - Check Pinecone dashboard for vector counts
   - Confirm no increase in error rates

### Rollback Criteria

**Immediate Rollback If:**
- Error rate > 5% for any operation
- Average latency > 10s for upserts
- Data integrity issues detected
- Pinecone API unavailable for > 5 minutes

**Planned Rollback If:**
- Cost exceeds budget by 50%
- Performance consistently worse than Flowise
- User-reported RAG quality degradation

---

## Appendix

### A. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PINECONE_API_KEY` | Yes | - | Pinecone API key (pc-xxx format) |
| `PINECONE_INDEX` | Yes | - | Pinecone index name |
| `PINECONE_ENVIRONMENT` | No | Auto-detect | Pinecone region (e.g., us-east-1-aws) |
| `NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE` | Legacy | - | Fallback API key (to be deprecated) |
| `NEXT_PUBLIC_PINECONE_INDEX` | Legacy | - | Fallback index name (to be deprecated) |
| `NEXT_PUBLIC_USE_PINECONE_DIRECT` | No | false | Feature flag to enable direct Pinecone |

### B. API Response Formats

**Upsert Response:**
```typescript
{
  upsertedCount: 100,
  namespace: "assistant-abc123",
  processingTime: 1234,
  batchCount: 1,
  errors: undefined // or string[] if partial failure
}
```

**Query Response:**
```typescript
[
  {
    id: "doc-1-chunk-0",
    score: 0.95,
    metadata: {
      text: "Original text chunk...",
      documentId: "doc-1",
      chunkIndex: 0,
      // ... other metadata
    }
  },
  // ... more results
]
```

**Delete Response:**
```typescript
{
  deleted: true,
  namespace: "assistant-abc123"
}
```

**Stats Response:**
```typescript
{
  vectorCount: 1500,
  dimension: 1536,
  namespace: "assistant-abc123"
}
```

### C. Common Error Codes

| Code | Type | Retryable | Description |
|------|------|-----------|-------------|
| `VALIDATION_ERROR` | User Error | No | Invalid input (namespace, vectors, etc.) |
| `CONNECTION_ERROR` | System Error | Yes | Failed to connect to Pinecone |
| `TIMEOUT_ERROR` | System Error | Yes | Operation exceeded timeout |
| `QUOTA_ERROR` | User Error | No | Pinecone plan limit exceeded |
| `UPSERT_ERROR` | System Error | Yes | Failed to upsert vectors |
| `QUERY_ERROR` | System Error | Yes | Failed to query vectors |
| `DELETE_NAMESPACE_ERROR` | System Error | Yes | Failed to delete namespace |
| `DELETE_VECTORS_ERROR` | System Error | Yes | Failed to delete vectors by ID |
| `STATS_ERROR` | System Error | Yes | Failed to get namespace stats |
| `MAX_RETRIES_EXCEEDED` | System Error | No | All retry attempts exhausted |

### D. Pinecone Dashboard Access

**Monitoring:**
- Dashboard: https://app.pinecone.io/
- Index stats: Number of vectors, dimensions, namespaces
- API metrics: Request rate, latency, errors
- Cost tracking: Storage usage, pod hours

**Useful Queries:**
- List all namespaces: Check index stats in dashboard
- Vector count by namespace: Use `getNamespaceStats(namespace)`
- Recent operations: Check Pinecone logs in dashboard

### E. Troubleshooting Guide

**Issue: Connection timeout**
- **Cause**: Network issues or Pinecone API slow
- **Solution**: Increase timeout, check network, verify Pinecone status

**Issue: Rate limit exceeded**
- **Cause**: Too many concurrent requests
- **Solution**: Reduce `maxConcurrent`, add delays between operations

**Issue: Namespace not found**
- **Cause**: Namespace doesn't exist or was deleted
- **Solution**: Verify namespace in Pinecone dashboard, check spelling

**Issue: Vector dimension mismatch**
- **Cause**: Index configured for different dimensions
- **Solution**: Verify embedding model matches index dimensions (1536 vs 3072)

**Issue: Authentication error**
- **Cause**: Invalid or expired API key
- **Solution**: Check environment variables, regenerate API key in Pinecone dashboard

---

## Summary

This implementation plan provides a comprehensive roadmap for implementing the Pinecone Vector Store Service (INTEL-003). The service is designed with production-ready features including:

- **Robust architecture**: Singleton pattern with lazy initialization and connection pooling
- **Performance optimization**: Batch processing (100 vectors/batch), concurrent operations (max 5)
- **Reliability**: Retry logic with exponential backoff, timeout management (30s)
- **Security**: Server-side only, API key protection, sanitized errors
- **Observability**: Structured logging, usage statistics, operation metrics
- **Testing**: Comprehensive unit tests, optional integration tests
- **Migration safety**: Feature flags, dual-write support, rollback plan

The service integrates seamlessly with the existing embedding service (INTEL-001/INTEL-002) and maintains compatibility with the multi-tenant namespace pattern used throughout the IntelliAA platform.

**Next Steps:**
1. Review this plan with the development team
2. Install Pinecone SDK and dependencies
3. Implement service following the provided code
4. Write and run unit tests
5. Deploy to staging for validation
6. Execute migration plan in phases
7. Monitor performance and adjust configuration as needed
