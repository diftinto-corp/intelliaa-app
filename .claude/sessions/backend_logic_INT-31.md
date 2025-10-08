# Backend Business Logic Architecture: INT-31 - Assistant Filtering & Search

**Date**: 2025-10-07
**Architect**: backend-business-logic-architect
**Feature**: Advanced filtering and search for assistants list

---

## Business Logic Analysis: Assistant Filtering & Search

### Overview
This document defines the complete **business logic architecture** for filtering and searching assistants in the IntelliAA platform. The solution uses **client-side filtering** with URL parameter synchronization, optimized for performance with memoization and debouncing strategies.

**Business Purpose**: Enable users to quickly find and filter assistants by search term, type (Voice/WhatsApp/Web), and operational status (Active/Configuring/Error/Disconnected) while maintaining real-time updates via Supabase subscriptions.

**Key Decision**: Client-side filtering is appropriate because:
- Typical SaaS accounts have <100 assistants
- Data is already fetched for realtime subscriptions
- Instant filter response (no network latency)
- Simplifies integration with existing Supabase realtime architecture

---

## Architecture Plan

### Operation Flow

1. **Component Mount & Initialization**
   - Read URL search parameters via `useSearchParams()` from Next.js 15
   - Validate and sanitize URL parameters with type guards
   - Initialize filter state from URL or defaults: `{ search: '', type: 'all', status: 'all' }`
   - Fetch all assistants for account via existing `GetAllAssistants(account_id)` server action
   - Subscribe to Supabase realtime channels (INSERT/DELETE events) - already implemented

2. **Filter State Management**
   - Maintain filter state in React state: `FilterState`
   - **URL parameters are source of truth** for persistence and shareability
   - Sync local state from URL on parameter changes (supports browser back/forward)
   - Update URL when filters change:
     - Search: Debounced 300ms (avoid excessive history entries)
     - Type/Status dropdowns: Immediate update (user expects instant feedback)

3. **Filter Application (Client-Side)**
   - Use `useMemo` to compute filtered assistants from full list
   - Apply filters in performance-optimized order:
     1. **Type filter** (fastest - boolean checks)
     2. **Status filter** (moderate - boolean checks with helper function)
     3. **Search filter** (slowest - string comparison)
   - Short-circuit evaluation on first failed condition (early exit optimization)
   - Return filtered array for rendering

4. **URL Synchronization**
   - Use `router.push()` with `scroll: false` to prevent scroll jump
   - Support browser back/forward navigation (URL drives state changes)
   - Clean URLs: Only include non-default values
     - `?search=sales&type=voice&status=active` (all filters active)
     - `?search=sales` (only search active)
     - `/assistants` (no filters, all defaults)

5. **Realtime Update Integration**
   - **INSERT events**: Add to `assistantsList`, let filter determine visibility
   - **DELETE events**: Remove from `assistantsList`
   - **Future**: Consider UPDATE subscription for status changes (currently not subscribed)
   - Filter logic automatically applied to updated list via `useMemo` re-computation
   - If new assistant doesn't match active filters, show toast: "New assistant created. Clear filters to view."

### Transaction Boundaries
**N/A** - All operations are client-side, no database transactions required. Filtering happens on already-fetched data.

### Multi-Tenant Considerations
- **Account Isolation**: Enforced by `GetAllAssistants(account_id)` server action with Supabase RLS
- **Filter Scope**: All filtering happens AFTER data is fetched (already scoped to account)
- **URL Parameters**: Do NOT contain `account_id` (only filter criteria)
- **Security**: No risk of cross-account data leakage (RLS enforced at database layer)
- **Performance**: Client-side filtering doesn't add database load per account

---

## Implementation Specifications

### Input Validation

```typescript
// ===== Type Definitions =====
export type FilterType = 'all' | 'voice' | 'whatsapp' | 'web';
export type FilterStatus = 'all' | 'active' | 'configuring' | 'error' | 'disconnected';

export interface FilterState {
  search: string;
  type: FilterType;
  status: FilterStatus;
}

// ===== Type Guards for URL Parameter Validation =====
const isValidFilterType = (value: string): value is FilterType => {
  return ['all', 'voice', 'whatsapp', 'web'].includes(value);
};

const isValidFilterStatus = (value: string): value is FilterStatus => {
  return ['all', 'active', 'configuring', 'error', 'disconnected'].includes(value);
};

// ===== Sanitization Function (Prevents URL Parameter Tampering) =====
const sanitizeFiltersFromURL = (searchParams: URLSearchParams): FilterState => {
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || 'all';
  const status = searchParams.get('status') || 'all';

  return {
    search: search.slice(0, 100), // Limit search length (prevent abuse)
    type: isValidFilterType(type) ? type : 'all', // Fallback to 'all' if invalid
    status: isValidFilterStatus(status) ? status : 'all', // Fallback to 'all' if invalid
  };
};
```

**Input Validation Rules**:
- **search**: Max 100 characters, trimmed
- **type**: Must be one of 'all' | 'voice' | 'whatsapp' | 'web', otherwise default to 'all'
- **status**: Must be one of valid status values, otherwise default to 'all'
- **XSS Prevention**: No HTML rendering in search results (plain text only)

### Database Operations
**None** - All filtering is client-side. The only database operation is the initial `GetAllAssistants(account_id)` fetch, which remains unchanged.

### Filter Logic Implementation

