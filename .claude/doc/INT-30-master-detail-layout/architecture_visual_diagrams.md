# INT-30: Visual Architecture Diagrams

**Feature**: Master-Detail Layout Architecture
**Created**: 2025-10-07

---

## 1. Component Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ app/[accountSlug]/assistants/[[...assistantId]]/page.tsx        │
│ [SERVER COMPONENT] ⚙️                                            │
│                                                                  │
│ Responsibilities:                                                │
│ • await params (accountSlug, assistantId)                       │
│ • await createClient() [Supabase server]                        │
│ • getAccountBySlug(accountSlug)                                 │
│ • getAssistantsForAccount(accountId)                            │
│ • getAssistantById(accountId, assistantId) [if selected]        │
│ • Error handling & redirects                                    │
│                                                                  │
│ Props passed down ↓                                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ AssistantsMasterDetailLayout.tsx                                │
│ [CLIENT COMPONENT] 🖱️ "use client"                              │
│                                                                  │
│ State Management:                                                │
│ • liveAssistants (from real-time subscription)                  │
│ • connectionStatus (connected/disconnected/reconnecting)        │
│ • selectedId (derived from URL params)                          │
│                                                                  │
│ Side Effects:                                                    │
│ • Supabase real-time channel subscription                       │
│ • Handle INSERT/UPDATE/DELETE events                            │
│ • Responsive breakpoint detection (useMediaQuery)               │
│                                                                  │
│ Navigation:                                                      │
│ • useRouter() for URL updates                                   │
│ • useParams() for reading current selection                     │
│                                                                  │
│ Components ↓                                                    │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ↓                           ↓
    ┌───────────────────────────┐   ┌──────────────────────────────┐
    │ AssistantsMasterPanel     │   │ AssistantDetailsPanel        │
    │ [CLIENT COMPONENT] 🖱️      │   │ [CLIENT COMPONENT, LAZY] 🖱️  │
    │                           │   │                              │
    │ Features:                 │   │ Features:                    │
    │ • Virtual scrolling       │   │ • React.lazy loading         │
    │ • @tanstack/react-virtual │   │ • Suspense wrapper           │
    │ • ScrollArea (shadcn/ui)  │   │ • Tabs for sections          │
    │ • Keyboard navigation     │   │ • Avatar, badges             │
    │                           │   │ • DropdownMenu (actions)     │
    │ Props:                    │   │                              │
    │ • assistants[]            │   │ Props:                       │
    │ • selectedId              │   │ • assistant                  │
    │ • onSelectAssistant()     │   │ • accountId                  │
    │                           │   │                              │
    │ Children ↓                │   │ Children ↓                   │
    └───────────────────────────┘   └──────────────────────────────┘
                │                                 │
                ↓                                 ↓
    ┌───────────────────────────┐   ┌──────────────────────────────┐
    │ AssistantListItem         │   │ ConfigAssistant              │
    │ [CLIENT, MEMOIZED] 🖱️      │   │ TabAssistantVoice            │
    │                           │   │ TabsReports                  │
    │ Features:                 │   │ [Existing Components]        │
    │ • React.memo wrapper      │   │                              │
    │ • Custom comparison       │   └──────────────────────────────┘
    │ • Avatar, badges          │
    │ • Status indicators       │
    │ • Hover state             │
    │                           │
    │ Props:                    │
    │ • assistant               │
    │ • isSelected              │
    │ • onSelect()              │
    └───────────────────────────┘
