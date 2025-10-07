# INT-30: Next.js 15 Master-Detail Layout Implementation Plan

**Version**: Next.js 15.5.4 with React 19.1.1
**Feature**: Master-Detail Layout for Assistants List
**Epic**: INT-29 - Master-Detail UI and Navigation
**Created**: 2025-10-07

---

## Executive Summary

This document provides a comprehensive implementation plan for building a responsive master-detail layout in Next.js 15, specifically addressing the breaking changes introduced in Next.js 15 around async request APIs and parameter handling.

**Key Implementation Points:**
- Use optional catch-all route `[[...assistantId]]` for flexible URL handling
- Leverage async `params` pattern (Promise-based) introduced in Next.js 15
- Implement proper Server/Client component boundaries
- Handle async `cookies()` API for Supabase client creation
- Support responsive behavior (desktop two-column, mobile navigation)

**Breaking Changes Alert:**
This implementation is **NOT compatible** with Next.js 14 patterns. Developers with Next.js 14 knowledge must understand the following critical changes before implementation.

---

## Critical Notes for Developers (Next.js 15 Breaking Changes)

### 1. **Async `params` - MUST AWAIT**

In Next.js 15, `params` is now a `Promise` and **must be awaited** in both pages and layouts.

```typescript
// ❌ WRONG (Next.js 14 pattern - will fail in Next.js 15)
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params; // ERROR: params is a Promise
}

// ✅ CORRECT (Next.js 15 pattern)
export default async function Page({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params; // MUST await
}
```

### 2. **Async `cookies()` - MUST AWAIT**

The `cookies()` function from `next/headers` is now async and returns a Promise.

```typescript
// ❌ WRONG (Next.js 14 pattern)
import { cookies } from 'next/headers';
const cookieStore = cookies(); // ERROR: returns Promise
const token = cookieStore.get('token');

// ✅ CORRECT (Next.js 15 pattern)
import { cookies } from 'next/headers';
const cookieStore = await cookies(); // MUST await
const token = cookieStore.get('token');
```

**Impact on Supabase Client:**
The project's `createClient()` in `src/lib/supabase/server.ts` is already async-compatible:

```typescript
// src/lib/supabase/server.ts - Already correct
export const createClient = async () => {
  const cookieStore = await cookies(); // ✅ Correct
  return createServerClient(...)
}
```

### 3. **Optional Catch-All Routes `[[...param]]`**

Optional catch-all routes match both the base route AND routes with parameters.

```typescript
// Route: src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx

// Matches:
// - /myaccount/assistants (assistantId: undefined)
// - /myaccount/assistants/abc123 (assistantId: ['abc123'])
// - /myaccount/assistants/abc123/edit (assistantId: ['abc123', 'edit'])

// Type definition:
type Params = Promise<{
  accountSlug: string;
  assistantId?: string[]; // Optional array
}>
```

### 4. **Client Components Cannot Use `params` Directly as Async**

Client Components cannot be async functions, so use React's `use()` hook to unwrap Promise params.

```typescript
// ❌ WRONG (Client Component cannot be async)
'use client'
export default async function ClientPage({ params }) { // ERROR
  const { slug } = await params;
}

// ✅ CORRECT (Use React's use hook)
'use client'
import { use } from 'react';

export default function ClientPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params); // ✅ Unwrap with use()
}
```

### 5. **Server vs. Client Component Boundaries**

**Server Components (Default):**
- Can be async functions
- Can use `cookies()`, `headers()` directly
- Can fetch data server-side
- Cannot use React hooks (useState, useEffect, etc.)
- Cannot use browser APIs

**Client Components (`"use client"`):**
- Cannot be async functions
- Cannot import `cookies()`, `headers()` directly
- Must use `use()` hook for Promise params
- Can use React hooks and browser APIs

---

## Architecture Overview

### File Structure

