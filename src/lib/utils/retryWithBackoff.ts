/**
 * Retry utility with exponential backoff (INT-32)
 * Used for external API calls (VAPI, Railway, etc.)
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000 (1 second)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds
   * @default 10000 (10 seconds)
   */
  maxDelay?: number;

  /**
   * Backoff multiplier (exponential factor)
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if an error is retryable
   * @default Retries all errors
   */
  shouldRetry?: (error: any, attempt: number) => boolean;

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Default options for retry with backoff
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
};

/**
 * Executes a function with exponential backoff retry logic
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => callVapiAPI(params),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms:`, error.message);
 *     },
 *     shouldRetry: (error) => {
 *       // Only retry on network or timeout errors
 *       return error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET';
 *     }
 *   }
 * );
 * ```
 *
 * @template T - Return type of the function
 * @param fn - Async function to execute with retries
 * @param options - Retry configuration options
 * @returns Promise resolving to function result
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Execute the function
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt === config.maxRetries;
      const shouldRetry = config.shouldRetry(error, attempt + 1);

      if (isLastAttempt || !shouldRetry) {
        // No more retries, throw the error
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Sleep utility for waiting between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Common retry scenarios
 */
export const RetryScenarios = {
  /**
   * Retry network errors (timeouts, connection refused, etc.)
   */
  networkErrors: (error: any) => {
    const networkErrorCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
    ];
    return networkErrorCodes.includes(error.code);
  },

  /**
   * Retry HTTP 5xx errors (server errors)
   */
  serverErrors: (error: any) => {
    const status = error.response?.status || error.status;
    return status >= 500 && status < 600;
  },

  /**
   * Retry rate limit errors (HTTP 429)
   */
  rateLimitErrors: (error: any) => {
    const status = error.response?.status || error.status;
    return status === 429;
  },

  /**
   * Retry network OR server errors
   */
  networkOrServerErrors: (error: any) => {
    return (
      RetryScenarios.networkErrors(error) || RetryScenarios.serverErrors(error)
    );
  },
};
