// ============================================================================
// VAPI Knowledge Base Server Actions
// Created: 2025-10-02 (INTEL-002)
// Description: Server actions for VAPI KB management with Supabase integration
// ============================================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import {
  createKnowledgeBase as createKBService,
  updateKnowledgeBase as updateKBService,
  deleteKnowledgeBase as deleteKBService,
  getKnowledgeBase as getKBService,
  addFilesToKnowledgeBase as addFilesService,
  removeFilesFromKnowledgeBase as removeFilesService,
  createQueryToolConfig,
} from '@/services/vapiKnowledgeBaseService';
import type {
  VapiKnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
  VapiKBServiceResult,
  ListKBFilter,
  VapiKBWithAssistant,
  VapiQueryToolConfig,
} from '@/types/vapi';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the current user's ID
 */
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Validates user has access to account
 */
async function validateAccountAccess(accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) return false;

  const { data, error } = await supabase
    .from('account_user')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

// ============================================================================
// Create Knowledge Base
// ============================================================================

/**
 * Creates a new VAPI knowledge base
 * 1. Creates KB in VAPI API
 * 2. Stores metadata in Supabase
 */
export async function createVapiKnowledgeBase(
  input: CreateKnowledgeBaseInput
): Promise<VapiKBServiceResult<VapiKnowledgeBase>> {
  try {
    // Validate account access
    const hasAccess = await validateAccountAccess(input.accountId);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this account',
        },
      };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    // Create KB in VAPI
    const vapiResult = await createKBService({
      name: input.name,
      description: input.description,
      provider: input.provider || 'google',
      fileIds: input.fileIds,
      serverUrl: input.customServerUrl,
    });

    if (!vapiResult.success || !vapiResult.data) {
      return {
        success: false,
        error: vapiResult.error || {
          code: 'VAPI_ERROR',
          message: 'Failed to create knowledge base in VAPI',
        },
      };
    }

    // Store metadata in Supabase
    const supabase = await createClient();
    const { data: kbRecord, error: dbError } = await supabase
      .from('vapi_knowledge_bases')
      .insert({
        account_id: input.accountId,
        vapi_kb_id: vapiResult.data.id,
        name: input.name,
        description: input.description || null,
        provider: input.provider || 'google',
        vapi_file_ids: input.fileIds,
        assistant_id: input.assistantId || null,
        tool_name: input.toolName || null,
        tool_description: input.toolDescription || null,
        custom_server_url: input.customServerUrl || null,
        custom_server_secret: input.customServerSecret || null,
        status: 'active',
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (dbError || !kbRecord) {
      // Rollback: delete from VAPI
      await deleteKBService(vapiResult.data.id);

      console.error('Failed to store KB in database:', dbError);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to store knowledge base metadata',
        },
      };
    }

    return {
      success: true,
      data: kbRecord as VapiKnowledgeBase,
    };
  } catch (error) {
    console.error('Failed to create VAPI knowledge base:', error);

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
// Update Knowledge Base
// ============================================================================

/**
 * Updates a VAPI knowledge base
 * Supports both full replacement and incremental updates
 */
export async function updateVapiKnowledgeBase(
  kbId: string,
  input: UpdateKnowledgeBaseInput
): Promise<VapiKBServiceResult<VapiKnowledgeBase>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    const supabase = await createClient();

    // Get current KB record
    const { data: currentKB, error: fetchError } = await supabase
      .from('vapi_knowledge_bases')
      .select('*')
      .eq('id', kbId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentKB) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    // Validate account access
    const hasAccess = await validateAccountAccess(currentKB.account_id);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this knowledge base',
        },
      };
    }

    // Handle file updates
    let updatedFileIds = currentKB.vapi_file_ids;

    if (input.fileIds) {
      // Full replacement
      updatedFileIds = input.fileIds;
    } else if (input.addFileIds || input.removeFileIds) {
      // Incremental updates
      if (input.addFileIds) {
        updatedFileIds = Array.from(
          new Set([...updatedFileIds, ...input.addFileIds])
        );
      }
      if (input.removeFileIds) {
        updatedFileIds = updatedFileIds.filter(
          (id) => !input.removeFileIds!.includes(id)
        );
      }
    }

    // Update in VAPI if file list or other VAPI fields changed
    const vapiNeedsUpdate =
      input.name ||
      input.description !== undefined ||
      updatedFileIds !== currentKB.vapi_file_ids ||
      input.customServerUrl !== undefined;

    if (vapiNeedsUpdate) {
      const vapiResult = await updateKBService(currentKB.vapi_kb_id, {
        name: input.name,
        description: input.description,
        fileIds: updatedFileIds,
        serverUrl: input.customServerUrl,
      });

      if (!vapiResult.success) {
        return {
          success: false,
          error: vapiResult.error || {
            code: 'VAPI_ERROR',
            message: 'Failed to update knowledge base in VAPI',
          },
        };
      }
    }

    // Update Supabase record
    const updateData: Partial<VapiKnowledgeBase> = {
      updated_by: userId,
    };

    if (input.name) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (updatedFileIds !== currentKB.vapi_file_ids)
      updateData.vapi_file_ids = updatedFileIds;
    if (input.assistantId !== undefined)
      updateData.assistant_id = input.assistantId;
    if (input.toolName !== undefined) updateData.tool_name = input.toolName;
    if (input.toolDescription !== undefined)
      updateData.tool_description = input.toolDescription;
    if (input.customServerUrl !== undefined)
      updateData.custom_server_url = input.customServerUrl;
    if (input.customServerSecret !== undefined)
      updateData.custom_server_secret = input.customServerSecret;
    if (input.status) updateData.status = input.status;

    const { data: updatedKB, error: updateError } = await supabase
      .from('vapi_knowledge_bases')
      .update(updateData)
      .eq('id', kbId)
      .select()
      .single();

    if (updateError || !updatedKB) {
      console.error('Failed to update KB in database:', updateError);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update knowledge base metadata',
        },
      };
    }

    return {
      success: true,
      data: updatedKB as VapiKnowledgeBase,
    };
  } catch (error) {
    console.error('Failed to update VAPI knowledge base:', error);

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
// Delete Knowledge Base
// ============================================================================

/**
 * Soft deletes a VAPI knowledge base
 * Also deletes from VAPI API
 */
export async function deleteVapiKnowledgeBase(
  kbId: string
): Promise<VapiKBServiceResult<void>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    const supabase = await createClient();

    // Get KB record
    const { data: kb, error: fetchError } = await supabase
      .from('vapi_knowledge_bases')
      .select('*')
      .eq('id', kbId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !kb) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    // Validate account access
    const hasAccess = await validateAccountAccess(kb.account_id);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this knowledge base',
        },
      };
    }

    // Delete from VAPI
    const vapiResult = await deleteKBService(kb.vapi_kb_id);
    if (!vapiResult.success) {
      console.warn('Failed to delete KB from VAPI:', vapiResult.error);
      // Continue with soft delete even if VAPI delete fails
    }

    // Soft delete in Supabase using helper function
    const { error: deleteError } = await supabase.rpc('soft_delete_vapi_kb', {
      kb_id: kbId,
    });

    if (deleteError) {
      console.error('Failed to soft delete KB:', deleteError);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to delete knowledge base',
        },
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to delete VAPI knowledge base:', error);

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
// List Knowledge Bases
// ============================================================================

