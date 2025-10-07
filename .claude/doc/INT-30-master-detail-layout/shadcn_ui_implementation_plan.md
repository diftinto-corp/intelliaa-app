# shadcn/ui Implementation Plan: INT-30 Master-Detail Layout

## Overview

This document provides a comprehensive UI component architecture plan for implementing a responsive master-detail layout for the Assistants module using shadcn/ui components, Radix UI primitives, and TailwindCSS. The implementation follows Next.js 15.5.4 + React 19 patterns with proper Server/Client component boundaries.

**Feature**: Responsive master-detail layout for assistants management
**Tech Stack**: Next.js 15.5.4, React 19, shadcn/ui, Radix UI, TailwindCSS
**Design System**: Existing IntelliAA theme with custom CSS variables

---

## Component Architecture

### Component Hierarchy

```
AssistantsPage (Server Component)
├── AssistantsMasterDetailLayout (Client Component - "use client")
    ├── AssistantsMasterPanel (Client Component)
    │   ├── AssistantsListHeader
    │   │   ├── Input (shadcn/ui - search)
    │   │   └── Button (shadcn/ui - create new)
    │   ├── ScrollArea (shadcn/ui)
    │   │   └── AssistantListItem[] (Client Component)
    │   │       ├── Avatar (shadcn/ui)
    │   │       ├── Badge (shadcn/ui - type indicator)
    │   │       └── StatusIndicator (custom with Badge)
    │   └── AssistantsListSkeleton (shadcn/ui Skeleton)
    │
    └── AssistantsDetailPanel (Client Component)
        ├── AssistantDetailHeader
        │   ├── Avatar (shadcn/ui)
        │   ├── Badge (shadcn/ui)
        │   └── DropdownMenu (shadcn/ui - actions)
        ├── Tabs (shadcn/ui - configuration sections)
        │   ├── TabsList
        │   └── TabsContent[]
        └── AssistantDetailSkeleton (shadcn/ui Skeleton)

EmptyState Component (when no assistants)
├── Illustration (Lucide icons)
├── Typography (heading, description)
└── Button (shadcn/ui - create CTA)
```

---

## shadcn/ui Component Selection

### Core Components Needed

**Already Installed** (verified from project):
- ✅ `button` - Primary actions, navigation
- ✅ `card` - Container for list items and detail panels
- ✅ `badge` - Type indicators (Voice/WhatsApp/Web), status badges
- ✅ `avatar` - Assistant icons
- ✅ `scroll-area` - Scrollable master list
- ✅ `skeleton` - Loading states
- ✅ `tabs` - Detail panel sections
- ✅ `dropdown-menu` - Action menus
- ✅ `separator` - Visual dividers
- ✅ `input` - Search/filter (future)
- ✅ `sheet` - Mobile detail panel slide-in

**To Be Installed**:
```bash
# No new shadcn/ui components needed - all required components are already installed
```

### Component Usage Map

| Feature | shadcn/ui Component | Purpose |
|---------|---------------------|---------|
| Master Panel Container | `ScrollArea` | Scrollable assistant list |
| List Item | `Card` (custom styled) | Individual assistant cards |
| Assistant Icon | `Avatar` with fallback | Visual identifier |
| Type Badge | `Badge` variant="secondary" | Voice/WhatsApp/Web indicator |
| Status Indicator | `Badge` variant="outline" + custom color | Active/Inactive/Deploying |
| Detail Panel | `Card` | Main content container |
| Configuration Tabs | `Tabs`, `TabsList`, `TabsContent` | Settings sections |
| Action Menu | `DropdownMenu` | Edit/Delete/Deploy actions |
| Mobile Detail | `Sheet` | Full-screen detail on mobile |
| Loading State | `Skeleton` | Async data loading |
| Empty State | Custom + `Button` | No assistants CTA |
| Dividers | `Separator` | Visual separation |

---

## Responsive Design Patterns

### Breakpoint Strategy

```typescript
// Mobile-first approach using TailwindCSS breakpoints
const breakpoints = {
  mobile: '< 768px',    // Full-width list, navigate to detail
  tablet: '768-1024px', // Two-column with adjusted ratios
  desktop: '> 1024px'   // Optimal two-column layout (40/60)
};
```

### Layout Behavior by Breakpoint

#### Mobile (< 768px)
```tsx
// Master panel: Full width, detail hidden
// Detail panel: Opens in Sheet component (slide-in)
<div className="w-full">
  <AssistantsMasterPanel />
  {/* Detail opens in Sheet overlay */}
  <Sheet open={!!selectedId} onOpenChange={handleClose}>
    <SheetContent side="right" className="w-full">
      <AssistantDetailPanel />
    </SheetContent>
  </Sheet>
</div>
```

