/**
 * INTEL-004: Document Storage Rollback Mechanism
 *
 * Handles cleanup of partial state across distributed systems when document storage creation fails.
 * Rollback order: Database → VAPI KB → VAPI File → Pinecone (reverse of creation order)
 *
 * Key Design Principles:
 * - Non-blocking: One rollback failure doesn't prevent others from executing
 * - Logged: All rollback operations are logged for manual cleanup if needed
 * - Idempotent: Safe to retry rollback operations
 */

import { deleteNamespace } from '@/services/pineconeService';
import { vapiService } from '@/services/vapiService';
import { deleteKnowledgeBase } from '@/services/vapiKnowledgeBaseService';
import { createClient } from '@/lib/supabase/server';
import { ProcessingStep, logError } from './documentStorageErrors';

// ============================================================================
// Rollback State Types
// ============================================================================

export interface RollbackState {
  // Database IDs (if created)
  documentStorageId?: string;
  pdfDocId?: string;

  // External service IDs (if created)
  namespace?: string; // Pinecone namespace
  vapiFileId?: string; // VAPI file ID
  vapiKbId?: string; // VAPI KB ID
  vapiKbWasCreated?: boolean; // True if we created KB (vs reused existing)

  // Metadata
  accountId: string;
  fileName: string;
  failedAt: ProcessingStep;
}

export interface RollbackResult {
  success: boolean;
  rollbacksAttempted: number;
  rollbacksSucceeded: number;
  rollbacksFailed: number;
  errors: Array<{
    phase: string;
    error: string;
  }>;
}

// ============================================================================
// Main Rollback Function
// ============================================================================

/**
 * Executes rollback in reverse order of creation
 *
 * Rollback phases (in order):
 * 1. Database records (document_storages, pdf_docs)
 * 2. VAPI Knowledge Base (if created new, not if reused)
 * 3. VAPI File
 * 4. Pinecone vectors
 *
 * @param state - The rollback state containing resource IDs
 * @returns Rollback result with success counts and errors
 */
export async function executeRollback(
  state: RollbackState
): Promise<RollbackResult> {
  const result: RollbackResult = {
    success: false,
    rollbacksAttempted: 0,
    rollbacksSucceeded: 0,
    rollbacksFailed: 0,
    errors: [],
  };

  console.log('[Rollback] Starting rollback', {
    failedAt: state.failedAt,
    accountId: state.accountId,
    fileName: state.fileName,
  });

  // =========================================================================
  // Phase 1: Database Rollback (if database phase was reached)
  // =========================================================================

  if (
    state.failedAt !== ProcessingStep.VALIDATION &&
    state.failedAt !== ProcessingStep.EMBEDDING &&
    state.failedAt !== ProcessingStep.PINECONE &&
    state.failedAt !== ProcessingStep.VAPI_UPLOAD &&
    state.failedAt !== ProcessingStep.VAPI_KB
  ) {
    // Database was created, need to rollback
    result.rollbacksAttempted++;

    try {
      await rollbackDatabase(state);
      result.rollbacksSucceeded++;
      console.log('[Rollback] Database rollback succeeded');
    } catch (error) {
      result.rollbacksFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        phase: 'Database',
        error: errorMessage,
      });
      console.error('[Rollback] Database rollback failed:', error);
    }
  }

  // =========================================================================
  // Phase 2: VAPI Knowledge Base Rollback (if KB was created, not reused)
  // =========================================================================

  if (
    state.vapiKbId &&
    state.vapiKbWasCreated &&
    state.failedAt !== ProcessingStep.VALIDATION &&
    state.failedAt !== ProcessingStep.EMBEDDING &&
    state.failedAt !== ProcessingStep.PINECONE &&
    state.failedAt !== ProcessingStep.VAPI_UPLOAD
  ) {
    result.rollbacksAttempted++;

    try {
      await rollbackVapiKnowledgeBase(state.vapiKbId);
      result.rollbacksSucceeded++;
      console.log('[Rollback] VAPI KB rollback succeeded');
    } catch (error) {
      result.rollbacksFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        phase: 'VAPI Knowledge Base',
        error: errorMessage,
      });
      console.error('[Rollback] VAPI KB rollback failed:', error);
    }
  }

  // =========================================================================
  // Phase 3: VAPI File Rollback
  // =========================================================================

  if (
    state.vapiFileId &&
    state.failedAt !== ProcessingStep.VALIDATION &&
    state.failedAt !== ProcessingStep.EMBEDDING &&
    state.failedAt !== ProcessingStep.PINECONE
  ) {
    result.rollbacksAttempted++;

    try {
      await rollbackVapiFile(state.vapiFileId);
      result.rollbacksSucceeded++;
      console.log('[Rollback] VAPI file rollback succeeded');
    } catch (error) {
      result.rollbacksFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        phase: 'VAPI File',
        error: errorMessage,
      });
      console.error('[Rollback] VAPI file rollback failed:', error);
    }
  }

  // =========================================================================
  // Phase 4: Pinecone Vectors Rollback
  // =========================================================================

  if (
    state.namespace &&
    state.failedAt !== ProcessingStep.VALIDATION &&
    state.failedAt !== ProcessingStep.EMBEDDING
  ) {
    result.rollbacksAttempted++;

    try {
      await rollbackPinecone(state.namespace);
      result.rollbacksSucceeded++;
      console.log('[Rollback] Pinecone rollback succeeded');
    } catch (error) {
      result.rollbacksFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        phase: 'Pinecone',
        error: errorMessage,
      });
      console.error('[Rollback] Pinecone rollback failed:', error);
    }
  }

  // =========================================================================
  // Determine Overall Success
  // =========================================================================

  result.success = result.rollbacksFailed === 0;

  // Log final result
  if (result.success) {
    console.log('[Rollback] All rollbacks completed successfully', {
      attempted: result.rollbacksAttempted,
      succeeded: result.rollbacksSucceeded,
    });
  } else {
    console.error('[Rollback] Some rollbacks failed', {
      attempted: result.rollbacksAttempted,
      succeeded: result.rollbacksSucceeded,
      failed: result.rollbacksFailed,
      errors: result.errors,
    });
  }

  return result;
}

