/**
 * Feature Flag Utility (INTEL-001)
 *
 * Provides functions to check if features should be enabled for specific accounts.
 * Supports:
 * - Per-account overrides (whitelist/blacklist)
 * - Percentage-based gradual rollout
 * - Safe defaults (disabled unless explicitly enabled)
 *
 * This enables zero-risk deployment with easy rollback capabilities.
 */

'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Feature flag configuration from database
 */
interface FeatureFlag {
  feature_name: string;
  enabled_percentage: number;
  enabled_accounts: string[];
  disabled_accounts: string[];
}

/**
 * Check if Vercel AI SDK embeddings should be used for an account
 *
 * Decision flow:
 * 1. Check if account is in disabled_accounts (blacklist) → return false
 * 2. Check if account is in enabled_accounts (whitelist) → return true
 * 3. Check account-specific override → return override value
 * 4. Check global rollout percentage → return based on hash
 * 5. Default → return false
 *
 * @param accountId - The account UUID to check
 * @returns Promise<boolean> - True if should use Vercel embeddings
 *
 * @example
 * ```typescript
 * const useVercel = await shouldUseVercelEmbeddings(accountId);
 * if (useVercel) {
 *   // Use new Vercel AI SDK service
 *   await generateEmbeddings(pdfBuffer);
 * } else {
 *   // Use legacy Flowise service
 *   await flowiseService.processFile(pdfBuffer);
 * }
 * ```
 */
export async function shouldUseVercelEmbeddings(accountId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Step 1: Check account-specific override
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('use_vercel_embeddings')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account feature flag:', accountError);
      return false; // Safe default: use Flowise
    }

    // Step 2: Get global feature flag configuration
    const { data: featureFlag, error: flagError } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('feature_name', 'vercel_embeddings')
      .single<FeatureFlag>();

    if (flagError) {
      console.error('Error fetching global feature flag:', flagError);
      // Fallback to account-specific setting if available
      return account?.use_vercel_embeddings ?? false;
    }

    // Step 3: Check blacklist (disabled_accounts)
    if (featureFlag.disabled_accounts?.includes(accountId)) {
      return false;
    }

    // Step 4: Check whitelist (enabled_accounts)
    if (featureFlag.enabled_accounts?.includes(accountId)) {
      return true;
    }

    // Step 5: Check account-specific override
    if (account?.use_vercel_embeddings !== null && account?.use_vercel_embeddings !== undefined) {
      return account.use_vercel_embeddings;
    }

    // Step 6: Check percentage-based rollout
    const enabledPercentage = featureFlag.enabled_percentage ?? 0;

    if (enabledPercentage === 0) {
      return false;
    }

    if (enabledPercentage === 100) {
      return true;
    }

    // Use deterministic hash to decide if account is in rollout percentage
    // This ensures the same account always gets the same result
    const hash = hashAccountId(accountId);
    return hash < enabledPercentage;
  } catch (error) {
    console.error('Unexpected error in shouldUseVercelEmbeddings:', error);
    return false; // Safe default: use Flowise
  }
}

/**
 * Generate a deterministic hash from account ID (0-99)
 * This ensures consistent rollout decisions for the same account
 *
 * @param accountId - Account UUID
 * @returns Number between 0-99
 */
function hashAccountId(accountId: string): number {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    const char = accountId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Enable Vercel embeddings for a specific account
 *
 * @param accountId - Account UUID
 * @returns Promise<boolean> - True if successful
 */
export async function enableVercelEmbeddingsForAccount(accountId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('accounts')
      .update({ use_vercel_embeddings: true })
      .eq('id', accountId);

    if (error) {
      console.error('Error enabling Vercel embeddings for account:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in enableVercelEmbeddingsForAccount:', error);
    return false;
  }
}

/**
 * Disable Vercel embeddings for a specific account
 *
 * @param accountId - Account UUID
 * @returns Promise<boolean> - True if successful
 */
export async function disableVercelEmbeddingsForAccount(accountId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('accounts')
      .update({ use_vercel_embeddings: false })
      .eq('id', accountId);

    if (error) {
      console.error('Error disabling Vercel embeddings for account:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in disableVercelEmbeddingsForAccount:', error);
    return false;
  }
}

/**
 * Update global rollout percentage
 * Requires service role permissions
 *
 * @param percentage - Percentage to enable (0-100)
 * @returns Promise<boolean> - True if successful
 */
export async function updateRolloutPercentage(percentage: number): Promise<boolean> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled_percentage: percentage })
      .eq('feature_name', 'vercel_embeddings');

    if (error) {
      console.error('Error updating rollout percentage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in updateRolloutPercentage:', error);
    return false;
  }
}

/**
 * Get current feature flag status
 *
 * @returns Promise with feature flag details
 */
export async function getFeatureFlagStatus() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('feature_name', 'vercel_embeddings')
      .single<FeatureFlag>();

    if (error) {
      console.error('Error fetching feature flag status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in getFeatureFlagStatus:', error);
    return null;
  }
}