```

**Legend:**
- ⚙️ = Server Component (server-side rendering)
- 🖱️ = Client Component (client-side interactivity)

---

## 2. Data Flow Architecture

### 2.1 Initial Page Load (Cold Start)

```
┌──────┐       ┌─────────┐       ┌──────────┐       ┌─────────┐       ┌────────┐
│ User │──────▶│ Browser │──────▶│  Server  │──────▶│Supabase │◀─────▶│  RLS   │
└──────┘       └─────────┘       └──────────┘       └─────────┘       └────────┘
    │               │                   │                  │
    │  Navigate     │                   │                  │
    │  to URL       │  GET /assistants  │                  │
    │ ─────────────▶│ ─────────────────▶│                  │
    │               │                   │  Query account   │
    │               │                   │  + assistants    │
    │               │                   │ ────────────────▶│
    │               │                   │                  │ ┌──────────┐
    │               │                   │                  │─│ Filter   │
    │               │                   │                  │ │ by       │
    │               │                   │                  │ │account_id│
    │               │                   │  Return data     │◀┘          │
    │               │                   │◀─────────────────│  └──────────┘
    │               │                   │                  │
    │               │  HTML + Data      │                  │
    │               │  (with initial    │                  │
    │               │   assistant data) │                  │
    │               │◀──────────────────│                  │
    │               │                   │                  │
    │  Display page │                   │                  │
    │  with data    │                   │                  │
    │◀──────────────│                   │                  │
    │               │                   │                  │
    │               │ ┌─────────────────────────────────────────┐
    │               │ │ React Hydration                         │
    │               │ │ • Client components become interactive  │
    │               │ │ • Setup real-time subscriptions         │
    │               │ │ • Attach event handlers                 │
    │               │ └─────────────────────────────────────────┘
    │               │
    │  Interactive  │
    │  UI ready ✅  │
    │◀──────────────│

Timeline:
0ms        50ms       100ms      150ms      200ms
│──────────│──────────│──────────│──────────│
Request   Supabase    HTML       Hydrate    Interactive
          Query       Sent
```

### 2.2 Client-Side Navigation (Warm Transition)

```
┌──────┐       ┌──────────────┐       ┌────────┐       ┌─────────────┐
│ User │       │ List         │       │ Router │       │   Details   │
└──────┘       │ Component    │       └────────┘       │   Panel     │
    │          └──────────────┘            │           └─────────────┘
    │                  │                   │                  │
    │  Click          │                   │                  │
    │  assistant      │                   │                  │
    │ ───────────────▶│                   │                  │
    │                 │                   │                  │
    │                 │  router.push()    │                  │
    │                 │  with new URL     │                  │
    │                 │ ─────────────────▶│                  │
    │                 │                   │                  │
    │                 │                   │ Update URL       │
    │                 │                   │ (no page reload) │
    │                 │                   │                  │
    │                 │  Highlight change │                  │
    │                 │◀──────────────────│                  │
    │                 │                   │                  │
    │                 │                   │  Pass selected   │
    │                 │                   │  assistant data  │
    │                 │                   │ ────────────────▶│
    │                 │                   │                  │
    │                 │                   │                  │  Display
    │                 │                   │                  │  details
    │  See updated    │                   │                  │  instantly
    │  selection ✅   │                   │                  │  ✅
    │◀────────────────│                   │                  │
    │                 │                   │                  │

Timeline: < 50ms (instant, no network request!)
```

### 2.3 Real-Time Updates Flow

```
┌─────────────┐      ┌──────────────┐      ┌────────────┐      ┌─────┐
│  Supabase   │      │ Subscription │      │   State    │      │ UI  │
│  Database   │      │   Handler    │      │  Manager   │      │     │
└─────────────┘      └──────────────┘      └────────────┘      └─────┘
       │                     │                    │               │
       │  Change occurs      │                    │               │
       │  (INSERT/UPDATE/    │                    │               │
       │   DELETE)           │                    │               │
       │                     │                    │               │
       │  WebSocket event    │                    │               │
       │ ───────────────────▶│                    │               │
       │                     │                    │               │
       │                     │ Filter by          │               │
       │                     │ account_id         │               │
       │                     │                    │               │
       │                     │ Update assistants  │               │
       │                     │ array based on     │               │
       │                     │ event type         │               │
       │                     │ ──────────────────▶│               │
       │                     │                    │               │
       │                     │                    │ Trigger       │
       │                     │                    │ re-render     │
       │                     │                    │ ─────────────▶│
       │                     │                    │               │
       │                     │                    │               │  Display
       │                     │                    │               │  updated
       │                     │                    │               │  data ✅
       │                     │                    │               │