#### Tablet (768px - 1024px)
```tsx
// Two-column layout with 45/55 ratio
<div className="flex gap-4">
  <div className="w-[45%]">
    <AssistantsMasterPanel />
  </div>
  <div className="w-[55%]">
    <AssistantDetailPanel />
  </div>
</div>
```

#### Desktop (> 1024px)
```tsx
// Two-column layout with 40/60 ratio, fixed master width
<div className="flex gap-6">
  <div className="w-[400px] min-w-[400px]">
    <AssistantsMasterPanel />
  </div>
  <div className="flex-1">
    <AssistantDetailPanel />
  </div>
</div>
```

### Visibility Classes

```tsx
// Hide/show patterns for responsive behavior
className={cn(
  // Mobile: Show only master, hide detail
  "block md:hidden",           // Mobile master
  "hidden md:block",            // Tablet+ detail

  // Tablet: Show both in flex
  "hidden md:flex",             // Tablet+ container

  // Desktop: Optimized layout
  "hidden lg:flex lg:gap-6"    // Desktop spacing
)}
```

---

## Component Architecture Details

### 1. Page Component (Server Component)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx`

**Purpose**: Server Component for data fetching and SEO optimization
**Component Type**: Server Component (default)

```typescript
import { createClient } from "@/lib/supabase/server";
import { AssistantsMasterDetailLayout } from "@/components/intelliaa/assistants/AssistantsMasterDetailLayout";
import { Assistant } from "@/interfaces/intelliaa";

interface PageProps {
  params: Promise<{
    accountSlug: string;
    assistantId?: string[];
  }>;
}

export default async function AssistantsPage({ params }: PageProps) {
  // CRITICAL: Await params (Next.js 15 breaking change)
  const { accountSlug, assistantId } = await params;

  // Create Supabase client (async in Next.js 15)
  const supabase = await createClient();

  // Fetch account ID from slug
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("slug", accountSlug)
    .single();

  if (!account) {
    return <div>Account not found</div>;
  }

  // Fetch all assistants for this account
  const { data: assistants, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("account_id", account.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching assistants:", error);
    return <div>Error loading assistants</div>;
  }

  // Extract selected ID from optional catch-all route
  const selectedId = assistantId?.[0] || null;

  return (
    <AssistantsMasterDetailLayout
      assistants={assistants || []}
      selectedId={selectedId}
      accountSlug={accountSlug}
    />
  );
}
```

**Key Points**:
- Uses `[[...assistantId]]` optional catch-all route for URL state
- `params` is now `Promise` in Next.js 15 - MUST await
- `createClient()` is async - MUST await
- Server-side data fetching for initial render (SEO + performance)
- Passes data to Client Component for interactivity

---

### 2. Master-Detail Layout (Client Component)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx`

**Purpose**: Main layout wrapper with responsive behavior and URL state management
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Assistant } from "@/interfaces/intelliaa";
import { cn } from "@/lib/utils";
import { AssistantsMasterPanel } from "./AssistantsMasterPanel";
import { AssistantsDetailPanel } from "./AssistantsDetailPanel";
import { AssistantsEmptyState } from "./AssistantsEmptyState";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

interface AssistantsMasterDetailLayoutProps {
  assistants: Assistant[];
  selectedId: string | null;
  accountSlug: string;
}