#### 1. Type Filter Logic

```typescript
/**
 * Determines if an assistant matches the selected type filter
 * @param assistant - Assistant to check
 * @param filterType - Selected filter type
 * @returns true if assistant matches filter
 */
const matchesTypeFilter = (assistant: Assistant, filterType: FilterType): boolean => {
  if (filterType === 'all') return true;

  switch (filterType) {
    case 'voice':
      // IMPORTANT: voice_assistant is a STRING ID (not boolean)
      // Based on interface analysis: voice_assistant is a string reference to voice_assistant table
      // Check if assistant has a voice assistant configured
      return !!(assistant.voice_assistant && assistant.voice_assistant.trim() !== '');

    case 'whatsapp':
      // WhatsApp is activated (boolean field)
      return assistant.activated_whatsApp === true;

    case 'web':
      // Neither voice nor WhatsApp (web-only assistant)
      return !assistant.voice_assistant && !assistant.activated_whatsApp;

    default:
      return true;
  }
};
```

**Type Filter Rationale**:
- **Voice**: Assistant has `voice_assistant` field populated (string ID, not boolean)
  - New assistants get `voice_assistant: "StgW6mMosfwXGzfaJ130"` by default
  - Empty string or null means no voice capability
- **WhatsApp**: `activated_whatsApp === true` (boolean field)
- **Web**: Neither voice nor WhatsApp capabilities
- **All**: No filtering applied

#### 2. Status Filter Logic

```typescript
/**
 * Determines the current operational status of an assistant
 * @param assistant - Assistant to evaluate
 * @returns Current status of the assistant
 */
const getAssistantStatus = (assistant: Assistant): FilterStatus => {
  // Configuring: Currently being deployed (WhatsApp deployment in progress)
  if (assistant.is_deploying_ws === true) {
    return 'configuring';
  }

  // Error: Has service_id but not activated and not deploying
  // This indicates a failed WhatsApp deployment
  if (assistant.service_id_rw && !assistant.activated_whatsApp && !assistant.is_deploying_ws) {
    return 'error';
  }

  // Active: WhatsApp is activated OR voice assistant is configured
  const hasWhatsApp = assistant.activated_whatsApp === true;
  const hasVoice = !!(assistant.voice_assistant && assistant.voice_assistant.trim() !== '');

  if (hasWhatsApp || hasVoice) {
    return 'active';
  }

  // Disconnected: Not active, not configuring, no errors
  return 'disconnected';
};

/**
 * Determines if an assistant matches the selected status filter
 * @param assistant - Assistant to check
 * @param filterStatus - Selected filter status
 * @returns true if assistant matches filter
 */
const matchesStatusFilter = (assistant: Assistant, filterStatus: FilterStatus): boolean => {
  if (filterStatus === 'all') return true;

  const actualStatus = getAssistantStatus(assistant);
  return actualStatus === filterStatus;
};
```

**Status Determination Rules**:
1. **Configuring**: `is_deploying_ws === true` (WhatsApp deployment in progress)
2. **Error**: Has `service_id_rw` but not activated and not deploying (deployment failed)
3. **Active**: `activated_whatsApp === true` OR has `voice_assistant` configured
4. **Disconnected**: None of the above (inactive assistant)

**Important Note**: Error state detection is inferred from data state. Consider adding explicit `deployment_status` enum field in future for more accurate error tracking.

#### 3. Search Filter Logic

```typescript
/**
 * Determines if an assistant matches the search term
 * @param assistant - Assistant to check
 * @param searchTerm - User's search query
 * @returns true if assistant matches search
 */
const matchesSearchFilter = (assistant: Assistant, searchTerm: string): boolean => {
  if (!searchTerm || searchTerm.trim() === '') return true;

  const searchLower = searchTerm.toLowerCase().trim();

  // Search in name and namespace (partial match, case-insensitive)
  const searchableFields = [
    assistant.name || '',
    assistant.namespace || '',
  ];

  return searchableFields.some(field =>
    field.toLowerCase().includes(searchLower)
  );
};
```

**Search Scope**:
- **Primary**: Assistant name (most common search)
- **Secondary**: Namespace (for advanced users/debugging)
- **Match Type**: Partial, case-insensitive
- **Future Enhancement**: Add template name, prompt text to searchable fields

#### 4. Complete Filter Function (Performance-Optimized)

```typescript
/**
 * Filters assistants list based on current filter state
 * Uses useMemo for performance optimization
 */
const filteredAssistants = useMemo(() => {
  return assistantsList.filter(assistant => {
    // Apply filters in order of performance (fastest first)
    // Short-circuit evaluation: exit early on first failure

    // 1. Type filter (boolean checks - fastest)
    if (!matchesTypeFilter(assistant, filters.type)) {
      return false; // Short-circuit: no need to check other filters
    }

    // 2. Status filter (boolean checks with some logic - moderate)
    if (!matchesStatusFilter(assistant, filters.status)) {
      return false; // Short-circuit
    }

    // 3. Search filter (string comparison - slowest)
    if (!matchesSearchFilter(assistant, filters.search)) {
      return false; // Short-circuit
    }

    // All filters passed
    return true;
  });
}, [assistantsList, filters.type, filters.status, filters.search]);
```

