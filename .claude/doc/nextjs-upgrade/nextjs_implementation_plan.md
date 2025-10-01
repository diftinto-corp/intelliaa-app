# Next.js 15.5.3 Upgrade Implementation Plan

## Executive Summary

**Current Version:** Next.js 14.2.20
**Target Version:** Next.js 15.5.3
**Estimated Complexity:** **HIGH**
**Estimated Time:** 4-6 hours

### Key Benefits of Upgrade
- React 19 support with improved performance and concurrent features
- Better async handling for Server Components
- Improved development experience with faster HMR
- Enhanced TypeScript support
- More granular caching control

### Critical Risks and Mitigation Strategies

**RISK 1: React 19 Breaking Changes**
- React 18.3.1 → React 19 is a major version jump
- Mitigation: Test all interactive components thoroughly, especially forms using hooks

**RISK 2: Async API Migration**
- `cookies()` function in Supabase server client becomes async
- Mitigation: Use automated codemod and manual verification

**RISK 3: Multi-tenant Architecture**
- Account-based routing and middleware session validation must remain stable
- Mitigation: Extensive testing of auth flows and tenant isolation

---

## Pre-Upgrade Checklist

- [ ] **Create full backup** of current codebase
- [ ] **Create new branch**: `git checkout -b upgrade/nextjs-15`
- [ ] **Document current build metrics**: Build time, bundle size
- [ ] **Ensure all tests pass** on current version
- [ ] **Setup staging environment** for testing upgraded version
- [ ] **Review all custom middleware** for compatibility

### Rollback Plan
```bash
# If issues arise, rollback using:
git checkout main
npm install  # Reinstall dependencies from package-lock.json
npm run build
```

---

## Dependency Update Plan

### Core Dependencies

**Next.js & React:**
```json
- Package: next
  Current: ^14.2.20
  Target: ^15.5.3
  Breaking Changes: Async request APIs, caching defaults, removed geo/ip from NextRequest
  Required Code Changes: Update cookies() calls, review caching strategy

- Package: react
  Current: ^18.3.1
  Target: ^19.0.0
  Breaking Changes: useFormState → useActionState, stricter hydration
  Required Code Changes: Update form hooks if used

- Package: react-dom
  Current: 18.2.0
  Target: ^19.0.0
  Breaking Changes: Must match React version
  Required Code Changes: None expected
```

**TypeScript & Types:**
```json
- Package: typescript
  Current: 5.3.3
  Target: ^5.7.2
  Breaking Changes: None expected
  Required Code Changes: None

- Package: @types/react
  Current: 18.2.48
  Target: ^19.0.2
  Breaking Changes: Type definitions for React 19
  Required Code Changes: Type adjustments for async components

- Package: @types/react-dom
  Current: 18.2.18
  Target: ^19.0.2
  Breaking Changes: Must match React types
  Required Code Changes: None
```

### Supabase Dependencies

```json
- Package: @supabase/ssr
  Current: 0.0.10
  Target: ^0.5.2 (latest)
  Breaking Changes: Improved async handling
  Required Code Changes: Review cookie handling in server.ts

- Package: @supabase/supabase-js
  Current: ^2.44.4
  Target: ^2.48.0 (latest compatible)
  Breaking Changes: None expected
  Required Code Changes: None
```

### UI & Styling Dependencies

```json
- Package: @radix-ui/* (all packages)
  Current: Various
  Target: Keep current (verify React 19 compatibility)
  Breaking Changes: None expected
  Required Code Changes: Test all UI components

- Package: tailwindcss
  Current: 3.4.1
  Target: ^3.4.1 (keep current)
  Breaking Changes: None
  Required Code Changes: None
```

### Other Critical Dependencies

```json
- Package: @apollo/client
  Current: ^3.10.8
  Target: ^3.12.4 (React 19 compatible)
  Breaking Changes: None expected
  Required Code Changes: None

- Package: swr
  Current: ^2.2.5
  Target: ^2.3.0 (React 19 compatible)
  Breaking Changes: None expected
  Required Code Changes: None

- Package: next-themes
  Current: ^0.3.0
  Target: ^0.4.4 (Next.js 15 compatible)
  Breaking Changes: None expected
  Required Code Changes: None
```

