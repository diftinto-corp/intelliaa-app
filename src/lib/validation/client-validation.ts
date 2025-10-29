/**
 * Client-side validation utilities
 *
 * Provides real-time validation for assistant configuration forms.
 * Reuses server-side Zod schemas for consistency.
 *
 * @see src/lib/validation/assistant-config.ts for schema definitions
 */

import { useState, useCallback } from "react";
import { z } from "zod";

/**
 * Validation error state
 */
export type ValidationErrors = Record<string, string | null>;

/**
 * Field validator function type
 */
type FieldValidator = (value: any) => string | null;

/**
 * Creates a field validator from a Zod schema
 *
 * @param schema - Zod schema for the field
 * @returns Validator function that returns error message or null
 */
function createFieldValidator(schema: z.ZodSchema): FieldValidator {
  return (value: any) => {
    const result = schema.safeParse(value);
    if (result.success) {
      return null;
    }
    return result.error.errors[0]?.message || "Valor inválido";
  };
}

// ============================================================================
// VOICE ASSISTANT VALIDATORS
// ============================================================================

export const voiceValidators = {
  prompt: createFieldValidator(
    z
      .string()
      .min(20, "El prompt debe tener al menos 20 caracteres")
      .max(5000, "El prompt no puede exceder 5000 caracteres")
  ),

  temperature: createFieldValidator(
    z
      .number()
      .min(0.0, "La temperatura debe ser al menos 0.0")
      .max(2.0, "La temperatura no puede exceder 2.0")
  ),

  maxTokens: createFieldValidator(
    z
      .number()
      .int("El máximo de tokens debe ser un número entero")
      .min(50, "El máximo de tokens debe ser al menos 50")
      .max(4000, "El máximo de tokens no puede exceder 4000")
  ),

  welcomeMessage: createFieldValidator(
    z
      .string()
      .min(1, "El mensaje de bienvenida es requerido")
      .max(500, "El mensaje de bienvenida no puede exceder 500 caracteres")
  ),

  endCallMessage: createFieldValidator(
    z
      .string()
      .max(200, "El mensaje de fin de llamada no puede exceder 200 caracteres")
  ),

  voicemailMessage: createFieldValidator(
    z
      .string()
      .max(200, "El mensaje de buzón de voz no puede exceder 200 caracteres")
  ),

  endCallPhrase: createFieldValidator(
    z
      .string()
      .max(50, "Cada frase debe tener máximo 50 caracteres")
  ),

  voiceId: createFieldValidator(
    z
      .string()
      .regex(/^[a-zA-Z0-9]+$/, "ID de voz inválido")
      .min(1, "ID de voz es requerido")
  ),
};

// ============================================================================
// WHATSAPP ASSISTANT VALIDATORS
// ============================================================================

export const whatsappValidators = {
  prompt: voiceValidators.prompt,
  temperature: voiceValidators.temperature,
  maxTokens: voiceValidators.maxTokens,

  keywordTransfer: createFieldValidator(
    z
      .string()
      .max(
        100,
        "La palabra clave de transferencia no puede exceder 100 caracteres"
      )
  ),

  numberTransfer: createFieldValidator(
    z
      .string()
      .regex(
        /^(\+?[1-9]\d{1,14})?$/,
        "Número de transferencia inválido. Use formato internacional (ej: +1234567890)"
      )
  ),
};

// ============================================================================
// VALIDATION HOOKS
// ============================================================================

/**
 * Hook for managing form validation errors
 *
 * Provides state and methods for field-level validation with inline error display.
 *
 * @param validators - Object mapping field names to validator functions
 * @returns Object with errors state and validation methods
 *
 * @example
 * ```tsx
 * const { errors, validateField, clearError, hasErrors } = useFormValidation({
 *   prompt: voiceValidators.prompt,
 *   temperature: voiceValidators.temperature,
 * });
 *
 * <Textarea
 *   value={prompt}
 *   onChange={(e) => setPrompt(e.target.value)}
 *   onBlur={() => validateField('prompt', prompt)}
 *   aria-invalid={!!errors.prompt}
 *   aria-describedby={errors.prompt ? 'prompt-error' : undefined}
 * />
 * {errors.prompt && (
 *   <p id="prompt-error" className="text-sm text-destructive">
 *     {errors.prompt}
 *   </p>
 * )}
 * ```
 */