export function AssistantsMasterDetailLayout({
  assistants,
  selectedId: initialSelectedId,
  accountSlug,
}: AssistantsMasterDetailLayoutProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [isLoading, setIsLoading] = useState(false);

  // Responsive behavior detection
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Sync URL state with component state
  useEffect(() => {
    setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  // Handle assistant selection
  const handleSelectAssistant = (assistantId: string) => {
    setIsLoading(true);
    setSelectedId(assistantId);

    // Update URL without full page reload
    router.push(`/${accountSlug}/assistants/${assistantId}`, { scroll: false });

    // Simulate loading delay (remove in production if not needed)
    setTimeout(() => setIsLoading(false), 300);
  };

  // Handle detail panel close (mobile only)
  const handleCloseDetail = () => {
    setSelectedId(null);
    router.push(`/${accountSlug}/assistants`, { scroll: false });
  };

  // Empty state handling
  if (assistants.length === 0) {
    return <AssistantsEmptyState accountSlug={accountSlug} />;
  }

  // Auto-select first assistant if none selected (desktop only)
  useEffect(() => {
    if (!isMobile && !selectedId && assistants.length > 0) {
      handleSelectAssistant(assistants[0].id);
    }
  }, [isMobile, selectedId, assistants]);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 md:gap-4 lg:gap-6">
      {/* Master Panel - Always visible on desktop, hidden when detail open on mobile */}
      <div
        className={cn(
          "w-full md:w-[45%] lg:w-[400px] lg:min-w-[400px]",
          isMobile && selectedId && "hidden"
        )}
      >
        <AssistantsMasterPanel
          assistants={assistants}
          selectedId={selectedId}
          onSelectAssistant={handleSelectAssistant}
          accountSlug={accountSlug}
        />
      </div>

      {/* Detail Panel - Desktop: side-by-side, Mobile: Sheet overlay */}
      {!isMobile ? (
        // Desktop/Tablet: Fixed panel
        <div className="hidden md:block md:w-[55%] lg:flex-1">
          {selectedId ? (
            <AssistantsDetailPanel
              assistantId={selectedId}
              accountSlug={accountSlug}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Select an assistant to view details</p>
            </div>
          )}
        </div>
      ) : (
        // Mobile: Sheet overlay
        <Sheet open={!!selectedId} onOpenChange={handleCloseDetail}>
          <SheetContent
            side="right"
            className="w-full p-0 sm:max-w-full"
          >
            {selectedId && (
              <AssistantsDetailPanel
                assistantId={selectedId}
                accountSlug={accountSlug}
                isLoading={isLoading}
                onClose={handleCloseDetail}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
```

**Key Points**:
- "use client" directive required for interactivity
- URL state management via `useRouter` from `next/navigation`
- Responsive behavior using `useMediaQuery` hook
- Sheet component for mobile detail overlay
- Auto-select first assistant on desktop
- Handles empty state gracefully

**Dependencies**:
```typescript
// Custom hook needed (create if doesn't exist)
// File: /Volumes/raul-1TB/Proyectos/intelliaa-app/src/hooks/use-media-query.ts
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}
```

---

### 3. Master Panel Component (Client Component)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsMasterPanel.tsx`

**Purpose**: Scrollable list of assistants with search and create actions
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { Assistant } from "@/interfaces/intelliaa";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { AssistantListItem } from "./AssistantListItem";
import { AssistantListSkeleton } from "./AssistantListSkeleton";

interface AssistantsMasterPanelProps {
  assistants: Assistant[];
  selectedId: string | null;
  onSelectAssistant: (id: string) => void;
  accountSlug: string;
  isLoading?: boolean;
}

export function AssistantsMasterPanel({
  assistants,
  selectedId,
  onSelectAssistant,
  accountSlug,
  isLoading = false,
}: AssistantsMasterPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter assistants based on search (future enhancement for INT-31)
  const filteredAssistants = assistants.filter((assistant) =>
    assistant.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      {/* Header with search and create button */}
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Assistants</h2>
          <Button
            size="sm"
            onClick={() => {
              // Navigate to creation wizard (INT-35)
              window.location.href = `/${accountSlug}/assistants/new`;
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>

        {/* Search input (prepared for INT-31) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assistants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <AssistantListSkeleton count={5} />
        ) : (
          <div className="p-2 space-y-2">
            {filteredAssistants.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No assistants found
              </div>
            ) : (
              filteredAssistants.map((assistant) => (
                <AssistantListItem
                  key={assistant.id}
                  assistant={assistant}
                  isSelected={assistant.id === selectedId}
                  onSelect={() => onSelectAssistant(assistant.id)}
                />
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

**Key Points**:
- Uses `ScrollArea` for optimized scrolling
- Search functionality prepared for INT-31 story
- Header with count and create action
- Skeleton loading state
- Responsive padding and spacing

---

### 4. List Item Component (Client Component)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantListItem.tsx`

**Purpose**: Individual assistant card in the master list
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { Assistant } from "@/interfaces/intelliaa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquare, Phone } from "lucide-react";

interface AssistantListItemProps {
  assistant: Assistant;
  isSelected: boolean;
  onSelect: () => void;
}

export function AssistantListItem({
  assistant,
  isSelected,
  onSelect,
}: AssistantListItemProps) {
  // Determine assistant type
  const getAssistantType = () => {
    if (assistant.voice_assistant) return "Voice";
    if (assistant.activated_whatsApp) return "WhatsApp";
    return "Web";
  };

  const assistantType = getAssistantType();

  // Get type icon
  const TypeIcon = {
    Voice: Phone,
    WhatsApp: MessageSquare,
    Web: Bot,
  }[assistantType];

  // Determine status
  const getStatus = () => {
    if (assistant.is_deploying_ws) return { label: "Deploying", variant: "secondary" as const };
    if (assistant.activated_whatsApp || assistant.voice_assistant) {
      return { label: "Active", variant: "success" as const };
    }
    return { label: "Inactive", variant: "outline" as const };
  };

  const status = getStatus();

  // Format last updated time
  const formattedTime = assistant.updated_at
    ? formatDistanceToNow(new Date(assistant.updated_at), { addSuffix: true })
    : "Never";

  // Truncate name at 30 characters
  const displayName = assistant.name
    ? assistant.name.length > 30
      ? `${assistant.name.substring(0, 30)}...`
      : assistant.name
    : "Untitled Assistant";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer",
        "hover:bg-accent hover:border-accent-foreground/20",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isSelected && [
          "bg-accent border-l-4 border-l-primary",
          "shadow-sm"
        ]
      )}
      aria-selected={isSelected}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10">
        <AvatarImage src={assistant.avatar_url} alt={displayName} />
        <AvatarFallback>
          <TypeIcon className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Name and Type Badge */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm truncate" title={assistant.name}>
            {displayName}
          </h3>
          <Badge variant="secondary" className="shrink-0">
            {assistantType}
          </Badge>
        </div>

        {/* Status and Timestamp */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge variant={status.variant}>
            {status.label}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">
            {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Status Badge with color variants
function StatusBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "success" | "secondary" | "outline";
}) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "text-xs",
        variant === "success" && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      )}
    >
      {children}
    </Badge>
  );
}
```

**Key Points**:
- Keyboard navigation support (Enter/Space)
- ARIA attributes for accessibility
- Selected state with left border accent
- Hover and focus states
- Type and status badges
- Truncated name with title tooltip
- Relative timestamp using `date-fns`

**Dependencies**:
```bash
npm install date-fns --legacy-peer-deps
```

---

### 5. Detail Panel Component (Client Component)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsDetailPanel.tsx`

**Purpose**: Display full assistant details with configuration tabs
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { useEffect, useState } from "react";
import { Assistant } from "@/interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AssistantDetailSkeleton } from "./AssistantDetailSkeleton";
import {
  Bot,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Settings,
  MessageSquare,
  FileText,
  Phone,
  ArrowLeft
} from "lucide-react";

interface AssistantsDetailPanelProps {
  assistantId: string;
  accountSlug: string;
  isLoading?: boolean;
  onClose?: () => void; // For mobile back navigation
}

export function AssistantsDetailPanel({
  assistantId,
  accountSlug,
  isLoading: initialLoading = false,
  onClose,
}: AssistantsDetailPanelProps) {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const supabase = createClient();

  // Fetch assistant details
  useEffect(() => {
    const fetchAssistant = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("assistants")
        .select("*")
        .eq("id", assistantId)
        .single();

      if (error) {
        console.error("Error fetching assistant:", error);
      } else {
        setAssistant(data);
      }

      setIsLoading(false);
    };

    fetchAssistant();
  }, [assistantId, supabase]);

  // Realtime subscription for status updates (INT-32)
  useEffect(() => {
    const channel = supabase
      .channel(`assistant-${assistantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assistants",
          filter: `id=eq.${assistantId}`,
        },
        (payload) => {
          setAssistant(payload.new as Assistant);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assistantId, supabase]);

  if (isLoading) {
    return <AssistantDetailSkeleton />;
  }

  if (!assistant) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Assistant not found</p>
      </div>
    );
  }

  const assistantType = assistant.voice_assistant
    ? "Voice"
    : assistant.activated_whatsApp
    ? "WhatsApp"
    : "Web";

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      {/* Header */}
      <div className="border-b p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Mobile back button */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            <Avatar className="h-16 w-16">
              <AvatarImage src={assistant.avatar_url} alt={assistant.name} />
              <AvatarFallback>
                <Bot className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{assistant.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{assistantType}</Badge>
                {assistant.activated_whatsApp && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                View in Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs for configuration sections */}
      <Tabs defaultValue="settings" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <Phone className="mr-2 h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <FileText className="mr-2 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="settings" className="m-0 p-4 md:p-6">
            {/* Integrate existing AssistantSettings component */}
            <div>Settings content here</div>
          </TabsContent>

          <TabsContent value="voice" className="m-0 p-4 md:p-6">
            {/* Integrate existing TabAssistantVoice component */}
            <div>Voice configuration here</div>
          </TabsContent>

          <TabsContent value="documents" className="m-0 p-4 md:p-6">
            {/* Integrate existing document viewer components */}
            <div>Documents here</div>
          </TabsContent>

          <TabsContent value="reports" className="m-0 p-4 md:p-6">
            {/* Integrate existing TabsReports component */}
            <div>Reports here</div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

**Key Points**:
- Client-side data fetching for selected assistant
- Supabase Realtime subscription for status updates
- Tab-based navigation for configuration sections
- Actions dropdown menu
- Mobile back button support
- Existing components can be integrated into TabsContent

---

### 6. Empty State Component

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsEmptyState.tsx`

**Purpose**: Display when no assistants exist
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Plus, Sparkles } from "lucide-react";

interface AssistantsEmptyStateProps {
  accountSlug: string;
}

export function AssistantsEmptyState({ accountSlug }: AssistantsEmptyStateProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center text-center p-8 space-y-6">
          {/* Illustration */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
            <div className="relative bg-primary/10 rounded-full p-6">
              <Bot className="h-16 w-16 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              Create Your First Assistant
              <Sparkles className="h-5 w-5 text-primary" />
            </h2>
            <p className="text-muted-foreground">
              AI-powered voice and messaging assistants that work 24/7. Set up your first assistant in minutes and start automating conversations.
            </p>
          </div>

          {/* CTA Button */}
          <Button
            size="lg"
            onClick={() => {
              window.location.href = `/${accountSlug}/assistants/new`;
            }}
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Assistant
          </Button>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground pt-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Voice and WhatsApp support
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Document knowledge bases
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Real-time analytics
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Key Points**:
- Centered layout with card container
- Illustration using Lucide icons with gradient effect
- Value proposition with feature highlights
- Primary CTA button
- Responsive spacing and typography

---

### 7. Skeleton Loading Components

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantListSkeleton.tsx`

**Purpose**: Loading state for master list
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface AssistantListSkeletonProps {
  count?: number;
}

export function AssistantListSkeleton({ count = 5 }: AssistantListSkeletonProps) {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border p-3"
        >
          {/* Avatar skeleton */}
          <Skeleton className="h-10 w-10 rounded-full" />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantDetailSkeleton.tsx`

**Purpose**: Loading state for detail panel
**Component Type**: Client Component ("use client")

```typescript
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function AssistantDetailSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      {/* Header skeleton */}
      <div className="border-b p-4 md:p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="border-b p-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-4 md:p-6 space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Separator className="my-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
```

**Key Points**:
- Matches actual component structure
- Uses shadcn/ui Skeleton component
- Responsive spacing
- Configurable count for list items

---

## Configuration Updates

### 1. TailwindCSS Configuration

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/tailwind.config.ts`

No changes needed - existing configuration supports all required utilities.

### 2. CSS Variables (globals.css)

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/globals.css`

Add success variant for status badges (optional - can use inline styles):

```css
@layer base {
  :root {
    /* Existing variables... */
    --success: 142 71% 45%;
    --success-foreground: 144 61% 20%;
  }

  .dark {
    /* Existing variables... */
    --success: 142 71% 45%;
    --success-foreground: 144 61% 90%;
  }
}
```

### 3. TypeScript Interfaces

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/interfaces/intelliaa.ts`

Ensure Assistant interface includes all required fields:

```typescript
export interface Assistant {
  id: string;
  account_id: string;
  name: string;
  namespace: string;
  prompt?: string;
  temperature?: number;
  token?: number;
  voice_assistant?: string;
  activated_whatsApp?: boolean;
  is_deploying_ws?: boolean;
  service_id_rw?: string;
  qr_url?: string;
  document_storage_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Installation Steps

```bash
# No new shadcn/ui components needed - all required components already installed

# Install date-fns for timestamp formatting
npm install date-fns --legacy-peer-deps

# Verify existing shadcn/ui components are up to date (optional)
npx shadcn-ui@latest add button card badge avatar scroll-area skeleton tabs dropdown-menu separator input sheet --overwrite
```

---

## Integration Points

### 1. Existing Components

The following existing components should be integrated into the detail panel tabs:

**Settings Tab**:
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/whatsapp/AssistantSettings.tsx`
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/voice/AssistantSettings.tsx`

**Voice Tab**:
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/voice/TabAssistantVoice.tsx`

**Documents Tab**:
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/documents/documentViewer/document-viewer.tsx`
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/assistants/AssignStorageSection.tsx`

**Reports Tab**:
- `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/reports/TabsReports.tsx`

### 2. Server Actions

Use existing server actions from `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistants.ts`:
- `GetAllAssistants(account_id)` - Fetch assistants (already used in page)
- `GetAssistant(account_id, assistant_id)` - Fetch single assistant (for detail panel)
- Realtime subscription pattern for status updates

### 3. Routing

**Current route**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/page.tsx`
**New route**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx`

Migration path:
1. Create new directory: `assistants/[[...assistantId]]/`
2. Move existing `page.tsx` to new location
3. Update imports and add URL state handling
4. Delete old `assistants/page.tsx`

---

## Accessibility Considerations

### ARIA Patterns

```typescript
// Master list - listbox pattern
<div role="listbox" aria-label="Assistants list">
  {assistants.map((assistant) => (
    <div
      key={assistant.id}
      role="option"
      aria-selected={isSelected}
      aria-labelledby={`assistant-${assistant.id}`}
      tabIndex={0}
    >
      <h3 id={`assistant-${assistant.id}`}>{assistant.name}</h3>
    </div>
  ))}
</div>

// Detail panel - region landmark
<div role="region" aria-label="Assistant details">
  {/* Content */}
</div>

// Tabs - automatic ARIA via Radix UI
<Tabs defaultValue="settings" aria-label="Assistant configuration">
  {/* TabsList and TabsContent automatically handle ARIA */}
</Tabs>
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Navigate between interactive elements |
| `↑` / `↓` | Navigate between list items |
| `Enter` / `Space` | Select assistant |
| `Escape` | Close detail panel (mobile) |
| `Ctrl/Cmd + K` | Focus search input (future) |

### Screen Reader Support

- Semantic HTML (`<nav>`, `<article>`, `<section>`)
- ARIA labels for icon-only buttons
- Status announcements via `aria-live` regions
- Focus management when opening/closing detail panel

### Implementation

```typescript
// Focus management for modal transitions
useEffect(() => {
  if (selectedId && isMobile) {
    // Trap focus in detail panel
    const detailPanel = document.getElementById('assistant-detail');
    detailPanel?.focus();
  }
}, [selectedId, isMobile]);

// Announce status changes
<div role="status" aria-live="polite" className="sr-only">
  {isDeploying && "Assistant is deploying"}
  {isActive && "Assistant is now active"}
</div>
```

---

## Responsive Design Strategy

### Breakpoints

```typescript
// TailwindCSS breakpoints used
const breakpoints = {
  sm: '640px',  // Small devices
  md: '768px',  // Tablets (master-detail split starts)
  lg: '1024px', // Desktop (optimal layout)
  xl: '1280px', // Large screens
};
```

### Layout Adaptations

#### Mobile (< 768px)
- **Master**: Full-width list
- **Detail**: Sheet overlay (slide from right)
- **Navigation**: Back button in detail header
- **Search**: Collapsed by default (icon only)
- **Spacing**: Reduced padding (p-3 instead of p-4)

#### Tablet (768px - 1024px)
- **Master**: 45% width
- **Detail**: 55% width
- **Navigation**: Side-by-side panels
- **Search**: Full input visible
- **Spacing**: Medium padding (p-4)

#### Desktop (> 1024px)
- **Master**: Fixed 400px width
- **Detail**: Flex-grow to fill remaining space
- **Navigation**: Side-by-side with optimal ratio
- **Search**: Full input with filter options (future)
- **Spacing**: Full padding (p-6)

### Responsive Classes

```tsx
// Master panel responsive width
className="w-full md:w-[45%] lg:w-[400px] lg:min-w-[400px]"

// Detail panel responsive width
className="hidden md:block md:w-[55%] lg:flex-1"

// Responsive padding
className="p-3 md:p-4 lg:p-6"

// Responsive gap
className="gap-2 md:gap-4 lg:gap-6"

// Hide on mobile, show on tablet+
className="hidden md:flex"

// Show only on mobile
className="block md:hidden"
```

---

## Visual Design Specifications

### Selected State Styling

```tsx
// List item selected state
className={cn(
  "rounded-lg border p-3 transition-all",
  isSelected && [
    "bg-accent",                    // Accent background
    "border-l-4 border-l-primary",  // Primary left border
    "shadow-sm",                    // Subtle shadow
  ]
)}
```

### Hover States

```tsx
// List item hover
className="hover:bg-accent hover:border-accent-foreground/20 transition-colors duration-200"

// Button hover (uses shadcn/ui defaults)
<Button variant="ghost" className="hover:bg-accent">
  Action
</Button>
```

### Transitions

```tsx
// Smooth transitions for state changes
className="transition-all duration-200 ease-in-out"

// Transform transitions for mobile sheet
<SheetContent className="transition-transform duration-300">
  {/* Content */}
</SheetContent>
```

### Status Colors

```tsx
// Active status - green
<Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
  Active
</Badge>

// Deploying status - yellow/amber
<Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
  Deploying
</Badge>

// Inactive status - gray
<Badge variant="outline" className="text-muted-foreground">
  Inactive
</Badge>
```

### Empty State Illustration

```tsx
// Gradient glow effect
<div className="relative">
  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
  <div className="relative bg-primary/10 rounded-full p-6">
    <Bot className="h-16 w-16 text-primary" />
  </div>
</div>
```

---

## Theme Integration

### Dark/Light Mode Support

All components automatically support dark/light mode via CSS variables defined in `globals.css`. The theme system uses TailwindCSS's `dark:` prefix for dark mode overrides.

**Key considerations**:
- Use semantic color tokens (e.g., `bg-background`, `text-foreground`)
- Avoid hardcoded colors - use CSS variables
- Test both themes for contrast compliance

### Hydration-Safe Theme Pattern

```typescript
"use client";

import { useEffect, useState } from "react";

export function ThemedComponent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return placeholder during SSR to avoid hydration mismatch
    return <div className="h-10 w-10 rounded-full bg-muted" />;
  }

  // Render theme-dependent content after mount
  return (
    <div className="bg-background text-foreground">
      {/* Theme-specific content */}
    </div>
  );
}
```

### CSS Variables Usage

```tsx
// ✅ Correct - uses semantic tokens
className="bg-background text-foreground border-border"

// ❌ Incorrect - hardcoded colors break theming
className="bg-gray-100 text-black border-gray-300"

// ✅ Correct - dark mode override
className="bg-card text-card-foreground dark:bg-card-dark"
```

---

## Important Notes & Warnings

### 1. Next.js 15 Breaking Changes

**CRITICAL**: The following patterns have changed in Next.js 15 and MUST be followed:

```typescript
// ❌ OLD (Next.js 14) - WILL NOT WORK
export default async function Page({ params }) {
  const { accountSlug } = params; // Error: params is Promise
}

// ✅ NEW (Next.js 15) - REQUIRED
export default async function Page({
  params,
}: {
  params: Promise<{ accountSlug: string }>;
}) {
  const { accountSlug } = await params; // MUST await
}

// ❌ OLD - Synchronous cookies
const cookieStore = cookies();

// ✅ NEW - Async cookies
const cookieStore = await cookies();
```

### 2. Hydration Safety

**WARNING**: Theme-dependent rendering must use `mounted` state to avoid hydration mismatches.

```typescript
// ❌ Causes hydration error
const isDark = document.documentElement.classList.contains('dark');

// ✅ Hydration-safe pattern
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

### 3. Server/Client Component Boundaries

**IMPORTANT**: Cannot import server-only functions in Client Components.

```typescript
// ❌ ERROR in Client Component
"use client";
import { cookies } from "next/headers"; // Error!

// ✅ CORRECT - use client-side Supabase client
"use client";
import { createClient } from "@/lib/supabase/client";
```

### 4. Performance Considerations

- **Virtualization**: If assistants list exceeds 100 items, implement virtualization using `react-window` or `@tanstack/react-virtual`
- **Realtime subscriptions**: Unsubscribe on unmount to prevent memory leaks
- **Image optimization**: Use Next.js `Image` component for assistant avatars

### 5. Browser Compatibility

- **Sheet component**: Uses Radix UI Dialog - requires modern browser (no IE11)
- **Scroll-area**: Custom scrollbar styling may not work in all browsers
- **Transitions**: Use `prefers-reduced-motion` media query for accessibility

---

## Migration Path

### Step 1: Create New Route Structure

```bash
# Create new directory for dynamic route
mkdir -p /Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/[[...assistantId]]

# Move existing page to new location
mv /Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/page.tsx \
   /Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx
```

### Step 2: Create Component Files

```bash
# Create components directory
mkdir -p /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants

# Create component files (in order of dependency)
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsEmptyState.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantListSkeleton.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantDetailSkeleton.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantListItem.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsMasterPanel.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsDetailPanel.tsx
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx

# Create custom hook
touch /Volumes/raul-1TB/Proyectos/intelliaa-app/src/hooks/use-media-query.ts
```

### Step 3: Update Page Component

Replace content of `page.tsx` with Server Component implementation (see Component Architecture section).

### Step 4: Implement Components

Implement components in this order (bottom-up dependency tree):
1. `use-media-query.ts` hook
2. `AssistantsEmptyState.tsx`
3. `AssistantListSkeleton.tsx`
4. `AssistantDetailSkeleton.tsx`
5. `AssistantListItem.tsx`
6. `AssistantsMasterPanel.tsx`
7. `AssistantsDetailPanel.tsx`
8. `AssistantsMasterDetailLayout.tsx`
9. Update `page.tsx`

### Step 5: Integrate Existing Components

Refactor existing components to work within new tab structure:
1. Update import paths in existing components
2. Remove redundant navigation elements
3. Ensure components accept necessary props
4. Test each tab independently

### Step 6: Test and Validate

1. Test all breakpoints (mobile, tablet, desktop)
2. Verify URL state synchronization
3. Test keyboard navigation
4. Verify accessibility with screen reader
5. Test dark/light theme switching
6. Verify Realtime subscriptions work

---

## Testing Recommendations

### Unit Tests

```typescript
// Test list item selection
describe('AssistantListItem', () => {
  it('should highlight when selected', () => {
    render(<AssistantListItem isSelected={true} />);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('should call onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<AssistantListItem onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Test master-detail interaction
describe('AssistantsMasterDetailLayout', () => {
  it('should update URL when assistant selected', async () => {
    const { user } = render(<AssistantsMasterDetailLayout />);
    await user.click(screen.getByText('Test Assistant'));
    expect(window.location.pathname).toContain('test-assistant-id');
  });
});
```

### Manual Test Cases

1. **Desktop Layout**
   - [ ] Two-column layout displays correctly
   - [ ] First assistant auto-selected on load
   - [ ] Selection persists on browser refresh

2. **Mobile Layout**
   - [ ] List displays full-width
   - [ ] Tapping assistant opens Sheet
   - [ ] Back button closes Sheet and returns to list
   - [ ] Sheet swipe gesture works

3. **Empty State**
   - [ ] Displays when no assistants exist
   - [ ] CTA button navigates to creation wizard

4. **Loading States**
   - [ ] Skeleton displays during initial load
   - [ ] Detail skeleton displays when switching assistants
   - [ ] No flash of empty content

5. **Keyboard Navigation**
   - [ ] Tab key navigates between list items
   - [ ] Enter/Space selects assistant
   - [ ] Escape closes detail panel (mobile)
   - [ ] Focus visible on all interactive elements

6. **Accessibility**
   - [ ] Screen reader announces selections
   - [ ] ARIA labels present on all controls
   - [ ] Color contrast meets WCAG 2.1 AA
   - [ ] Focus order is logical

7. **Theme Switching**
   - [ ] All colors adapt to dark/light mode
   - [ ] No hydration mismatches
   - [ ] Smooth transitions between themes

---

## Troubleshooting

### Issue: Hydration Error with Theme

**Symptom**: "Hydration failed" error in console
**Cause**: Theme-dependent rendering on server vs client
**Solution**: Use mounted state pattern

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

### Issue: URL Not Updating

**Symptom**: URL doesn't change when selecting assistant
**Cause**: Using wrong router import
**Solution**: Use `next/navigation` router (App Router)

```typescript
// ❌ Wrong - Pages Router
import { useRouter } from 'next/router';

// ✅ Correct - App Router
import { useRouter } from 'next/navigation';
```

### Issue: Sheet Not Opening on Mobile

**Symptom**: Detail panel doesn't open on mobile
**Cause**: Missing `open` prop or incorrect state
**Solution**: Ensure Sheet receives correct open state

```typescript
<Sheet open={!!selectedId} onOpenChange={handleClose}>
  {/* Content */}
</Sheet>
```

### Issue: Realtime Updates Not Working

**Symptom**: Status changes don't reflect in UI
**Cause**: Missing subscription or incorrect channel name
**Solution**: Verify subscription setup and cleanup

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`assistant-${assistantId}`)
    .on(/* ... */)
    .subscribe();

  return () => supabase.removeChannel(channel); // MUST cleanup
}, [assistantId]);
```

### Issue: List Item Not Clickable

**Symptom**: Click events not firing on list items
**Cause**: Missing role and tabIndex attributes
**Solution**: Add proper ARIA attributes

```typescript
<div
  role="button"
  tabIndex={0}
  onClick={onSelect}
  onKeyDown={(e) => {
    if (e.key === "Enter") onSelect();
  }}
>
```

### Issue: Performance Lag with Many Assistants

**Symptom**: Slow scrolling with 100+ assistants
**Cause**: Rendering too many DOM nodes
**Solution**: Implement virtualization

```bash
npm install react-window --legacy-peer-deps
```

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={assistants.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <AssistantListItem assistant={assistants[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## Summary & Next Steps

This implementation plan provides a comprehensive guide for building a modern, accessible, and responsive master-detail layout for the Assistants module using shadcn/ui components and Next.js 15 best practices.

### Key Takeaways

1. **No new shadcn/ui components needed** - all required components already installed
2. **Server/Client split** - Server Component for data fetching, Client Components for interactivity
3. **Mobile-first responsive** - Sheet overlay on mobile, side-by-side on desktop
4. **URL state management** - Using Next.js App Router with optional catch-all route
5. **Accessibility first** - ARIA patterns, keyboard navigation, screen reader support
6. **Theme support** - Dark/light mode with hydration-safe patterns

### Implementation Order

1. Create custom hook (`use-media-query.ts`)
2. Implement skeleton and empty state components
3. Build list item and master panel
4. Build detail panel with tabs
5. Integrate into main layout component
6. Update page component with new route
7. Test all breakpoints and accessibility
8. Integrate existing configuration components into tabs

### Future Enhancements (Subsequent Stories)

- **INT-31**: Advanced filtering and search in master panel
- **INT-32**: Real-time status visualization with animated indicators
- **INT-33**: Onboarding tour highlighting master-detail features
- **INT-35**: Wizard UI integration for assistant creation

---

**Document Version**: 1.0
**Created**: 2025-10-07
**Status**: Ready for Implementation
**Review Status**: Pending Architecture & QA Review
