'use server';

// ============================================================================
// Document Storage Assignment Server Actions (WhatsApp Assistants)
// Created: 2025-10-04 (INTEL-009)
// Description: Server actions for assigning/unassigning document storages to WhatsApp assistants
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import { client as railwayClient } from '@/lib/graphqlClient';
import { gql } from '@apollo/client/core/core.cjs';

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
    namespaces?: string[];
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

const RAILWAY_ENVIRONMENT_ID = '708c1410-af63-470b-96c8-6f03682691ab';

// ============================================================================
// Railway Helper Functions
// ============================================================================

/**
 * Updates WhatsApp bot namespace configuration in Railway
 * @param serviceId - Railway service ID
 * @param namespaces - Array of Pinecone namespaces
 * @returns Success status
 */
async function updateWhatsAppBotNamespaces(
  serviceId: string,
  namespaces: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const namespacesString = namespaces.join(',');

    const result = await railwayClient.mutate({
      mutation: gql`
        mutation UpdateServiceVariables(
          $serviceId: String!
          $environmentId: String!
          $variables: ServiceVariables!
        ) {
          variableCollectionUpsert(
            input: {
              serviceId: $serviceId
              environmentId: $environmentId
              variables: $variables
            }
          ) {
            id
          }
        }
      `,
      variables: {
        serviceId,
        environmentId: RAILWAY_ENVIRONMENT_ID,
        variables: {
          PINECONE_NAMESPACES: namespacesString,
        },
      },
    });

    if (result.errors) {
      console.error('Railway GraphQL errors:', result.errors);
      return {
        success: false,
        error: result.errors[0]?.message || 'RAILWAY_UPDATE_FAILED',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Railway update failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'RAILWAY_UPDATE_FAILED',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets all namespaces for a WhatsApp assistant
 * @param supabase - Supabase client
 * @param assistantId - Assistant ID
 * @returns Array of namespace strings
 */
async function getNamespacesForAssistant(
  supabase: any,
  assistantId: string
): Promise<string[]> {
  const { data: assignments } = await supabase
    .from('document_storage-assistants')
    .select(
      `
      document_storage:document_storages!inner(
        namespace
      )
    `
    )
    .eq('assistant', assistantId);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Extract namespaces from nested structure
  const namespaces = assignments
    .map((assignment: any) => {
      const storage = Array.isArray(assignment.document_storage)
        ? assignment.document_storage[0]
        : assignment.document_storage;
      return storage?.namespace;
    })
    .filter((ns: string | undefined): ns is string => !!ns);

  // Remove duplicates and sort
  return Array.from(new Set<string>(namespaces)).sort();
}

// ============================================================================
// Main Server Actions
// ============================================================================

/**
 * Assigns a document storage to a WhatsApp assistant
 * Creates Railway config update and inserts junction table record
 *
 * @param assistantId - UUID of the assistant
 * @param documentStorageId - UUID of the document storage
 * @returns AssignmentResult with success/error status
 */
export async function assignDocumentStorageToWhatsAppAssistant(
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
      .select('id, account_id, service_id_rw, name, namespace, activated_whatsApp')
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
    // PHASE 5: Get Current Namespaces
    // ========================================================================

    const currentNamespaces = await getNamespacesForAssistant(supabase, assistantId);
    const updatedNamespaces = [...currentNamespaces, storage.namespace];

    // ========================================================================
    // PHASE 6: Update Railway Config (CRITICAL - Do Before DB)
    // ========================================================================

    // Only update Railway if assistant is deployed
    if (assistant.service_id_rw && assistant.activated_whatsApp) {
      const railwayResult = await updateWhatsAppBotNamespaces(
        assistant.service_id_rw,
        updatedNamespaces
      );

      if (!railwayResult.success) {
        console.error('Railway update failed:', railwayResult.error);
        return {
          success: false,
          message: 'Error al actualizar configuración de WhatsApp',
          error: railwayResult.error,
        };
      }
    }

    // ========================================================================
    // PHASE 7: Insert DB Record (After Railway Success)
    // ========================================================================

    try {
      const { data: assignment, error: insertError } = await supabase
        .from('document_storage-assistants')
        .insert({
          assistant: assistantId,
          document_storage: documentStorageId,
        })
        .select('id, assistant, document_storage, created_at')
        .single();

      if (insertError) {
        // CRITICAL: Rollback Railway changes
        console.error('DB insert failed, rolling back Railway:', insertError);

        if (assistant.service_id_rw && assistant.activated_whatsApp) {
          try {
            // Restore previous namespace array
            await updateWhatsAppBotNamespaces(
              assistant.service_id_rw,
              currentNamespaces
            );
          } catch (rollbackError) {
            // Log rollback failure (requires manual intervention)
            console.error('CRITICAL: Railway rollback failed:', rollbackError);
          }
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

      // ======================================================================
      // PHASE 8: Update Namespaces Cache (Optional)
      // ======================================================================

      await supabase
        .from('assistants')
        .update({ namespaces: updatedNamespaces })
        .eq('id', assistantId);

      return {
        success: true,
        message: `Almacenamiento "${storage.name}" asignado correctamente`,
        data: {
          ...assignment,
          namespaces: updatedNamespaces,
        },
      };
    } catch (error) {
      console.error('Unexpected error during assignment:', error);

      // Attempt Railway rollback
      if (assistant.service_id_rw && assistant.activated_whatsApp) {
        try {
          await updateWhatsAppBotNamespaces(
            assistant.service_id_rw,
            currentNamespaces
          );
        } catch (rollbackError) {
          console.error('CRITICAL: Railway rollback failed:', rollbackError);
        }
      }

      return {
        success: false,
        message: 'Error inesperado al asignar almacenamiento',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  } catch (error) {
    console.error('Unexpected error in assignDocumentStorageToWhatsAppAssistant:', error);
    return {
      success: false,
      message: 'Error inesperado al asignar almacenamiento',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Unassigns a document storage from a WhatsApp assistant
 * Removes Railway config and deletes junction table record
 *
 * @param assignmentId - UUID of the assignment record
 * @returns AssignmentResult with success/error status
 */
export async function unassignDocumentStorageFromWhatsAppAssistant(
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
          service_id_rw,
          activated_whatsApp,
          account_id,
          name
        ),
        document_storage:document_storages!inner(
          id,
          name,
          namespace
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

    const storageData = Array.isArray(assignment.document_storage)
      ? assignment.document_storage[0]
      : assignment.document_storage;

    // ========================================================================
    // PHASE 3: Get Updated Namespaces (Excluding This One)
    // ========================================================================

    const currentNamespaces = await getNamespacesForAssistant(supabase, assistantData.id);
    const updatedNamespaces = currentNamespaces.filter(
      (ns) => ns !== storageData.namespace
    );

    // ========================================================================
    // PHASE 4: Remove from Railway (Best Effort - Non-Blocking)
    // ========================================================================

    let railwayCleanupFailed = false;

    if (assistantData.service_id_rw && assistantData.activated_whatsApp) {
      const railwayResult = await updateWhatsAppBotNamespaces(
        assistantData.service_id_rw,
        updatedNamespaces
      );

      if (!railwayResult.success) {
        console.warn('Railway cleanup failed (non-critical):', railwayResult.error);
        railwayCleanupFailed = true;
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

    // ========================================================================
    // PHASE 6: Update Namespaces Cache (Optional)
    // ========================================================================

    await supabase
      .from('assistants')
      .update({ namespaces: updatedNamespaces })
      .eq('id', assistantData.id);

    return {
      success: true,
      message: railwayCleanupFailed
        ? `Almacenamiento "${storageData.name}" desasignado (advertencia: limpieza de WhatsApp falló)`
        : `Almacenamiento "${storageData.name}" desasignado correctamente`,
      data: {
        id: assignmentId,
        assistant: assistantData.id,
        document_storage: storageData.id,
        created_at: new Date().toISOString(),
        namespaces: updatedNamespaces,
      },
    };
  } catch (error) {
    console.error('Unexpected error in unassignDocumentStorageFromWhatsAppAssistant:', error);
    return {
      success: false,
      message: 'Error inesperado al desasignar almacenamiento',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Gets all assigned storages for a WhatsApp assistant
 *
 * @param assistantId - UUID of the assistant
 * @returns Array of assigned storages
 */
export async function getAssignedStoragesForWhatsAppAssistant(
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
    console.error('Error in getAssignedStoragesForWhatsAppAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Gets available (unassigned) storages for a WhatsApp assistant
 *
 * @param assistantId - UUID of the assistant
 * @param accountId - UUID of the account
 * @returns Array of available storages
 */
export async function getAvailableStoragesForWhatsAppAssistant(
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

    const assignedIds = new Set((assignments || []).map((a) => a.document_storage));

    // Filter out assigned storages
    const availableStorages = (allStorages || []).filter(
      (storage) => !assignedIds.has(storage.id)
    );

    return { success: true, data: availableStorages };
  } catch (error) {
    console.error('Error in getAvailableStoragesForWhatsAppAssistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}
