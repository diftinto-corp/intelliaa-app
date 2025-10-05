# INTEL-011: Environment Configuration Session Context

## Session Information
- **Feature**: Update Environment Configuration
- **Branch**: feature/INTEL-011-environment-configuration
- **Epic**: Backend Service Migration
- **Priority**: P0 - Critical
- **Date Started**: 2025-10-05

## Initial Analysis

### Current State Assessment

#### Existing Environment Variables (from .env.example)
The project currently has:

**✅ Already Configured:**
- `OPENAI_API_KEY` - Added in INTEL-001 (line 38)
- `PINECONE_API_KEY` - Added in INTEL-003 (line 47)
- `PINECONE_INDEX` - Added in INTEL-003 (line 49)
- `PINECONE_ENVIRONMENT` - Added in INTEL-003 (line 51)
- `NEXT_PRIVATE_VAPI_KEY` - Already exists (line 9)
- `NEXT_PUBLIC_SUPABASE_URL` - Already exists (line 68)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Already exists (line 67)

**⚠️ Legacy Variables (To Be Deprecated):**
- `NEXT_PUBLIC_FLOWISE*` - Multiple Flowise-related variables (lines 21-30)
- `NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE` - Old OpenAI key for Flowise (line 33)
- `NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE` - Old Pinecone key for Flowise (line 42)
- `NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE` - No longer needed (line 54)

**📝 Good Documentation Found:**
- Lines 35-38: Clear documentation for OPENAI_API_KEY with cost information
- Lines 45-51: Comprehensive Pinecone configuration with migration notes
- Lines 81-86: Feature flag documentation for Vercel embeddings

### Key Findings

1. **Most variables are already in place** from previous INTEL stories (001, 002, 003)
2. **Documentation is partially complete** - some variables have good descriptions, others lack context
3. **Migration path exists** - Legacy Flowise variables are still present for backward compatibility
4. **No validation utility exists** - Need to create `src/lib/env.ts` as specified

### Implementation Plan

#### Phase 1: Analysis & Planning ✅
- [x] Read current .env.example
- [x] Identify existing vs missing variables
- [x] Create session context file
- [x] Consult with backend-business-logic-architect for validation utility design

#### Phase 2: Environment Variable Updates ✅
- [x] Reorganize .env.example with clear sections
- [x] Add comprehensive documentation for each variable
- [x] Add source URLs (where to get API keys)
- [x] Mark deprecated variables clearly
- [x] Add environment-specific notes (dev vs production)

#### Phase 3: Validation Utility ✅
- [x] Create `src/lib/env.ts` with validation logic
- [x] Define required vs optional variables
- [x] Implement clear error messages
- [x] Add type safety with TypeScript
- [x] Integrate validation at app startup
- [x] Create build-time validation script (`scripts/validate-env.js`)
- [x] Update package.json to run validation before build

#### Phase 4: Documentation ✅
- [x] Update README.md with setup instructions
- [x] Update CLAUDE.md environment section
- [x] Create migration guide (in .env.example)
- [x] Document security best practices

#### Phase 5: Testing ✅
- [x] Test validation with missing variables
- [x] Test with all variables present
- [x] Verify error messages are clear
- [x] Test in local development environment
- [x] Test build-time validation integration

## Architecture Considerations

### Environment Variable Naming Convention
Current patterns observed:
- `NEXT_PUBLIC_*` - Client-side exposed variables
- `NEXT_PRIVATE_*` - Server-side only (marked private)
- `NEXT_*` - Server-side build/runtime variables
- No prefix - Server-side only (e.g., `OPENAI_API_KEY`, `PINECONE_API_KEY`)

### Migration Strategy
1. **Keep old variables during transition** - Don't break existing deployments
2. **Add new variables alongside** - Allow parallel operation
3. **Feature flags for gradual rollout** - `NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS` already exists
4. **Clear deprecation notices** - Mark old variables with comments
5. **Remove after verification** - Only delete once migration is complete

### Security Requirements
- Never commit `.env.local` to git
- Use different keys for dev/staging/production
- Server-side variables should NOT use `NEXT_PUBLIC_` prefix
- Sensitive keys should be in deployment platform secrets

## Dependencies

### Blocks
- INTEL-001 ✅ (already has OPENAI_API_KEY)
- INTEL-002 ✅ (already has NEXT_PRIVATE_VAPI_KEY)
- INTEL-003 ✅ (already has Pinecone configuration)

### External Requirements
- OpenAI API account (already exists)
- Pinecone account and index (already exists)
- VAPI account (already exists)
- Supabase project (already exists)

## Next Steps

1. **Consult backend-business-logic-architect** for validation utility design
2. **Reorganize .env.example** with better structure and documentation
3. **Create validation utility** at `src/lib/env.ts`
4. **Update project documentation**
5. **Test thoroughly** in local environment

## Notes

