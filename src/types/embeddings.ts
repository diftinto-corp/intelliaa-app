/**
 * Types for Vercel AI SDK Embedding Service (INTEL-001)
 *
 * This module defines all TypeScript types and interfaces for the
 * embedding service that uses Vercel AI SDK with OpenAI.
 */

/**
 * Embedding service providers
 */
export type EmbeddingService = 'flowise' | 'vercel';

/**
 * Supported OpenAI embedding models
 */
export type EmbeddingModel =
  | 'text-embedding-ada-002'  // OpenAI Ada v2 (1536 dimensions, $0.0001/1K tokens)
  | 'text-embedding-3-small'  // OpenAI v3 Small (1536 dimensions, $0.00002/1K tokens)
  | 'text-embedding-3-large'; // OpenAI v3 Large (3072 dimensions, $0.00013/1K tokens)

/**
 * Configuration options for the embedding service
 */
export interface EmbeddingServiceConfig {
  /**
   * The OpenAI embedding model to use
   * @default 'text-embedding-ada-002'
   */
  model?: EmbeddingModel;

  /**
   * Maximum size of each text chunk in characters
   * @default 1500
   */
  chunkSize?: number;

  /**
   * Number of characters to overlap between chunks
   * @default 750
   */
  chunkOverlap?: number;

  /**
   * Maximum number of retry attempts for failed API calls
   * Note: Vercel AI SDK has built-in retry logic
   * @default 2 (3 total attempts including initial)
   */
  maxRetries?: number;

  /**
   * AbortSignal for canceling long-running operations
   */
  abortSignal?: AbortSignal;

  /**
   * Additional metadata to attach to each embedding result
   */
  metadata?: Record<string, any>;
}

/**
 * Metadata associated with each embedded text chunk
 */
export interface EmbeddingMetadata {
  /**
   * Page number in the source document (if applicable)
   */
  pageNumber?: number;

  /**
   * Index of this chunk in the document (0-based)
   */
  chunkIndex: number;

  /**
   * Total number of chunks in the document
   */
  totalChunks: number;

  /**
   * Document ID for linking to Pinecone namespace (INTEL-003)
   */
  documentId?: string;

  /**
   * Account ID for multi-tenant isolation
   */
  accountId?: string;

  /**
   * Assistant namespace for RAG functionality
   */
  namespace?: string;

  /**
   * Additional custom metadata
   */
  [key: string]: any;
}

/**
 * Result of embedding a single text chunk
 */
export interface EmbeddingResult {
  /**
   * The original text that was embedded
   */
  text: string;

  /**
   * The embedding vector (1536 dimensions for ada-002 and v3-small)
   */
  embedding: number[];

  /**
   * Metadata associated with this embedding
   */
  metadata: EmbeddingMetadata;
}

/**
 * Usage statistics for embedding generation
 */
export interface EmbeddingUsageStats {
  /**
   * Total number of tokens processed
   */
  totalTokens: number;

  /**
   * Estimated cost in USD
   */
  estimatedCost: number;

  /**
   * Processing time in milliseconds
   */
  processingTime: number;

  /**
   * Number of chunks processed
   */
  chunkCount: number;

  /**
   * Model used for embedding generation
   */
  model: EmbeddingModel;
}

/**
 * Complete response from embedding generation
 */
export interface GenerateEmbeddingsResponse {
  /**
   * Array of embedding results, one per chunk
   */
  results: EmbeddingResult[];

  /**
   * Usage statistics and cost information
   */
  usage: EmbeddingUsageStats;
}

/**
 * Base error class for embedding service errors
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public cause?: Error
  ) {
    super(message);
    this.name = 'EmbeddingError';

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EmbeddingError);
    }
  }

  /**
   * Convert error to JSON-serializable format for API responses
   */
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
 * Error thrown when file validation fails
 * Non-retryable error
 */
export class EmbeddingValidationError extends EmbeddingError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'VALIDATION_ERROR', details, cause);
    this.name = 'EmbeddingValidationError';
  }
}

/**
 * Error thrown when OpenAI API rate limit is exceeded
 * Retryable error with exponential backoff
 */
export class EmbeddingRateLimitError extends EmbeddingError {
  constructor(
    message: string,
    public retryAfter?: number,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, 'RATE_LIMIT_ERROR', details, cause);
    this.name = 'EmbeddingRateLimitError';
  }
}

/**
 * Error thrown when PDF parsing fails
 * Non-retryable error
 */
export class EmbeddingParseError extends EmbeddingError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'PARSE_ERROR', details, cause);
    this.name = 'EmbeddingParseError';
  }
}

/**
 * Error thrown when OpenAI API returns an error
 * May be retryable depending on status code
 */
export class EmbeddingAPIError extends EmbeddingError {
  constructor(
    message: string,
    public statusCode?: number,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, 'API_ERROR', details, cause);
    this.name = 'EmbeddingAPIError';
  }

  /**
   * Check if this error is retryable
   */
  get isRetryable(): boolean {
    if (!this.statusCode) return false;

    // Retry on server errors and rate limits
    return this.statusCode === 429 || (this.statusCode >= 500 && this.statusCode < 600);
  }
}

/**
 * Internal interface for text chunks before embedding
 */
export interface TextChunk {
  text: string;
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
  };
}

/**
 * Database record format for embedding usage tracking
 */
export interface EmbeddingUsageRecord {
  id?: string;
  account_id: string;
  document_id?: string;
  service: EmbeddingService;
  model: EmbeddingModel;
  total_tokens: number;
  chunk_count: number;
  estimated_cost: number;
  processing_time: number;
  created_at?: Date;
}