Event Handling:
┌─────────────┬────────────────────────────────────────────┐
│ INSERT      │ Add new assistant to top of list          │
├─────────────┼────────────────────────────────────────────┤
│ UPDATE      │ Replace matching assistant in list        │
├─────────────┼────────────────────────────────────────────┤
│ DELETE      │ Remove from list, redirect if selected   │
└─────────────┴────────────────────────────────────────────┘
```

---

## 3. State Management Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                      TIER 1: URL STATE                          │
│                  (Source of Truth for Selection)                │
│                                                                  │
│  URL: /myaccount/assistants/abc123                             │
│  State: { selectedId: 'abc123' }                               │
│                                                                  │
│  Benefits:                                                       │
│  ✅ Shareable (copy/paste URL)                                  │
│  ✅ Bookmarkable                                                │
│  ✅ Browser back/forward works                                  │
│  ✅ Persists across refresh                                     │
│  ✅ SEO-friendly                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 2: SERVER STATE                         │
│                  (Initial Data from Server)                     │
│                                                                  │
│  Fetched by: Server Component (page.tsx)                       │
│  Data: { assistants[], selectedAssistant }                     │
│                                                                  │
│  Benefits:                                                       │
│  ✅ Fast initial render (no loading flash)                     │
│  ✅ No client-side fetch waterfall                             │
│  ✅ RLS policies automatically enforced                         │
│  ✅ Smaller client bundle                                       │
│  ✅ Better Core Web Vitals                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: CLIENT STATE                         │
│                   (UI Interactions)                             │
│                                                                  │
│  Managed by: Client Components (React state)                   │
│  State Examples:                                                │
│  • hoveredId (which item is hovered)                           │
│  • isLoading (action in progress)                              │
│  • expandedSections (UI toggles)                               │
│  • liveAssistants (real-time updated list)                     │
│  • connectionStatus (subscription health)                       │
│                                                                  │
│  Benefits:                                                       │
│  ✅ Fast, local updates                                         │
│  ✅ No unnecessary server round-trips                           │
│  ✅ Optimistic UI updates                                       │
│  ✅ Smooth interactions                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Responsive Layout Breakpoints

### Desktop (> 1024px): Side-by-Side

```
┌────────────────────────────────────────────────────────────────┐
│                         Header Bar                             │
│  [Logo]  Assistants                               [User Menu]  │
└────────────────────────────────────────────────────────────────┘
┌──────────────────┬───────────────────────────────────────────────┐
│ Master Panel     │ Detail Panel                                  │
│ (400px fixed)    │ (flex-1, grows to fill)                       │
│                  │                                               │
│ ┌──────────────┐ │ ┌───────────────────────────────────────────┐ │
│ │ Search       │ │ │ Assistant Name                            │ │
│ └──────────────┘ │ │ [Avatar] Assistant 1  [Voice] [Active]    │ │
│                  │ └───────────────────────────────────────────┘ │
│ ┌──────────────┐ │                                               │
│ │[•] Asst 1    │←│ ┌───────────────────────────────────────────┐ │
│ │   Voice      │ │ │ [Configuration] [Voice] [Reports]         │ │
│ └──────────────┘ │ ├───────────────────────────────────────────┤ │
│ ┌──────────────┐ │ │                                           │ │
│ │   Asst 2     │ │ │  Prompt:                                  │ │
│ │   WhatsApp   │ │ │  ┌─────────────────────────────────────┐ │ │
│ └──────────────┘ │ │  │ You are a helpful assistant...      │ │ │
│ ┌──────────────┐ │ │  └─────────────────────────────────────┘ │ │
│ │   Asst 3     │ │ │                                           │ │
│ │   Web        │ │ │  Temperature: [────────•─] 0.7            │ │
│ └──────────────┘ │ │                                           │ │
│                  │ │  Max Tokens: [────•──────] 500            │ │
│ [+ New]          │ │                                           │ │
│                  │ │  [Save Changes]                           │ │
│                  │ └───────────────────────────────────────────┘ │
└──────────────────┴───────────────────────────────────────────────┘
   (Scrollable)            (Scrollable)
```

### Tablet (768-1024px): Adjusted Ratio

```
┌──────────────────────────────────────────────────────────────┐
│                        Header Bar                            │
└──────────────────────────────────────────────────────────────┘
┌───────────────────────┬──────────────────────────────────────┐
│ Master Panel (45%)    │ Detail Panel (55%)                   │
│                       │                                      │
│ ┌───────────────────┐ │ ┌────────────────────────────────┐ │
│ │[•] Assistant 1    │ │ │ Assistant 1                    │ │
│ │   Voice           │ │ │ [Avatar] [Voice] [Active]      │ │
│ └───────────────────┘ │ └────────────────────────────────┘ │
│ ┌───────────────────┐ │                                    │ │
│ │   Assistant 2     │ │ [Configuration] [Voice] [Reports]  │ │
│ │   WhatsApp        │ │                                    │ │
│ └───────────────────┘ │ Configuration content...           │ │
│                       │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