```
src/app/[accountSlug]/assistants/
├── [[...assistantId]]/
│   ├── page.tsx                 # Server Component - Route entry point
│   ├── loading.tsx              # Loading UI (optional)
│   └── error.tsx                # Error boundary (optional)
└── page.tsx                     # DELETE - Will be replaced by [[...assistantId]]/page.tsx

src/components/intelliaa/assistants/
├── AssistantsMasterDetailLayout.tsx   # Client Component - Main layout orchestrator
├── AssistantsMasterPanel.tsx          # Client Component - List view
├── AssistantsDetailPanel.tsx          # Client Component - Detail view
├── AssistantListItem.tsx              # Client Component - Individual list item
├── AssistantsEmptyState.tsx           # Client Component - Empty state
├── AssistantsListSkeleton.tsx         # Loading skeleton for list
└── AssistantsDetailSkeleton.tsx       # Loading skeleton for detail
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Server Component: page.tsx                                  │
│ - Awaits params (accountSlug, assistantId)                  │
│ - Creates Supabase client (await createClient())            │
│ - Fetches initial assistants data                           │
│ - Gets account_id from accountSlug                          │
└────────────────────┬────────────────────────────────────────┘
                     │ Pass data as props
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Client Component: AssistantsMasterDetailLayout.tsx          │
│ - Manages URL state with useRouter/useParams               │
│ - Handles selection state                                   │
│ - Sets up Supabase realtime subscriptions                   │
│ - Orchestrates Master/Detail panels                         │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
             ↓                       ↓
   ┌────────────────────┐  ┌──────────────────────┐
   │ AssistantsMaster   │  │ AssistantsDetail     │
   │ Panel              │  │ Panel                │
   │ - List rendering   │  │ - Detail rendering   │
   │ - Selection UI     │  │ - Edit forms         │
   └────────────────────┘  └──────────────────────┘
```

---

## Detailed Implementation Guide

### Step 1: Create Optional Catch-All Route

**File**: `src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx`

This is the **Server Component** entry point. It handles:
- Async params unwrapping
- Supabase client creation (async)
- Initial data fetching
- Account validation

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AssistantsMasterDetailLayout } from "@/components/intelliaa/assistants/AssistantsMasterDetailLayout";
import { GetAllAssistants } from "@/lib/actions/intelliaa/assistants";

/**
 * Next.js 15 Server Component for Assistants Master-Detail Layout
 *
 * IMPORTANT: params is a Promise in Next.js 15 - MUST await
 *
 * Route Matching:
 * - /[accountSlug]/assistants -> assistantId: undefined
 * - /[accountSlug]/assistants/abc123 -> assistantId: ['abc123']
 */
