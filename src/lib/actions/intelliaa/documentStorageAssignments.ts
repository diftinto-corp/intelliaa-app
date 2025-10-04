'use server';

// ============================================================================
// Document Storage Assignment Server Actions
// Created: 2025-10-04 (INTEL-008)
// Description: Server actions for assigning/unassigning document storages to voice assistants
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import { createQueryToolConfig } from '@/services/vapiKnowledgeBaseService';
import type { VapiQueryToolConfig } from '@/types/vapi';

// ============================================================================
// Types
// ============================================================================

export type AssignmentResult = {
  success: boolean;
  message: string;
  data?: {
    id: string;
    assistant: string;
    document_storage: string;
    created_at: string;
  };
  error?: string;
};

export type AssignedStorage = {
  id: string;
  created_at: string;
  storage: {
    id: string;
    name: string;
    description: string | null;
    namespace: string;
  };
};

// ============================================================================
// Constants
// ============================================================================

const VAPI_API_URL = process.env.VAPI_API_URL || 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.NEXT_PRIVATE_VAPI_KEY;
const MAX_TOOL_NAME_LENGTH = 40;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitizes tool name to meet VAPI requirements
 * - Alphanumeric and underscore only
 * - Max 40 characters
 * - Handles collisions with random suffix
 */
function sanitizeToolName(name: string, maxLength = MAX_TOOL_NAME_LENGTH): string {
  // Remove special characters, replace spaces with underscore
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Truncate if needed
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Ensure not empty
  if (!sanitized) {
    sanitized = 'knowledge_base';
  }

  return sanitized;
}

/**
 * Checks if tool name already exists in tools array
 */
function toolNameExists(tools: VapiQueryToolConfig[], name: string): boolean {
  return tools.some(
    (tool) =>
      tool.type === 'knowledgeBase' &&
      tool.function?.name === name
  );
}

/**
 * Generates unique tool name by adding random suffix if collision detected
 */
function generateUniqueToolName(
  baseName: string,
  existingTools: VapiQueryToolConfig[]
): string {
  const sanitized = sanitizeToolName(baseName);

  if (!toolNameExists(existingTools, sanitized)) {
    return sanitized;
  }

  // Add random suffix (36^4 = 1.68M combinations)
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const uniqueName = `${sanitized.substring(0, MAX_TOOL_NAME_LENGTH - 5)}_${randomSuffix}`;

  return uniqueName;
}

// ============================================================================
// VAPI Helper Functions
// ============================================================================

/**
 * Fetches VAPI assistant configuration
 */
async function getVapiAssistant(vapiAssistantId: string): Promise<any> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI API key not configured');
  }

  const response = await fetch(`${VAPI_API_URL}/assistant/${vapiAssistantId}`, {
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`VAPI API error: ${error.error?.message || 'Failed to fetch assistant'}`);
  }

  return response.json();
}

/**
 * Updates VAPI assistant configuration
 */
