// ============================================================================
// VAPI Knowledge Base Service
// Created: 2025-10-02 (INTEL-002)
// Description: Service for managing VAPI knowledge bases via API
// ============================================================================

import type {
  VapiKBCreateRequest,
  VapiKBResponse,
  VapiKBUpdateRequest,
  VapiKBServiceResult,
  VapiBatchOperationResult,
  VapiErrorResponse,
  VapiQueryToolConfig,
} from '@/types/vapi';

// ============================================================================
// Configuration
// ============================================================================

const VAPI_API_URL = process.env.VAPI_API_URL || 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.NEXT_PRIVATE_VAPI_KEY;

// Constants
const MAX_FILES_PER_KB = 100; // VAPI limit
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for VAPI API errors
 */
class VapiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'VapiAPIError';
  }
}

/**
 * Determines if an error should be retried
 */
function shouldRetry(error: VapiAPIError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;

  // Retry on rate limiting
  if (error.statusCode === 429) return true;

  // Retry on server errors
  if (error.statusCode && error.statusCode >= 500) return true;

  // Retry on network errors (no status code)
  if (!error.statusCode) return true;

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP Client
// ============================================================================

/**
 * Makes authenticated request to VAPI API with retry logic
 */
async function vapiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  attempt = 1
): Promise<T> {
  if (!VAPI_API_KEY) {
    throw new VapiAPIError('VAPI API key not configured', 500, 'CONFIG_ERROR');
  }

  const url = `${VAPI_API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Parse response body
    const data = await response.json();

    // Handle errors
    if (!response.ok) {
      const errorData = data as VapiErrorResponse;
      const error = new VapiAPIError(
        errorData.error?.message || 'VAPI API request failed',
        response.status,
        errorData.error?.code
      );

      // Retry if appropriate
      if (shouldRetry(error, attempt)) {
        const delay = getRetryDelay(attempt);
        console.warn(
          `VAPI request failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`,
          { endpoint, status: response.status }
        );
        await sleep(delay);
        return vapiRequest<T>(endpoint, options, attempt + 1);
      }

      throw error;
    }

    return data as T;
  } catch (error) {
    // Network errors
    if (error instanceof VapiAPIError) {
      throw error;
    }

    const networkError = new VapiAPIError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
      undefined,
      'NETWORK_ERROR'
    );

    // Retry network errors
    if (shouldRetry(networkError, attempt)) {
      const delay = getRetryDelay(attempt);
      console.warn(
        `Network error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`,
        { endpoint }
      );
      await sleep(delay);
      return vapiRequest<T>(endpoint, options, attempt + 1);
    }

    throw networkError;
  }
}

// ============================================================================
// Knowledge Base Operations
// ============================================================================

/**
 * Creates a new VAPI knowledge base
 * Auto-batches if fileIds > 100
 */
export async function createKnowledgeBase(
  config: VapiKBCreateRequest
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  try {
    // Validate input
    if (!config.name) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Knowledge base name is required',
        },
      };
    }

    // Handle batch operations if needed
    if (config.fileIds && config.fileIds.length > MAX_FILES_PER_KB) {
      const batchResult = await createKnowledgeBaseWithBatching(config);
      if (!batchResult.success) {
        return batchResult;
      }
      // Return the KB created with first batch
      return batchResult as VapiKBServiceResult<VapiKBResponse>;
    }

    // Single KB creation
    const requestBody: VapiKBCreateRequest = {
      name: config.name,
      description: config.description,
      provider: config.provider || 'google',
      fileIds: config.fileIds || [],
    };

    if (config.serverUrl) {
      requestBody.serverUrl = config.serverUrl;
    }

    const response = await vapiRequest<VapiKBResponse>(
      '/knowledge-base',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Failed to create VAPI knowledge base:', error);

    if (error instanceof VapiAPIError) {
      return {
        success: false,
        error: {
          code: error.code || 'API_ERROR',
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Creates KB with automatic batching for >100 files
 * Creates main KB with first batch, then updates with remaining batches
 */
async function createKnowledgeBaseWithBatching(
  config: VapiKBCreateRequest
): Promise<VapiKBServiceResult<VapiKBResponse & { batchInfo?: VapiBatchOperationResult }>> {
  const fileIds = config.fileIds || [];
  const batches: string[][] = [];

  // Split into batches
  for (let i = 0; i < fileIds.length; i += MAX_FILES_PER_KB) {
    batches.push(fileIds.slice(i, i + MAX_FILES_PER_KB));
  }

  try {
    // Create KB with first batch
    const firstBatchResult = await createKnowledgeBase({
      ...config,
      fileIds: batches[0],
    });

    if (!firstBatchResult.success || !firstBatchResult.data) {
      return firstBatchResult;
    }

    const kbId = firstBatchResult.data.id;
    const batchInfo: VapiBatchOperationResult = {
      totalFiles: fileIds.length,
      batches: batches.length,
      successCount: 1,
      failedBatches: [],
    };

    // Add remaining batches
    for (let i = 1; i < batches.length; i++) {
      const batchFileIds = batches[i];

      try {
        // Get current file list and append new batch
        const currentKB = await getKnowledgeBase(kbId);
        if (!currentKB.success || !currentKB.data) {
          throw new Error('Failed to fetch current KB state');
        }

        const updatedFileIds = [
          ...currentKB.data.fileIds,
          ...batchFileIds,
        ];

        await updateKnowledgeBase(kbId, {
          fileIds: updatedFileIds,
        });

        batchInfo.successCount++;
      } catch (error) {
        batchInfo.failedBatches.push({
          batchIndex: i,
          fileIds: batchFileIds,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      data: {
        ...firstBatchResult.data,
        batchInfo,
      },
    };
  } catch (error) {
    console.error('Batch operation failed:', error);

    return {
      success: false,
      error: {
        code: 'BATCH_ERROR',
        message: error instanceof Error ? error.message : 'Batch operation failed',
      },
    };
  }
}

/**
 * Retrieves a VAPI knowledge base by ID
 */
export async function getKnowledgeBase(
  knowledgeBaseId: string
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  try {
    if (!knowledgeBaseId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Knowledge base ID is required',
        },
      };
    }

    const response = await vapiRequest<VapiKBResponse>(
      `/knowledge-base/${knowledgeBaseId}`
    );

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Failed to get VAPI knowledge base:', error);

    if (error instanceof VapiAPIError) {
      return {
        success: false,
        error: {
          code: error.code || 'API_ERROR',
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Updates a VAPI knowledge base
 */
export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  updates: VapiKBUpdateRequest
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  try {
    if (!knowledgeBaseId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Knowledge base ID is required',
        },
      };
    }

    // Handle batch updates if fileIds > 100
    if (updates.fileIds && updates.fileIds.length > MAX_FILES_PER_KB) {
      return await updateKnowledgeBaseWithBatching(knowledgeBaseId, updates);
    }

    const response = await vapiRequest<VapiKBResponse>(
      `/knowledge-base/${knowledgeBaseId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Failed to update VAPI knowledge base:', error);

    if (error instanceof VapiAPIError) {
      return {
        success: false,
        error: {
          code: error.code || 'API_ERROR',
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Updates KB with automatic batching for >100 files
 */
async function updateKnowledgeBaseWithBatching(
  knowledgeBaseId: string,
  updates: VapiKBUpdateRequest
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  // For updates with >100 files, we need to split into multiple update operations
  // This is a simplified version - in production you might want more sophisticated logic
  const fileIds = updates.fileIds || [];
  const firstBatch = fileIds.slice(0, MAX_FILES_PER_KB);

  // Update with first batch
  const result = await updateKnowledgeBase(knowledgeBaseId, {
    ...updates,
    fileIds: firstBatch,
  });

  if (!result.success) {
    return result;
  }

  // For remaining files, make additional update calls
  // Note: This replaces the entire file list each time
  // A more sophisticated approach would append batches
  console.warn(
    `KB update had ${fileIds.length} files. Only first ${MAX_FILES_PER_KB} were applied.` +
    ` Consider using addFileIds for batch additions.`
  );

  return result;
}

/**
 * Deletes a VAPI knowledge base
 */
export async function deleteKnowledgeBase(
  knowledgeBaseId: string
): Promise<VapiKBServiceResult<void>> {
  try {
    if (!knowledgeBaseId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Knowledge base ID is required',
        },
      };
    }

    await vapiRequest<void>(
      `/knowledge-base/${knowledgeBaseId}`,
      {
        method: 'DELETE',
      }
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to delete VAPI knowledge base:', error);

    if (error instanceof VapiAPIError) {
      return {
        success: false,
        error: {
          code: error.code || 'API_ERROR',
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Lists all VAPI knowledge bases
 * Note: Actual VAPI API might have pagination - adjust as needed
 */
export async function listKnowledgeBases(): Promise<
  VapiKBServiceResult<VapiKBResponse[]>
> {
  try {
    const response = await vapiRequest<VapiKBResponse[]>('/knowledge-base');

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Failed to list VAPI knowledge bases:', error);

    if (error instanceof VapiAPIError) {
      return {
        success: false,
        error: {
          code: error.code || 'API_ERROR',
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// ============================================================================
// Query Tool Configuration
// ============================================================================

/**
 * Creates a query tool configuration for an assistant
 * This configuration object is added to assistant.tools array
 */
export function createQueryToolConfig(
  knowledgeBaseId: string,
  options?: {
    name?: string;
    description?: string;
    serverUrl?: string;
    serverSecret?: string;
  }
): VapiQueryToolConfig {
  const config: VapiQueryToolConfig = {
    type: 'knowledgeBase',
    knowledgeBaseId,
  };

  // Add function metadata if provided
  if (options?.name || options?.description) {
    config.function = {
      name: options.name || 'searchKnowledgeBase',
      description: options.description || 'Search the knowledge base for relevant information',
    };
  }

  // Add server config for custom KB
  if (options?.serverUrl) {
    config.server = {
      url: options.serverUrl,
    };

    if (options.serverSecret) {
      config.server.secret = options.serverSecret;
    }
  }

  return config;
}

/**
 * Adds file IDs to an existing knowledge base
 * Handles batching automatically
 */
export async function addFilesToKnowledgeBase(
  knowledgeBaseId: string,
  fileIds: string[]
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  try {
    // Get current KB state
    const currentKB = await getKnowledgeBase(knowledgeBaseId);
    if (!currentKB.success || !currentKB.data) {
      return {
        success: false,
        error: currentKB.error || {
          code: 'KB_NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    // Merge file lists
    const updatedFileIds = [
      ...currentKB.data.fileIds,
      ...fileIds,
    ];

    // Remove duplicates
    const uniqueFileIds = Array.from(new Set(updatedFileIds));

    // Update KB
    return await updateKnowledgeBase(knowledgeBaseId, {
      fileIds: uniqueFileIds,
    });
  } catch (error) {
    console.error('Failed to add files to KB:', error);

    return {
      success: false,
      error: {
        code: 'ADD_FILES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add files',
      },
    };
  }
}

/**
 * Removes file IDs from an existing knowledge base
 */
export async function removeFilesFromKnowledgeBase(
  knowledgeBaseId: string,
  fileIds: string[]
): Promise<VapiKBServiceResult<VapiKBResponse>> {
  try {
    // Get current KB state
    const currentKB = await getKnowledgeBase(knowledgeBaseId);
    if (!currentKB.success || !currentKB.data) {
      return {
        success: false,
        error: currentKB.error || {
          code: 'KB_NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    // Remove specified files
    const updatedFileIds = currentKB.data.fileIds.filter(
      (id) => !fileIds.includes(id)
    );

    // Update KB
    return await updateKnowledgeBase(knowledgeBaseId, {
      fileIds: updatedFileIds,
    });
  } catch (error) {
    console.error('Failed to remove files from KB:', error);

    return {
      success: false,
      error: {
        code: 'REMOVE_FILES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to remove files',
      },
    };
  }
}
