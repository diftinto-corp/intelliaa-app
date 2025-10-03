/**
 * INTEL-004: Document Storage Validation Utilities
 *
 * Provides validation functions for document storage creation:
 * - File validation (size, type, empty check) - AC8, AC9, AC10
 * - Namespace generation with uniqueness guarantee - AC7
 * - Account access validation - AC6
 */

import crypto from 'crypto';

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ALLOWED_EXTENSIONS = ['.pdf'];

// Pinecone namespace requirements:
// - 3-63 characters
// - lowercase alphanumeric with hyphens
// - must start and end with alphanumeric
const NAMESPACE_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// ============================================================================
// Type Definitions
// ============================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'EMPTY_FILE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE';
}

export interface NamespaceGenerationResult {
  namespace: string;
  sanitizedName: string;
}

// ============================================================================
// File Validation Functions
// ============================================================================

/**
 * Validates a PDF file for document storage creation
 *
 * Acceptance Criteria:
 * - AC8: Empty file validation (0 bytes)
 * - AC9: PDF-only validation (MIME type + extension)
 * - AC10: File size validation (max 50MB)
 *
 * @param file - The File object to validate
 * @returns Validation result with error details if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // AC8: Empty file validation
  if (file.size === 0) {
    return {
      valid: false,
      error: 'El archivo está vacío. Por favor, selecciona un archivo PDF válido.',
      errorCode: 'EMPTY_FILE',
    };
  }

  // AC9: File type validation (MIME type)
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Solo se permiten archivos PDF. Por favor, selecciona un archivo con extensión .pdf',
      errorCode: 'INVALID_TYPE',
    };
  }

  // AC9: File type validation (extension)
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: 'Solo se permiten archivos PDF. Por favor, selecciona un archivo con extensión .pdf',
      errorCode: 'INVALID_TYPE',
    };
  }

  // AC10: File size validation
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `El archivo es demasiado grande (${sizeMB}MB). El tamaño máximo permitido es 50MB.`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  return { valid: true };
}

/**
 * Server-side file buffer validation
 * Used when validating file after upload
 */
export function validateFileBuffer(
  buffer: Buffer,
  filename: string
): FileValidationResult {
  // AC8: Empty file validation
  if (buffer.length === 0) {
    return {
      valid: false,
      error: 'El archivo está vacío',
      errorCode: 'EMPTY_FILE',
    };
  }

  // AC9: Extension validation
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: 'Solo se permiten archivos PDF',
      errorCode: 'INVALID_TYPE',
    };
  }

  // AC9: PDF magic number validation (more robust than MIME type)
  // PDF files start with %PDF-
  const pdfMagicNumber = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-
  if (!buffer.subarray(0, 5).equals(pdfMagicNumber)) {
    return {
      valid: false,
      error: 'El archivo no es un PDF válido',
      errorCode: 'INVALID_TYPE',
    };
  }

  // AC10: File size validation
  if (buffer.length > MAX_FILE_SIZE) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `El archivo es demasiado grande (${sizeMB}MB). El tamaño máximo es 50MB`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  return { valid: true };
}

// ============================================================================
// Namespace Generation Functions
// ============================================================================

/**
 * Sanitizes a document storage name for use in namespace
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Remove leading/trailing hyphens
 * - Limit to 50 characters (leaves room for random suffix)
 */
function sanitizeNameForNamespace(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')          // Remove consecutive hyphens
    .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
    .substring(0, 50);            // Limit length
}

/**
 * Generates a cryptographically random string for namespace uniqueness
 *
 * AC7: Namespace uniqueness guarantee
 * Uses crypto.randomBytes for cryptographic randomness (not Math.random)
 *
 * @param length - Length of random string (default: 6)
 * @returns Lowercase alphanumeric random string
 */
function generateRandomString(length: number = 6): string {
  // Generate random bytes (4 bytes = 8 hex chars, we'll take 6)
  const bytes = crypto.randomBytes(Math.ceil(length / 2));
  return bytes
    .toString('hex')
    .substring(0, length)
    .toLowerCase();
}

/**
 * Generates a unique namespace for document storage
 *
 * Format: {sanitized-name}-{random-6-chars}
 * Example: "my-document-a3f8b2"
 *
 * AC7: Namespace uniqueness guarantee via crypto.randomBytes
 *
 * The generated namespace:
 * - Meets Pinecone requirements (3-63 chars, lowercase, alphanumeric + hyphens)
 * - Is globally unique with ~1 in 16 million collision probability
 * - Is human-readable (includes sanitized document name)
 *
 * @param documentName - The document storage name
 * @returns Namespace generation result
 */
export function generateUniqueNamespace(
  documentName: string
): NamespaceGenerationResult {
  const sanitizedName = sanitizeNameForNamespace(documentName);
  const randomSuffix = generateRandomString(6);

  // Construct namespace: {name}-{random}
  // Ensure it meets Pinecone requirements
  let namespace = sanitizedName
    ? `${sanitizedName}-${randomSuffix}`
    : randomSuffix;

  // Validate format (should always pass, but defensive check)
  if (!NAMESPACE_REGEX.test(namespace)) {
    // Fallback: use only random string if sanitized name caused issues
    namespace = `doc-${randomSuffix}`;
  }

  return {
    namespace,
    sanitizedName,
  };
}

/**
 * Validates a namespace format
 *
 * Ensures namespace meets Pinecone requirements:
 * - 3-63 characters
 * - Lowercase alphanumeric with hyphens
 * - Must start and end with alphanumeric
 *
 * @param namespace - The namespace to validate
 * @returns True if valid, false otherwise
 */
export function validateNamespaceFormat(namespace: string): boolean {
  return NAMESPACE_REGEX.test(namespace);
}

// ============================================================================
// Account Access Validation
// ============================================================================

/**
 * Validates that a user has access to an account
 *
 * AC6: Multi-tenant isolation
 *
 * Note: This is a client-side check. Server-side validation is enforced by:
 * 1. RLS policies on database tables
 * 2. PostgreSQL function validation (create_document_storage_with_pdf)
 *
 * @param accountId - The account ID to check
 * @param userId - The user ID to check
 * @returns True if user has access (to be implemented with Supabase query)
 */
export async function validateAccountAccess(
  accountId: string,
  userId: string
): Promise<boolean> {
  // This function is called from server actions
  // The actual validation is performed by:
  // 1. The PostgreSQL function create_document_storage_with_pdf
  // 2. RLS policies on document_storages and pdf_docs tables
  //
  // This function exists for future enhancement if needed
  // (e.g., early validation before starting file upload)

  return true; // Placeholder - actual validation in PostgreSQL function
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validates a document storage name
 *
 * Rules:
 * - Required (non-empty)
 * - 3-100 characters
 * - No leading/trailing whitespace
 */
export function validateDocumentName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      valid: false,
      error: 'El nombre es requerido',
    };
  }

  if (trimmed.length < 3) {
    return {
      valid: false,
      error: 'El nombre debe tener al menos 3 caracteres',
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: 'El nombre no puede exceder 100 caracteres',
    };
  }

  return { valid: true };
}