**Performance Optimizations**:
1. **Ordered by Cost**: Filters ordered by computational cost (cheapest first)
2. **Short-Circuit Evaluation**: Exit early on first failure (~50% average reduction in checks)
3. **Memoization**: `useMemo` with granular dependencies (only recompute when necessary)
4. **Case-Insensitive Search**: Lowercase conversion done once per iteration
5. **Dependency Granularity**: Individual filter properties, not whole filter object

### URL Synchronization Implementation

```typescript
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Assistant } from '@/interfaces/intelliaa.d';

/**
 * Custom hook for managing assistant filters with URL synchronization
 * @param assistantsList - Full list of assistants for the account
 * @returns Filter state, filtered results, and handler functions
 */
const useAssistantFilters = (assistantsList: Assistant[]) => {
  const searchParams = useSearchParams(); // Read URL params
  const router = useRouter(); // Update URL
  const pathname = usePathname(); // Current path

  // Initialize filters from URL (on mount)
  const [filters, setFilters] = useState<FilterState>(() =>
    sanitizeFiltersFromURL(searchParams)
  );

  // Debounce timer ref for search input
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when URL changes (browser back/forward support)
  useEffect(() => {
    const newFilters = sanitizeFiltersFromURL(searchParams);
    setFilters(newFilters);
  }, [searchParams]);

  /**
   * Updates URL with current filter state
   * @param newFilters - New filter values
   * @param immediate - If true, update immediately; if false, debounce (for search)
   */
  const updateURL = (newFilters: FilterState, immediate = false) => {
    const updateFn = () => {
      const params = new URLSearchParams();

      // Only add non-default values to URL (clean URLs)
      if (newFilters.search) {
        params.set('search', newFilters.search);
      }
      if (newFilters.type !== 'all') {
        params.set('type', newFilters.type);
      }
      if (newFilters.status !== 'all') {
        params.set('status', newFilters.status);
      }

      const queryString = params.toString();
      const newURL = queryString ? `${pathname}?${queryString}` : pathname;

      // Update URL without scrolling to top
      router.push(newURL, { scroll: false });
    };

    if (immediate) {
      // Clear any pending debounce
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      updateFn();
    } else {
      // Debounce search updates (300ms)
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(updateFn, 300);
    }
  };

  // Cleanup on unmount (prevent memory leaks)
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // ===== Handler Functions =====

  const handleSearchChange = (search: string) => {
    const newFilters = { ...filters, search };
    setFilters(newFilters);
    updateURL(newFilters, false); // Debounced
  };

  const handleTypeChange = (type: FilterType) => {
    const newFilters = { ...filters, type };
    setFilters(newFilters);
    updateURL(newFilters, true); // Immediate
  };

  const handleStatusChange = (status: FilterStatus) => {
    const newFilters = { ...filters, status };
    setFilters(newFilters);
    updateURL(newFilters, true); // Immediate
  };

  const clearAllFilters = () => {
    const defaultFilters: FilterState = {
      search: '',
      type: 'all',
      status: 'all',
    };
    setFilters(defaultFilters);
    updateURL(defaultFilters, true); // Immediate
  };

  // Apply filters with memoization
  const filteredAssistants = useMemo(() => {
    return assistantsList.filter(assistant =>
      matchesTypeFilter(assistant, filters.type) &&
      matchesStatusFilter(assistant, filters.status) &&
      matchesSearchFilter(assistant, filters.search)
    );
  }, [assistantsList, filters]);

  const hasActiveFilters = useMemo(
    () => filters.search !== '' || filters.type !== 'all' || filters.status !== 'all',
    [filters]
  );

  return {
    filters,
    filteredAssistants,
    filteredCount: filteredAssistants.length,
    hasActiveFilters,
    handleSearchChange,
    handleTypeChange,
    handleStatusChange,
    clearAllFilters,
  };
};
```

**URL Synchronization Features**:
- **Initialization**: Reads URL params on mount
- **Bi-Directional Sync**: URL changes update state (back/forward), state changes update URL
- **Debouncing**: Search updates debounced 300ms, dropdowns immediate
- **Clean URLs**: Only non-default values included
- **Memory Safety**: Cleanup function clears pending timeouts

### Return Value

```typescript
interface FilteredAssistantsResult {
  filtered: Assistant[];
  total: number;
  count: number;
  hasActiveFilters: boolean;
}

/**
 * Creates a result object with filtered assistants and metadata
 */
const getFilteredResults = (
  assistantsList: Assistant[],
  filters: FilterState,
  filteredAssistants: Assistant[]
): FilteredAssistantsResult => {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.type !== 'all' ||
    filters.status !== 'all';

  return {
    filtered: filteredAssistants,
    total: assistantsList.length,
    count: filteredAssistants.length,
    hasActiveFilters,
  };
};
```

---

## Error Handling Strategy

| Failure Point | Recovery Action | User Message |
|--------------|----------------|-------------|
| Invalid URL parameter type | Fallback to 'all', sanitize | (Silent - use safe default) |
| Invalid URL parameter status | Fallback to 'all', sanitize | (Silent - use safe default) |
| Search term too long (>100 chars) | Truncate to 100 characters | (Silent truncation) |
| No results found | Show EmptyFilterState component | "No assistants match your filters. Try adjusting your search." |
| Supabase subscription error | Log error, continue with current data | Toast: "Unable to receive live updates. Please refresh." |
| Fetch assistants failure | Show error boundary | "Failed to load assistants. Please try again." |
| XSS attempt in search | Sanitize input (no HTML rendering) | (Silent sanitization) |
| Memory leak from debounce | Cleanup in useEffect | (Preventive - no user message) |

