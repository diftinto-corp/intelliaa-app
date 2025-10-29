/**
 * Assistant Configuration Validation Schemas
 *
 * Provides server-side validation using Zod for:
 * - Voice assistant configuration updates
 * - WhatsApp assistant configuration updates
 * - Type-safe input/output types
 * - Field-specific error messages
 *
 * @see INT-34 Backend Architecture Review
 */

import { z } from 'zod';

// ============================================================================
// VOICE ASSISTANT VALIDATION
// ============================================================================

/**
 * Validation schema for Voice Assistant update requests
 *
 * Enforces all business rules and constraints for voice assistant configuration:
 * - Temperature: 0.0 - 2.0 (1 decimal place)
 * - Max Tokens: 50 - 4000 (integer)
 * - Prompt: 20 - 5000 characters
 * - Voice ID: Alphanumeric format
 * - End call phrases: Max 20 phrases, 50 chars each
 *
 * @example
 * ```typescript
 * const result = voiceAssistantUpdateSchema.safeParse(requestBody);
 * if (!result.success) {
 *   return res.status(400).json({ errors: result.error.errors });
 * }
 * const validData = result.data;
 * ```
 */
export const voiceAssistantUpdateSchema = z.object({
  // Required assistant identifiers
  id_assistant: z
    .string()
    .uuid('ID de asistente inválido'),

  id_assistant_vapi: z
    .string()
    .min(1, 'ID de asistente VAPI es requerido'),

  // Core configuration
  prompt: z
    .string()
    .min(20, 'El prompt debe tener al menos 20 caracteres')
    .max(5000, 'El prompt no puede exceder 5000 caracteres')
    .trim(),

  temperature: z
    .number()
    .min(0.0, 'La temperatura debe ser al menos 0.0')
    .max(2.0, 'La temperatura no puede exceder 2.0')
    .multipleOf(0.1, 'La temperatura debe tener máximo 1 decimal'),

  maxTokens: z
    .number()
    .int('El máximo de tokens debe ser un número entero')
    .min(50, 'El máximo de tokens debe ser al menos 50')
    .max(4000, 'El máximo de tokens no puede exceder 4000'),

  // Voice configuration
  voiceId: z
    .string()
    .regex(
      /^[a-zA-Z0-9]+$/,
      'ID de voz inválido (solo letras y números permitidos)'
    )
    .min(1, 'ID de voz es requerido'),

  // Messages
  welcomeMessage: z
    .string()
    .min(1, 'El mensaje de bienvenida es requerido')
    .max(500, 'El mensaje de bienvenida no puede exceder 500 caracteres')
    .trim(),

  endCallMessage: z
    .string()
    .max(200, 'El mensaje de fin de llamada no puede exceder 200 caracteres')
    .trim()
    .optional()
    .default(''),

  voicemailMessage: z
    .string()
    .max(200, 'El mensaje de buzón de voz no puede exceder 200 caracteres')
    .trim()
    .optional()
    .default(''),

  // End call configuration
  endCallPhrases: z
    .array(
      z.string()
        .max(50, 'Cada frase de fin de llamada debe tener máximo 50 caracteres')
        .trim()
    )
    .max(20, 'Máximo 20 frases de fin de llamada permitidas')
    .default([]),

  // Feature toggles
  recordCall: z
    .boolean()
    .default(false),

  backgroundOffice: z
    .boolean()
    .default(false),

  detectEmotion: z
    .boolean()
    .default(false),

  // Document storage
  fileIds: z
    .array(z.string())
    .max(50, 'Máximo 50 archivos permitidos')
    .default([]),

  documentStorageId: z
    .string()
    .uuid('ID de almacenamiento de documentos inválido')
    .optional()
    .or(z.literal('')),
});

/**
 * TypeScript type inferred from the validation schema
 * Use this type for type-safe function parameters
 */
export type VoiceAssistantUpdateInput = z.infer<typeof voiceAssistantUpdateSchema>;

// ============================================================================
// WHATSAPP ASSISTANT VALIDATION
// ============================================================================

/**
 * Validation schema for WhatsApp Assistant update requests
 *
 * Enforces business rules for WhatsApp assistant configuration:
 * - Temperature: 0.0 - 2.0 (1 decimal place)
 * - Max Tokens: 50 - 4000 (integer)
 * - Prompt: 20 - 5000 characters
 * - Transfer number: E.164 format (international phone number)
 * - Keyword transfer: Optional transfer trigger word
 *
 * @example
 * ```typescript
 * const result = whatsappAssistantUpdateSchema.safeParse(data);
 * if (!result.success) {
 *   throw new Error(formatValidationError(result.error));
 * }
 * ```
 */
