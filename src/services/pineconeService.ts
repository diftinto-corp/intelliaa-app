/**
 * Pinecone Vector Store Service
 *
 * Provides vector storage and retrieval operations with namespace isolation
 * for multi-tenant AI assistant platform.
 *
 * @module services/pineconeService
 * @see INTEL-003 for implementation details
 */

import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Vector record structure for Pinecone operations
 */
export interface VectorRecord {
  /** Unique identifier for the vector */
  id: string;
  /** Embedding values (must match index dimension: 1536 or 3072) */
  values: number[];
  /** Associated metadata */
  metadata: {
    /** Original text content */
    text: string;
    /** Document identifier */
    documentId: string;
    /** Page number (optional, for PDFs) */
    pageNumber?: number;
    /** Chunk index within document */
    chunkIndex: number;
    /** Total number of chunks */
    totalChunks?: number;
    /** Additional custom metadata */
    [key: string]: any;
  };
}

/**
 * Query result from vector similarity search
 */
export interface QueryResult {
  /** Vector identifier */
  id: string;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Vector metadata */
  metadata: Record<string, any>;
}

/**
 * Namespace statistics
 */
export interface NamespaceStats {
  /** Total number of vectors in namespace */
  vectorCount: number;
  /** Vector dimension size */
  dimension: number;
}

/**
 * Service configuration options
 */
export interface PineconeServiceConfig {
  /** Batch size for upsert operations (default: 100) */
  batchSize?: number;
  /** Maximum concurrent batch requests (default: 5) */
  maxConcurrent?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
}

/**
 * Upsert operation options
 */
export interface UpsertOptions extends PineconeServiceConfig {}

/**
 * Query operation options
 */
export interface QueryOptions {
  /** Number of top results to return (default: 10) */
  topK?: number;
  /** Include vector values in response (default: false) */
  includeValues?: boolean;
  /** Include metadata in response (default: true) */
  includeMetadata?: boolean;
  /** Filter metadata conditions */
  filter?: Record<string, any>;
}

/**
 * Upsert operation response
 */
export interface UpsertResponse {
  /** Number of vectors successfully upserted */
  upsertedCount: number;
  /** Errors encountered during upsert (if any) */
  errors?: string[];
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for Pinecone operations
 */
export class PineconeError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'PineconeError';
  }
}

/**
 * Validation error (non-retryable)
 */
export class PineconeValidationError extends PineconeError {
  constructor(message: string) {
    super(message);
    this.name = 'PineconeValidationError';
  }
}

/**
 * Connection error (retryable)
 */
export class PineconeConnectionError extends PineconeError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'PineconeConnectionError';
  }
}

/**
 * Timeout error (retryable)
 */
export class PineconeTimeoutError extends PineconeError {
  constructor(message: string) {
    super(message);
    this.name = 'PineconeTimeoutError';
  }
}

/**
 * Quota exceeded error (non-retryable)
 */
export class PineconeQuotaError extends PineconeError {
  constructor(message: string) {
    super(message);
    this.name = 'PineconeQuotaError';
  }
}

/**
 * Configuration error (non-retryable)
 */
export class PineconeConfigError extends PineconeError {
  constructor(message: string) {
    super(message);
    this.name = 'PineconeConfigError';
  }
}

// ============================================================================
// Service Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<PineconeServiceConfig> = {
  batchSize: 100,
  maxConcurrent: 5,
  timeout: 30000,
  maxRetries: 2,
};

// ============================================================================
// Singleton Client Management
// ============================================================================

let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index<RecordMetadata> | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize Pinecone client (singleton pattern)
 */
async function initializePineconeClient(): Promise<void> {
  // Return existing initialization if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return immediately if already initialized
  if (pineconeClient && pineconeIndex) {
    return;
  }

  initializationPromise = (async () => {
    try {
      // Get API key (prioritize server-side, fallback to legacy)
      const apiKey =
        process.env.PINECONE_API_KEY ||
        process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE;

      if (!apiKey) {
        throw new PineconeConfigError(
          'PINECONE_API_KEY or NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE environment variable is required'
        );
      }

      // Get index name
      const indexName =
        process.env.PINECONE_INDEX || process.env.NEXT_PUBLIC_PINECONE_INDEX;

      if (!indexName) {
        throw new PineconeConfigError(
          'PINECONE_INDEX or NEXT_PUBLIC_PINECONE_INDEX environment variable is required'
        );
      }

      // Initialize client
      pineconeClient = new Pinecone({
        apiKey,
      });

      // Get index reference
      pineconeIndex = pineconeClient.index(indexName);

      console.log(`[PineconeService] Initialized with index: ${indexName}`);
    } catch (error) {
      // Reset state on initialization failure
      pineconeClient = null;
      pineconeIndex = null;
      initializationPromise = null;

      if (error instanceof PineconeConfigError) {
        throw error;
      }

      throw new PineconeConnectionError(
        'Failed to initialize Pinecone client',
        error as Error
      );
    }
  })();

  return initializationPromise;
}