async function updateVapiAssistant(
  vapiAssistantId: string,
  updates: { tools: VapiQueryToolConfig[] }
): Promise<any> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI API key not configured');
  }

  const response = await fetch(`${VAPI_API_URL}/assistant/${vapiAssistantId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`VAPI API error: ${error.error?.message || 'Failed to update assistant'}`);
  }

  return response.json();
}

// ============================================================================
// Main Server Actions
// ============================================================================

/**
 * Assigns a document storage to a voice assistant
 * Creates VAPI query tool and inserts junction table record
 *
 * @param assistantId - UUID of the assistant
 * @param documentStorageId - UUID of the document storage
 * @returns AssignmentResult with success/error status
 */
export async function assignDocumentStorageToVoiceAssistant(
  assistantId: string,
  documentStorageId: string
): Promise<AssignmentResult> {
  try {
    const supabase = await createClient();

    // ========================================================================
    // PHASE 1: Authentication & Authorization
    // ========================================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: 'No autenticado',
        error: 'UNAUTHORIZED',
      };
    }

    // ========================================================================
    // PHASE 2: Fetch Assistant & Validate Access
    // ========================================================================

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('id, account_id, voice_assistant_id, name')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return {
        success: false,
        message: 'Asistente no encontrado',
        error: 'ASSISTANT_NOT_FOUND',
      };
    }

    // Validate user has access to assistant's account
    const { data: accountAccess, error: accountError } = await supabase
      .from('basejump.account_user')
      .select('account_id')
      .eq('account_id', assistant.account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountAccess) {
      return {
        success: false,
        message: 'Sin acceso a este asistente',
        error: 'FORBIDDEN',
      };
    }

    // ========================================================================
    // PHASE 3: Fetch Storage & Validate Same Account
    // ========================================================================

    const { data: storage, error: storageError } = await supabase
      .from('document_storages')
      .select('id, account_id, name, namespace')
      .eq('id', documentStorageId)
      .single();

    if (storageError || !storage) {
      return {
        success: false,
        message: 'Almacenamiento no encontrado',
        error: 'STORAGE_NOT_FOUND',
      };
    }

    // Validate same account (prevent cross-account assignments)
    if (storage.account_id !== assistant.account_id) {
      return {
        success: false,
        message: 'El almacenamiento y el asistente deben pertenecer a la misma cuenta',
        error: 'ACCOUNT_MISMATCH',
      };
    }

    // ========================================================================
    // PHASE 4: Check for Duplicate Assignment (Idempotent)
    // ========================================================================

    const { data: existingAssignment } = await supabase
      .from('document_storage-assistants')
      .select('id')
      .eq('assistant', assistantId)
      .eq('document_storage', documentStorageId)
      .single();

    if (existingAssignment) {
      return {
        success: true,
        message: 'El almacenamiento ya está asignado a este asistente',
        data: {
          id: existingAssignment.id,
          assistant: assistantId,
          document_storage: documentStorageId,
          created_at: new Date().toISOString(),
        },
      };
    }

    // ========================================================================
    // PHASE 5: Get VAPI Knowledge Base for Storage
    // ========================================================================

    // Note: After migration 20251004000003, document_storage_id will be available
    // For now, we'll try both patterns for backwards compatibility
    const { data: vapiKB, error: vapiKBError } = await supabase
      .from('vapi_knowledge_bases')
      .select('vapi_kb_id, tool_name, tool_description, document_storage_id')
      .eq('account_id', assistant.account_id)
      .is('deleted_at', null)
      .eq('status', 'active')
      .or(`document_storage_id.eq.${documentStorageId},assistant_id.eq.${assistantId}`)
      .limit(1)
      .single();

    if (vapiKBError || !vapiKB) {
      return {
        success: false,
        message: 'No se encontró knowledge base VAPI para este almacenamiento. Asegúrate de que el almacenamiento tenga archivos subidos.',
        error: 'VAPI_KB_NOT_FOUND',
      };
    }

    // Verify KB is actually linked to this storage (if document_storage_id is set)
    if (vapiKB.document_storage_id && vapiKB.document_storage_id !== documentStorageId) {
      return {
        success: false,
        message: 'El knowledge base encontrado no corresponde a este almacenamiento',
        error: 'VAPI_KB_MISMATCH',
      };
    }

    // ========================================================================
    // PHASE 6: Update VAPI Assistant (CRITICAL - Do Before DB)
    // ========================================================================

    if (!assistant.voice_assistant_id) {
      return {
        success: false,
        message: 'Este asistente no tiene configuración de voz VAPI',
        error: 'NO_VOICE_ASSISTANT',
      };
    }

    try {
      // Fetch current VAPI assistant config
      const vapiAssistant = await getVapiAssistant(assistant.voice_assistant_id);
      const currentTools: VapiQueryToolConfig[] = vapiAssistant.tools || [];

      // Create new query tool
      const toolName = generateUniqueToolName(
        vapiKB.tool_name || `search_${storage.name}`,
        currentTools
      );

      const newQueryTool = createQueryToolConfig(vapiKB.vapi_kb_id, {
        name: toolName,
        description: vapiKB.tool_description || `Buscar información en ${storage.name}`,
      });

      // Merge with existing tools
      const updatedTools = [...currentTools, newQueryTool];

      // Update VAPI assistant
      await updateVapiAssistant(assistant.voice_assistant_id, {
        tools: updatedTools,
      });

      // ======================================================================
      // PHASE 7: Insert DB Record (After VAPI Success)
      // ======================================================================

      const { data: assignment, error: insertError } = await supabase
        .from('document_storage-assistants')
        .insert({
          assistant: assistantId,
          document_storage: documentStorageId,
        })
        .select('id, assistant, document_storage, created_at')
        .single();

      if (insertError) {
        // CRITICAL: Rollback VAPI changes
        console.error('DB insert failed, rolling back VAPI:', insertError);

        try {
          // Remove the tool we just added
          const rollbackTools = currentTools; // Restore original tools
          await updateVapiAssistant(assistant.voice_assistant_id, {
            tools: rollbackTools,
          });
        } catch (rollbackError) {
          // Log rollback failure (requires manual intervention)
          console.error('CRITICAL: VAPI rollback failed:', rollbackError);
        }

        // Handle duplicate constraint error (23505) as success
        if (insertError.code === '23505') {
          return {
            success: true,
            message: 'El almacenamiento ya está asignado',
          };
        }

        return {
          success: false,
          message: 'Error al guardar la asignación',
          error: insertError.message,
        };
      }

      return {
        success: true,
        message: `Almacenamiento "${storage.name}" asignado correctamente`,
        data: assignment,
      };
    } catch (vapiError) {
      console.error('VAPI error during assignment:', vapiError);
      return {
        success: false,
        message: 'Error al actualizar configuración VAPI',
        error: vapiError instanceof Error ? vapiError.message : 'VAPI_ERROR',
      };
    }
  } catch (error) {
    console.error('Unexpected error in assignDocumentStorageToVoiceAssistant:', error);
    return {
      success: false,
      message: 'Error inesperado al asignar almacenamiento',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Unassigns a document storage from a voice assistant
 * Removes VAPI query tool and deletes junction table record
 *
 * @param assignmentId - UUID of the assignment record
 * @returns AssignmentResult with success/error status
 */
export async function unassignDocumentStorageFromVoiceAssistant(
  assignmentId: string
): Promise<AssignmentResult> {
  try {
    const supabase = await createClient();

    // ========================================================================
    // PHASE 1: Authentication & Authorization
    // ========================================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: 'No autenticado',
        error: 'UNAUTHORIZED',
      };
    }

    // ========================================================================
    // PHASE 2: Fetch Assignment with Related Data
    // ========================================================================

    const { data: assignment, error: assignmentError } = await supabase
      .from('document_storage-assistants')
      .select(
        `
        id,
        assistant:assistants!inner(
          id,
          voice_assistant_id,
          account_id,
          name
        ),
        document_storage:document_storages!inner(
          id,
          name
        )
      `
      )
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return {
        success: false,
        message: 'Asignación no encontrada',
        error: 'ASSIGNMENT_NOT_FOUND',
      };
    }

    // Validate user has access to assistant's account
    const assistantData = Array.isArray(assignment.assistant)
      ? assignment.assistant[0]
      : assignment.assistant;

    const { data: accountAccess, error: accountError } = await supabase
      .from('basejump.account_user')
      .select('account_id')
      .eq('account_id', assistantData.account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountAccess) {
      return {
        success: false,
        message: 'Sin acceso a este asistente',
        error: 'FORBIDDEN',
      };
    }

    // ========================================================================
    // PHASE 3: Get VAPI KB to find tool
    // ========================================================================

    const storageData = Array.isArray(assignment.document_storage)
      ? assignment.document_storage[0]
      : assignment.document_storage;

    // Try to find VAPI KB by document_storage_id (after migration) or assistant_id (legacy)
    const { data: vapiKB } = await supabase
      .from('vapi_knowledge_bases')
      .select('vapi_kb_id, document_storage_id')
      .eq('account_id', assistantData.account_id)
      .is('deleted_at', null)
      .or(`document_storage_id.eq.${storageData.id},assistant_id.eq.${assistantData.id}`)
      .limit(1)
      .maybeSingle();

    // ========================================================================
    // PHASE 4: Remove from VAPI (Best Effort - Non-Blocking)
    // ========================================================================

    let vapiCleanupFailed = false;

    if (assistantData.voice_assistant_id && vapiKB) {
      try {
        const vapiAssistant = await getVapiAssistant(assistantData.voice_assistant_id);
        const currentTools: VapiQueryToolConfig[] = vapiAssistant.tools || [];

        // Filter out the tool for this KB
        const updatedTools = currentTools.filter(
          (tool) =>
            !(
              tool.type === 'knowledgeBase' &&
              tool.knowledgeBaseId === vapiKB.vapi_kb_id
            )
        );

        // Only update if tool was found
        if (updatedTools.length < currentTools.length) {
          await updateVapiAssistant(assistantData.voice_assistant_id, {
            tools: updatedTools,
          });
        }
      } catch (vapiError) {
        console.warn('VAPI cleanup failed (non-critical):', vapiError);
        vapiCleanupFailed = true;
      }
    }

    // ========================================================================
    // PHASE 5: Delete DB Record (Always Succeeds)
    // ========================================================================

    const { error: deleteError } = await supabase
      .from('document_storage-assistants')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      return {
        success: false,
        message: 'Error al eliminar la asignación',
        error: deleteError.message,
      };
    }

    return {
      success: true,
      message: vapiCleanupFailed
        ? `Almacenamiento "${storageData.name}" desasignado (advertencia: limpieza VAPI falló)`
        : `Almacenamiento "${storageData.name}" desasignado correctamente`,
    };
  } catch (error) {
    console.error('Unexpected error in unassignDocumentStorageFromVoiceAssistant:', error);
    return {
      success: false,
      message: 'Error inesperado al desasignar almacenamiento',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Gets all assigned storages for an assistant
 *
 * @param assistantId - UUID of the assistant
 * @returns Array of assigned storages
 */
export async function getAssignedStoragesForAssistant(
  assistantId: string
): Promise<{ success: boolean; data?: AssignedStorage[]; error?: string }> {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    // Fetch assignments with storage details
    const { data: assignments, error: fetchError } = await supabase
      .from('document_storage-assistants')
      .select(
        `
        id,
        created_at,
        document_storage:document_storages!inner(
          id,
          name,
          description,
          namespace
        )
      `
      )
      .eq('assistant', assistantId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Transform data
    const transformedData: AssignedStorage[] = (assignments || []).map((assignment) => {
      const storage = Array.isArray(assignment.document_storage)
        ? assignment.document_storage[0]
        : assignment.document_storage;

      return {
        id: assignment.id,
        created_at: assignment.created_at,
        storage: {
          id: storage.id,
          name: storage.name,
          description: storage.description,
          namespace: storage.namespace,
        },
      };
    });

    return { success: true, data: transformedData };
  } catch (error) {
    console.error('Error in getAssignedStoragesForAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Gets available (unassigned) storages for an assistant
 *
 * @param assistantId - UUID of the assistant
 * @param accountId - UUID of the account
 * @returns Array of available storages
 */
export async function getAvailableStoragesForAssistant(
  assistantId: string,
  accountId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    description: string | null;
    namespace: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    // Get all storages in account
    const { data: allStorages, error: storagesError } = await supabase
      .from('document_storages')
      .select('id, name, description, namespace')
      .eq('account_id', accountId)
      .order('name');

    if (storagesError) {
      return { success: false, error: storagesError.message };
    }

    // Get assigned storage IDs
    const { data: assignments } = await supabase
      .from('document_storage-assistants')
      .select('document_storage')
      .eq('assistant', assistantId);

    const assignedIds = new Set(
      (assignments || []).map((a) => a.document_storage)
    );

    // Filter out assigned storages
    const availableStorages = (allStorages || []).filter(
      (storage) => !assignedIds.has(storage.id)
    );

    return { success: true, data: availableStorages };
  } catch (error) {
    console.error('Error in getAvailableStoragesForAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}
