/**
 * Vercel AI SDK Embedding Service (INTEL-001)
 *
 * This service provides document embedding generation using Vercel AI SDK
 * with OpenAI's embedding models. It replaces the Flowise dependency for
 * embedding generation while maintaining compatibility with existing systems.
 *
 * Features:
 * - PDF text extraction and parsing
 * - Recursive character-based text chunking with overlap
 * - Batch embedding generation using OpenAI
 * - Automatic retry logic with exponential backoff
 * - Cost tracking and usage statistics
 * - Pinecone-ready output format (INTEL-003)
 */

import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { pdf as parsePDF } from 'pdf-parse';
import type {
  EmbeddingServiceConfig,
  EmbeddingResult,
  GenerateEmbeddingsResponse,
  TextChunk,
  EmbeddingModel,
} from '@/types/embeddings';
import {
  EmbeddingError,
  EmbeddingValidationError,
  EmbeddingParseError,
  EmbeddingAPIError,
  EmbeddingRateLimitError,
} from '@/types/embeddings';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<EmbeddingServiceConfig, 'abortSignal' | 'metadata'>> = {
  model: 'text-embedding-ada-002',
  chunkSize: 1500,
  chunkOverlap: 750,
  maxRetries: 2, // 3 total attempts (1 initial + 2 retries)
};

/**
 * Maximum file size: 50MB
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Minimum chunk size to avoid empty or tiny chunks
 */
const MIN_CHUNK_SIZE = 100;

/**
 * Cost per 1K tokens for different models (in USD)
 */
const MODEL_COSTS: Record<EmbeddingModel, number> = {
  'text-embedding-ada-002': 0.0001,
  'text-embedding-3-small': 0.00002,
  'text-embedding-3-large': 0.00013,
};

/**
 * Recursively split text into chunks using a list of separators.
 * This implements the RecursiveCharacterTextSplitter pattern from LangChain
 * without requiring the dependency.
 *
 * Algorithm:
 * 1. Try to split by the first separator
 * 2. If chunks are still too large, recursively use the next separator
 * 3. Continue until chunks are small enough or all separators are exhausted
 * 4. Add overlap between chunks to preserve context
 *
 * @param text - The text to split
 * @param chunkSize - Maximum size of each chunk
 * @param chunkOverlap - Number of characters to overlap between chunks
 * @param separators - List of separators to try in order
 * @returns Array of text chunks
 */
function splitTextRecursive(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[] = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', '']
): string[] {
  const chunks: string[] = [];

  if (text.length <= chunkSize) {
    return [text];
  }

  // Try each separator in order
  for (const separator of separators) {
    if (separator === '') {
      // Last resort: split by character
      for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
        const end = Math.min(i + chunkSize, text.length);
        const chunk = text.slice(i, end).trim();
        if (chunk.length >= MIN_CHUNK_SIZE) {
          chunks.push(chunk);
        }
      }
      return chunks;
    }

    const splits = text.split(separator);

    // If we get good splits, process them
    if (splits.length > 1) {
      let currentChunk = '';

      for (const split of splits) {
        const testChunk = currentChunk
          ? currentChunk + separator + split
          : split;

        if (testChunk.length <= chunkSize) {
          currentChunk = testChunk;
        } else {
          // Current chunk is complete
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }

          // If this split is too large, recursively split it
          if (split.length > chunkSize) {
            const remainingSeparators = separators.slice(
              separators.indexOf(separator) + 1
            );
            const subChunks = splitTextRecursive(
              split,
              chunkSize,
              chunkOverlap,
              remainingSeparators
            );
            chunks.push(...subChunks);
            currentChunk = '';
          } else {
            currentChunk = split;
          }
        }
      }

      // Don't forget the last chunk
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // Add overlap between chunks
      if (chunkOverlap > 0 && chunks.length > 1) {
        return addOverlap(chunks, chunkOverlap);
      }

      return chunks.filter((chunk) => chunk.length >= MIN_CHUNK_SIZE);
    }
  }

  // Fallback: return as single chunk
  return [text];
}

