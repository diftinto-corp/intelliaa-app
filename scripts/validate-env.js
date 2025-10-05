#!/usr/bin/env node

/**
 * Build-time Environment Validation Script
 *
 * This script validates environment variables before the build process.
 * It ensures all required variables are present and prevents deployment
 * with missing configuration.
 *
 * Usage:
 *   node scripts/validate-env.js
 *
 * Exit codes:
 *   0 - All environment variables are valid
 *   1 - Missing required environment variables
 */

// Load environment variables from .env.local if present
require('dotenv').config({ path: '.env.local' });

// Define required environment variables with metadata
const requiredEnvVars = [
  {
    key: 'OPENAI_API_KEY',
    description: 'OpenAI API key for embeddings',
    setupUrl: 'https://platform.openai.com/api-keys',
    serverOnly: true,
  },
  {
    key: 'PINECONE_API_KEY',
    description: 'Pinecone API key for vector storage',
    setupUrl: 'https://app.pinecone.io/organizations/-/projects/-/keys',
    serverOnly: true,
  },
  {
    key: 'PINECONE_INDEX',
    description: 'Pinecone index name',
    serverOnly: true,
  },
  {
    key: 'NEXT_PRIVATE_VAPI_KEY',
    description: 'VAPI private API key',
    setupUrl: 'https://dashboard.vapi.ai/',
    serverOnly: true,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    setupUrl: 'https://app.supabase.com/project/_/settings/api',
    serverOnly: false,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    setupUrl: 'https://app.supabase.com/project/_/settings/api',
    serverOnly: false,
  },
];

// Define optional environment variables with defaults
const optionalEnvVars = [
  {
    key: 'PINECONE_ENVIRONMENT',
    defaultValue: 'us-east-1-aws',
    description: 'Pinecone environment/region',
  },
  {
    key: 'NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS',
    defaultValue: 'false',
    description: 'Feature flag for Vercel AI SDK embeddings',
  },
];

// Validate environment variables
function validateEnv() {
  const errors = [];
  const warnings = [];

  console.log('🔍 Validating environment variables...\n');

  // Check required variables
  requiredEnvVars.forEach(({ key, description, setupUrl, serverOnly }) => {
    const value = process.env[key];

    if (!value) {
      errors.push({
        variable: key,
        description,
        setupUrl,
        serverOnly,
      });
    } else {
      const scope = serverOnly ? '(server-only)' : '(client-side)';
      console.log(`✓ ${key} ${scope}`);
    }
  });

  // Check optional variables and use defaults
  optionalEnvVars.forEach(({ key, defaultValue, description }) => {
    const value = process.env[key];

    if (!value) {
      warnings.push({
        variable: key,
        defaultValue,
        description,
      });
    } else {
      console.log(`✓ ${key} (optional)`);
    }
  });

  console.log('');

  // Report warnings for optional variables
  if (warnings.length > 0) {
    console.log('⚠️  Using default values for optional variables:\n');
    warnings.forEach(({ variable, defaultValue, description }) => {
      console.log(`  ${variable}: ${description}`);
      console.log(`    Default: ${defaultValue}\n`);
    });
  }

  // Report errors and exit if any required variables are missing
  if (errors.length > 0) {
    console.log('❌ Environment validation failed!\n');
    console.log('Missing required environment variables:\n');

    errors.forEach(({ variable, description, setupUrl, serverOnly }) => {
      const scope = serverOnly ? '(server-only)' : '(client-side)';
      console.log(`  • ${variable} ${scope}`);
      console.log(`    ${description}`);
      if (setupUrl) {
        console.log(`    Get from: ${setupUrl}`);
      }
      console.log('');
    });

    console.log('💡 To fix this:\n');
    console.log('  1. Copy .env.example to .env.local');
    console.log('  2. Fill in all required values');
    console.log('  3. Run the build command again\n');

    process.exit(1);
  }

  console.log('✅ All required environment variables are present!\n');
  process.exit(0);
}

// Run validation
validateEnv();
