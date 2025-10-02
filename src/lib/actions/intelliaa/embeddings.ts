/**
 * Embedding Usage Tracking Actions (INTEL-001)
 *
 * Server actions for tracking embedding generation usage and costs.
 * Provides monitoring and billing capabilities for the Vercel AI SDK
 * embedding service.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  EmbeddingUsageStats,
  EmbeddingUsageRecord,
  EmbeddingService,
} from '@/types/embeddings';

/**
 * Track embedding usage for an account
 *
 * This should be called after successfully generating embeddings
 * to record usage for monitoring and billing purposes.
 *
 * @param accountId - Account UUID
 * @param documentId - Optional document UUID
 * @param usage - Usage statistics from embedding generation
 * @param service - Which service was used ('vercel' or 'flowise')
 * @returns Promise<boolean> - True if tracking succeeded
 *
 * @example
 * ```typescript
 * const result = await generateEmbeddings(pdfBuffer);
 * await trackEmbeddingUsage(
 *   accountId,
 *   documentId,
 *   result.usage,
 *   'vercel'
 * );
 * ```
 */
export async function trackEmbeddingUsage(
  accountId: string,
  documentId: string | null,
  usage: EmbeddingUsageStats,
  service: EmbeddingService
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const record: Omit<EmbeddingUsageRecord, 'id' | 'created_at'> = {
      account_id: accountId,
      document_id: documentId || undefined,
      service,
      model: usage.model,
      total_tokens: usage.totalTokens,
      chunk_count: usage.chunkCount,
      estimated_cost: usage.estimatedCost,
      processing_time: usage.processingTime,
    };

    const { error } = await supabase.from('embedding_usage').insert(record);

    if (error) {
      console.error('Error tracking embedding usage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in trackEmbeddingUsage:', error);
    return false;
  }
}

/**
 * Get embedding usage for an account within a date range
 *
 * @param accountId - Account UUID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Usage records
 */
export async function getEmbeddingUsage(
  accountId: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('embedding_usage')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching embedding usage:', error);
      return null;
    }

    return data as EmbeddingUsageRecord[];
  } catch (error) {
    console.error('Unexpected error in getEmbeddingUsage:', error);
    return null;
  }
}

/**
 * Get total cost for an account within a date range
 *
 * @param accountId - Account UUID
 * @param startDate - Start date (default: start of current month)
 * @param endDate - End date (default: now)
 * @returns Total cost in USD
 */
export async function getTotalEmbeddingCost(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    const supabase = await createClient();

    // Default to current month if no dates provided
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();

    const { data, error } = await supabase
      .from('embedding_usage')
      .select('estimated_cost')
      .eq('account_id', accountId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (error) {
      console.error('Error calculating total embedding cost:', error);
      return 0;
    }

    const total = data?.reduce((sum, record) => sum + Number(record.estimated_cost), 0) || 0;

    return total;
  } catch (error) {
    console.error('Unexpected error in getTotalEmbeddingCost:', error);
    return 0;
  }
}

/**
 * Check if account has exceeded monthly usage limit
 *
 * @param accountId - Account UUID
 * @param limitUSD - Monthly limit in USD (default: $10)
 * @returns Object with usage status
 */
export async function checkUsageLimit(
  accountId: string,
  limitUSD: number = 10
): Promise<{
  exceeded: boolean;
  currentCost: number;
  limit: number;
  percentage: number;
}> {
  const currentCost = await getTotalEmbeddingCost(accountId);
  const percentage = (currentCost / limitUSD) * 100;

  return {
    exceeded: currentCost >= limitUSD,
    currentCost,
    limit: limitUSD,
    percentage: Math.min(percentage, 100),
  };
}

/**
 * Get embedding usage statistics by service
 *
 * @param accountId - Account UUID
 * @param service - Optional service filter
 * @returns Usage statistics grouped by service
 */
export async function getUsageByService(
  accountId: string,
  service?: EmbeddingService
) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('embedding_usage')
      .select('service, estimated_cost, total_tokens, chunk_count')
      .eq('account_id', accountId);

    if (service) {
      query = query.eq('service', service);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching usage by service:', error);
      return null;
    }

    // Group by service
    const stats = data?.reduce(
      (acc, record) => {
        const svc = record.service as EmbeddingService;
        if (!acc[svc]) {
          acc[svc] = {
            totalCost: 0,
            totalTokens: 0,
            totalChunks: 0,
            count: 0,
          };
        }

        acc[svc].totalCost += Number(record.estimated_cost);
        acc[svc].totalTokens += record.total_tokens;
        acc[svc].totalChunks += record.chunk_count;
        acc[svc].count += 1;

        return acc;
      },
      {} as Record<
        EmbeddingService,
        {
          totalCost: number;
          totalTokens: number;
          totalChunks: number;
          count: number;
        }
      >
    );

    return stats;
  } catch (error) {
    console.error('Unexpected error in getUsageByService:', error);
    return null;
  }
}
