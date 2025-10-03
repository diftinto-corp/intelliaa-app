/**
 * INTEL-004: Client-Side Validation Utilities
 *
 * Provides client-side validation for immediate user feedback
 * before server-side processing begins.
 */

import type { ValidationError } from "./types";

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["application/pdf"];
const ALLOWED_EXTENSIONS = [".pdf"];

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validates a PDF file for upload
 *
 * Checks:
 * - AC8: Empty file (0 bytes)
 * - AC9: File type (PDF only)
 * - AC10: File size (max 50MB)
 *
 * @param file - The file to validate
 * @returns ValidationError if invalid, null if valid
 */
export function validateFile(file: File | null): ValidationError | null {
  if (!file) {
    return {
      field: "file",
      message: "Por favor, selecciona un archivo PDF",
      code: "INVALID_TYPE",
    };
  }

  // AC8: Empty file validation
  if (file.size === 0) {
    return {
      field: "file",
      message: "El archivo está vacío. Por favor, selecciona un archivo PDF válido.",
      code: "EMPTY_FILE",
    };
  }

  // AC9: File type validation (MIME)
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      field: "file",
      message: "Solo se permiten archivos PDF. Por favor, selecciona un archivo con extensión .pdf",
      code: "INVALID_TYPE",
    };
  }

  // AC9: File type validation (extension)
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      field: "file",
      message: "Solo se permiten archivos PDF. Por favor, selecciona un archivo con extensión .pdf",
      code: "INVALID_TYPE",
    };
  }

  // AC10: File size validation
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      field: "file",
      message: `El archivo es demasiado grande (${sizeMB}MB). El tamaño máximo permitido es 50MB.`,
      code: "FILE_TOO_LARGE",
    };
  }

  return null;
}

// ============================================================================
// Name Validation
// ============================================================================

/**
 * Validates document storage name
 *
 * Rules:
 * - Required (non-empty)
 * - 3-100 characters
 * - No leading/trailing whitespace
 *
 * @param name - The name to validate
 * @returns ValidationError if invalid, null if valid
 */
export function validateName(name: string): ValidationError | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      field: "name",
      message: "El nombre es requerido",
    };
  }

  if (trimmed.length < 3) {
    return {
      field: "name",
      message: "El nombre debe tener al menos 3 caracteres",
    };
  }

  if (trimmed.length > 100) {
    return {
      field: "name",
      message: "El nombre no puede exceder 100 caracteres",
    };
  }

  return null;
}

// ============================================================================
// Description Validation (optional field)
// ============================================================================

/**
 * Validates document storage description (optional)
 *
 * Rules:
 * - Optional
 * - Max 500 characters
 *
 * @param description - The description to validate
 * @returns ValidationError if invalid, null if valid
 */
export function validateDescription(description: string): ValidationError | null {
  if (description && description.length > 500) {
    return {
      field: "name", // Reusing name field type
      message: "La descripción no puede exceder 500 caracteres",
    };
  }

  return null;
}

// ============================================================================
// Form Validation
// ============================================================================

/**
 * Validates entire form data
 *
 * @param name - Document storage name
 * @param file - PDF file
 * @param description - Optional description
 * @returns Array of ValidationErrors (empty if valid)
 */
export function validateForm(
  name: string,
  file: File | null,
  description?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  const nameError = validateName(name);
  if (nameError) {
    errors.push(nameError);
  }

  const fileError = validateFile(file);
  if (fileError) {
    errors.push(fileError);
  }

  if (description) {
    const descError = validateDescription(description);
    if (descError) {
      errors.push(descError);
    }
  }

  return errors;
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
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Checks if file type is accepted based on MIME type
 *
 * @param file - The file to check
 * @returns True if accepted, false otherwise
 */
export function isFileTypeAccepted(file: File): boolean {
  return ALLOWED_MIME_TYPES.includes(file.type);
}

/**
 * Gets file extension from filename
 *
 * @param filename - The filename
 * @returns File extension (e.g., ".pdf")
 */
export function getFileExtension(filename: string): string {
  return filename.toLowerCase().substring(filename.lastIndexOf("."));
}