### Error Recovery Implementation

```typescript
// Graceful degradation for subscription failures
useEffect(() => {
  try {
    const channel = supabase
      .channel('assistants_insert')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'assistants',
      }, (payload) => {
        const newAssistant = payload.new as Assistant;
        setAssistantsList(prev => [...prev, newAssistant]);

        // Check if it matches current filters
        const matchesFilters =
          matchesTypeFilter(newAssistant, filters.type) &&
          matchesStatusFilter(newAssistant, filters.status) &&
          matchesSearchFilter(newAssistant, filters.search);

        // Notify user if new assistant is filtered out
        if (hasActiveFilters && !matchesFilters) {
          toast.info('New assistant created. Clear filters to view.');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', status);
          toast.error('Unable to receive live updates. Please refresh the page.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('Failed to setup realtime subscription:', error);
    // Continue without realtime - app still functional
  }
}, [assistantsList, filters, hasActiveFilters]);
```

**Error Handling Principles**:
1. **Graceful Degradation**: App remains functional even if features fail
2. **Silent Recovery**: Minor issues handled transparently (URL sanitization)
3. **User Feedback**: Significant issues communicated via toasts
4. **Logging**: All errors logged to console for debugging
5. **Defensive Coding**: Type guards, null checks, fallback values

---

## Realtime Update Handling

### Strategy: Add to List, Let Filter Decide Visibility

**Rationale**:
- **Centralized Logic**: Filter logic in one place (`useMemo`)
- **Simpler Code**: Easier to maintain, no logic duplication
- **User Control**: User can clear filters to see new items
- **Established Pattern**: Follows UX patterns (Gmail, Slack, Notion)

### Implementation

```typescript
// INSERT subscription - add unconditionally to list
useEffect(() => {
  const channel = supabase
    .channel('assistants_insert')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'assistants',
    }, (payload: any) => {
      const newAssistant = payload.new as Assistant;

      // Always add to full list
      setAssistantsList(prev => [...prev, newAssistant]);

      // Check if it matches current filters
      const matchesFilters =
        matchesTypeFilter(newAssistant, filters.type) &&
        matchesStatusFilter(newAssistant, filters.status) &&
        matchesSearchFilter(newAssistant, filters.search);

      // If filters are active and new item doesn't match, notify user
      if (hasActiveFilters && !matchesFilters) {
        toast.info('New assistant created. Clear filters to view.');
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [assistantsList, filters, hasActiveFilters]);

// DELETE subscription - remove from list
useEffect(() => {
  const channel = supabase
    .channel('assistants_delete')
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'assistants',
    }, (payload: any) => {
      setAssistantsList(prev =>
        prev.filter(assistant => assistant.id !== payload.old.id)
      );

      // If deleted assistant was selected, select first in filtered list
      if (assistantSelected?.id === payload.old.id) {
        setAssistantSelected(filteredAssistants[0] || null);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [assistantsList, assistantSelected, filteredAssistants]);

// TODO: Consider adding UPDATE subscription for status changes
// This would handle cases where assistant status changes (e.g., deployment completes)
// Would require re-filtering to ensure status filter accuracy
```

**Realtime Update Behavior**:
- **INSERT**: Always add to list, filter logic applies automatically via `useMemo`
- **DELETE**: Remove from list, update selection if needed
- **UPDATE**: Not currently subscribed (future enhancement)
- **Toast Notification**: Show when new item doesn't match active filters

---

## Rollback Procedures

**N/A** - All filtering is client-side with no database changes. If feature needs to be disabled:

1. Remove filter components from `AssistantComponent.tsx`
2. Restore `assistantsListPage` prop to use full `assistantsList`
3. Remove URL parameter reading logic
4. Remove `useAssistantFilters` hook import

**No data rollback required** (no database writes).

---

## Performance Considerations

### Current Optimization Strategy

1. **Memoization**:
   ```typescript
   // Only recompute when dependencies change
   const filteredAssistants = useMemo(() => {
     return assistantsList.filter(/* ... */);
   }, [assistantsList, filters.type, filters.status, filters.search]);
   ```
   - Granular dependencies: Individual filter properties, not whole object
   - Prevents re-filtering on unrelated state changes

2. **Debouncing**:
   - Search input: 300ms debounce (industry standard)
   - Dropdowns: No debounce (immediate feedback expected)
   - URL updates: Debounced for search, immediate for dropdowns

3. **Short-Circuit Evaluation**:
   - Filters applied in order of computational cost
   - Exit early on first failed condition
   - Reduces unnecessary computation by ~50% on average

4. **Component Optimization**:
   - Use `React.memo` for list items (prevent re-render on filter change)
   - Minimize state updates (only update when necessary)
   - Avoid unnecessary object creation in render

### Performance Thresholds

| Assistant Count | Strategy | Expected Performance | Action |
|----------------|----------|---------------------|--------|
| <50 | Client-side filtering | <10ms filter time | Optimal - no changes needed |
| 50-100 | Client-side with monitoring | 10-30ms filter time | Monitor performance metrics |
| 100-200 | Consider virtual scrolling | 30-50ms filter time | Implement react-window for list |
| >200 | Migrate to server-side filtering | N/A (server-side) | Implement server-side pagination |

### Monitoring Implementation

