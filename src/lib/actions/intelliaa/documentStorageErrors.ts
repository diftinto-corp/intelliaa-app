/**
 * INTEL-004: Document Storage Error Handling
 *
 * Provides custom error types and error handling utilities for document storage creation.
 * Supports user-friendly error messages and retry logic (AC5).
 */

// ============================================================================
// Processing Steps Enum
// ============================================================================

export enum ProcessingStep {
  VALIDATION = 'validation',
  EMBEDDING = 'embedding',
  PINECONE = 'pinecone',
  VAPI_UPLOAD = 'vapi_upload',
  VAPI_KB = 'vapi_kb',
  DATABASE = 'database',
  COMPLETED = 'completed',
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for document storage operations
 */
export class DocumentStorageError extends Error {
  public readonly step: ProcessingStep;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: string;

  constructor(
    message: string,
    step: ProcessingStep,
    retryable: boolean = false,
    technicalDetails?: string
  ) {
    super(message);
    this.name = 'DocumentStorageError';
    this.step = step;
    this.retryable = retryable;
    this.userMessage = message;
    this.technicalDetails = technicalDetails;
  }
}

/**
 * AC8, AC9, AC10: File validation errors
 */
export class FileValidationError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(message, ProcessingStep.VALIDATION, false, technicalDetails);
    this.name = 'FileValidationError';
  }
}

/**
 * Embedding generation errors (INTEL-001)
 */
export class EmbeddingError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(
      message,
      ProcessingStep.EMBEDDING,
      true, // Retryable - could be temporary API issue
      technicalDetails
    );
    this.name = 'EmbeddingError';
  }
}

/**
 * Pinecone vector storage errors (INTEL-003)
 */
export class PineconeError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(
      message,
      ProcessingStep.PINECONE,
      true, // Retryable - could be temporary connection issue
      technicalDetails
    );
    this.name = 'PineconeError';
  }
}

/**
 * VAPI file upload errors
 */
export class VapiUploadError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(
      message,
      ProcessingStep.VAPI_UPLOAD,
      true, // Retryable - could be temporary network issue
      technicalDetails
    );
    this.name = 'VapiUploadError';
  }
}

/**
 * VAPI Knowledge Base errors (INTEL-002)
 */
export class VapiKnowledgeBaseError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(
      message,
      ProcessingStep.VAPI_KB,
      true, // Retryable
      technicalDetails
    );
    this.name = 'VapiKnowledgeBaseError';
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends DocumentStorageError {
  constructor(message: string, technicalDetails?: string) {
    super(
      message,
      ProcessingStep.DATABASE,
      false, // Not retryable - likely constraint violation
      technicalDetails
    );
    this.name = 'DatabaseError';
  }
}

/**
 * Timeout errors (5 minute limit)
 */
export class TimeoutError extends DocumentStorageError {
  constructor(step: ProcessingStep, technicalDetails?: string) {
    super(
      'El procesamiento tardó demasiado tiempo. Por favor, intenta con un archivo más pequeño o inténtalo nuevamente.',
      step,
      true, // Retryable
      technicalDetails
    );
    this.name = 'TimeoutError';
  }
}

/**
 * AC7: Namespace collision error (extremely rare with crypto.randomBytes)
 */
export class NamespaceCollisionError extends DocumentStorageError {
  constructor(namespace: string) {
    super(
      'Error al generar un identificador único. Por favor, inténtalo nuevamente.',
      ProcessingStep.VALIDATION,
      true, // Retryable - will generate new namespace
      `Namespace collision: ${namespace}`
    );
    this.name = 'NamespaceCollisionError';
  }
}

/**
 * AC6: Authorization errors
 */
export class AuthorizationError extends DocumentStorageError {
  constructor(message: string = 'No tienes permiso para realizar esta acción.') {
    super(message, ProcessingStep.VALIDATION, false);
    this.name = 'AuthorizationError';
  }
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  step: ProcessingStep;
  retryable: boolean;
  technicalDetails?: string;
}

export interface SuccessResponse {
  success: true;
  storageId: string;
  pdfDocId: string;
}

export type DocumentStorageResponse = SuccessResponse | ErrorResponse;

// ============================================================================
// Error Handling Functions
// ============================================================================