---

## File-by-File Modification Plan

### 1. Supabase Server Client
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/supabase/server.ts`
**Reason:** cookies() becomes async in Next.js 15
**Changes Required:**
```typescript
// BEFORE (Next.js 14)
import { cookies } from "next/headers";

export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // ...
      },
    },
  );
};

// AFTER (Next.js 15)
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // ...
      },
    },
  );
};
```

### 2. Account Slug Layout
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/layout.tsx`
**Reason:** params becomes async, createClient() becomes async
**Changes Required:**
```typescript
// BEFORE
export default async function PersonalAccountDashboard({
  children,
  params: { accountSlug },
}: {
  children: React.ReactNode;
  params: { accountSlug: string };
}) {
  const supabaseClient = createClient();
  // ...
}

// AFTER
export default async function PersonalAccountDashboard({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ accountSlug: string }>;
}) {
  const { accountSlug } = await params;
  const supabaseClient = await createClient();
  // ...
}
```

### 3. Confirmation Page
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/confirm/page.tsx`
**Reason:** searchParams becomes async
**Changes Required:**
```typescript
// BEFORE
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: { org: string };
}) {
  if (!searchParams.org) {
    redirect("/");
  }
  // ...
}

// AFTER
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ org: string }>;
}) {
  const params = await searchParams;
  if (!params.org) {
    redirect("/");
  }
  // ...
}
```

### 4. Middleware Session Validation
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/supabase/middleware.ts`
**Reason:** Cookie handling remains synchronous in middleware
**Changes Required:**
```typescript
// No changes needed - middleware cookie handling remains synchronous in Next.js 15
// The current implementation should work as-is
```

### 5. API Route Handlers
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/api/create-assistant-voice/route.ts` (and all other API routes)
**Reason:** Review for caching changes
**Changes Required:**
```typescript
// Add explicit caching if needed (GET routes are no longer cached by default)
export const dynamic = 'force-dynamic'; // or 'force-static' if caching is desired
// OR
export const revalidate = 60; // seconds

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Existing code remains the same
}
```

### 6. All Server Actions Using Supabase
**Files:** All files in `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/`
**Reason:** createClient() becomes async
**Changes Required:**
```typescript
// Example for assistants.ts
// BEFORE
const GetAllAssistants = async (account_id: string) => {
  const supabase = createClient();
  // ...
}

// AFTER
const GetAllAssistants = async (account_id: string) => {
  const supabase = await createClient();
  // ...
}
```

**Affected Server Action Files:**
- `/src/lib/actions/intelliaa/assistants.ts` - Uses client-side createClient, may not need changes
- `/src/lib/actions/accounts.ts` - Check if uses server createClient
- `/src/lib/actions/teams.ts` - Check if uses server createClient
- `/src/lib/actions/invitations.ts` - Check if uses server createClient
- All other action files need review

### 7. Auth Callback Route
**File:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/auth/callback/route.ts`
**Reason:** createClient() becomes async
**Changes Required:**
```typescript
// BEFORE
const supabase = createClient();

// AFTER
const supabase = await createClient();
```

---

## Configuration Updates

### 1. next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Add if experiencing issues with async components:
  experimental: {
    // ppr: true, // Partial Prerendering if needed
  }
};