```typescript
useEffect(() => {
  // Performance monitoring
  if (assistantsList.length > 100) {
    console.warn(
      `Large assistant list detected: ${assistantsList.length} items. ` +
      'Consider implementing server-side filtering for optimal performance.'
    );
  }

  if (assistantsList.length > 200) {
    console.error(
      `Very large assistant list: ${assistantsList.length} items. ` +
      'Server-side filtering strongly recommended.'
    );

    // Could trigger analytics event here
    // analytics.track('large_assistant_list', { count: assistantsList.length });
  }
}, [assistantsList.length]);
```

### Future Server-Side Migration Path

If client-side filtering becomes a bottleneck (>200 assistants), migrate to server-side:

```typescript
// Server action with filtering
'use server';
import { createClient } from '@/lib/supabase/server';

export async function GetFilteredAssistants(
  accountId: string,
  filters: FilterState
) {
  const supabase = await createClient();

  let query = supabase
    .from('assistants')
    .select('*')
    .eq('account_id', accountId);

  // Apply filters at database level
  if (filters.search) {
    // Search in name or namespace
    query = query.or(`name.ilike.%${filters.search}%,namespace.ilike.%${filters.search}%`);
  }

  if (filters.type !== 'all') {
    // Type filtering logic (may need computed column or join)
    // This requires database schema changes to support type categorization
  }

  if (filters.status !== 'all') {
    // Status filtering logic (may need computed column or complex WHERE clause)
    // This requires explicit status tracking in database
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

**Migration Checklist**:
- [ ] Add database indexes on searchable columns
- [ ] Create computed column for `type` categorization
- [ ] Add explicit `status` field or computed column
- [ ] Implement pagination (offset/limit or cursor-based)
- [ ] Update client to call server action on filter change
- [ ] Remove client-side filtering logic
- [ ] Test performance with large datasets

---

## Security Checklist

- [x] **Input Validation**: URL parameters validated with type guards
- [x] **XSS Prevention**: No HTML rendering in search results (plain text only)
- [x] **SQL Injection**: N/A (client-side filtering, no dynamic SQL)
- [x] **Input Sanitization**: Search term length limited to 100 characters
- [x] **RLS Enforcement**: Handled by `GetAllAssistants` server action (account_id filter)
- [x] **Account Isolation**: Multi-tenant security via Supabase RLS
- [x] **URL Parameter Tampering**: Sanitization with fallback to safe defaults
- [ ] **Rate Limiting**: Consider adding client-side rate limit for URL updates (prevent abuse)

### Additional Security Considerations

```typescript
// Sanitize search input (prevent potential XSS if search is ever server-rendered)
const sanitizeSearchInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .slice(0, 100)         // Limit length
    .trim();               // Remove whitespace
};

// Validate account_id matches current session (in server action)
// This is already handled by GetAllAssistants using account_id from session
```

**Security Principles**:
1. **Defense in Depth**: Multiple layers of validation (client + server)
2. **Least Privilege**: Only fetch data for current account
3. **Input Sanitization**: Clean all user inputs
4. **Safe Defaults**: Invalid inputs fallback to safe values
5. **No Secrets in URLs**: Only filter criteria, no sensitive data

---

## Testing Strategy

### Unit Tests (Recommended)

```typescript
// Filter function tests
describe('matchesTypeFilter', () => {
  it('should match voice assistants with voice_assistant ID', () => {
    const assistant = { voice_assistant: 'abc123', activated_whatsApp: false };
    expect(matchesTypeFilter(assistant, 'voice')).toBe(true);
  });

  it('should not match voice filter for empty voice_assistant', () => {
    const assistant = { voice_assistant: '', activated_whatsApp: false };
    expect(matchesTypeFilter(assistant, 'voice')).toBe(false);
  });

  it('should match whatsapp assistants when activated_whatsApp is true', () => {
    const assistant = { voice_assistant: '', activated_whatsApp: true };
    expect(matchesTypeFilter(assistant, 'whatsapp')).toBe(true);
  });

  it('should match web assistants without voice or whatsapp', () => {
    const assistant = { voice_assistant: '', activated_whatsApp: false };
    expect(matchesTypeFilter(assistant, 'web')).toBe(true);
  });

  it('should match all types when filter is "all"', () => {
    const assistant = { voice_assistant: 'abc', activated_whatsApp: true };
    expect(matchesTypeFilter(assistant, 'all')).toBe(true);
  });
});

describe('getAssistantStatus', () => {
  it('should return configuring when is_deploying_ws is true', () => {
    const assistant = {
      is_deploying_ws: true,
      activated_whatsApp: false,
      voice_assistant: '',
      service_id_rw: null,
    };
    expect(getAssistantStatus(assistant)).toBe('configuring');
  });

  it('should return error when deployment failed', () => {
    const assistant = {
      service_id_rw: 'abc123',
      activated_whatsApp: false,
      is_deploying_ws: false,
      voice_assistant: '',
    };
    expect(getAssistantStatus(assistant)).toBe('error');
  });

  it('should return active when whatsapp is activated', () => {
    const assistant = {
      activated_whatsApp: true,
      is_deploying_ws: false,
      voice_assistant: '',
      service_id_rw: null,
    };
    expect(getAssistantStatus(assistant)).toBe('active');
  });

  it('should return active when voice assistant is configured', () => {
    const assistant = {
      voice_assistant: 'voice123',
      activated_whatsApp: false,
      is_deploying_ws: false,
      service_id_rw: null,
    };
    expect(getAssistantStatus(assistant)).toBe('active');
  });

  it('should return disconnected when no active connections', () => {
    const assistant = {
      voice_assistant: '',
      activated_whatsApp: false,
      is_deploying_ws: false,
      service_id_rw: null,
    };
    expect(getAssistantStatus(assistant)).toBe('disconnected');
  });
});