export default async function AssistantsPage({
  params,
}: {
  params: Promise<{
    accountSlug: string;
    assistantId?: string[]
  }>;
}) {
  // Step 1: Unwrap async params (Next.js 15 requirement)
  const { accountSlug, assistantId } = await params;

  // Step 2: Create async Supabase client (Next.js 15 requirement)
  const supabase = await createClient();

  // Step 3: Validate session
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    redirect("/auth");
  }

  // Step 4: Get account by slug
  const { data: account, error: accountError } = await supabase.rpc(
    "get_account_by_slug",
    { slug: accountSlug }
  );

  if (!account || accountError) {
    redirect("/auth");
  }

  const accountId = account.account_id;

  // Step 5: Fetch initial assistants data
  const assistants = await GetAllAssistants(accountId);

  // Step 6: Extract selected assistant ID from optional catch-all
  // assistantId is an array: ['abc123'] or undefined
  const selectedId = assistantId?.[0]; // First segment or undefined

  // Step 7: Render Client Component with server-fetched data
  return (
    <AssistantsMasterDetailLayout
      accountSlug={accountSlug}
      accountId={accountId}
      initialAssistants={assistants || []}
      selectedAssistantId={selectedId}
    />
  );
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ accountSlug: string; assistantId?: string[] }>;
}) {
  const { accountSlug, assistantId } = await params;

  return {
    title: assistantId?.[0]
      ? `Assistant ${assistantId[0]} - ${accountSlug}`
      : `Assistants - ${accountSlug}`,
  };
}
```

**Key Points:**
- ✅ Async function (Server Component)
- ✅ Awaits `params` before destructuring
- ✅ Awaits `createClient()` for Supabase
- ✅ Fetches data server-side before rendering
- ✅ Passes data to Client Component via props

---

### Step 2: Create Master-Detail Layout Client Component

**File**: `src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx`

This is the **Client Component** orchestrator. It handles:
- URL state management
- Realtime subscriptions
- Responsive behavior
- Navigation between master/detail

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Assistant } from "@/interfaces/intelliaa";
import { AssistantsMasterPanel } from "./AssistantsMasterPanel";
import { AssistantsDetailPanel } from "./AssistantsDetailPanel";
import { AssistantsEmptyState } from "./AssistantsEmptyState";

interface AssistantsMasterDetailLayoutProps {
  accountSlug: string;
  accountId: string;
  initialAssistants: Assistant[];
  selectedAssistantId?: string; // From URL params
}

export function AssistantsMasterDetailLayout({
  accountSlug,
  accountId,
  initialAssistants,
  selectedAssistantId: initialSelectedId,
}: AssistantsMasterDetailLayoutProps) {
  const router = useRouter();
  const supabase = createClient();

  // State management
  const [assistants, setAssistants] = useState<Assistant[]>(initialAssistants);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialSelectedId || initialAssistants[0]?.id
  );
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);

  // Get selected assistant object
  const selectedAssistant = assistants.find((a) => a.id === selectedId);

  /**
   * Handle assistant selection
   * Updates URL without full page reload
   */
  const handleSelectAssistant = (assistantId: string) => {
    setSelectedId(assistantId);

    // Update URL using Next.js router (client-side navigation)
    router.push(`/${accountSlug}/assistants/${assistantId}`, {
      scroll: false, // Prevent scroll to top
    });

    // On mobile, show detail view
    if (window.innerWidth < 768) {
      setIsMobileDetailView(true);
    }
  };

  /**
   * Handle back navigation on mobile
   */
  const handleMobileBack = () => {
    setIsMobileDetailView(false);
    router.push(`/${accountSlug}/assistants`, {
      scroll: false,
    });
  };

  /**
   * Set up Supabase realtime subscriptions
   */
  useEffect(() => {
    const channel = supabase
      .channel("assistants_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "assistants",
          filter: `account_id=eq.${accountId}`,
        },
        (payload: any) => {
          setAssistants((prev) => [...prev, payload.new as Assistant]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assistants",
          filter: `account_id=eq.${accountId}`,
        },
        (payload: any) => {
          setAssistants((prev) =>
            prev.map((a) =>
              a.id === payload.new.id ? (payload.new as Assistant) : a
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "assistants",
          filter: `account_id=eq.${accountId}`,
        },
        (payload: any) => {
          setAssistants((prev) => prev.filter((a) => a.id !== payload.old.id));

          // If deleted assistant was selected, select first remaining
          if (payload.old.id === selectedId) {
            const remaining = assistants.filter((a) => a.id !== payload.old.id);
            if (remaining.length > 0) {
              handleSelectAssistant(remaining[0].id);
            } else {
              setSelectedId(undefined);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, selectedId, supabase]);

  /**
   * Sync selectedId when URL params change (browser back/forward)
   */
  useEffect(() => {
    if (initialSelectedId && initialSelectedId !== selectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  // Empty state
  if (assistants.length === 0) {
    return <AssistantsEmptyState accountSlug={accountSlug} />;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Master Panel (List) */}
      <div
        className={`
          w-full md:w-2/5 lg:w-[400px]
          border-r border-border
          ${isMobileDetailView ? 'hidden md:block' : 'block'}
        `}
      >
        <AssistantsMasterPanel
          assistants={assistants}
          selectedId={selectedId}
          onSelectAssistant={handleSelectAssistant}
          accountSlug={accountSlug}
        />
      </div>

      {/* Detail Panel */}
      <div
        className={`
          w-full md:w-3/5 lg:flex-1
          ${!isMobileDetailView ? 'hidden md:block' : 'block'}
        `}
      >
        {selectedAssistant ? (
          <AssistantsDetailPanel
            assistant={selectedAssistant}
            accountSlug={accountSlug}
            accountId={accountId}
            onMobileBack={handleMobileBack}
            isMobileView={isMobileDetailView}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select an assistant to view details
          </div>
        )}
      </div>
    </div>
  );
}
```