/**
 * Get initialized Pinecone index
 */
async function getIndex(): Promise<Index<RecordMetadata>> {
  await initializePineconeClient();

  if (!pineconeIndex) {
    throw new PineconeConnectionError('Pinecone index not initialized');
  }

  return pineconeIndex;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate namespace format
 * Pattern: lowercase alphanumeric and hyphens, 3-63 chars
 * Must start/end with alphanumeric, no consecutive hyphens
 */
function validateNamespace(namespace: string): void {
  if (!namespace || typeof namespace !== 'string') {
    throw new PineconeValidationError('Namespace is required and must be a string');
  }

  if (namespace.length < 3 || namespace.length > 63) {
    throw new PineconeValidationError(
      'Namespace must be between 3 and 63 characters'
    );
  }

  // Support both new format (with hyphens) and legacy format (13-char alphanumeric)
  const namespacePattern = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  if (!namespacePattern.test(namespace)) {
    throw new PineconeValidationError(
      'Namespace must contain only lowercase letters, numbers, and hyphens. ' +
      'Must start and end with alphanumeric character. No consecutive hyphens.'
    );
  }

  // Check for consecutive hyphens
  if (namespace.includes('--')) {
    throw new PineconeValidationError('Namespace cannot contain consecutive hyphens');
  }
}

/**
 * Validate vector record structure
 */
function validateVectorRecord(vector: VectorRecord): void {
  if (!vector.id || typeof vector.id !== 'string') {
    throw new PineconeValidationError('Vector id is required and must be a string');
  }

  if (!Array.isArray(vector.values) || vector.values.length === 0) {
    throw new PineconeValidationError('Vector values must be a non-empty array');
  }

  // Check for valid numbers (no NaN, Infinity)
  const hasInvalidValues = vector.values.some(
    (v) => typeof v !== 'number' || !isFinite(v)
  );
  if (hasInvalidValues) {
    throw new PineconeValidationError(
      'Vector values must contain only finite numbers (no NaN or Infinity)'
    );
  }

  if (!vector.metadata || typeof vector.metadata !== 'object') {
    throw new PineconeValidationError('Vector metadata is required and must be an object');
  }

  if (!vector.metadata.text || typeof vector.metadata.text !== 'string') {
    throw new PineconeValidationError('Vector metadata.text is required and must be a string');
  }

  if (!vector.metadata.documentId || typeof vector.metadata.documentId !== 'string') {
    throw new PineconeValidationError('Vector metadata.documentId is required and must be a string');
  }

  if (
    typeof vector.metadata.chunkIndex !== 'number' ||
    vector.metadata.chunkIndex < 0
  ) {
    throw new PineconeValidationError(
      'Vector metadata.chunkIndex is required and must be a non-negative number'
    );
  }
}

/**
 * Validate query embedding
 */
function validateQueryEmbedding(embedding: number[]): void {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new PineconeValidationError('Query embedding must be a non-empty array');
  }

  const hasInvalidValues = embedding.some(
    (v) => typeof v !== 'number' || !isFinite(v)
  );
  if (hasInvalidValues) {
    throw new PineconeValidationError(
      'Query embedding must contain only finite numbers (no NaN or Infinity)'
    );
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // HTTP 429 (rate limit)
  if (error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Execute operation with retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = DEFAULT_CONFIG.maxRetries,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry validation errors
      if (error instanceof PineconeValidationError) {
        throw error;
      }

      // Don't retry config errors
      if (error instanceof PineconeConfigError) {
        throw error;
      }

      // Don't retry quota errors
      if (error instanceof PineconeQuotaError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      console.warn(
        `[PineconeService] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
        `retrying in ${Math.round(delay)}ms...`,
        error.message
      );

      await sleep(delay);
    }
  }

  // All retries exhausted
  throw new PineconeConnectionError(
    `${operationName} failed after ${maxRetries + 1} attempts`,
    lastError
  );
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process array in batches with concurrency control
 */
async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  maxConcurrent: number,
  processBatch: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const batches: T[][] = [];

  // Split into batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results: R[] = [];

  // Process batches with concurrency control
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const batchGroup = batches.slice(i, i + maxConcurrent);
    const groupResults = await Promise.all(
      batchGroup.map((batch) => processBatch(batch))
    );
    results.push(...groupResults);
  }

  return results;
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Upsert vectors to Pinecone with namespace isolation
 *
 * @param namespace - Namespace identifier (3-63 chars, lowercase alphanumeric + hyphens)
 * @param vectors - Array of vector records to upsert
 * @param options - Operation options (batch size, concurrency, etc.)
 * @returns Upsert response with success count and errors
 *
 * @throws {PineconeValidationError} If namespace or vector data is invalid
 * @throws {PineconeConnectionError} If connection fails
 * @throws {PineconeTimeoutError} If operation times out
 *
 * @example
 * ```typescript
 * const vectors = [
 *   {
 *     id: 'doc1-chunk-0',
 *     values: [0.1, 0.2, ...], // 1536 dimensions
 *     metadata: {
 *       text: 'Original text content',
 *       documentId: 'doc1',
 *       chunkIndex: 0,
 *     },
 *   },
 * ];
 *
 * const result = await upsertVectors('assistant-abc123', vectors);
 * console.log(`Upserted ${result.upsertedCount} vectors`);
 * ```
 */
export async function upsertVectors(
  namespace: string,
  vectors: VectorRecord[],
  options: UpsertOptions = {}
): Promise<UpsertResponse> {
  // Validate inputs
  validateNamespace(namespace);

  if (!Array.isArray(vectors) || vectors.length === 0) {
    throw new PineconeValidationError('Vectors array is required and must not be empty');
  }

  // Validate all vectors
  vectors.forEach((vector, index) => {
    try {
      validateVectorRecord(vector);
    } catch (error) {
      if (error instanceof PineconeValidationError) {
        throw new PineconeValidationError(
          `Invalid vector at index ${index}: ${error.message}`
        );
      }
      throw error;
    }
  });

  // Merge options with defaults
  const config = { ...DEFAULT_CONFIG, ...options };

  const errors: string[] = [];
  let totalUpserted = 0;

  try {
    const index = await getIndex();
    const namespaceIndex = index.namespace(namespace);

    // Process vectors in batches
    const results = await processBatches(
      vectors,
      config.batchSize,
      config.maxConcurrent,
      async (batch) => {
        return await withRetry(
          async () => {
            // Transform to Pinecone format
            const records = batch.map((vector) => ({
              id: vector.id,
              values: vector.values,
              metadata: vector.metadata,
            }));

            await namespaceIndex.upsert(records);
            return batch.length;
          },
          config.maxRetries,
          `Upsert batch of ${batch.length} vectors`
        );
      }
    );

    totalUpserted = results.reduce((sum, count) => sum + count, 0);

    console.log(
      `[PineconeService] Upserted ${totalUpserted} vectors to namespace: ${namespace}`
    );

    return {
      upsertedCount: totalUpserted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    // Handle specific error types
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    if (error.status === 402) {
      throw new PineconeQuotaError('Pinecone storage quota exceeded. Please upgrade your plan.');
    }

    if (error.status === 404) {
      throw new PineconeConfigError('Pinecone index not found. Check your PINECONE_INDEX configuration.');
    }

    throw error;
  }
}

/**
 * Query vectors by similarity within namespace
 *
 * @param namespace - Namespace to search within
 * @param queryEmbedding - Query vector embedding
 * @param options - Query options (topK, filters, etc.)
 * @returns Array of matching results with scores
 *
 * @throws {PineconeValidationError} If namespace or query embedding is invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * const queryEmbedding = [0.1, 0.2, ...]; // 1536 dimensions
 *
 * const results = await queryVectors('assistant-abc123', queryEmbedding, {
 *   topK: 5,
 *   filter: { documentId: 'doc1' }
 * });
 *
 * results.forEach(result => {
 *   console.log(`Score: ${result.score}, Text: ${result.metadata.text}`);
 * });
 * ```
 */
export async function queryVectors(
  namespace: string,
  queryEmbedding: number[],
  options: QueryOptions = {}
): Promise<QueryResult[]> {
  // Validate inputs
  validateNamespace(namespace);
  validateQueryEmbedding(queryEmbedding);

  const {
    topK = 10,
    includeValues = false,
    includeMetadata = true,
    filter,
  } = options;

  if (topK < 1 || topK > 10000) {
    throw new PineconeValidationError('topK must be between 1 and 10000');
  }

  try {
    const index = await getIndex();
    const namespaceIndex = index.namespace(namespace);

    const queryResponse = await withRetry(
      async () => {
        return await namespaceIndex.query({
          vector: queryEmbedding,
          topK,
          includeValues,
          includeMetadata,
          filter,
        });
      },
      DEFAULT_CONFIG.maxRetries,
      'Query vectors'
    );

    const results: QueryResult[] = (queryResponse.matches || []).map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata || {},
    }));

    console.log(
      `[PineconeService] Queried namespace ${namespace}, found ${results.length} results`
    );

    return results;
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    if (error.status === 404) {
      throw new PineconeConfigError('Pinecone index not found');
    }

    throw error;
  }
}

/**
 * Delete all vectors in a namespace
 *
 * @param namespace - Namespace to delete
 *
 * @throws {PineconeValidationError} If namespace is invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * await deleteNamespace('assistant-abc123');
 * console.log('Namespace deleted successfully');
 * ```
 */
export async function deleteNamespace(namespace: string): Promise<void> {
  validateNamespace(namespace);

  try {
    const index = await getIndex();
    const namespaceIndex = index.namespace(namespace);

    await withRetry(
      async () => {
        await namespaceIndex.deleteAll();
      },
      DEFAULT_CONFIG.maxRetries,
      'Delete namespace'
    );

    console.log(`[PineconeService] Deleted namespace: ${namespace}`);
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    if (error.status === 404) {
      // Namespace doesn't exist - idempotent operation
      console.log(`[PineconeService] Namespace ${namespace} does not exist (already deleted)`);
      return;
    }

    throw error;
  }
}

/**
 * Delete specific vectors by IDs within namespace
 *
 * @param namespace - Namespace containing the vectors
 * @param ids - Array of vector IDs to delete
 *
 * @throws {PineconeValidationError} If namespace or IDs are invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * await deleteVectorsByIds('assistant-abc123', ['doc1-chunk-0', 'doc1-chunk-1']);
 * console.log('Vectors deleted successfully');
 * ```
 */
export async function deleteVectorsByIds(
  namespace: string,
  ids: string[]
): Promise<void> {
  validateNamespace(namespace);

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new PineconeValidationError('IDs array is required and must not be empty');
  }

  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new PineconeValidationError('All IDs must be non-empty strings');
  }

  try {
    const index = await getIndex();
    const namespaceIndex = index.namespace(namespace);

    await withRetry(
      async () => {
        await namespaceIndex.deleteMany(ids);
      },
      DEFAULT_CONFIG.maxRetries,
      `Delete ${ids.length} vectors`
    );

    console.log(
      `[PineconeService] Deleted ${ids.length} vectors from namespace: ${namespace}`
    );
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    throw error;
  }
}