export const whatsappAssistantUpdateSchema = z.object({
  // Core configuration (all optional for partial updates)
  temperature: z
    .number()
    .min(0.0, 'La temperatura debe ser al menos 0.0')
    .max(2.0, 'La temperatura no puede exceder 2.0')
    .multipleOf(0.1, 'La temperatura debe tener máximo 1 decimal')
    .optional(),

  token: z
    .number()
    .int('El máximo de tokens debe ser un número entero')
    .min(50, 'El máximo de tokens debe ser al menos 50')
    .max(4000, 'El máximo de tokens no puede exceder 4000')
    .optional(),

  prompt: z
    .string()
    .min(20, 'El prompt debe tener al menos 20 caracteres')
    .max(5000, 'El prompt no puede exceder 5000 caracteres')
    .trim()
    .optional(),

  // WhatsApp specific fields
  keyword_transfer_ws: z
    .string()
    .max(100, 'La palabra clave de transferencia no puede exceder 100 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),

  number_transfer_ws: z
    .string()
    .regex(
      /^(\+?[1-9]\d{1,14})?$/,
      'Número de transferencia inválido. Use formato internacional (ej: +1234567890)'
    )
    .optional()
    .or(z.literal('')),

  // Namespace (read-only, for reference)
  namespace: z
    .string()
    .optional(),

  // Voice assistant reference
  voice_assistant: z
    .string()
    .optional(),

  // Document keys (legacy field)
  docs_keys: z
    .array(
      z.object({
        name: z.string(),
        s3_key: z.string(),
        namespace: z.string(),
        id_document: z.string().uuid(),
      })
    )
    .optional(),
});

/**
 * TypeScript type inferred from the validation schema
 * Use this type for type-safe function parameters
 */
export type WhatsAppAssistantUpdateInput = z.infer<typeof whatsappAssistantUpdateSchema>;

// ============================================================================
// VALIDATION ERROR FORMATTING
// ============================================================================

/**
 * Formats Zod validation errors into a user-friendly structure
 *
 * Converts Zod error format into a structure suitable for API responses:
 * - Overall error message
 * - Field-specific error arrays
 *
 * @param error - ZodError from failed validation
 * @returns Formatted error object with message and field errors
 *
 * @example
 * ```typescript
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   const formatted = formatValidationError(result.error);
 *   return res.status(400).json({
 *     error: formatted.message,
 *     fields: formatted.fields
 *   });
 * }
 * ```
 *
 * Output format:
 * ```json
 * {
 *   "message": "Validation failed",
 *   "fields": {
 *     "prompt": ["El prompt debe tener al menos 20 caracteres"],
 *     "temperature": ["La temperatura debe ser al menos 0.0"]
 *   }
 * }
 * ```
 */
export function formatValidationError(error: z.ZodError): {
  message: string;
  fields: Record<string, string[]>;
} {
  const fields: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!fields[path]) {
      fields[path] = [];
    }
    fields[path].push(err.message);
  });

  return {
    message: 'Errores de validación',
    fields,
  };
}

/**
 * Formats validation errors as a simple string for logging
 *
 * @param error - ZodError from failed validation
 * @returns Single string with all error messages
 *
 * @example
 * ```typescript
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   console.error(formatValidationErrorString(result.error));
 * }
 * ```
 *
 * Output: "prompt: El prompt debe tener al menos 20 caracteres; temperature: La temperatura debe ser al menos 0.0"
 */
export function formatValidationErrorString(error: z.ZodError): string {
  return error.errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join('; ');
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates voice assistant update data and returns typed result
 *
 * Convenience wrapper around safeParse for voice assistant updates.
 *
 * @param data - Raw request data to validate
 * @returns Success object with validated data or error object
 *
 * @example
 * ```typescript
 * const result = validateVoiceAssistantUpdate(requestBody);
 * if (!result.success) {
 *   return res.status(400).json(formatValidationError(result.error));
 * }
 * await updateAssistant(result.data);
 * ```
 */
export function validateVoiceAssistantUpdate(data: unknown) {
  return voiceAssistantUpdateSchema.safeParse(data);
}

/**
 * Validates WhatsApp assistant update data and returns typed result
 *
 * Convenience wrapper around safeParse for WhatsApp assistant updates.
 *
 * @param data - Raw request data to validate
 * @returns Success object with validated data or error object
 */
export function validateWhatsAppAssistantUpdate(data: unknown) {
  return whatsappAssistantUpdateSchema.safeParse(data);
}

/**
 * Strict validation that throws on error
 *
 * Use when you want to fail fast on validation errors.
 *
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const validData = strictValidateVoiceAssistant(requestBody);
 *   await updateAssistant(validData);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     return res.status(400).json(formatValidationError(error));
 *   }
 *   throw error;
 * }
 * ```
 */
export function strictValidateVoiceAssistant(data: unknown): VoiceAssistantUpdateInput {
  return voiceAssistantUpdateSchema.parse(data);
}

/**
 * Strict validation for WhatsApp assistant that throws on error
 */
export function strictValidateWhatsAppAssistant(data: unknown): WhatsAppAssistantUpdateInput {
  return whatsappAssistantUpdateSchema.parse(data);
}