**Key Points:**
- ✅ "use client" directive (Client Component)
- ✅ Uses `useRouter()` for client-side navigation
- ✅ URL updates without page reload via `router.push()`
- ✅ Handles responsive behavior (mobile vs desktop)
- ✅ Sets up Supabase realtime subscriptions
- ✅ Manages selection state locally

---

### Step 3: Create Master Panel (List View)

**File**: `src/components/intelliaa/assistants/AssistantsMasterPanel.tsx`

```typescript
"use client";

import { Assistant } from "@/interfaces/intelliaa";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AssistantListItem } from "./AssistantListItem";

interface AssistantsMasterPanelProps {
  assistants: Assistant[];
  selectedId?: string;
  onSelectAssistant: (id: string) => void;
  accountSlug: string;
}

export function AssistantsMasterPanel({
  assistants,
  selectedId,
  onSelectAssistant,
  accountSlug,
}: AssistantsMasterPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Assistants</h2>
        <Button size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          New
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {assistants.map((assistant) => (
            <AssistantListItem
              key={assistant.id}
              assistant={assistant}
              isSelected={assistant.id === selectedId}
              onClick={() => onSelectAssistant(assistant.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

---

### Step 4: Create List Item Component

**File**: `src/components/intelliaa/assistants/AssistantListItem.tsx`

```typescript
"use client";

import { Assistant } from "@/interfaces/intelliaa";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Phone, Globe } from "lucide-react";

interface AssistantListItemProps {
  assistant: Assistant;
  isSelected: boolean;
  onClick: () => void;
}

export function AssistantListItem({
  assistant,
  isSelected,
  onClick,
}: AssistantListItemProps) {
  // Determine assistant type based on flags
  const getAssistantType = () => {
    if (assistant.activated_whatsApp) return "WhatsApp";
    if (assistant.voice_assistant) return "Voice";
    return "Web";
  };

  const getTypeIcon = () => {
    if (assistant.activated_whatsApp) return <MessageSquare className="w-4 h-4" />;
    if (assistant.voice_assistant) return <Phone className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const type = getAssistantType();

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-lg text-left transition-colors
        hover:bg-muted
        ${isSelected ? 'bg-accent border-l-4 border-primary' : 'border-l-4 border-transparent'}
      `}
    >
      {/* Name */}
      <div className="flex items-center gap-2 mb-1">
        {getTypeIcon()}
        <h3 className="font-medium text-sm truncate">
          {assistant.name || `Assistant ${assistant.id.slice(0, 8)}`}
        </h3>
      </div>

      {/* Type Badge */}
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="secondary" className="text-xs">
          {type}
        </Badge>

        {/* Status Indicator */}
        {assistant.activated_whatsApp && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground">
        {assistant.updated_at
          ? formatDistanceToNow(new Date(assistant.updated_at), {
              addSuffix: true,
            })
          : "Recently"}
      </p>
    </button>
  );
}
```

---

### Step 5: Create Detail Panel

**File**: `src/components/intelliaa/assistants/AssistantsDetailPanel.tsx`

```typescript
"use client";

import { Assistant } from "@/interfaces/intelliaa";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ConfigAssistant from "./whatsapp/ConfigAssistant"; // Reuse existing component

interface AssistantsDetailPanelProps {
  assistant: Assistant;
  accountSlug: string;
  accountId: string;
  onMobileBack: () => void;
  isMobileView: boolean;
}

export function AssistantsDetailPanel({
  assistant,
  accountSlug,
  accountId,
  onMobileBack,
  isMobileView,
}: AssistantsDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Mobile Back Button */}
      {isMobileView && (
        <div className="flex items-center gap-2 p-4 border-b border-border md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      )}

      {/* Detail Content - Reuse existing ConfigAssistant */}
      <div className="flex-1 overflow-auto">
        <ConfigAssistant
          templates={[]} // Pass templates from parent if needed
          assistantsListPage={[assistant]} // Single assistant
          assistantSelected={assistant}
          setAssistantSelected={() => {}} // Handle updates via realtime
          qaList={[]}
          setQaList={() => {}}
        />
      </div>
    </div>
  );
}
```

---

### Step 6: Create Empty State Component

**File**: `src/components/intelliaa/assistants/AssistantsEmptyState.tsx`

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Plus, Bot } from "lucide-react";
import ModalAdd from "./ModalAdd"; // Existing modal

interface AssistantsEmptyStateProps {
  accountSlug: string;
}

export function AssistantsEmptyState({ accountSlug }: AssistantsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="flex flex-col items-center text-center max-w-md">
        {/* Icon */}
        <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-8 h-8 text-muted-foreground" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold mb-2">No assistants yet</h2>

        {/* Description */}
        <p className="text-muted-foreground mb-6">
          Create your first AI assistant to get started. Choose from voice, WhatsApp, or web assistants.
        </p>

        {/* CTA Button */}
        <ModalAdd templates={[]} /> {/* Pass templates from server */}
      </div>
    </div>
  );
}
```

---

### Step 7: Create Loading States

**File**: `src/app/[accountSlug]/assistants/[[...assistantId]]/loading.tsx`

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function AssistantsLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Master Panel Skeleton */}
      <div className="w-full md:w-2/5 lg:w-[400px] border-r border-border p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>

      {/* Detail Panel Skeleton */}
      <div className="hidden md:block w-3/5 lg:flex-1 p-6">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
```

