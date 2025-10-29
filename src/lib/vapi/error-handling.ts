/**
 * VAPI Error Handling Utilities
 *
 * Provides structured error handling for VAPI API calls with:
 * - Typed error classes
 * - Error parsing from HTTP responses
 * - Retry logic with exponential backoff
 * - User-friendly error messages
 *
 * @see INT-34 Backend Architecture Review
 */

/**
 * Categories of errors that can occur when calling VAPI API
 */
export enum VapiErrorType {
  /** Invalid API key or authentication failure (401) */
  AUTHENTICATION = 'AUTHENTICATION',

  /** Invalid request data or assistant configuration (400, 422) */
  VALIDATION = 'VALIDATION',

  /** Too many requests, rate limit exceeded (429) */
  RATE_LIMIT = 'RATE_LIMIT',

  /** Assistant or resource not found (404) */
  NOT_FOUND = 'NOT_FOUND',

  /** VAPI server error (500-599) */
  SERVER_ERROR = 'SERVER_ERROR',

  /** Network timeout or connection failure */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Unknown or unexpected error */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Custom error class for VAPI API failures
 *
 * Provides structured error information including:
 * - Error type for programmatic handling
 * - HTTP status code
 * - Raw error details from VAPI
 * - User-friendly message for display
 *
 * @example
 * ```typescript
 * try {
 *   await updateVapiAssistant(id, config);
 * } catch (error) {
 *   if (error instanceof VapiError) {
 *     if (error.type === VapiErrorType.RATE_LIMIT) {
 *       // Show "Please try again later" message
 *     }
 *   }
 * }
 * ```
 */
export class VapiError extends Error {
  constructor(
    public type: VapiErrorType,
    public statusCode: number,
    public details: any,
    public userMessage: string
  ) {
    super(userMessage);
    this.name = 'VapiError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VapiError);
    }
  }

  /**
   * Returns a JSON representation of the error
   * Useful for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      statusCode: this.statusCode,
      message: this.userMessage,
      details: this.details,
    };
  }
}

/**
 * Parses HTTP response and error data into a structured VapiError
 *
 * Maps HTTP status codes to appropriate error types and generates
 * user-friendly messages in Spanish.
 *
 * @param response - The HTTP response from VAPI API
 * @param errorData - Optional parsed error data from response body
 * @returns VapiError with appropriate type and message
 *
 * @example
 * ```typescript
 * const response = await fetch(vapiUrl, options);
 * if (!response.ok) {
 *   const errorData = await response.json().catch(() => null);
 *   throw parseVapiError(response, errorData);
 * }
 * ```
 */
export function parseVapiError(response: Response, errorData?: any): VapiError {
  const status = response.status;

  // Authentication errors (401)
  if (status === 401) {
    return new VapiError(
      VapiErrorType.AUTHENTICATION,
      401,
      errorData,
      'Error de autenticación con el servicio de voz. Por favor, contacte soporte.'
    );
  }

  // Rate limiting (429)
  if (status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const retryMessage = retryAfter
      ? `Por favor, intente de nuevo en ${retryAfter} segundos.`
      : 'Por favor, intente de nuevo en unos momentos.';

    return new VapiError(
      VapiErrorType.RATE_LIMIT,
      429,
      errorData,
      `Demasiadas solicitudes. ${retryMessage}`
    );
  }

  // Not found (404)
  if (status === 404) {
    return new VapiError(
      VapiErrorType.NOT_FOUND,
      404,
      errorData,
      'Asistente de voz no encontrado. Puede haber sido eliminado.'
    );
  }

  // Validation errors (400, 422)
  if (status >= 400 && status < 500) {
    // Try to extract specific validation message from VAPI response
    let message = 'Configuración inválida. Por favor, revise los campos.';

    if (errorData?.message) {
      message = `Error de validación: ${errorData.message}`;
    } else if (errorData?.errors) {
      // If VAPI returns field-specific errors
      const fieldErrors = Object.entries(errorData.errors)
        .map(([field, err]) => `${field}: ${err}`)
        .join(', ');
      message = `Errores de validación: ${fieldErrors}`;
    }

    return new VapiError(
      VapiErrorType.VALIDATION,
      status,
      errorData,
      message
    );
  }

  // Server errors (500-599)
  if (status >= 500) {
    return new VapiError(
      VapiErrorType.SERVER_ERROR,
      status,
      errorData,
      'El servicio de voz no está disponible temporalmente. Por favor, intente de nuevo más tarde.'
    );
  }

  // Unknown error
  return new VapiError(
    VapiErrorType.UNKNOWN,
    status,
    errorData,
    'Ocurrió un error inesperado. Por favor, intente de nuevo.'
  );
}

/**
 * Options for retry behavior
 */
interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay in milliseconds before first retry (default: 1000ms) */
  baseDelay?: number;

