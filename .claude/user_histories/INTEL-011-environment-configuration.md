# INTEL-011: Update Environment Configuration

**Epic**: Backend Service Migration
**Priority**: P0 - Critical
**Estimate**: 2 points
**Labels**: infrastructure, configuration, devops

## User Story

As a developer, I want to configure environment variables for the new services, so that the application can connect to Vercel AI SDK, VAPI, and Pinecone.

## Acceptance Criteria

### AC1: Environment Variable Validation
**Given** the application starts
**When** environment variables are loaded
**Then** all required variables are validated and missing variables trigger clear error messages

### AC2: Configuration Documentation
**Given** a developer sets up the project
**When** they reference `.env.example`
**Then** all variables are documented with descriptions, example values, and whether they're required

### AC3: Migration Path
**Given** the migration from Flowise is complete
**When** updating environment configuration
**Then** old Flowise-specific variables can be safely removed or marked as deprecated

### AC4: Development vs Production
**Given** different deployment environments (local, staging, production)
**When** configuring variables
**Then** documentation clearly indicates which variables differ between environments

## Technical Notes

### New Environment Variables Required

#### OpenAI (for Vercel AI SDK)
```bash
# OpenAI API Key for embeddings
OPENAI_API_KEY=sk-proj-...
# Required for: Vercel AI SDK embeddings (INTEL-001)
```

#### Pinecone (Update existing)
```bash
# Pinecone API Key (migrate from NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE)
PINECONE_API_KEY=your-api-key
# Required for: Vector store operations (INTEL-003)

# Pinecone Index Name (migrate from NEXT_PUBLIC_PINECONE_INDEX)
PINECONE_INDEX=intelliaa-documents
# Required for: Vector store operations (INTEL-003)

# Pinecone Environment (may be needed)
PINECONE_ENVIRONMENT=us-east-1-aws
# Required for: Pinecone client initialization
```

#### VAPI (existing, verify)
```bash
# VAPI Private Key
NEXT_PRIVATE_VAPI_KEY=your-vapi-key
# Required for: File uploads and knowledge base operations (INTEL-002)
```

### Variables to Deprecate/Remove

After complete migration, these can be removed:
```bash
# OLD FLOWISE VARIABLES - Can be removed after migration
# NEXT_PUBLIC_FLOWISE=
# NEXT_PUBLIC_FLOWISE_KEY=
# NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE= (replace with OPENAI_API_KEY)
# NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE= (replace with PINECONE_API_KEY)
# NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE= (no longer needed, record manager not used)
```

### Updated .env.example
```bash
# ================================
# OPENAI CONFIGURATION
# ================================
# OpenAI API key for document embeddings
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# ================================
# PINECONE CONFIGURATION
# ================================
# Pinecone API key for vector storage
# Get from: https://app.pinecone.io/
PINECONE_API_KEY=your-pinecone-api-key

# Pinecone index name (must be created beforehand)
PINECONE_INDEX=intelliaa-documents

# Pinecone environment/region
PINECONE_ENVIRONMENT=us-east-1-aws

# ================================
# VAPI CONFIGURATION
# ================================
# VAPI private API key for voice AI and knowledge bases
# Get from: https://dashboard.vapi.ai/
NEXT_PRIVATE_VAPI_KEY=your-vapi-key

# ================================
# SUPABASE CONFIGURATION
# ================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ... other existing variables ...
```

### Environment Validation Utility

Create validation utility at `src/lib/env.ts`:
```typescript
const requiredEnvVars = {
  OPENAI_API_KEY: 'OpenAI API key for embeddings',
  PINECONE_API_KEY: 'Pinecone API key for vector storage',
  PINECONE_INDEX: 'Pinecone index name',
  NEXT_PRIVATE_VAPI_KEY: 'VAPI API key',
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anonymous key',
} as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}`
    );
  }
}

// Call at app startup
validateEnv();
```

### Deployment Checklist

**Local Development**:
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in all required variables
- [ ] Verify connection to OpenAI API
- [ ] Verify connection to Pinecone
- [ ] Verify connection to VAPI

**Staging/Production**:
- [ ] Set environment variables in deployment platform (Vercel/Railway/etc.)
- [ ] Use production API keys (not development keys)
- [ ] Verify all services are accessible from deployment environment
- [ ] Test end-to-end document upload and retrieval
- [ ] Monitor for any environment-related errors

### Security Considerations

**Never commit**:
- `.env.local` (add to `.gitignore`)
- Actual API keys in code
- API keys in documentation

**Best practices**:
- Use different API keys for development and production
- Rotate keys periodically
- Use secret management tools for production
- Set up alerts for API key usage spikes
- Limit API key permissions where possible

### Migration Guide

For existing installations:
1. Keep old Flowise variables during development
2. Add new variables (OpenAI, Pinecone)
3. Test with both configurations in parallel if needed
4. Switch over to new services
5. Remove old Flowise variables after verification
6. Update deployment configuration

### Documentation Updates

Update the following files:
- [ ] `.env.example` with new variables
- [ ] `README.md` with setup instructions
- [ ] `CLAUDE.md` with updated environment section
- [ ] Deployment guides (if any)

## Definition of Done

- [ ] `.env.example` updated with all variables
- [ ] Each variable documented with description and source
- [ ] Environment validation utility created
- [ ] Validation utility integrated at app startup
- [ ] Documentation updated (README, CLAUDE.md)
- [ ] Migration guide created
- [ ] Security best practices documented
- [ ] Deployment checklist created
- [ ] Tested in local development
- [ ] Verified in staging environment
- [ ] Code reviewed and approved

## Dependencies

- OpenAI API account and key
- Pinecone account and index created
- VAPI account and key (already exists)
- No blocking dependencies from other stories

## Related Stories

- **Blocks**: INTEL-001 (needs OPENAI_API_KEY)
- **Blocks**: INTEL-003 (needs Pinecone configuration)
- **Blocks**: INTEL-002 (needs VAPI configuration verified)
