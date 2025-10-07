# INT-32: Implement Real-Time Status Visualization for Assistants

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P0 - Must Have
**Estimate**: 3-5 points (Medium)
**Labels**: frontend, realtime, ui, monitoring

## User Story

As an IntelliAA user monitoring my assistants, I want to see real-time status indicators for each assistant, so that I can quickly identify which assistants are active, configuring, or experiencing issues without manual refresh.

## Acceptance Criteria

### AC1: Color-Coded Status Badges
**Given** an assistant in the list
**When** viewing its status
**Then** I see a color-coded badge: Green (Active), Yellow (Configuring), Red (Error), Gray (Disconnected)

### AC2: Real-Time Status Updates via Supabase
**Given** I am viewing the assistants list
**When** an assistant's status changes in the database (e.g., deployment completes)
**Then** the status badge updates in real-time within 500ms without page refresh

### AC3: Error Status with Tooltip Details
**Given** an assistant has an error status
**When** I hover over the error badge
**Then** I see a tooltip with the error message and timestamp of the error

### AC4: Status Transition Animations
**Given** an assistant status changes from "Configuring" to "Active"
**When** the update occurs
**Then** I see a subtle pulse/fade animation on the badge to draw attention to the change

### AC5: Status Summary Statistics
**Given** I am on the assistants page
**When** viewing the header area
**Then** I see summary counts: "X Active • Y Configuring • Z Errors" with click-to-filter functionality

### AC6: Historical Status Indicator
**Given** an assistant has had recent status changes
**When** viewing the assistant details
**Then** I see a status history timeline showing last 5 status changes with timestamps

### AC7: Status Filter Integration
**Given** I click on "3 Errors" in the summary statistics
**When** the filter activates
**Then** the list filters to show only assistants with error status (integrates with INT-31 filters)

## Technical Notes

### Implementation Details
- **Components**: `StatusBadge.tsx`, `StatusSummary.tsx`, `StatusHistoryTimeline.tsx`
- **File Location**: `src/components/intelliaa/assistants/status/`
- **Realtime**: Use Supabase Realtime subscriptions to `assistants` table
- **State Management**: Optimistic updates with SWR or React Query

### Status Enum Definition
```typescript
export enum AssistantStatus {
  ACTIVE = 'active',
  CONFIGURING = 'configuring',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'green',
    bgClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: CheckCircle,
  },
  configuring: {
    label: 'Configuring',
    color: 'yellow',
    bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: Clock,
  },
  error: {
    label: 'Error',
    color: 'red',
    bgClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: AlertCircle,
  },
  disconnected: {
    label: 'Disconnected',
    color: 'gray',
    bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    icon: WifiOff,
  },
} as const;
```

### Supabase Realtime Subscription
```typescript
// src/hooks/useAssistantStatus.ts
export function useAssistantStatus(accountId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`assistants:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assistants',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          // Update local state with new status
          updateAssistantStatus(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId]);
}
```

### Status Badge Component
```typescript
// src/components/intelliaa/assistants/status/StatusBadge.tsx
interface StatusBadgeProps {
  status: AssistantStatus;
  errorMessage?: string;
  showAnimation?: boolean;
}

export function StatusBadge({ status, errorMessage, showAnimation }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              config.bgClass,
              showAnimation && 'animate-pulse',
              'flex items-center gap-1'
            )}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        {status === 'error' && errorMessage && (
          <TooltipContent>
            <p className="text-sm">{errorMessage}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Database Schema Update
```sql
-- Add error tracking fields to assistants table
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS status assistant_status DEFAULT 'configuring';
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW();

-- Create status history table
CREATE TABLE assistant_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  status assistant_status NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE assistant_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view status history for their assistants"
  ON assistant_status_history FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT get_accounts_for_current_user()));
```

### Animation Specifications
- **Pulse on Change**: 1-second pulse when status updates
- **Fade Transition**: 200ms fade between status colors
- **Icon Spin**: Configuring status shows spinning clock icon

## Definition of Done

- [ ] Status badge component created with all 4 status types
- [ ] Color coding implemented and tested in light/dark mode
- [ ] Supabase Realtime subscription working for status updates
- [ ] Error tooltips display correct error messages
- [ ] Status transition animations implemented
- [ ] Summary statistics component shows accurate counts
- [ ] Click-to-filter from summary works (integrates with INT-31)
- [ ] Status history timeline displays last 5 changes
- [ ] Database schema updated with status fields
- [ ] RLS policies created for status history table
- [ ] Performance tested with 100+ assistants and frequent updates
- [ ] Accessibility verified (ARIA live regions for status changes)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-30 (Master-Detail Layout)
- **Integrates with**: INT-31 (Filter by status functionality)
- Existing: Supabase Realtime enabled on project
- New: Database migration for status fields

## Related Stories

- **Depends on**: INT-30 (Layout provides UI structure)
- **Integrates with**: INT-31 (Filtering system)
- **Related**: INT-44, INT-45 (WhatsApp status from Evolution API)
- **Related**: INT-40 (Voice status from VAPI)