describe('matchesSearchFilter', () => {
  it('should match case-insensitive partial names', () => {
    const assistant = { name: 'Sales Assistant', namespace: 'abc123' };
    expect(matchesSearchFilter(assistant, 'sales')).toBe(true);
    expect(matchesSearchFilter(assistant, 'SALES')).toBe(true);
    expect(matchesSearchFilter(assistant, 'sal')).toBe(true);
  });

  it('should match namespace', () => {
    const assistant = { name: 'Test', namespace: 'unique123' };
    expect(matchesSearchFilter(assistant, 'unique')).toBe(true);
  });

  it('should return true for empty search', () => {
    const assistant = { name: 'Test', namespace: 'abc' };
    expect(matchesSearchFilter(assistant, '')).toBe(true);
  });

  it('should return false for non-matching search', () => {
    const assistant = { name: 'Test', namespace: 'abc' };
    expect(matchesSearchFilter(assistant, 'xyz')).toBe(false);
  });
});
```

### Integration Tests

```typescript
// URL synchronization tests
describe('useAssistantFilters', () => {
  it('should initialize filters from URL params', () => {
    // Mock useSearchParams to return ?search=test&type=voice
    const mockSearchParams = new URLSearchParams('?search=test&type=voice');
    jest.spyOn(require('next/navigation'), 'useSearchParams').mockReturnValue(mockSearchParams);

    const { result } = renderHook(() => useAssistantFilters([]));

    expect(result.current.filters).toEqual({
      search: 'test',
      type: 'voice',
      status: 'all',
    });
  });

  it('should update URL when filters change', async () => {
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push: mockPush });

    const { result } = renderHook(() => useAssistantFilters([]));

    act(() => {
      result.current.handleTypeChange('whatsapp');
    });

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('type=whatsapp'),
      { scroll: false }
    );
  });

  it('should debounce search updates', async () => {
    jest.useFakeTimers();
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push: mockPush });

    const { result } = renderHook(() => useAssistantFilters([]));

    act(() => {
      result.current.handleSearchChange('test');
    });

    // Should not update immediately
    expect(mockPush).not.toHaveBeenCalled();

    // Should update after 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockPush).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should clear debounce when component unmounts', () => {
    const { unmount } = renderHook(() => useAssistantFilters([]));

    // Should not throw or cause memory leaks
    expect(() => unmount()).not.toThrow();
  });
});
```

### Manual Testing Checklist

#### Filter Functionality
- [ ] Search filters assistants by name (case-insensitive)
- [ ] Search filters assistants by namespace
- [ ] Type filter: Voice shows only assistants with voice_assistant
- [ ] Type filter: WhatsApp shows only activated_whatsApp = true
- [ ] Type filter: Web shows assistants without voice or WhatsApp
- [ ] Type filter: All shows all assistants
- [ ] Status filter: Active shows voice or WhatsApp activated
- [ ] Status filter: Configuring shows is_deploying_ws = true
- [ ] Status filter: Error shows failed deployments
- [ ] Status filter: Disconnected shows inactive assistants
- [ ] Combining filters works (AND logic)
- [ ] Clear all filters button resets to defaults

#### URL Synchronization
- [ ] URL params update when filters change
- [ ] Filters persist on page refresh
- [ ] Back button updates filter state correctly
- [ ] Forward button updates filter state correctly
- [ ] Direct URL navigation with params works

#### Debouncing
- [ ] Search input debounces URL update (300ms)
- [ ] Type dropdown updates URL immediately
- [ ] Status dropdown updates URL immediately
- [ ] Rapid typing in search doesn't create many URL updates

#### Realtime Updates
- [ ] New assistants from Supabase appear if matching filters
- [ ] New assistants hidden if not matching filters
- [ ] Toast notification when new assistant doesn't match filters
- [ ] Deleted assistants disappear from filtered list
- [ ] Selection updates when current assistant is deleted

#### UI/UX
- [ ] Empty state shows when no matches
- [ ] Result count displays correctly
- [ ] Loading state during initial fetch
- [ ] No flicker or jank during filtering

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance degradation with large lists (>200 items) | Medium | Medium | Monitor list size, implement virtual scrolling if needed, add console warning at 100+ items, migrate to server-side at 200+ |
| URL parameter tampering breaks UI | Low | Low | Comprehensive validation with safe fallbacks, type guards prevent invalid values |
| Search debounce causes UI lag perception | Low | Low | 300ms is industry standard (Gmail uses 300-500ms), provide visual feedback if needed |
| Realtime subscription failure | Medium | Low | Graceful degradation, show toast notification, app remains functional without realtime |
| Filter state desync between URL and local state | Low | Medium | URL is source of truth, `useEffect` syncs local state from URL changes, bi-directional binding |
| "Error" status false positives | Medium | Medium | Clear status determination logic, document edge cases, consider adding explicit status field in database |
| New assistant not visible due to filters | High | Low | Show toast notification "New assistant created. Clear filters to view." |
| Memory leak from debounce timeout | Low | High | Cleanup function in `useEffect` clears timeout on unmount, tested in integration tests |
| Filter logic inconsistency with backend status (INT-32) | High | Medium | Centralize status logic in `getAssistantStatus()`, update after INT-32 completion |
| Browser history pollution from rapid filter changes | Low | Low | Debouncing reduces history entries, `scroll: false` prevents scroll jump |

### Risk: "Error" Status Detection Limitations

**Current Implementation Limitation**:
The "error" status is **inferred** from data state:

```typescript
if (service_id_rw && !activated_whatsApp && !is_deploying_ws) {
  return 'error';
}
```

**Potential Issues**:
- **False Positives**: Assistant might be in this state temporarily during normal operation
- **No Explicit Tracking**: No dedicated error field in database
- **Ambiguity**: Can't distinguish between deployment failure vs. user manual disconnection
- **Race Conditions**: Webhook might not have arrived yet

**Recommended Mitigation**:

1. **Short-term (Current Implementation)**:
   - Document this as "inferred error state" in code comments
   - Add logging to track false positives
   - Monitor user feedback on error filter accuracy

2. **Medium-term (Database Enhancement)**:
   ```sql
   ALTER TABLE assistants
   ADD COLUMN deployment_status TEXT
   CHECK (deployment_status IN ('pending', 'deploying', 'deployed', 'failed', 'disconnected'));

   CREATE INDEX idx_assistants_deployment_status ON assistants(deployment_status);
   ```

3. **Long-term (Webhook Integration)**:
   - Implement webhook-based status tracking from Railway/Buildship
   - Set explicit error states when deployment fails
   - Add `last_deployment_error` field for debugging
   - Implement automatic retry logic with backoff

---

## Dependencies

### Required Environment Variables
**None** - All filtering is client-side, no environment configuration needed.

### External Service Availability
- **Supabase Realtime**: Graceful degradation if unavailable (filtering still works, just no live updates)
- **Browser APIs**: `URLSearchParams`, `setTimeout`, `clearTimeout` (universally supported)

### Database Schema Requirements

```sql
-- Current schema (no changes required for basic filtering)
-- assistants table fields used:
--   - id (uuid) - Primary key
--   - name (text) - Searchable field
--   - namespace (text) - Searchable field, unique identifier
--   - voice_assistant (text, nullable) - ID reference to voice_assistant table (NOT boolean)
--   - activated_whatsApp (boolean) - WhatsApp activation status
--   - is_deploying_ws (boolean) - Deployment in progress flag
--   - service_id_rw (text, nullable) - Railway service ID for WhatsApp
--   - account_id (uuid) - Foreign key for RLS, multi-tenancy