module.exports = nextConfig;
```

### 2. tsconfig.json
No changes required - current configuration is compatible

### 3. package.json Scripts
No changes required - scripts remain the same

### 4. Environment Variables
No changes required - all environment variables remain the same

---

## Critical Integration Points

### 1. Supabase Client Pattern Updates

**Server Components:**
- All calls to `createClient()` from `@/lib/supabase/server.ts` must be awaited
- Session validation in layouts and pages needs async handling

**Client Components:**
- No changes needed for `@/lib/supabase/client.ts`
- Real-time subscriptions continue to work as before

**Middleware:**
- Current implementation should work without changes
- Cookie handling in middleware remains synchronous

### 2. Apollo Client Configuration
- Current setup should work with React 19
- Monitor for any GraphQL subscription issues
- No immediate changes required

### 3. API Route Handlers
- Review all GET handlers for caching requirements
- Add explicit `dynamic` or `revalidate` exports where needed
- POST/PUT/DELETE handlers work as before

### 4. WhatsApp/Vapi Integration
- External service integrations should not be affected
- Test webhook endpoints thoroughly
- Verify real-time features continue working

---

## Testing Strategy

### 1. Unit Tests to Update
- Update test setup for React 19 if using React Testing Library
- Review async component testing patterns

### 2. Integration Test Checklist
- [ ] Authentication flow (login, logout, password reset)
- [ ] Multi-tenant routing and isolation
- [ ] Supabase RLS policies still enforced
- [ ] Document upload and processing
- [ ] Voice assistant creation and management
- [ ] WhatsApp deployment flow
- [ ] Real-time subscriptions
- [ ] API route handlers
- [ ] Webhook endpoints

### 3. Manual Testing Checklist
- [ ] Navigate through all account slugs
- [ ] Create and delete assistants
- [ ] Upload documents
- [ ] Test voice calls
- [ ] Deploy WhatsApp bot
- [ ] View reports and analytics
- [ ] Team member management
- [ ] Billing integration

### 4. Performance Benchmarks
```bash
# Before upgrade:
npm run build
# Record: Build time, bundle sizes, First Load JS

# After upgrade:
npm run build
# Compare: Build time, bundle sizes, First Load JS
```

---

## Migration Steps (Ordered)

### Step 1: Install Codemod Tool
```bash
npm install -D @next/codemod@latest
```
**Verification:** Tool installed successfully

### Step 2: Run Automated Migration
```bash
npx @next/codemod@latest upgrade latest
```
**Note:** This will update package.json and attempt automatic code changes
**Verification:** Check git diff for changes made

### Step 3: Manual Dependency Updates
```bash
# Update remaining dependencies
npm update @supabase/ssr@latest
npm update @apollo/client@latest
npm update @types/react@latest @types/react-dom@latest
```
**Verification:** No peer dependency warnings

### Step 4: Update Async APIs Manually

4.1. Update server.ts:
```bash
# Manually update /src/lib/supabase/server.ts
# Make createClient async and await cookies()
```

4.2. Find and update all createClient() calls:
```bash
# Search for createClient() usage
grep -r "createClient()" src/
# Update each file to await createClient()
```

4.3. Update params/searchParams in pages/layouts:
```bash
# Search for params and searchParams usage
grep -r "params:" src/app/
grep -r "searchParams:" src/app/
# Update to Promise types and await them
```

### Step 5: Clear Caches and Rebuild
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run build
```
**Verification:** Build completes without errors

### Step 6: Run Development Server
```bash
npm run dev
```
**Verification:** No runtime errors, all pages load

### Step 7: Test Critical Paths
- Login with test account
- Navigate tenant routes
- Create test assistant
- Upload test document
- Check real-time updates

### Step 8: Run Production Build
```bash
npm run build
npm run start
```
**Verification:** Production build works correctly

---

## Post-Upgrade Validation

### Build Verification
```bash
# 1. Clean build
rm -rf .next && npm run build

# 2. Check for build warnings
# Review output for deprecation warnings

# 3. Analyze bundle size
# Compare with pre-upgrade metrics
```

### Runtime Checks
1. **Authentication:** Test full auth flow including middleware redirects
2. **Data Fetching:** Verify Supabase queries work in Server Components
3. **Real-time:** Test Supabase subscriptions in Client Components
4. **API Routes:** Test all CRUD operations through API routes
5. **External Services:** Verify Flowise, Vapi, Railway integrations

### Feature-by-Feature Validation
- [ ] Dashboard loads with correct data
- [ ] Assistant management (CRUD operations)
- [ ] Document upload and vector processing
- [ ] Voice assistant deployment
- [ ] WhatsApp bot deployment and QR generation
- [ ] Reports and analytics display
- [ ] Team member invitations
- [ ] Billing/subscription management

### Performance Comparison
```bash
# Metrics to compare:
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Total Bundle Size
- Build Time
```

---

## Troubleshooting Guide

### Common Errors and Solutions

**Error 1: "cookies() expects to be awaited"**
```typescript
// Solution: Add await
const cookieStore = await cookies();
```