/**
 * INTEL-006: Query vector IDs by metadata filter
 *
 * Finds all vector IDs matching a metadata filter within a namespace.
 * This is useful for identifying vectors to delete when removing a document.
 *
 * @param namespace - Namespace to search within
 * @param filter - Metadata filter conditions (e.g., { documentId: 'doc-123' })
 * @param options - Query options (defaults: topK=10000 to get all matches)
 * @returns Array of vector IDs matching the filter
 *
 * @throws {PineconeValidationError} If namespace or filter is invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * // Find all vectors for a specific document
 * const vectorIds = await queryVectorIdsByMetadata('assistant-abc123', {
 *   documentId: 'unique-pdf-doc-123'
 * });
 *
 * // Then delete them
 * if (vectorIds.length > 0) {
 *   await deleteVectorsByIds('assistant-abc123', vectorIds);
 * }
 * ```
 */
export async function queryVectorIdsByMetadata(
  namespace: string,
  filter: Record<string, any>,
  options: { topK?: number } = {}
): Promise<string[]> {
  validateNamespace(namespace);

  if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
    throw new PineconeValidationError('Filter is required and must be a non-empty object');
  }

  const { topK = 10000 } = options;

  try {
    const index = await getIndex();
    const namespaceIndex = index.namespace(namespace);

    // We need a dummy vector for the query (Pinecone requires it)
    // Use a zero vector - we only care about metadata filtering, not similarity
    const stats = await index.describeIndexStats();
    const dimension = stats.dimension || 1536;
    const dummyVector = new Array(dimension).fill(0);

    const queryResponse = await withRetry(
      async () => {
        return await namespaceIndex.query({
          vector: dummyVector,
          topK,
          includeValues: false,
          includeMetadata: false, // We only need IDs
          filter,
        });
      },
      DEFAULT_CONFIG.maxRetries,
      'Query vector IDs by metadata'
    );

    const vectorIds = (queryResponse.matches || []).map((match) => match.id);

    console.log(
      `[PineconeService] Found ${vectorIds.length} vector IDs in namespace ${namespace} matching filter:`,
      filter
    );

    return vectorIds;
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    if (error.status === 404) {
      throw new PineconeConfigError('Pinecone index not found');
    }

    throw error;
  }
}