### Mobile (< 768px): Sheet Overlay

**List View (Default)**
```
┌─────────────────────┐
│ [≡] Assistants  [+] │
├─────────────────────┤
│ [Search...]         │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │[•] Assistant 1  │ │
│ │   Voice         │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │   Assistant 2   │ │
│ │   WhatsApp      │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │   Assistant 3   │ │
│ │   Web           │ │
│ └─────────────────┘ │
│                     │
│                     │
└─────────────────────┘
```

**Detail View (Sheet Slides Up)**
```
┌─────────────────────┐
│ [X] Assistant 1     │ ← Close button
├─────────────────────┤
│ [Avatar] [Voice]    │
│ [Active]            │
├─────────────────────┤
│                     │
│ [Config] [Voice]    │
│ [Reports]           │
├─────────────────────┤
│                     │
│ Prompt:             │
│ ┌─────────────────┐ │
│ │ You are...      │ │
│ └─────────────────┘ │
│                     │
│ Temperature: 0.7    │
│                     │
│ [Save Changes]      │
│                     │
└─────────────────────┘
  ↑ Swipe down to close
```

---

## 5. Performance Optimization Strategy

### Virtual Scrolling Impact

```
WITHOUT Virtual Scrolling (100 items):
┌──────────────────────────────────────────────────┐
│ DOM Nodes: 100 × ~10 elements = 1000 nodes       │
│ Memory: ~50MB                                    │
│ Initial Render: 500ms                            │
│ Scroll FPS: 20-30fps (janky)                    │
└──────────────────────────────────────────────────┘

WITH Virtual Scrolling (100 items, show 15):
┌──────────────────────────────────────────────────┐
│ DOM Nodes: 15 × ~10 elements = 150 nodes         │
│ Memory: ~8MB                                     │
│ Initial Render: 80ms                             │
│ Scroll FPS: 60fps (smooth)                      │
│                                                  │
│ Performance Improvement: 6x faster! 🚀           │
└──────────────────────────────────────────────────┘

Visual Representation:
┌────────────────┐
│ [Buffer]       │  Overscan (not rendered, measured)
├────────────────┤
│ [Item 1] ←     │
│ [Item 2]       │
│ [Item 3]       │  Visible viewport
│ [Item 4]       │  (rendered to DOM)
│ [Item 5] ←     │
├────────────────┤
│ [Buffer]       │  Overscan (not rendered, measured)
└────────────────┘
       ↓
  Items 6-100: Not in DOM, calculated positions
```

### Code Splitting Impact

```
BEFORE Code Splitting:
┌───────────────────────────────────────────────────────┐
│ Initial Bundle: 450KB                                 │
│ • Master panel components: 80KB                       │
│ • Detail panel components: 170KB                      │
│ • Document viewer: 100KB                              │
│ • Reports components: 80KB                            │
│ • Other dependencies: 20KB                            │
│                                                       │
│ Time to Interactive: 2.5s (on 3G)                    │
└───────────────────────────────────────────────────────┘

AFTER Code Splitting:
┌───────────────────────────────────────────────────────┐
│ Initial Bundle: 280KB                                 │
│ • Master panel components: 80KB                       │
│ • Layout and routing: 200KB                          │
│                                                       │
│ Time to Interactive: 1.2s (on 3G) ✅                 │
├───────────────────────────────────────────────────────┤
│ Lazy Loaded (on first assistant selection): 170KB    │
│ • Detail panel components: 170KB                      │
│ • Document viewer: 100KB (lazy within detail)        │
│ • Reports: 80KB (lazy within detail)                 │
│                                                       │
│ Time to Detail: +300ms (acceptable) ✅               │
└───────────────────────────────────────────────────────┘

Result: 40% smaller initial bundle, 2x faster TTI! 🚀
```

---

## 6. Error Handling Flow

