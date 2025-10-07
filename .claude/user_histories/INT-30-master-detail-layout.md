# INT-30: Implement Master-Detail Layout for Assistants List

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P0 - Must Have
**Estimate**: 5-8 points (Large)
**Labels**: frontend, ui, layout, navigation

## User Story

As an IntelliAA user managing multiple AI assistants, I want to view my assistants in a master-detail layout, so that I can efficiently browse my assistant list while viewing and editing configuration details without constant navigation.

## Acceptance Criteria

### AC1: Responsive Master-Detail Layout
**Given** I am on the assistants page with existing assistants
**When** the page loads on desktop (>1024px width)
**Then** I see a two-column layout with assistant list (40% width) on left and details panel (60% width) on right

### AC2: Mobile Responsive Behavior
**Given** I access the page on mobile (<768px width)
**When** viewing the layout
**Then** the master list displays full-width, and tapping an assistant navigates to a full-screen detail view with back navigation

### AC3: Empty State Handling
**Given** I have no assistants in my account
**When** the assistants page loads
**Then** I see an empty state illustration with "Create your first assistant" CTA button

### AC4: Selection State Management
**Given** I select an assistant from the list
**When** the assistant is clicked
**Then** the selected assistant is highlighted in the list and its details load in the right panel within 500ms

### AC5: URL State Synchronization
**Given** I select an assistant with ID "abc123"
**When** the selection occurs
**Then** the URL updates to `/[accountSlug]/assistants/abc123` without full page reload, and sharing this URL directly loads that assistant

### AC6: Loading States with Skeletons
**Given** the assistant details are loading
**When** waiting for data to load
**Then** I see skeleton loaders in the detail panel that match the expected content structure

### AC7: Assistant List Item Display
**Given** each assistant in the master list
**When** displayed
**Then** each item shows: avatar/icon, name (truncated at 30 chars), type badge (Voice/WhatsApp/Web), status indicator, and last modified timestamp

### AC8: Keyboard Navigation Support
**Given** I am navigating the assistant list
**When** I use arrow keys (up/down)
**Then** I can navigate between assistants, and pressing Enter opens the selected assistant details

## Technical Notes

### Implementation Details
- **Layout Component**: Create `AssistantsMasterDetailLayout.tsx` in `src/components/intelliaa/assistants/`
- **State Management**: Use URL params for selection state (`useParams`, `useRouter` from next/navigation)
- **Responsive Framework**: TailwindCSS with breakpoints: `md:` for tablet, `lg:` for desktop
- **List Component**: `AssistantsList.tsx` with virtualization for 100+ items (use `react-window` or similar)

### Component Structure
```typescript
// src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx
export default async function AssistantsPage({
  params,
}: {
  params: Promise<{ accountSlug: string; assistantId?: string[] }>;
}) {
  const { accountSlug, assistantId } = await params;
  // Fetch assistants server-side
  return <AssistantsMasterDetailLayout />;
}

// src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx
interface AssistantsMasterDetailLayoutProps {
  assistants: Assistant[];
  selectedId?: string;
  accountSlug: string;
}
```

### Styling Specifications
- Master panel: `w-full md:w-2/5 lg:w-[400px]` with `border-r`
- Detail panel: `w-full md:w-3/5 lg:flex-1`
- Selected state: `bg-accent border-l-4 border-primary`
- Hover state: `hover:bg-muted transition-colors`

### Data Fetching
- Use Server Components for initial data load
- Client-side optimistic updates with SWR or React Query
- Supabase Realtime subscription for status updates

### Empty State Design
- Illustration: Use existing Radix UI icons or Lucide icons
- CTA button: Primary variant, navigates to creation wizard
- Supporting text: Brief value proposition (2-3 sentences)

## Definition of Done

- [ ] Layout component created with responsive behavior verified on mobile, tablet, desktop
- [ ] URL state management implemented and tested with direct URL access
- [ ] Empty state designed and displayed when no assistants exist
- [ ] Skeleton loaders implemented for all loading states
- [ ] Keyboard navigation tested and working
- [ ] Assistant list displays all required information (name, type, status, timestamp)
- [ ] Selection state persists across browser refresh
- [ ] Accessibility verified (ARIA labels, semantic HTML, keyboard navigation)
- [ ] Performance tested with 100+ assistants (virtualization if needed)
- [ ] Code reviewed and merged

## Dependencies

- None (foundational story)
- Existing: `assistants` table with RLS policies
- Existing: Supabase client utilities

## Related Stories

- **Blocks**: INT-31 (Advanced Filtering and Search)
- **Blocks**: INT-32 (Real-Time Status Visualization)
- **Blocks**: INT-33 (Onboarding Experience)
- **Related**: INT-35 (Wizard UI - creation flow integration)