**Error 2: "Property 'geo' does not exist on type 'NextRequest'"**
```typescript
// Solution: Remove geo/ip usage or get from hosting provider
// These properties were removed in Next.js 15
```

**Error 3: "params is not an object"**
```typescript
// Solution: Await params in async components
const resolvedParams = await params;
```

**Error 4: "fetch() not caching as expected"**
```typescript
// Solution: Add explicit cache option
fetch(url, { cache: 'force-cache' })
// or
fetch(url, { next: { revalidate: 3600 } })
```

### Compatibility Issues

**Supabase SSR Package:**
- If issues with @supabase/ssr 0.0.10, upgrade to latest 0.5.x
- Cookie handling has improved in newer versions

**React 19 Hydration:**
- Stricter hydration may reveal existing issues
- Check for conditional rendering causing mismatches

### Rollback Procedures

**Full Rollback:**
```bash
# 1. Switch branch
git checkout main

# 2. Clean everything
rm -rf node_modules .next

# 3. Reinstall exact versions
npm ci

# 4. Verify working state
npm run dev
```

**Partial Rollback (keep some updates):**
```bash
# Downgrade only Next.js/React
npm install next@14.2.20 react@18.3.1 react-dom@18.2.0
npm install -D @types/react@18.2.48 @types/react-dom@18.2.18
```

---

## Important Notes & Warnings

### **⚠️ CRITICAL WARNING 1: Async Request APIs**
The biggest breaking change is that `cookies()`, `headers()`, `params`, and `searchParams` are now async. **Every Server Component and Server Action using these must be updated.** Missing even one will cause runtime errors.

### **⚠️ CRITICAL WARNING 2: React 19 Compatibility**
Not all third-party libraries may be compatible with React 19 yet. While major libraries like Radix UI should work, monitor for any console warnings about deprecated APIs or hydration mismatches.

### **⚠️ CRITICAL WARNING 3: Caching Behavior**
GET Route Handlers and fetch requests are **no longer cached by default**. This could significantly impact performance if your app relied on automatic caching. Review all data fetching patterns and add explicit caching where needed.

### Additional Important Notes:

1. **Supabase RLS Policies:** These work at the database level and shouldn't be affected by the Next.js upgrade, but test thoroughly to ensure row-level security remains intact.

2. **Multi-tenant Architecture:** The account-based routing under `[accountSlug]` uses dynamic segments which now receive params as a Promise. Ensure all components handle this correctly.

3. **Real-time Subscriptions:** Supabase real-time features should continue working in Client Components. These don't use React Server Components so aren't affected by async changes.

4. **Environment Variables:** No changes needed, but verify all are loaded correctly in the upgraded environment.

5. **TypeScript Strict Mode:** With new React types, you may see new type errors. These often reveal existing issues rather than new problems.

6. **Development Performance:** Next.js 15 includes Turbopack improvements. You may notice faster HMR and build times.

7. **Partial Prerendering (PPR):** This is available as an experimental feature. Consider enabling for better performance once stable.

---

## Migration Timeline Estimate

**Phase 1: Preparation (30 minutes)**
- Backup and branch creation
- Documentation review

**Phase 2: Automated Migration (1 hour)**
- Run codemod
- Update dependencies
- Initial build attempt

**Phase 3: Manual Updates (2-3 hours)**
- Update async APIs
- Fix type errors
- Update Server Actions

**Phase 4: Testing (1-2 hours)**
- Unit tests
- Integration tests
- Manual testing

**Phase 5: Optimization (30 minutes)**
- Performance tuning
- Cache configuration

**Total Estimated Time: 4-6 hours**

---

## Success Criteria

The upgrade is considered successful when:
1. ✅ All dependencies updated to target versions
2. ✅ Build completes without errors or warnings
3. ✅ All existing features work as before
4. ✅ No regression in performance metrics
5. ✅ All tests pass
6. ✅ Multi-tenant architecture remains secure
7. ✅ External service integrations functioning
8. ✅ Real-time features working correctly

---

## References

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [React 19 Migration](https://react.dev/blog/2024/12/05/react-19)
- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Caching Documentation](https://nextjs.org/docs/app/building-your-application/caching)

---

*Document Created: 2025-01-10*
*Target Completion: Before production deployment*
*Document Version: 1.0*