```
┌───────────────────────────────────────────────────────────────┐
│                    Error Handling Strategy                    │
└───────────────────────────────────────────────────────────────┘

1. Initial Load Error (Server Component)
─────────────────────────────────────────
   Server Component
         │
         ↓
   try { fetch data }
         │
         ├─ Success → Render layout
         │
         └─ Error → Caught
                │
                ├─ Account not found → redirect('/')
                ├─ Invalid assistantId → redirect('/assistants')
                ├─ Network error → <ErrorState retry={true} />
                └─ Unknown → <ErrorState />

2. Real-Time Subscription Error
────────────────────────────────
   useEffect subscription
         │
         ↓
   channel.subscribe((status) => {
         │
         ├─ SUBSCRIBED → setStatus('connected') ✅
         │
         ├─ CHANNEL_ERROR → setStatus('disconnected')
         │                  │
         │                  └─ Retry with exponential backoff
         │                     (1s, 2s, 4s, 8s, 16s, max 30s)
         │
         └─ CLOSED → setStatus('disconnected')
                     Show reconnection banner
   })

3. Navigation Error (Invalid ID)
─────────────────────────────────
   User enters URL manually
         │
         ↓
   Parse assistantId from URL
         │
         ├─ Valid format (UUID) → Check if exists in list
         │                         │
         │                         ├─ Exists → Highlight ✅
         │                         └─ Not exists → redirect('/assistants')
         │                                        + toast('Assistant not found')
         │
         └─ Invalid format → redirect('/assistants')
                            + toast('Invalid assistant ID')

4. Optimistic Update Failure
──────────────────────────────
   User creates assistant
         │
         ├─ Optimistically add to list (grayed out)
         │
         ↓
   API call to server
         │
         ├─ Success → Real-time event updates with real data ✅
         │
         └─ Error → Remove optimistic item
                   + Show error toast
                   + Optional: Show retry button
```

---

## 7. Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Multi-Tenant Security Layers                   │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Authentication
───────────────────────
┌──────────────────────────────────────────────────────────────┐
│ Middleware (src/middleware.ts)                               │
│ • Validates session cookie                                   │
│ • Refreshes expired tokens                                   │
│ • Redirects unauthenticated users to /auth/sign-in          │
└──────────────────────────────────────────────────────────────┘
              │
              ↓ Authenticated user ID

Layer 2: Authorization (URL → Account Validation)
──────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ Server Component (page.tsx)                                  │
│ • getAccountBySlug(accountSlug)                             │
│ • RLS policy verifies: user is member of account           │
│ • If not member → redirect('/') or 404                      │
└──────────────────────────────────────────────────────────────┘
              │
              ↓ Authorized account_id

Layer 3: Row-Level Security (RLS)
──────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ Supabase RLS Policies (assistants table)                    │
│                                                              │
│ SELECT Policy:                                               │
│   (account_id IN (                                           │
│     SELECT account_id FROM account_user                      │
│     WHERE user_id = auth.uid()                              │
│   ))                                                         │
│                                                              │
│ INSERT/UPDATE/DELETE Policies:                              │
│   Same account_id check                                     │
└──────────────────────────────────────────────────────────────┘
              │
              ↓ Filtered results (only user's assistants)

Layer 4: Client-Side Filtering (Defense in Depth)
──────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ Real-Time Subscription (Client Component)                    │
│ • Filter: `account_id=eq.${accountId}`                      │
│ • Only receives events for authorized account               │
│ • Invalid events rejected client-side                        │
└──────────────────────────────────────────────────────────────┘

Security Verification Test:
───────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ Test 1: Try to access other account's assistant              │
│   URL: /othercompany/assistants/their-assistant-id          │
│   Expected: Redirect or 404 (not visible)                   │
│                                                              │
│ Test 2: Manually craft Supabase query                       │
│   Try: SELECT * FROM assistants WHERE account_id != mine    │
│   Expected: Returns 0 rows (RLS blocks)                     │
│                                                              │
│ Test 3: Real-time event injection                           │
│   Try: Subscribe to other account's channel                 │
│   Expected: No events received (filtered server-side)       │
└──────────────────────────────────────────────────────────────┘
```

---

**End of Visual Architecture Diagrams**

For detailed implementation code and strategies, see:
- `architecture_implementation_plan.md` (this document)
- `shadcn_ui_implementation_plan.md` (UI components)
- `nextjs_implementation_plan.md` (Next.js 15 patterns)
- `supabase_implementation_plan.md` (Database optimization)