/**
 * Lists knowledge bases with optional filtering
 */
export async function listVapiKnowledgeBases(
  filter: ListKBFilter
): Promise<VapiKBServiceResult<VapiKBWithAssistant[]>> {
  try {
    // Validate account access
    const hasAccess = await validateAccountAccess(filter.accountId);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this account',
        },
      };
    }

    const supabase = await createClient();

    let query = supabase
      .from('vapi_knowledge_bases')
      .select(
        `
        *,
        assistant:assistants(id, namespace, name)
      `
      )
      .eq('account_id', filter.accountId);

    // Apply filters
    if (!filter.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (filter.assistantId) {
      query = query.eq('assistant_id', filter.assistantId);
    }

    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    if (filter.provider) {
      query = query.eq('provider', filter.provider);
    }

    // Order by most recent
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Failed to list knowledge bases:', error);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve knowledge bases',
        },
      };
    }

    return {
      success: true,
      data: (data || []) as VapiKBWithAssistant[],
    };
  } catch (error) {
    console.error('Failed to list VAPI knowledge bases:', error);

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
// Get Single Knowledge Base
// ============================================================================

/**
 * Gets a single knowledge base by ID
 */
export async function getVapiKnowledgeBase(
  kbId: string
): Promise<VapiKBServiceResult<VapiKBWithAssistant>> {
  try {
    const supabase = await createClient();

    const { data: kb, error } = await supabase
      .from('vapi_knowledge_bases')
      .select(
        `
        *,
        assistant:assistants(id, namespace, name)
      `
      )
      .eq('id', kbId)
      .is('deleted_at', null)
      .single();

    if (error || !kb) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    // Validate account access
    const hasAccess = await validateAccountAccess(kb.account_id);
    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have access to this knowledge base',
        },
      };
    }

    return {
      success: true,
      data: kb as VapiKBWithAssistant,
    };
  } catch (error) {
    console.error('Failed to get VAPI knowledge base:', error);

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
// File Operations
// ============================================================================

/**
 * Adds files to an existing knowledge base
 */
export async function addFilesToVapiKB(
  kbId: string,
  fileIds: string[]
): Promise<VapiKBServiceResult<VapiKnowledgeBase>> {
  return updateVapiKnowledgeBase(kbId, { addFileIds: fileIds });
}

/**
 * Removes files from an existing knowledge base
 */
export async function removeFilesFromVapiKB(
  kbId: string,
  fileIds: string[]
): Promise<VapiKBServiceResult<VapiKnowledgeBase>> {
  return updateVapiKnowledgeBase(kbId, { removeFileIds: fileIds });
}

// ============================================================================
// Query Tool Configuration
// ============================================================================

/**
 * Gets the query tool configuration for an assistant
 */
export async function getQueryToolForKB(
  kbId: string
): Promise<VapiKBServiceResult<VapiQueryToolConfig>> {
  try {
    const kbResult = await getVapiKnowledgeBase(kbId);

    if (!kbResult.success || !kbResult.data) {
      return {
        success: false,
        error: kbResult.error || {
          code: 'NOT_FOUND',
          message: 'Knowledge base not found',
        },
      };
    }

    const kb = kbResult.data;

    const queryTool = createQueryToolConfig(kb.vapi_kb_id, {
      name: kb.tool_name || undefined,
      description: kb.tool_description || undefined,
      serverUrl: kb.custom_server_url || undefined,
      serverSecret: kb.custom_server_secret || undefined,
    });

    return {
      success: true,
      data: queryTool,
    };
  } catch (error) {
    console.error('Failed to get query tool config:', error);

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
// Sync Status
// ============================================================================

/**
 * Updates the sync status of a knowledge base
 */
export async function updateKBSyncStatus(
  kbId: string,
  status: 'syncing' | 'active' | 'error',
  errorMessage?: string
): Promise<VapiKBServiceResult<void>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      };
    }

    const supabase = await createClient();

    const updateData: Partial<VapiKnowledgeBase> = {
      status,
      updated_by: userId,
      last_synced_at: new Date().toISOString(),
    };

    if (errorMessage !== undefined) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('vapi_knowledge_bases')
      .update(updateData)
      .eq('id', kbId);

    if (error) {
      console.error('Failed to update sync status:', error);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update sync status',
        },
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to update KB sync status:', error);

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
