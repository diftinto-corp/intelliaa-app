// ============================================================================
// VAPI Type Definitions
// Created: 2025-10-02 (INTEL-002)
// Description: TypeScript types for VAPI API integration
// ============================================================================

/**
 * VAPI Knowledge Base Provider Types
 * - 'google': VAPI-hosted vector search (default)
 * - 'custom-knowledge-base': Webhook-based custom KB
 */
export type VapiKBProvider = 'google' | 'custom-knowledge-base';

/**
 * Knowledge Base Status
 * - 'active': KB is operational
 * - 'inactive': KB is disabled
 * - 'error': KB creation/update failed
 * - 'syncing': KB is being updated
 */
export type VapiKBStatus = 'active' | 'inactive' | 'error' | 'syncing';

/**
 * VAPI Knowledge Base Configuration (API Request)
 */
export interface VapiKBCreateRequest {
  name: string;
  description?: string;
  provider?: VapiKBProvider;
  fileIds?: string[]; // VAPI file IDs (max 100 per request)
  serverUrl?: string; // For custom-knowledge-base provider
}

/**
 * VAPI Knowledge Base Response (API Response)
 */
export interface VapiKBResponse {
  id: string; // VAPI knowledge base ID
  name: string;
  description?: string;
  provider: VapiKBProvider;
  fileIds: string[];
  serverUrl?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * VAPI Knowledge Base Update Request
 */
export interface VapiKBUpdateRequest {
  name?: string;
  description?: string;
  fileIds?: string[]; // Replaces existing file list
  serverUrl?: string;
}

/**
 * VAPI Query Tool Configuration
 * Used in assistant.tools array
 */
export interface VapiQueryToolConfig {
  type: 'knowledgeBase';
  knowledgeBaseId: string; // VAPI KB ID
  server?: {
    url: string;
    secret?: string;
  };
  function?: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Database Record for vapi_knowledge_bases table
 */
export interface VapiKnowledgeBase {
  id: string; // UUID
  account_id: string; // UUID
  vapi_kb_id: string; // VAPI API ID
  name: string;
  description: string | null;
  provider: VapiKBProvider;
  vapi_file_ids: string[]; // Array of VAPI file IDs
  file_count: number; // Auto-computed by trigger
  assistant_id: string | null; // UUID
  tool_name: string | null;
  tool_description: string | null;
  custom_server_url: string | null;
  custom_server_secret: string | null;
  status: VapiKBStatus;
  error_message: string | null;
  created_by: string | null; // UUID
  updated_by: string | null; // UUID
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  deleted_at: string | null; // ISO 8601
  last_synced_at: string | null; // ISO 8601
}

/**
 * Knowledge Base Creation Input (from UI/API)
 */
export interface CreateKnowledgeBaseInput {
  accountId: string;
  name: string;
  description?: string;
  provider?: VapiKBProvider;
  fileIds: string[]; // VAPI file IDs
  assistantId?: string;
  toolName?: string;
  toolDescription?: string;
  customServerUrl?: string;
  customServerSecret?: string;
}

/**
 * Knowledge Base Update Input (from UI/API)
 */
export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
  fileIds?: string[]; // Replaces existing
  addFileIds?: string[]; // Adds to existing
  removeFileIds?: string[]; // Removes from existing
  assistantId?: string | null;
  toolName?: string;
  toolDescription?: string;
  customServerUrl?: string;
  customServerSecret?: string;
  status?: VapiKBStatus;
}

/**
 * Service Method Return Type
 */
export interface VapiKBServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
  };
}

/**
 * Batch Operation Result
 */
export interface VapiBatchOperationResult {
  totalFiles: number;
  batches: number;
  successCount: number;
  failedBatches: Array<{
    batchIndex: number;
    fileIds: string[];
    error: string;
  }>;
}

/**
 * VAPI Error Response
 */
export interface VapiErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
  };
}

/**
 * List Knowledge Bases Filter
 */
export interface ListKBFilter {
  accountId: string;
  assistantId?: string;
  status?: VapiKBStatus;
  provider?: VapiKBProvider;
  includeDeleted?: boolean;
}

/**
 * Knowledge Base with Assistant Info (joined query)
 */
export interface VapiKBWithAssistant extends VapiKnowledgeBase {
  assistant?: {
    id: string;
    namespace: string;
    name: string | null;
  };
}