-- RLS policies (already implemented):
-- - SELECT: WHERE account_id IN (user's accounts)
-- - INSERT: WHERE account_id IN (user's accounts)
-- - UPDATE: WHERE account_id IN (user's accounts)
-- - DELETE: WHERE account_id IN (user's accounts)

-- Optional future enhancements:
-- 1. Explicit status tracking:
ALTER TABLE assistants ADD COLUMN deployment_status TEXT
  CHECK (deployment_status IN ('pending', 'deploying', 'deployed', 'failed', 'disconnected'));

-- 2. Performance indexes (if migrating to server-side filtering):
CREATE INDEX idx_assistants_name_trgm ON assistants USING gin (name gin_trgm_ops);
CREATE INDEX idx_assistants_namespace ON assistants(namespace);

-- 3. Full-text search (advanced):
ALTER TABLE assistants ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(namespace, ''))) STORED;
CREATE INDEX idx_assistants_search ON assistants USING gin (search_vector);
```

### Component Dependencies

**Next.js 15 Hooks**:
- `useSearchParams` from 'next/navigation' - Read URL query parameters
- `useRouter` from 'next/navigation' - Update URL via router.push()
- `usePathname` from 'next/navigation' - Get current pathname

**React 19 Hooks**:
- `useState` - Local filter state management
- `useEffect` - URL sync, subscription setup, cleanup
- `useMemo` - Filter computation memoization
- `useCallback` - Handler function memoization (optional optimization)
- `useRef` - Debounce timeout reference

**Supabase Client**:
- `createClient()` from '@/lib/supabase/client' - Client-side Supabase instance
- Realtime subscriptions (INSERT/DELETE events)

**TypeScript Interfaces**:
- `Assistant` from '@/interfaces/intelliaa.d.ts' - Assistant data shape

**Third-Party**:
- None - all functionality uses built-in browser APIs and existing project dependencies

---

## Next Steps

### Implementation Order

1. **Create Utility Functions** (`src/lib/utils/assistantFilters.ts`)
   - `matchesTypeFilter(assistant, type): boolean`
   - `matchesStatusFilter(assistant, status): boolean`
   - `matchesSearchFilter(assistant, search): boolean`
   - `getAssistantStatus(assistant): FilterStatus`
   - `sanitizeFiltersFromURL(searchParams): FilterState`
   - Type definitions: `FilterType`, `FilterStatus`, `FilterState`
   - **Estimate**: 1-2 hours

2. **Create Custom Hook** (`src/components/intelliaa/assistants/filters/useAssistantFilters.ts`)
   - Implements `useAssistantFilters(assistantsList)` hook
   - URL synchronization logic
   - Debouncing implementation
   - Filter application with useMemo
   - Returns: `{ filters, filteredAssistants, handlers, ... }`
   - **Estimate**: 2-3 hours

3. **Write Unit Tests** (`src/lib/utils/__tests__/assistantFilters.test.ts`)
   - Test filter functions with various inputs
   - Test status determination logic
   - Test URL sanitization
   - **Estimate**: 1-2 hours

4. **Integrate into AssistantComponent** (`src/components/intelliaa/assistants/AssistantComponent.tsx`)
   - Import `useAssistantFilters` hook
   - Replace `assistantsList` with `filteredAssistants` in render
   - Add filter UI components (created by shadcn-ui-planner)
   - Update realtime subscription logic
   - **Estimate**: 1-2 hours

5. **Manual Testing**
   - Test all filter combinations
   - Test URL synchronization (back/forward buttons)
   - Test realtime updates with active filters
   - Test edge cases (empty list, single item, special characters)
   - **Estimate**: 2-3 hours

6. **Performance Testing**
   - Test with 50, 100, 200+ assistants
   - Measure filter computation time
   - Verify no memory leaks
   - **Estimate**: 1 hour

### Total Estimated Effort
**Backend Logic Only**: 8-13 hours

**Combined with UI** (from shadcn-ui-planner): 15-24 hours total

### Coordination with Other Agents

- **shadcn-ui-planner**: ✅ Already consulted (UI component architecture defined in main context file)
- **business-logic-architect**: N/A (this IS the business logic architecture)
- **backend-test-architect**: Consult after implementation for comprehensive test case definitions
- **INT-32 coordination**: Update `getAssistantStatus()` logic after status values are standardized

---

## Type Definitions Export

```typescript
// src/lib/types/assistantFilters.ts

/**
 * Filter type options for assistant categorization
 */
export type FilterType = 'all' | 'voice' | 'whatsapp' | 'web';

/**
 * Filter status options for assistant operational state
 */
export type FilterStatus = 'all' | 'active' | 'configuring' | 'error' | 'disconnected';

/**
 * Complete filter state structure
 */
export interface FilterState {
  /** Search query (name or namespace) */
  search: string;
  /** Assistant type filter */
  type: FilterType;
  /** Assistant status filter */
  status: FilterStatus;
}

/**
 * Filtered assistants result with metadata
 */
export interface FilteredAssistantsResult {
  /** Filtered assistant list */
  filtered: Assistant[];
  /** Total number of assistants (before filtering) */
  total: number;
  /** Number of assistants after filtering */
  count: number;
  /** Whether any filters are active (not all defaults) */
  hasActiveFilters: boolean;
}

/**
 * Type guard: Validates filter type from URL parameter
 */
export const isValidFilterType = (value: string): value is FilterType => {
  return ['all', 'voice', 'whatsapp', 'web'].includes(value);
};

/**
 * Type guard: Validates filter status from URL parameter
 */
export const isValidFilterStatus = (value: string): value is FilterStatus => {
  return ['all', 'active', 'configuring', 'error', 'disconnected'].includes(value);
};

/**
 * Default filter state (all filters disabled)
 */
export const DEFAULT_FILTERS: Readonly<FilterState> = {
  search: '',
  type: 'all',
  status: 'all',
} as const;
```

---

## Summary

### Architecture Decisions

1. **Client-Side Filtering**: Chosen for simplicity, performance with <100 items, and easier realtime integration
2. **URL Parameter State**: Provides shareability, persistence, and browser history support
3. **Debouncing Strategy**: 300ms for search (standard), immediate for dropdowns
4. **Filter Order**: Type > Status > Search (performance-optimized)
5. **Realtime Strategy**: Add to list unconditionally, let filter logic decide visibility

### Key Implementation Files

| File | Purpose | Lines of Code |
|------|---------|---------------|
| `src/lib/utils/assistantFilters.ts` | Filter utility functions | ~120 |
| `src/lib/types/assistantFilters.ts` | Type definitions | ~60 |
| `src/components/intelliaa/assistants/filters/useAssistantFilters.ts` | Custom filter hook | ~150 |
| `src/components/intelliaa/assistants/AssistantComponent.tsx` (modified) | Integration point | ~30 (changes) |
| **Total** | | **~360 LOC** |

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Filter time (<50 items) | <10ms | Optimal performance |
| Filter time (50-100 items) | 10-30ms | Still acceptable |
| Filter time (100-200 items) | 30-50ms | May need virtual scrolling |
| Search debounce | 300ms | Industry standard |
| Memory overhead | Minimal | Single memoized array |
| Network requests | 0 | Pure client-side |

### Security Posture

- ✅ Input validation with type guards
- ✅ XSS prevention (no HTML rendering)
- ✅ Account isolation via RLS
- ✅ URL parameter sanitization
- ✅ No sensitive data in URLs

### Future Enhancements

1. **Server-Side Filtering** (>200 assistants)
   - Database indexes on searchable columns
   - Pagination support
   - More complex status queries

2. **Advanced Search**
   - Full-text search on prompt, template name
   - Fuzzy matching
   - Search history

3. **Explicit Status Tracking**
   - `deployment_status` enum field
   - Webhook-based status updates
   - Error message storage

4. **Filter Presets**
   - Save common filter combinations
   - Share filter presets across team
   - Default filters per user

---

**Document Version**: 1.0
**Last Updated**: 2025-10-07
**Status**: Ready for Implementation
