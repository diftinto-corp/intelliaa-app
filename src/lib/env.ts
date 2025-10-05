/**
 * Environment Variable Validation Utility
 *
 * This module provides type-safe access to environment variables with runtime validation.
 * It ensures all required variables are present before the application starts.
 *
 * Architecture:
 * - Server-side variables (no NEXT_PUBLIC_ prefix) are only accessible on the server
 * - Client-side variables (NEXT_PUBLIC_ prefix) are accessible on both server and client
 * - Validation runs at build time and runtime for defense in depth
 * - Type-safe exports prevent accessing undefined variables
 *
 * @see .claude/sessions/context_session_INTEL-011.md for implementation details
 */

// ============================================================================
// Type Definitions
// ============================================================================

type EnvError = {
  variable: string;
  message: string;
  setupUrl?: string;
};

type ValidationResult = {
  valid: boolean;
  errors: EnvError[];
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Require an environment variable to be present
 * Throws a descriptive error if missing
 */
function requireEnv(key: string, description?: string, setupUrl?: string): string {
  const value = process.env[key];

  if (!value) {
    const errorMessage = description
      ? `Missing required environment variable: ${key} (${description})`
      : `Missing required environment variable: ${key}`;

    const errorDetails = setupUrl
      ? `${errorMessage}\n  Get your API key from: ${setupUrl}`
      : errorMessage;

    throw new Error(errorDetails);
  }

  return value;
}

/**
 * Get an optional environment variable with a default value
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Parse a boolean environment variable
 */
function booleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Validate all required environment variables
 * Collects all errors before throwing
 */
function validateAllEnv(): ValidationResult {
  const errors: EnvError[] = [];

  // Only validate server variables on the server side
  if (typeof window === 'undefined') {
    // Server-side required variables
    const serverVars = [
      {
        key: 'OPENAI_API_KEY',
        description: 'OpenAI API key for embeddings',
        setupUrl: 'https://platform.openai.com/api-keys',
      },
      {
        key: 'PINECONE_API_KEY',
        description: 'Pinecone API key for vector storage',
        setupUrl: 'https://app.pinecone.io/organizations/-/projects/-/keys',
      },
      {
        key: 'PINECONE_INDEX',
        description: 'Pinecone index name',
      },
      {
        key: 'NEXT_PRIVATE_VAPI_KEY',
        description: 'VAPI private API key',
        setupUrl: 'https://dashboard.vapi.ai/',
      },
    ];

    serverVars.forEach(({ key, description, setupUrl }) => {
      if (!process.env[key]) {
        errors.push({
          variable: key,
          message: description || 'Required environment variable',
          setupUrl,
        });
      }
    });
  }

  // Client-side required variables (validate on both server and client)
  const clientVars = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      description: 'Supabase project URL',
      setupUrl: 'https://app.supabase.com/project/_/settings/api',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      description: 'Supabase anonymous key',
      setupUrl: 'https://app.supabase.com/project/_/settings/api',
    },
  ];

  clientVars.forEach(({ key, description, setupUrl }) => {
    if (!process.env[key]) {
      errors.push({
        variable: key,
        message: description || 'Required environment variable',
        setupUrl,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Server-side Environment Variables
// ============================================================================

/**
 * Server-side environment variables
 * Only accessible in Server Components, Route Handlers, and Server Actions
 *
 * Usage:
 * ```typescript
 * import { serverEnv } from '@/lib/env';
 *
 * const apiKey = serverEnv.OPENAI_API_KEY;
 * ```
 */
export const serverEnv = {
  OPENAI_API_KEY: requireEnv(
    'OPENAI_API_KEY',
    'OpenAI API key for embeddings',
    'https://platform.openai.com/api-keys'
  ),
  PINECONE_API_KEY: requireEnv(
    'PINECONE_API_KEY',
    'Pinecone API key for vector storage',
    'https://app.pinecone.io/organizations/-/projects/-/keys'
  ),
  PINECONE_INDEX: requireEnv(
    'PINECONE_INDEX',
    'Pinecone index name'
  ),
  PINECONE_ENVIRONMENT: optionalEnv('PINECONE_ENVIRONMENT', 'us-east-1-aws'),
  NEXT_PRIVATE_VAPI_KEY: requireEnv(
    'NEXT_PRIVATE_VAPI_KEY',
    'VAPI private API key',
    'https://dashboard.vapi.ai/'
  ),
} as const;

// ============================================================================
// Client-side Environment Variables
// ============================================================================

/**
 * Client-side environment variables
 * Safe to use in both Server and Client Components
 *
 * Usage:
 * ```typescript
 * import { clientEnv } from '@/lib/env';
 *
 * const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
 * ```
 */
export const clientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'Supabase project URL',
    'https://app.supabase.com/project/_/settings/api'
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'Supabase anonymous key',
    'https://app.supabase.com/project/_/settings/api'
  ),
  NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS: booleanEnv('NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS', false),
} as const;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate all environment variables
 * Returns validation result with any errors found
 *
 * Usage:
 * ```typescript
 * const result = validateEnv();
 * if (!result.valid) {
 *   console.error('Environment validation errors:', result.errors);
 * }
 * ```
 */
export function validateEnv(): ValidationResult {
  return validateAllEnv();
}

/**
 * Assert that all environment variables are valid
 * Throws an error if validation fails
 *
 * Usage:
 * ```typescript
 * // In root layout or app initialization
 * assertEnv();
 * ```
 */
export function assertEnv(): void {
  const result = validateAllEnv();

  if (!result.valid) {
    const errorMessage = [
      '❌ Environment validation failed:',
      '',
      'Missing required environment variables:',
      ...result.errors.map(err => {
        const setupInfo = err.setupUrl ? `\n     Get from: ${err.setupUrl}` : '';
        return `  - ${err.variable}: ${err.message}${setupInfo}`;
      }),
      '',
      '💡 Copy .env.example to .env.local and fill in the required values',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

// ============================================================================
// Type Exports for External Use
// ============================================================================

/**
 * Type-safe server environment
 */
export type ServerEnv = typeof serverEnv;

/**
 * Type-safe client environment
 */
export type ClientEnv = typeof clientEnv;