**File**: `src/app/[accountSlug]/assistants/[[...assistantId]]/error.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function AssistantsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Assistants page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <AlertCircle className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">
        {error.message || "Failed to load assistants"}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

---

## Migration from Existing Implementation

### Current State

The existing implementation uses:
- `src/app/[accountSlug]/assistants/page.tsx` (simple wrapper)
- `src/components/intelliaa/assistants/AssistantComponent.tsx` (Client Component with all logic)

**Issues with current approach:**
- ❌ Client Component fetches data (should be Server Component)
- ❌ Uses `usePathname()` to parse accountSlug (inefficient)
- ❌ No URL state for selected assistant
- ❌ Not using Next.js 15 async patterns correctly

### Migration Steps

#### Step 1: Delete Old Page

```bash
# Delete the old page.tsx
rm src/app/[accountSlug]/assistants/page.tsx
```

#### Step 2: Create New Route Structure

```bash
# Create optional catch-all directory
mkdir -p src/app/[accountSlug]/assistants/[[...assistantId]]

# Create new page.tsx inside
# (Use implementation from Step 1 above)
```

#### Step 3: Extract Reusable Components

The existing `ConfigAssistant` component can be reused inside `AssistantsDetailPanel`. Extract any reusable parts:

```typescript
// src/components/intelliaa/assistants/AssistantsDetailPanel.tsx
import ConfigAssistant from "./whatsapp/ConfigAssistant";

export function AssistantsDetailPanel({ assistant, ... }: Props) {
  return (
    <div className="flex-1 overflow-auto">
      <ConfigAssistant
        assistantSelected={assistant}
        // ... other props
      />
    </div>
  );
}
```

#### Step 4: Update Data Fetching

Move data fetching from Client Component to Server Component:

```typescript
// OLD: src/components/intelliaa/assistants/AssistantComponent.tsx
"use client"
export default function AssistantComponent() {
  useEffect(() => {
    const fetchAssistants = async () => {
      const account = await getAccountBySlug(null, path);
      const assistants = await GetAllAssistants(account_id);
      // ...
    };
    fetchAssistants();
  }, []);
}

// NEW: src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx
export default async function AssistantsPage({ params }) {
  const { accountSlug } = await params;
  const supabase = await createClient();
  const account = await supabase.rpc("get_account_by_slug", { slug: accountSlug });
  const assistants = await GetAllAssistants(account.account_id);

  return <AssistantsMasterDetailLayout initialAssistants={assistants} />;
}
```

---

## Navigation Patterns

### Client-Side Navigation (Recommended)

Use `useRouter()` for client-side navigation without page reload:

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();

// Navigate to assistant detail
router.push(`/${accountSlug}/assistants/${assistantId}`, {
  scroll: false, // Don't scroll to top
});

// Navigate back to list
router.push(`/${accountSlug}/assistants`, {
  scroll: false,
});
```

### Browser Back/Forward Handling

The layout automatically syncs with URL params:

```typescript
useEffect(() => {
  // Sync selectedId when URL params change (browser back/forward)
  if (initialSelectedId && initialSelectedId !== selectedId) {
    setSelectedId(initialSelectedId);
  }
}, [initialSelectedId]);
```