/**
 * INTEL-006: Delete vectors by metadata filter
 *
 * Convenience function that combines querying by metadata and deleting the matching vectors.
 * This is the recommended way to delete document-related vectors.
 *
 * @param namespace - Namespace containing the vectors
 * @param filter - Metadata filter conditions (e.g., { documentId: 'doc-123' })
 * @returns Number of vectors deleted
 *
 * @throws {PineconeValidationError} If namespace or filter is invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * // Delete all vectors for a specific PDF document
 * const deletedCount = await deleteVectorsByMetadata('assistant-abc123', {
 *   documentId: 'unique-pdf-doc-123'
 * });
 *
 * console.log(`Deleted ${deletedCount} vectors`);
 * ```
 */
export async function deleteVectorsByMetadata(
  namespace: string,
  filter: Record<string, any>
): Promise<number> {
  validateNamespace(namespace);

  // Find all matching vector IDs
  const vectorIds = await queryVectorIdsByMetadata(namespace, filter);

  if (vectorIds.length === 0) {
    console.log(
      `[PineconeService] No vectors found in namespace ${namespace} matching filter:`,
      filter
    );
    return 0;
  }

  // Delete them
  await deleteVectorsByIds(namespace, vectorIds);

  return vectorIds.length;
}

/**
 * Get statistics for a namespace
 *
 * @param namespace - Namespace to get stats for
 * @returns Namespace statistics (vector count, dimension)
 *
 * @throws {PineconeValidationError} If namespace is invalid
 * @throws {PineconeConnectionError} If connection fails
 *
 * @example
 * ```typescript
 * const stats = await getNamespaceStats('assistant-abc123');
 * console.log(`Namespace has ${stats.vectorCount} vectors of ${stats.dimension} dimensions`);
 * ```
 */
export async function getNamespaceStats(namespace: string): Promise<NamespaceStats> {
  validateNamespace(namespace);

  try {
    const index = await getIndex();

    const stats = await withRetry(
      async () => {
        return await index.describeIndexStats();
      },
      DEFAULT_CONFIG.maxRetries,
      'Get namespace stats'
    );

    // Get namespace-specific stats
    const namespaceStats = stats.namespaces?.[namespace];

    if (!namespaceStats) {
      return {
        vectorCount: 0,
        dimension: stats.dimension || 0,
      };
    }

    return {
      vectorCount: namespaceStats.recordCount || 0,
      dimension: stats.dimension || 0,
    };
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new PineconeConfigError('Invalid Pinecone API key or access denied');
    }

    throw error;
  }
}

/**
 * Initialize Pinecone service (optional, for pre-warming)
 * Call this at app startup to eliminate cold start latency
 *
 * @example
 * ```typescript
 * // In app startup (e.g., layout.tsx or middleware)
 * await initializePineconeService();
 * ```
 */
export async function initializePineconeService(): Promise<void> {
  await initializePineconeClient();
}