- The project already has most required environment variables from previous INTEL stories
- Main work needed: validation utility, better documentation, and migration guide
- Feature flag pattern (`NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS`) is good for gradual rollout
- Need to ensure Next.js 15 async patterns are used in validation utility

---

## Backend Business Logic Architect Recommendations

### Validation Utility Design (Consulted: 2025-10-05)

**Recommended Approach: Lightweight + Incremental**

The architect recommends a **3-phase implementation**:

#### Phase 1: Basic Validation (Start Simple)
```typescript
export const serverEnv = {
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  PINECONE_API_KEY: requireEnv('PINECONE_API_KEY'),
  // ...
} as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
```

#### Phase 2: Pattern Validation (Enhance)
- Add regex pattern matching for API keys (e.g., OpenAI keys start with `sk-proj-`)
- Add URL format validation for Supabase
- Better error messages with setup URLs

#### Phase 3: Full Schema-Based Validation (Polish)
- Aggregate all errors before failing
- Separate server/client variable validation
- Optional: Add Zod if complexity grows

### Key Design Decisions

1. **Validation Timing**: Both build-time AND runtime (defense in depth)
2. **Error Strategy**: Collect all errors, fail once with complete report
3. **Server/Client Separation**: Separate exports (`serverEnv` vs `clientEnv`)
4. **Type Safety**: Const assertions + TypeScript for IDE autocomplete
5. **Pattern Matching**: Permissive initially (e.g., OpenAI key starts with `sk-`)
6. **Defaults**: Explicit default values for optional variables (e.g., `PINECONE_ENVIRONMENT: 'us-east-1-aws'`)
7. **Error Messages**: Actionable with setup URLs
8. **Bundle Optimization**: Tree-shakeable, server schemas excluded from client bundle
9. **Dependency Strategy**: Zero external dependencies initially
10. **Migration Path**: Gradual rollout with warnings before hard failures

### File Structure (Recommended)
```
src/lib/env/
├── index.ts                 # Main export and validation orchestration
├── schemas/
│   ├── server.ts           # Server-side variable schemas
│   ├── client.ts           # Client-side variable schemas
│   └── types.ts            # Shared types
├── validators/
│   ├── format-validators.ts # Format validation functions
│   └── pattern-validators.ts # Pattern matching validators
└── errors.ts               # Error formatting and reporting
```

### Critical Variables to Validate

**Server-side (Required):**
- `OPENAI_API_KEY` - Pattern: `/^sk-proj-[a-zA-Z0-9_-]+$/`
- `PINECONE_API_KEY` - Pattern: `/^pc-[a-zA-Z0-9_-]+$/`
- `PINECONE_INDEX` - String, required
- `NEXT_PRIVATE_VAPI_KEY` - API key, required

**Server-side (Optional with defaults):**
- `PINECONE_ENVIRONMENT` - Default: `'us-east-1-aws'`

