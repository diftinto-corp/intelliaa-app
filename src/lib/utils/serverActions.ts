/**
 * Server Action Utility Functions
 * Helper functions for working with Next.js 15 server actions
 *
 * Note: These are NOT server actions themselves, just utility functions
 * that can be used in both client and server code.
 */

/**
 * Type guard to check if a result is an error response
 *
 * @param result - Result from a server action that may be data or error
 * @returns True if result is an error object with error property
 *
 * @example
 * ```typescript
 * const result = await getAssistantsForAccount(accountId);
 * if (isError(result)) {
 *   console.error(result.error);
 *   return;
 * }
 * // result is now typed as AssistantListItem[]
 * ```
 */
export function isError<T>(
  result: T | { error: string }
): result is { error: string } {
  return typeof result === "object" && result !== null && "error" in result;
}

/**
 * Type guard for checking if a value is defined (not null or undefined)
 *
 * @param value - Value to check
 * @returns True if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Extracts error message from various error types
 *
 * @param error - Error of unknown type
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "string"
  ) {
    return error.error;
  }
  return "An unexpected error occurred";
}
