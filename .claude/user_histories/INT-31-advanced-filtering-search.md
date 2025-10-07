# INT-31: Add Advanced Filtering and Search to Assistants List

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P0 - Must Have
**Estimate**: 3-5 points (Medium)
**Labels**: frontend, ui, filtering, search

## User Story

As an IntelliAA user with many assistants, I want to filter and search my assistant list by name, type, and status, so that I can quickly find the specific assistant I need to work with.

## Acceptance Criteria

### AC1: Real-Time Search by Name
**Given** I have multiple assistants in my list
**When** I type "customer" in the search input
**Then** the list filters in real-time (debounced 300ms) to show only assistants with names containing "customer" (case-insensitive)

### AC2: Filter by Assistant Type
**Given** I want to see only Voice assistants
**When** I select "Voice" from the type filter dropdown
**Then** the list displays only Voice assistants, and the filter chip shows "Type: Voice" with a remove option

### AC3: Filter by Status
**Given** I need to find assistants with errors
**When** I select "Error" from the status filter
**Then** only assistants with error status are displayed, and other filters remain active

### AC4: Combined Filters
**Given** I have search text "support" and type filter "WhatsApp" active
**When** both filters are applied
**Then** I see only WhatsApp assistants with "support" in their name, and both filter chips are visible

### AC5: Clear All Filters
**Given** multiple filters are active
**When** I click "Clear all" button
**Then** all filters reset, the full assistant list displays, and the search input and dropdowns clear

### AC6: Filter State in URL
**Given** I have filters applied (search="sales", type="Voice")
**When** I refresh the page or share the URL
**Then** the same filters are re-applied on page load from URL query parameters

### AC7: No Results State
**Given** my filters return zero results
**When** viewing the list
**Then** I see an empty state with message "No assistants match your filters" and a "Clear filters" button

### AC8: Result Count Display
**Given** filters are active
**When** viewing the filtered list
**Then** I see "Showing X of Y assistants" above the list

## Technical Notes

### Implementation Details
- **Components**: Create `AssistantsFilterBar.tsx` and `SearchInput.tsx`
- **File Location**: `src/components/intelliaa/assistants/filters/`
- **State Management**: Use `useSearchParams` and `useRouter` from `next/navigation`
- **Debouncing**: Use `useDebouncedValue` hook (300ms delay)

### Filter Configuration
```typescript
interface FilterState {
  search: string;
  type: 'all' | 'voice' | 'whatsapp' | 'web';
  status: 'all' | 'active' | 'configuring' | 'error' | 'disconnected';
}

// URL format: ?search=sales&type=voice&status=active
```

### Component Structure
```typescript
// src/components/intelliaa/assistants/filters/AssistantsFilterBar.tsx
export function AssistantsFilterBar() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex gap-2 items-center p-4 border-b">
      <SearchInput />
      <TypeFilter />
      <StatusFilter />
      {hasActiveFilters && <ClearFiltersButton />}
    </div>
  );
}
```

### Search Implementation
- Use `filter()` on client-side for <100 assistants
- For 100+ assistants, implement server-side filtering via API route
- Highlight matching text in results (optional enhancement)

### Filter UI Components
- **Search Input**: Magnifying glass icon, placeholder "Search assistants...", clear button when text exists
- **Type Dropdown**: Radio options (All, Voice, WhatsApp, Web)
- **Status Dropdown**: Radio options (All, Active, Configuring, Error, Disconnected)
- **Filter Chips**: Dismissible badges showing active filters

### Performance Optimization
- Memoize filter function with `useMemo`
- Virtualize list if >100 items (react-window)
- Debounce search input to reduce re-renders

## Definition of Done

- [ ] Search input created with 300ms debouncing
- [ ] Type filter dropdown implemented with all assistant types
- [ ] Status filter dropdown implemented with all statuses
- [ ] Combined filters work correctly together
- [ ] Clear all filters button functional
- [ ] URL query parameters sync with filter state
- [ ] No results state displays when appropriate
- [ ] Result count displays above filtered list
- [ ] Filter persistence tested across page refresh
- [ ] Performance verified with 100+ assistants
- [ ] Accessibility verified (ARIA labels, keyboard navigation)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-30 (Master-Detail Layout must be completed)
- Existing: Assistant data structure with type and status fields
- Existing: URL routing utilities from Next.js 15

## Related Stories

- **Depends on**: INT-30 (Master-Detail Layout)
- **Related**: INT-32 (Status values must align)
- **Enhances**: User experience for INT-33 (Onboarding)