export function useFormValidation(validators: Record<string, FieldValidator>) {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback(
    (fieldName: string, value: any): boolean => {
      const validator = validators[fieldName];
      if (!validator) {
        console.warn(`No validator found for field: ${fieldName}`);
        return true;
      }

      const error = validator(value);
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));

      return error === null;
    },
    [validators]
  );

  const validateAllFields = useCallback(
    (values: Record<string, any>): boolean => {
      const newErrors: ValidationErrors = {};
      let isValid = true;

      Object.keys(validators).forEach((fieldName) => {
        const validator = validators[fieldName];
        const value = values[fieldName];
        const error = validator(value);

        if (error) {
          newErrors[fieldName] = error;
          isValid = false;
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [validators]
  );

  const clearError = useCallback((fieldName: string) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: null,
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useCallback(() => {
    return Object.values(errors).some((error) => error !== null);
  }, [errors]);

  const getError = useCallback(
    (fieldName: string): string | null => {
      return errors[fieldName] || null;
    },
    [errors]
  );

  return {
    errors,
    validateField,
    validateAllFields,
    clearError,
    clearAllErrors,
    hasErrors,
    getError,
  };
}

/**
 * Hook for Voice Assistant form validation
 *
 * Pre-configured with voice assistant validators.
 *
 * @example
 * ```tsx
 * const { errors, validateField } = useVoiceAssistantValidation();
 * ```
 */
export function useVoiceAssistantValidation() {
  return useFormValidation(voiceValidators);
}

/**
 * Hook for WhatsApp Assistant form validation
 *
 * Pre-configured with WhatsApp assistant validators.
 *
 * @example
 * ```tsx
 * const { errors, validateField } = useWhatsAppAssistantValidation();
 * ```
 */
export function useWhatsAppAssistantValidation() {
  return useFormValidation(whatsappValidators);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates end call phrases array
 *
 * @param phrases - Array of end call phrases
 * @returns Object with isValid flag and error message
 */
export function validateEndCallPhrases(
  phrases: string[]
): { isValid: boolean; error: string | null } {
  if (phrases.length > 20) {
    return {
      isValid: false,
      error: "Máximo 20 frases de fin de llamada permitidas",
    };
  }

  for (const phrase of phrases) {
    const error = voiceValidators.endCallPhrase(phrase);
    if (error) {
      return { isValid: false, error };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Formats validation error for display
 *
 * @param error - Error message or null
 * @returns Formatted error string or null
 */
export function formatValidationError(error: string | null): string | null {
  return error;
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array)
 *
 * @param value - Value to check
 * @returns True if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Creates an onChange handler that validates on blur
 *
 * @param setValue - State setter function
 * @param validateField - Validation function from useFormValidation
 * @param fieldName - Name of the field being validated
 * @returns Object with onChange and onBlur handlers
 *
 * @example
 * ```tsx
 * const handlers = createValidatedFieldHandlers(
 *   setPrompt,
 *   validateField,
 *   'prompt'
 * );
 *
 * <Textarea {...handlers} value={prompt} />
 * ```
 */
export function createValidatedFieldHandlers<T>(
  setValue: (value: T) => void,
  validateField: (fieldName: string, value: any) => boolean,
  fieldName: string
) {
  return {
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value as T);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      validateField(fieldName, e.target.value);
    },
  };
}

/**
 * Creates handlers for number inputs (sliders, number fields)
 *
 * @param setValue - State setter function
 * @param validateField - Validation function
 * @param fieldName - Name of the field
 * @returns Object with onChange handler
 */
export function createValidatedNumberHandlers(
  setValue: (value: number) => void,
  validateField: (fieldName: string, value: any) => boolean,
  fieldName: string
) {
  return {
    onValueChange: (value: number) => {
      setValue(value);
      validateField(fieldName, value);
    },
  };
}