### Keyboard Navigation (Future Enhancement)

Add keyboard navigation support:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      // Select next assistant
      const currentIndex = assistants.findIndex((a) => a.id === selectedId);
      const nextIndex = Math.min(currentIndex + 1, assistants.length - 1);
      handleSelectAssistant(assistants[nextIndex].id);
    }
    if (e.key === "ArrowUp") {
      // Select previous assistant
      const currentIndex = assistants.findIndex((a) => a.id === selectedId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      handleSelectAssistant(assistants[prevIndex].id);
    }
    if (e.key === "Enter") {
      // Focus detail panel (or trigger edit)
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [selectedId, assistants]);
```

---

## TypeScript Type Definitions

### Route Params Types

```typescript
// For pages/layouts with optional catch-all
type AssistantsPageParams = Promise<{
  accountSlug: string;
  assistantId?: string[]; // Optional array
}>;

// Usage
export default async function Page({
  params,
}: {
  params: AssistantsPageParams;
}) {
  const { accountSlug, assistantId } = await params;
  const selectedId = assistantId?.[0]; // Extract first segment
}
```

### Component Props Types

```typescript
// Master-Detail Layout Props
interface AssistantsMasterDetailLayoutProps {
  accountSlug: string;
  accountId: string;
  initialAssistants: Assistant[];
  selectedAssistantId?: string;
}

// Master Panel Props
interface AssistantsMasterPanelProps {
  assistants: Assistant[];
  selectedId?: string;
  onSelectAssistant: (id: string) => void;
  accountSlug: string;
}

// Detail Panel Props
interface AssistantsDetailPanelProps {
  assistant: Assistant;
  accountSlug: string;
  accountId: string;
  onMobileBack: () => void;
  isMobileView: boolean;
}
```

---

## Responsive Design Patterns

### Desktop (≥768px)

```css
/* Two-column layout */
.master-panel {
  width: 40%; /* or fixed 400px */
  border-right: 1px solid;
  display: block;
}

.detail-panel {
  width: 60%; /* or flex: 1 */
  display: block;
}
```

### Mobile (<768px)

```css
/* Full-width single column */
.master-panel {
  width: 100%;
  display: block; /* Show list view */
}

.detail-panel {
  width: 100%;
  display: none; /* Hide detail view */
}

/* When detail is selected on mobile */
.master-panel {
  display: none; /* Hide list */
}

.detail-panel {
  display: block; /* Show detail */
}
```

### TailwindCSS Implementation

```typescript
<div className="flex h-[calc(100vh-4rem)] overflow-hidden">
  {/* Master Panel */}
  <div
    className={`
      w-full md:w-2/5 lg:w-[400px]
      border-r border-border
      ${isMobileDetailView ? 'hidden md:block' : 'block'}
    `}
  >
    {/* List content */}
  </div>

  {/* Detail Panel */}
  <div
    className={`
      w-full md:w-3/5 lg:flex-1
      ${!isMobileDetailView ? 'hidden md:block' : 'block'}
    `}
  >
    {/* Detail content */}
  </div>
</div>
```

---

## Performance Optimization

### 1. **Server-Side Data Fetching**

Fetch initial data on the server to reduce client-side loading:

```typescript
// Server Component - Fetches before hydration
export default async function AssistantsPage({ params }) {
  const assistants = await GetAllAssistants(accountId);
  return <Layout initialAssistants={assistants} />;
}
```

### 2. **Realtime Subscriptions**

Use Supabase realtime only for updates, not initial load:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("assistants_realtime")
    .on("postgres_changes", { event: "UPDATE", ... }, (payload) => {
      // Update state optimistically
      setAssistants((prev) =>
        prev.map((a) => (a.id === payload.new.id ? payload.new : a))
      );
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [accountId]);
```

### 3. **Virtualization (For 100+ Items)**

If the assistant list grows large, use virtualization:

```typescript
import { FixedSizeList as List } from "react-window";

<List
  height={window.innerHeight - 200}
  itemCount={assistants.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <AssistantListItem assistant={assistants[index]} />
    </div>
  )}
</List>
```

### 4. **Optimize Images (If Using Avatars)**

```typescript
import Image from "next/image";

<Image
  src={assistant.avatar || "/default-avatar.png"}
  alt={assistant.name}
  width={40}
  height={40}
  className="rounded-full"
/>
```

---

## Error Handling & Edge Cases

### 1. **No Assistants Exist**

Show empty state:

```typescript
if (assistants.length === 0) {
  return <AssistantsEmptyState accountSlug={accountSlug} />;
}
```

### 2. **Invalid Assistant ID in URL**

Handle gracefully:

```typescript
const selectedAssistant = assistants.find((a) => a.id === selectedId);

if (!selectedAssistant && selectedId) {
  // Redirect to list view
  router.push(`/${accountSlug}/assistants`);
  return;
}
```

### 3. **Supabase Connection Errors**

Wrap data fetching in try-catch:

```typescript
export default async function AssistantsPage({ params }) {
  try {
    const assistants = await GetAllAssistants(accountId);
    return <Layout initialAssistants={assistants || []} />;
  } catch (error) {
    console.error("Failed to fetch assistants:", error);
    // Let error.tsx handle it
    throw error;
  }
}
```

### 4. **Realtime Subscription Failures**

Add error handling to subscriptions:

```typescript
const channel = supabase
  .channel("assistants_realtime")
  .on("postgres_changes", { ... }, (payload) => {
    // Handle update
  })
  .on("error", (error) => {
    console.error("Realtime error:", error);
    // Optionally show toast notification
  })
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("Connected to realtime");
    }
  });
```

---

## Testing Considerations

### Unit Tests (Example with Vitest)

```typescript
// src/components/intelliaa/assistants/__tests__/AssistantListItem.test.tsx
import { render, screen } from "@testing-library/react";
import { AssistantListItem } from "../AssistantListItem";

describe("AssistantListItem", () => {
  it("renders assistant name", () => {
    const assistant = {
      id: "123",
      name: "Test Assistant",
      activated_whatsApp: false,
      voice_assistant: null,
      updated_at: new Date().toISOString(),
    };

    render(
      <AssistantListItem
        assistant={assistant}
        isSelected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText("Test Assistant")).toBeInTheDocument();
  });

  it("shows selected state", () => {
    const assistant = { id: "123", name: "Test", ... };

    const { container } = render(
      <AssistantListItem
        assistant={assistant}
        isSelected={true}
        onClick={() => {}}
      />
    );

    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });
});
```

### Integration Tests

Test URL state synchronization:

```typescript
// src/app/[accountSlug]/assistants/__tests__/navigation.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { AssistantsMasterDetailLayout } from "@/components/...";

describe("Assistants Navigation", () => {
  it("updates URL when assistant is selected", async () => {
    const mockRouter = { push: vi.fn() };
    vi.mock("next/navigation", () => ({
      useRouter: () => mockRouter,
      useParams: () => ({ accountSlug: "test-account" }),
    }));

    render(
      <AssistantsMasterDetailLayout
        accountSlug="test-account"
        accountId="123"
        initialAssistants={[{ id: "abc", name: "Test" }]}
      />
    );

    const listItem = screen.getByText("Test");
    fireEvent.click(listItem);

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/test-account/assistants/abc",
      { scroll: false }
    );
  });
});
```

---

## Accessibility (A11y) Checklist

- ✅ Semantic HTML (`<button>`, `<nav>`, etc.)
- ✅ ARIA labels for interactive elements
- ✅ Keyboard navigation support (arrow keys, Enter)
- ✅ Focus management (focus selected item)
- ✅ Screen reader announcements for state changes
- ✅ Color contrast compliance (WCAG AA)

**Example ARIA implementation:**

```typescript
<button
  role="option"
  aria-selected={isSelected}
  aria-label={`Assistant ${assistant.name}, ${getAssistantType()}`}
  onClick={onClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      onClick();
    }
  }}
>
  {/* Content */}
</button>
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Test on all breakpoints (mobile, tablet, desktop)
- [ ] Verify URL state persistence (browser refresh, back/forward)
- [ ] Test with 0, 1, 10, 100+ assistants
- [ ] Verify Supabase realtime subscriptions work
- [ ] Test keyboard navigation
- [ ] Run accessibility audit (Lighthouse, axe)
- [ ] Test loading states (slow 3G network)
- [ ] Verify error boundaries catch errors
- [ ] Test with different account slugs
- [ ] Verify RLS policies enforce account isolation

---

## Troubleshooting Guide

### Issue: "params is not a function" error

**Cause:** Trying to access params synchronously (Next.js 14 pattern)

**Fix:** Await params before destructuring

```typescript
// ❌ Wrong
const { slug } = params;

// ✅ Correct
const { slug } = await params;
```

### Issue: "cookies is not a function" error

**Cause:** Not awaiting cookies() call

**Fix:** Await cookies before calling methods

```typescript
// ❌ Wrong
const cookieStore = cookies();

// ✅ Correct
const cookieStore = await cookies();
```

### Issue: URL doesn't update when selecting assistant

**Cause:** Not using router.push()

**Fix:** Use Next.js router for navigation

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();
router.push(`/${accountSlug}/assistants/${assistantId}`);
```

### Issue: "Cannot read property 'get' of undefined" on Supabase client

**Cause:** Supabase client creation not awaited

**Fix:** Always await createClient()

```typescript
// ❌ Wrong
const supabase = createClient();

// ✅ Correct
const supabase = await createClient();
```

### Issue: Hydration mismatch on initial render

**Cause:** Server and client rendering different content

**Fix:** Use `mounted` state for client-only features

```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) return <Skeleton />;
```

---

## Next.js 15 Codemod (Optional Automated Migration)

Next.js provides a codemod to automatically migrate async APIs:

```bash
npx @next/codemod@latest next-async-request-api .
```

This codemod will:
- Convert `cookies()`, `headers()`, `draftMode()` to async
- Update `params` and `searchParams` to Promise types
- Add `await` where necessary

**Note:** The codemod may not catch all cases, especially complex patterns. Manual review is required.

---

## References

### Official Next.js 15 Documentation

- [App Router Overview](https://nextjs.org/docs/app)
- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Async Request APIs](https://nextjs.org/docs/app/building-your-application/upgrading/version-15#async-request-apis)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

### Project-Specific Resources

- [CLAUDE.md](/Volumes/raul-1TB/Proyectos/intelliaa-app/CLAUDE.md) - Project conventions
- [Supabase Server Client](/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/supabase/server.ts)
- [Assistants Actions](/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistants.ts)

---

## Summary of Breaking Changes

| **Feature**          | **Next.js 14**                 | **Next.js 15**                        |
|----------------------|--------------------------------|---------------------------------------|
| `params`             | Synchronous object             | Promise - must `await`                |
| `searchParams`       | Synchronous object             | Promise - must `await`                |
| `cookies()`          | Synchronous function           | Async function - must `await`         |
| `headers()`          | Synchronous function           | Async function - must `await`         |
| `draftMode()`        | Synchronous function           | Async function - must `await`         |
| Client Components    | Can access params directly     | Must use `use()` hook for Promises    |
| Server Components    | Standard functions             | Can be async functions                |

---

## Implementation Timeline

**Estimated Effort:** 5-8 story points

**Phase 1 (2-3 days):**
- Create route structure (`[[...assistantId]]/page.tsx`)
- Implement Server Component with async patterns
- Create basic layout structure

**Phase 2 (2-3 days):**
- Build master panel components
- Build detail panel components
- Implement responsive behavior

**Phase 3 (1-2 days):**
- Add loading states and error boundaries
- Implement keyboard navigation
- Test across devices and browsers

**Phase 4 (1 day):**
- Accessibility review and fixes
- Performance optimization
- Final QA and deployment

---

## Conclusion

This implementation plan provides a complete guide to building a master-detail layout using Next.js 15's async patterns. The key takeaways:

1. **Always await `params` in Next.js 15** - They are Promises now
2. **Always await `cookies()`** - It's async now
3. **Use Server Components for data fetching** - Better performance
4. **Use Client Components for interactivity** - State management, events
5. **Optional catch-all routes** - Perfect for master-detail patterns

By following this guide, you'll create a modern, performant, and accessible master-detail layout that fully leverages Next.js 15's capabilities.