**Client-side (Required):**
- `NEXT_PUBLIC_SUPABASE_URL` - Pattern: `/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - JWT pattern: `/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/`

**Client-side (Optional with defaults):**
- `NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS` - Boolean, default: `false`

### Integration Strategy

1. **Build-time validation**: Add script to package.json build command
2. **Runtime validation**: Import in root layout (server-side only)
3. **Type-safe access**: Replace direct `process.env` with `serverEnv` / `clientEnv`

### Security Considerations

- ✅ Server-only variables never included in client bundle
- ✅ No console.log of actual values (only variable names in errors)
- ✅ Pattern matching prevents obviously invalid keys
- ✅ Type system enforces server/client separation
- ✅ Validation runs before any database or API access

### Implementation Recommendation

**Start with Phase 1 (Basic)** for immediate value, then iterate to Phase 2/3 as needed. This minimizes risk while providing immediate validation benefits.

**No Zod dependency initially** - Pure TypeScript implementation keeps bundle small. Consider Zod later if validation complexity justifies it (~14KB bundle size).

---

## Implementation Summary

### Completed Work ✅

#### 1. Environment Variable Organization (.env.example)
- **Reorganized with clear sections**: Core Services, AI & Voice Services, Cloud Services, Communication Services, etc.
- **Comprehensive documentation**: Each variable includes description, setup URL, and default values
- **Deprecated variables marked**: Clear warnings for Flowise-related variables being phased out
- **Environment-specific notes**: Separate guidance for dev, staging, and production
- **Security best practices**: Documented in comments

#### 2. Validation Utility (src/lib/env.ts)
- **Type-safe exports**: `serverEnv` and `clientEnv` with const assertions
- **Runtime validation**: `validateEnv()` and `assertEnv()` functions
- **Clear error messages**: Includes variable descriptions and setup URLs
- **Server/client separation**: Server-only variables never exposed to client bundle
- **Default values**: Optional variables have explicit defaults (e.g., `PINECONE_ENVIRONMENT`)
- **Zero dependencies**: Pure TypeScript implementation, no external validation libraries

#### 3. Build-Time Validation (scripts/validate-env.js)
- **Pre-build validation**: Runs before `next build` to catch missing variables
- **Detailed error reporting**: Shows all missing variables with setup instructions
- **Warning for optional variables**: Informs about default values being used
- **Exit codes**: Returns 0 for success, 1 for failure (CI/CD compatible)

#### 4. Integration
- **package.json scripts**:
  - `npm run validate-env` - Standalone validation command
  - `npm run build` - Now runs validation before build
- **App layout integration**: Runtime validation in `src/app/layout.tsx`
  - Development: Throws error for immediate feedback
  - Production: Logs error but degrades gracefully

#### 5. Documentation Updates
- **README.md**:
  - Updated environment setup instructions
  - Added validation command documentation
  - Included migration note about Flowise deprecation
  - Added environment variable section with type-safe usage examples
- **CLAUDE.md**:
  - Comprehensive environment variables section
  - Type-safe usage examples
  - Validation behavior documentation
  - Legacy variables deprecation notice

### Validation Test Results ✅

**Test 1: Standalone validation**
```bash
npm run validate-env
```
✅ All required variables validated successfully
✅ Optional variables show default values
✅ Clear output with server-only and client-side annotations

**Test 2: Build-time validation**
```bash
npm run build
```
✅ Validation runs before build
✅ Build proceeds with valid environment
✅ Clear error messages if variables missing

### Files Created/Modified

**Created:**
1. `src/lib/env.ts` - Type-safe environment validation utility
2. `scripts/validate-env.js` - Build-time validation script
3. `.claude/sessions/context_session_INTEL-011.md` - Session context

**Modified:**
1. `.env.example` - Reorganized with comprehensive documentation
2. `package.json` - Added validation to build script
3. `src/app/layout.tsx` - Integrated runtime validation
4. `README.md` - Updated environment setup section
5. `.claude/CLAUDE.md` - Updated environment variables section

### Key Achievements

1. ✅ **Defense in depth**: Validation at build time AND runtime
2. ✅ **Type safety**: TypeScript prevents accessing undefined variables
3. ✅ **Developer experience**: Clear error messages with setup URLs
4. ✅ **Security**: Server-side variables never exposed to client
5. ✅ **Zero dependencies**: Pure TypeScript, no external libraries
6. ✅ **CI/CD ready**: Exit codes and clear error reporting
7. ✅ **Migration path**: Legacy variables documented and deprecated
8. ✅ **Comprehensive documentation**: README, CLAUDE.md, and .env.example all updated

### Future Enhancements (Optional)

1. **Pattern validation** (Phase 2):
   - Add regex validation for API key formats (e.g., OpenAI keys start with `sk-proj-`)
   - URL format validation for Supabase endpoint
   - JWT format validation for Supabase anon key

2. **Enhanced validation** (Phase 3):
   - Aggregate all errors before failing
   - Separate server/client validation with detailed reporting
   - Add Zod if validation complexity grows

3. **Monitoring** (Future):
   - Add telemetry for validation failures in production
   - Track environment variable usage patterns
   - Alert on missing variables in staging/production deployments

### Testing Checklist ✅

- [x] Validation script runs successfully with all required variables
- [x] Clear error messages when variables are missing
- [x] Optional variables use default values correctly
- [x] Build command includes validation
- [x] Runtime validation integrated in app layout
- [x] Type-safe imports work correctly (`serverEnv`, `clientEnv`)
- [x] Documentation is comprehensive and accurate
- [x] Migration guide is clear for existing installations

## Definition of Done ✅

All acceptance criteria from INTEL-011 user story have been met:

### AC1: Environment Variable Validation ✅
- ✅ Validation runs at app startup (build time and runtime)
- ✅ Required variables are validated
- ✅ Missing variables trigger clear error messages with setup URLs

### AC2: Configuration Documentation ✅
- ✅ `.env.example` fully documented with descriptions
- ✅ Example values provided for all variables
- ✅ Required vs optional clearly marked
- ✅ Setup URLs included for each service

### AC3: Migration Path ✅
- ✅ Old Flowise variables marked as deprecated
- ✅ Clear migration instructions in comments
- ✅ New variables documented alongside old ones
- ✅ Safe to remove old variables after verification

### AC4: Development vs Production ✅
- ✅ Environment-specific documentation in .env.example
- ✅ Different validation behavior (throw in dev, log in prod)
- ✅ Clear guidance for which variables differ between environments
- ✅ Security best practices documented

## Next Steps (Post-Implementation)

1. **Monitor validation in production**: Check logs for any environment-related errors
2. **Gradual Flowise deprecation**: Remove old variables after complete migration to Vercel AI SDK
3. **Consider Phase 2 enhancements**: Add pattern validation if needed
4. **Update deployment documentation**: Ensure platform-specific guides (Vercel, Railway) are updated