  /** Maximum delay between retries in milliseconds (default: 10000ms) */
  maxDelay?: number;

  /** Error types that should NOT be retried (default: VALIDATION, AUTHENTICATION, NOT_FOUND) */
  nonRetryableTypes?: VapiErrorType[];

  /** Callback function called before each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Calls a VAPI operation with automatic retry logic and exponential backoff
 *
 * Automatically retries failed requests based on error type:
 * - Retries: RATE_LIMIT, SERVER_ERROR, NETWORK_ERROR
 * - No retry: VALIDATION, AUTHENTICATION, NOT_FOUND
 *
 * Uses exponential backoff: delay = baseDelay * 2^(attempt-1)
 *
 * @param operation - Async function to execute (e.g., fetch call)
 * @param options - Retry configuration options
 * @returns Result of successful operation
 * @throws VapiError or original error after max retries exceeded
 *
 * @example
 * ```typescript
 * const result = await callVapiWithRetry(
 *   async () => {
 *     const response = await fetch(vapiUrl, { method: 'PATCH', ... });
 *     if (!response.ok) {
 *       const errorData = await response.json().catch(() => null);
 *       throw parseVapiError(response, errorData);
 *     }
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 */
export async function callVapiWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    nonRetryableTypes = [
      VapiErrorType.VALIDATION,
      VapiErrorType.AUTHENTICATION,
      VapiErrorType.NOT_FOUND
    ],
    onRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error should be retried
      if (error instanceof VapiError) {
        // Don't retry validation, auth, or not found errors
        if (nonRetryableTypes.includes(error.type)) {
          throw error;
        }
      }

      // If this was the last attempt, throw the error
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay; // Add ±30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      } else {
        console.warn(
          `[VAPI Retry] Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms...`,
          {
            error: lastError instanceof VapiError ? lastError.type : lastError.message,
          }
        );
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  if (!lastError) {
    throw new Error('All retry attempts failed without capturing an error');
  }

  console.error(
    `[VAPI Retry] All ${maxRetries} attempts failed.`,
    lastError
  );

  throw lastError;
}

/**
 * Wraps a fetch call to VAPI with proper error handling
 *
 * Convenience function that combines fetch with error parsing.
 * Use this for one-off VAPI calls without retry logic.
 *
 * @param url - VAPI API endpoint URL
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws VapiError with appropriate type and message
 *
 * @example
 * ```typescript
 * const result = await fetchVapi(
 *   `https://api.vapi.ai/assistant/${id}`,
 *   {
 *     method: 'PATCH',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${apiKey}`
 *     },
 *     body: JSON.stringify(config)
 *   }
 * );
 * ```
 */
export async function fetchVapi<T = any>(
  url: string,
  options: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw parseVapiError(response, errorData);
    }

    return await response.json();
  } catch (error) {
    // If it's already a VapiError, re-throw it
    if (error instanceof VapiError) {
      throw error;
    }

    // Network errors (fetch failures)
    throw new VapiError(
      VapiErrorType.NETWORK_ERROR,
      0,
      error,
      'No se pudo conectar al servicio de voz. Por favor, verifique su conexión.'
    );
  }
}

/**
 * Type guard to check if an error is a VapiError
 *
 * @example
 * ```typescript
 * try {
 *   await updateVapiAssistant(id, config);
 * } catch (error) {
 *   if (isVapiError(error)) {
 *     console.log('VAPI error type:', error.type);
 *   }
 * }
 * ```
 */
export function isVapiError(error: unknown): error is VapiError {
  return error instanceof VapiError;
}