// ============================================================================
// Individual Rollback Functions
// ============================================================================

/**
 * Rolls back database records
 *
 * Deletes:
 * - pdf_docs record (if exists)
 * - document_storages record (if exists)
 *
 * Note: These deletes will cascade to related records via foreign keys
 */
async function rollbackDatabase(state: RollbackState): Promise<void> {
  const supabase = await createClient();

  // Delete pdf_docs first (child record)
  if (state.pdfDocId) {
    const { error: pdfError } = await supabase
      .from('pdf_docs')
      .delete()
      .eq('id', state.pdfDocId);

    if (pdfError) {
      throw new Error(`Failed to delete pdf_docs: ${pdfError.message}`);
    }
  }

  // Delete document_storages (parent record)
  if (state.documentStorageId) {
    const { error: storageError } = await supabase
      .from('document_storages')
      .delete()
      .eq('id', state.documentStorageId);

    if (storageError) {
      throw new Error(`Failed to delete document_storages: ${storageError.message}`);
    }
  }
}

/**
 * Rolls back VAPI Knowledge Base
 *
 * Only deletes if we created a NEW KB (not if we reused existing)
 */
async function rollbackVapiKnowledgeBase(vapiKbId: string): Promise<void> {
  try {
    await deleteKnowledgeBase(vapiKbId);
  } catch (error) {
    // Log but don't fail - KB might not exist or already deleted
    console.warn('[Rollback] VAPI KB delete warning:', error);

    // Only throw if it's a non-404 error
    if (error instanceof Error && !error.message.includes('404')) {
      throw error;
    }
  }
}

/**
 * Rolls back VAPI file upload
 */
async function rollbackVapiFile(vapiFileId: string): Promise<void> {
  try {
    await vapiService.deleteFile(vapiFileId);
  } catch (error) {
    // Log but don't fail - file might not exist or already deleted
    console.warn('[Rollback] VAPI file delete warning:', error);

    // Only throw if it's a non-404 error
    if (error instanceof Error && !error.message.includes('404')) {
      throw error;
    }
  }
}

/**
 * Rolls back Pinecone vectors
 *
 * Deletes all vectors in the namespace
 */
async function rollbackPinecone(namespace: string): Promise<void> {
  try {
    await deleteNamespace(namespace);
  } catch (error) {
    // Log but don't fail - vectors might not exist or already deleted
    console.warn('[Rollback] Pinecone delete warning:', error);

    // Only throw if it's a non-404 or non-namespace-not-found error
    if (
      error instanceof Error &&
      !error.message.includes('404') &&
      !error.message.includes('not found')
    ) {
      throw error;
    }
  }
}

// ============================================================================
// Rollback State Builder
// ============================================================================

/**
 * Creates an initial rollback state
 */
export function createRollbackState(
  accountId: string,
  fileName: string
): RollbackState {
  return {
    accountId,
    fileName,
    failedAt: ProcessingStep.VALIDATION,
  };
}

/**
 * Updates rollback state with database IDs
 */
export function updateRollbackStateWithDatabase(
  state: RollbackState,
  documentStorageId: string,
  pdfDocId: string
): RollbackState {
  return {
    ...state,
    documentStorageId,
    pdfDocId,
    failedAt: ProcessingStep.DATABASE,
  };
}

/**
 * Updates rollback state with Pinecone namespace
 */
export function updateRollbackStateWithPinecone(
  state: RollbackState,
  namespace: string
): RollbackState {
  return {
    ...state,
    namespace,
    failedAt: ProcessingStep.PINECONE,
  };
}

/**
 * Updates rollback state with VAPI file ID
 */
export function updateRollbackStateWithVapiFile(
  state: RollbackState,
  vapiFileId: string
): RollbackState {
  return {
    ...state,
    vapiFileId,
    failedAt: ProcessingStep.VAPI_UPLOAD,
  };
}

/**
 * Updates rollback state with VAPI KB ID
 */
export function updateRollbackStateWithVapiKB(
  state: RollbackState,
  vapiKbId: string,
  wasCreated: boolean = false
): RollbackState {
  return {
    ...state,
    vapiKbId,
    vapiKbWasCreated: wasCreated,
    failedAt: ProcessingStep.VAPI_KB,
  };
}

// ============================================================================
// Orphaned Resource Cleanup (Future Enhancement)
// ============================================================================

/**
 * Identifies orphaned resources for manual cleanup
 *
 * This function can be run periodically to find resources that failed rollback
 * and need manual intervention.
 *
 * Future implementation could include:
 * - Scheduled job to find orphaned Pinecone namespaces
 * - Scheduled job to find orphaned VAPI files
 * - Alert system for failed rollbacks
 */
export async function identifyOrphanedResources(): Promise<{
  orphanedNamespaces: string[];
  orphanedVapiFiles: string[];
  orphanedVapiKBs: string[];
}> {
  // TODO: Implement orphaned resource detection
  // This would require:
  // 1. List all Pinecone namespaces
  // 2. List all VAPI files
  // 3. List all VAPI KBs
  // 4. Compare with database records
  // 5. Return resources that exist in services but not in database

  return {
    orphanedNamespaces: [],
    orphanedVapiFiles: [],
    orphanedVapiKBs: [],
  };
}
