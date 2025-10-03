/**
 * INTEL-005: Upload Lock Mechanism
 *
 * Prevents concurrent uploads to the same document storage
 * to avoid race conditions and vector ID collisions.
 *
 * Uses Supabase as a distributed lock store.
 */

import { createClient } from "@/lib/supabase/server";

export interface UploadLock {
  storage_id: string;
  locked_at: string;
  locked_by: string;
  process_id: string;
}

/**
 * Acquire an upload lock for a document storage
 *
 * @param documentStorageId - The storage ID to lock
 * @param accountId - The account acquiring the lock
 * @returns Lock acquired successfully
 * @throws Error if lock is already held by another process
 */
export async function acquireUploadLock(
  documentStorageId: string,
  accountId: string
): Promise<string> {
  const supabase = await createClient();
  const processId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Try to insert lock (will fail if already exists due to unique constraint)
  const { data, error } = await supabase
    .from('upload_locks')
    .insert({
      storage_id: documentStorageId,
      locked_at: new Date().toISOString(),
      locked_by: accountId,
      process_id: processId,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a unique constraint violation (lock already exists)
    if (error.code === '23505') {
      // Lock already exists, check if it's stale (older than 10 minutes)
      const { data: existingLock } = await supabase
        .from('upload_locks')
        .select('*')
        .eq('storage_id', documentStorageId)
        .single();

      if (existingLock) {
        const lockAge = Date.now() - new Date(existingLock.locked_at).getTime();
        const TEN_MINUTES = 10 * 60 * 1000;

        if (lockAge > TEN_MINUTES) {
          // Stale lock - force release and retry
          await releaseUploadLock(documentStorageId, existingLock.process_id);
          return acquireUploadLock(documentStorageId, accountId);
        }
      }

      throw new Error(
        'Otro proceso está subiendo un archivo a este almacenamiento. ' +
        'Por favor, espera a que termine e intenta nuevamente.'
      );
    }

    throw new Error(`Error al adquirir bloqueo de subida: ${error.message}`);
  }

  return processId;
}

/**
 * Release an upload lock
 *
 * @param documentStorageId - The storage ID to unlock
 * @param processId - The process ID that acquired the lock
 */
export async function releaseUploadLock(
  documentStorageId: string,
  processId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('upload_locks')
    .delete()
    .eq('storage_id', documentStorageId)
    .eq('process_id', processId);

  if (error) {
    console.error('[UploadLock] Error releasing lock:', error);
    // Don't throw - releasing lock failure shouldn't break the flow
  }
}

/**
 * Check if a storage is currently locked
 *
 * @param documentStorageId - The storage ID to check
 * @returns True if locked, false otherwise
 */
export async function isStorageLocked(
  documentStorageId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('upload_locks')
    .select('*')
    .eq('storage_id', documentStorageId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[UploadLock] Error checking lock:', error);
    return false;
  }

  if (!data) return false;

  // Check if lock is stale (older than 10 minutes)
  const lockAge = Date.now() - new Date(data.locked_at).getTime();
  const TEN_MINUTES = 10 * 60 * 1000;

  return lockAge <= TEN_MINUTES;
}

/**
 * Clean up stale locks (older than 10 minutes)
 * Should be called periodically by a cron job
 */
export async function cleanupStaleLocks(): Promise<number> {
  const supabase = await createClient();
  const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('upload_locks')
    .delete()
    .lt('locked_at', TEN_MINUTES_AGO)
    .select();

  if (error) {
    console.error('[UploadLock] Error cleaning stale locks:', error);
    return 0;
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log(`[UploadLock] Cleaned up ${count} stale locks`);
  }

  return count;
}