/**
 * Add overlap between chunks to preserve context across boundaries
 *
 * @param chunks - Array of text chunks
 * @param overlap - Number of characters to overlap
 * @returns Array of chunks with overlap
 */
function addOverlap(chunks: string[], overlap: number): string[] {
  if (chunks.length <= 1 || overlap <= 0) {
    return chunks;
  }

  const overlappedChunks: string[] = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    // Take last `overlap` characters from previous chunk
    const overlapText = prevChunk.slice(-overlap);

    // Prepend to current chunk if not already included
    if (!currentChunk.startsWith(overlapText)) {
      overlappedChunks.push(overlapText + ' ' + currentChunk);
    } else {
      overlappedChunks.push(currentChunk);
    }
  }

  return overlappedChunks;
}

/**
 * Extract text from a PDF buffer and split into chunks
 *
 * @param fileBuffer - PDF file as Buffer
 * @param config - Chunking configuration
 * @returns Array of text chunks with metadata
 * @throws {EmbeddingValidationError} If file is invalid or too large
 * @throws {EmbeddingParseError} If PDF parsing fails
 */
async function chunkDocument(
  fileBuffer: Buffer,
  config: EmbeddingServiceConfig
): Promise<TextChunk[]> {
  const chunkSize = config.chunkSize ?? DEFAULT_CONFIG.chunkSize;
  const chunkOverlap = config.chunkOverlap ?? DEFAULT_CONFIG.chunkOverlap;

  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new EmbeddingValidationError('File size exceeds maximum limit', {
      maxSize: MAX_FILE_SIZE,
      actualSize: fileBuffer.length,
    });
  }

  // Validate chunk configuration
  if (chunkSize < MIN_CHUNK_SIZE) {
    throw new EmbeddingValidationError('Chunk size too small', {
      minSize: MIN_CHUNK_SIZE,
      actualSize: chunkSize,
    });
  }

  if (chunkOverlap >= chunkSize) {
    throw new EmbeddingValidationError('Chunk overlap must be less than chunk size', {
      chunkSize,
      chunkOverlap,
    });
  }

  // Parse PDF
  let pdfData: { text: string; pages?: any[]; info?: any };
  try {
    pdfData = await parsePDF(fileBuffer);
  } catch (error) {
    throw new EmbeddingParseError(
      'Failed to parse PDF file',
      {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
  }

  // Validate extracted text
  const text = pdfData.text?.trim();
  if (!text || text.length === 0) {
    throw new EmbeddingParseError('PDF contains no extractable text', {
      pages: pdfData.pages?.length ?? 0,
    });
  }

  // Split text into chunks
  const textChunks = splitTextRecursive(text, chunkSize, chunkOverlap);

  // Add metadata to each chunk
  const chunks: TextChunk[] = textChunks.map((chunkText, index) => ({
    text: chunkText,
    metadata: {
      chunkIndex: index,
      // Note: pdf-parse doesn't provide per-chunk page mapping
      // For more accurate page numbers, would need a different PDF library
    },
  }));

  return chunks;
}

/**
 * Calculate estimated cost based on token count and model
 *
 * @param tokens - Number of tokens processed
 * @param model - Embedding model used
 * @returns Estimated cost in USD
 */
function calculateCost(tokens: number, model: EmbeddingModel): number {
  const costPer1K = MODEL_COSTS[model] || MODEL_COSTS['text-embedding-ada-002'];
  return (tokens / 1000) * costPer1K;
}

/**
 * Sanitize error messages for user-facing display
 * Removes sensitive information like API keys or internal paths
 *
 * @param error - Error to sanitize
 * @returns Sanitized error message
 */
function sanitizeErrorMessage(error: Error): string {
  let message = error.message;

  // Remove potential API keys
  message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***');

  // Remove file paths
  message = message.replace(/\/[^\s]+\/[^\s]+/g, '<path>');

  return message;
}

/**
 * Generate embeddings for a PDF document
 *
 * This is the main entry point for the embedding service. It:
 * 1. Validates and parses the PDF file
 * 2. Chunks the text with overlap
 * 3. Generates embeddings using OpenAI via Vercel AI SDK
 * 4. Returns results with usage statistics
 *
 * @param file - PDF file as Buffer
 * @param config - Optional configuration
 * @returns Embedding results and usage statistics
 * @throws {EmbeddingValidationError} For invalid input
 * @throws {EmbeddingParseError} For PDF parsing errors
 * @throws {EmbeddingAPIError} For OpenAI API errors
 * @throws {EmbeddingRateLimitError} When rate limit is exceeded
 *
 * @example
 * ```typescript
 * const pdfBuffer = await fs.readFile('document.pdf');
 * const result = await generateEmbeddings(pdfBuffer, {
 *   model: 'text-embedding-ada-002',
 *   chunkSize: 1500,
 *   chunkOverlap: 750,
 * });
 *
 * console.log(`Generated ${result.results.length} embeddings`);
 * console.log(`Cost: $${result.usage.estimatedCost.toFixed(4)}`);
 * ```
 */
export async function generateEmbeddings(
  file: Buffer,
  config: EmbeddingServiceConfig = {}
): Promise<GenerateEmbeddingsResponse> {
  const startTime = Date.now();

  // Merge with defaults
  const mergedConfig: EmbeddingServiceConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const model = mergedConfig.model!;

  try {
    // Step 1: Chunk the document
    const chunks = await chunkDocument(file, mergedConfig);

    if (chunks.length === 0) {
      throw new EmbeddingValidationError('No valid chunks extracted from document');
    }

    // Step 2: Generate embeddings using Vercel AI SDK
    // The SDK automatically handles batching and rate limits
    let embeddingResults;
    try {
      embeddingResults = await embedMany({
        model: openai.embedding(model),
        values: chunks.map((chunk) => chunk.text),
        maxRetries: mergedConfig.maxRetries,
        abortSignal: mergedConfig.abortSignal,
      });
    } catch (error: any) {
      // Handle OpenAI API errors
      if (error?.statusCode === 429) {
        throw new EmbeddingRateLimitError(
          'OpenAI API rate limit exceeded',
          error?.retryAfter,
          {
            model,
            chunkCount: chunks.length,
          },
          error
        );
      }

      throw new EmbeddingAPIError(
        sanitizeErrorMessage(error),
        error?.statusCode,
        {
          model,
          chunkCount: chunks.length,
          errorType: error?.name,
        },
        error
      );
    }

    // Step 3: Combine chunks with embeddings and add metadata
    const totalChunks = chunks.length;
    const results: EmbeddingResult[] = chunks.map((chunk, index) => ({
      text: chunk.text,
      embedding: embeddingResults.embeddings[index],
      metadata: {
        ...chunk.metadata,
        totalChunks,
        chunkIndex: index,
        ...mergedConfig.metadata,
      },
    }));

    // Step 4: Calculate usage statistics
    const processingTime = Date.now() - startTime;
    const totalTokens = embeddingResults.usage.tokens;
    const estimatedCost = calculateCost(totalTokens, model);

    return {
      results,
      usage: {
        totalTokens,
        estimatedCost,
        processingTime,
        chunkCount: totalChunks,
        model,
      },
    };
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof EmbeddingError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new EmbeddingError(
      sanitizeErrorMessage(error as Error),
      'UNKNOWN_ERROR',
      {
        errorType: (error as Error)?.name,
        model,
      },
      error as Error
    );
  }
}

/**
 * Validate that a file is a valid PDF
 *
 * @param fileBuffer - File buffer to validate
 * @returns True if valid PDF
 * @throws {EmbeddingValidationError} If not a valid PDF
 */
export function validatePDF(fileBuffer: Buffer): boolean {
  // Check PDF magic number (should start with %PDF)
  const header = fileBuffer.slice(0, 5).toString('utf-8');
  if (!header.startsWith('%PDF')) {
    throw new EmbeddingValidationError('File is not a valid PDF', {
      header: header.replace(/[^\x20-\x7E]/g, ''),
    });
  }

  return true;
}

/**
 * Export text chunking function for testing
 * @internal
 */
export { splitTextRecursive, addOverlap, chunkDocument };