/**
 * Maps technical error codes to user-friendly messages (AC5)
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof DocumentStorageError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // PostgreSQL error codes
    if ('code' in error) {
      const pgError = error as Error & { code: string };

      switch (pgError.code) {
        case '23505': // unique_violation
          return 'Ya existe un documento con este identificador. Por favor, inténtalo nuevamente.';

        case '23514': // check_violation
          return 'Los datos proporcionados no cumplen con los requisitos. Por favor, verifica la información.';

        case '42501': // insufficient_privilege
          return 'No tienes permiso para realizar esta acción.';

        case 'PGRST116': // RLS violation
          return 'No tienes acceso a esta cuenta.';
      }
    }

    // Network errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      return 'Error de conexión. Por favor, verifica tu conexión a internet e inténtalo nuevamente.';
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'El procesamiento tardó demasiado tiempo. Por favor, intenta con un archivo más pequeño.';
    }

    // Generic error with message
    return error.message || 'Ocurrió un error inesperado. Por favor, inténtalo nuevamente.';
  }

  return 'Ocurrió un error inesperado. Por favor, inténtalo nuevamente.';
}

/**
 * Determines if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof DocumentStorageError) {
    return error.retryable;
  }

  if (error instanceof Error && 'code' in error) {
    const pgError = error as Error & { code: string };

    // Retryable PostgreSQL errors
    const retryableCodes = [
      '23505', // unique_violation (namespace collision - will regenerate)
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '57014', // query_canceled
    ];

    return retryableCodes.includes(pgError.code);
  }

  // Network errors are retryable
  if (error instanceof Error) {
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed') ||
      error.message.includes('timeout')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the processing step where an error occurred
 */
export function getErrorStep(error: unknown): ProcessingStep {
  if (error instanceof DocumentStorageError) {
    return error.step;
  }

  return ProcessingStep.VALIDATION;
}

/**
 * Converts an error to an ErrorResponse
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  const userMessage = getUserFriendlyMessage(error);
  const retryable = isRetryable(error);
  const step = getErrorStep(error);

  let technicalDetails: string | undefined;
  if (error instanceof DocumentStorageError) {
    technicalDetails = error.technicalDetails;
  } else if (error instanceof Error) {
    technicalDetails = error.message;
  }

  return {
    success: false,
    error: userMessage,
    step,
    retryable,
    technicalDetails,
  };
}

/**
 * Creates a success response
 */
export function toSuccessResponse(
  storageId: string,
  pdfDocId: string
): SuccessResponse {
  return {
    success: true,
    storageId,
    pdfDocId,
  };
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Logs an error with context for debugging
 */
export function logError(
  error: unknown,
  context: {
    operation: string;
    accountId: string;
    namespace?: string;
    fileName?: string;
  }
): void {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    operation: context.operation,
    accountId: context.accountId,
    namespace: context.namespace,
    fileName: context.fileName,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof DocumentStorageError && {
        step: error.step,
        retryable: error.retryable,
        technicalDetails: error.technicalDetails,
      }),
    } : String(error),
  };

  console.error('[DocumentStorage Error]', JSON.stringify(errorDetails, null, 2));
}

// ============================================================================
// Validation Error Helpers
// ============================================================================

/**
 * Creates a file validation error (AC8, AC9, AC10)
 */
export function createFileValidationError(
  type: 'EMPTY_FILE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE',
  details?: string
): FileValidationError {
  const messages = {
    EMPTY_FILE: 'El archivo está vacío. Por favor, selecciona un archivo PDF válido.',
    INVALID_TYPE: 'Solo se permiten archivos PDF. Por favor, selecciona un archivo con extensión .pdf',
    FILE_TOO_LARGE: 'El archivo es demasiado grande. El tamaño máximo permitido es 50MB.',
  };

  return new FileValidationError(messages[type], details);
}

/**
 * Creates a namespace collision error (AC7)
 */
export function createNamespaceCollisionError(namespace: string): NamespaceCollisionError {
  return new NamespaceCollisionError(namespace);
}

/**
 * Creates an authorization error (AC6)
 */
export function createAuthorizationError(
  message?: string
): AuthorizationError {
  return new AuthorizationError(message);
}

// ============================================================================
// Error Recovery Helpers
// ============================================================================

/**
 * Checks if an operation should be retried based on error
 */
export function shouldRetry(
  error: unknown,
  attemptNumber: number,
  maxAttempts: number = 3
): boolean {
  if (attemptNumber >= maxAttempts) {
    return false;
  }

  return isRetryable(error);
}

/**
 * Calculates exponential backoff delay for retries
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  const baseDelay = 1000;
  const maxDelay = 10000; // 10 seconds max

  const delay = baseDelay * Math.pow(2, attemptNumber - 1);
  return Math.min(delay, maxDelay);
}
