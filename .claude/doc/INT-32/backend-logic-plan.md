# Backend Business Logic Architecture Plan: INT-32 Real-Time Status Visualization

## Business Logic Analysis: Assistant Status Management

### Overview

This document provides the comprehensive backend business logic architecture for managing assistant status transitions, error tracking, and status history in the IntelliAA platform. The system must support real-time status updates driven by external service integrations (WhatsApp deployment via Railway, Voice assistant activation via Vapi), while maintaining multi-tenant data isolation and transactional integrity.

**Business Purpose**: Enable real-time visibility into assistant health and deployment state through automated status tracking, error reporting, and historical audit trails.

---

## Architecture Plan

### Operation Flow

The status management system consists of three primary operation flows:

#### 1. Status Update Flow (Primary)

```
User Action / External Event
    ↓
Server Action: updateAssistantStatus()
    ↓
Input Validation (account_id, assistant_id, new_status)
    ↓
Verify Account Membership (RLS + explicit check)
    ↓
Validate Status Transition (State Machine)
    ↓
Atomic Transaction START
    ↓
├─ Update assistants.status
├─ Update assistants.error_message (if error)
├─ Update assistants.last_status_change
├─ Insert assistant_status_history record
    ↓
Atomic Transaction COMMIT
    ↓
Supabase Realtime Broadcast
    ↓
Client UI Update (via useAssistantsRealtime hook)
```

#### 2. WhatsApp Deployment Status Flow

```
WhatsApp Deployment Initiated (activateWs)
    ↓
Set status = 'configuring'
Set is_deploying_ws = true
    ↓
Railway Webhook Callback (POST /api/railway)
    ↓
If status === 'SUCCESS':
    ├─ Call wsStatusActiveUtil(namespace)
    ├─ Set status = 'active'
    ├─ Set activated_whatsApp = true
    ├─ Set is_deploying_ws = false
    ↓
If status === 'FAILED':
    ├─ Set status = 'error'
    ├─ Set error_message = Railway error details
    ├─ Set is_deploying_ws = false
```

#### 3. Voice Assistant Activation Flow

```
Voice Assistant Created (createAssistantVoiceVapi)
    ↓
Set status = 'configuring'
    ↓
Vapi API Response
    ↓
If Success:
    ├─ Set status = 'active'
    ├─ Store voice_assistant_id
    ↓
If Failed:
    ├─ Set status = 'error'
    ├─ Set error_message = Vapi error details
```

### Transaction Boundaries

#### Atomic Unit 1: Status Update Transaction
**Operations that must succeed/fail together:**
- Update `assistants.status`
- Update `assistants.error_message` (if transitioning to error)
- Update `assistants.last_status_change`
- Insert `assistant_status_history` record

**Rollback Trigger**: Any database operation failure, validation error, or authorization failure

**Implementation**:
```typescript
// Use Supabase transaction via RPC or sequential operations with error handling
const { error: updateError } = await supabase
  .from('assistants')
  .update({
    status: newStatus,
    error_message: errorMessage || null,
    last_status_change: new Date().toISOString(),
  })
  .eq('id', assistantId)
  .eq('account_id', accountId);

if (updateError) {
  throw new Error(`Status update failed: ${updateError.message}`);
}

const { error: historyError } = await supabase
  .from('assistant_status_history')
  .insert({
    assistant_id: assistantId,
    account_id: accountId,
    status: newStatus,
    error_message: errorMessage || null,
  });

if (historyError) {
  // Rollback: Attempt to revert status update
  await supabase
    .from('assistants')
    .update({ status: previousStatus })
    .eq('id', assistantId);

  throw new Error(`History insert failed: ${historyError.message}`);
}
```

#### Atomic Unit 2: External Service Integration Status Updates
**Operations that must succeed/fail together:**
- External API call (Railway/Vapi)
- Status update to 'configuring'
- Store external service identifiers (service_id_rw, qr_url, etc.)

**Rollback Trigger**: External API failure should revert status to previous state

### Multi-Tenant Considerations

**Account Isolation Enforcement**:
1. All server actions MUST include `account_id` parameter
2. Database queries MUST filter by `account_id`
3. RLS policies provide defense-in-depth but are NOT the primary authorization mechanism
4. Explicit account membership validation via `get_accounts_for_current_user()` function

**RLS Policy Dependencies**:
- `assistants` table: Existing RLS policies filter by account membership
- `assistant_status_history` table: New RLS policy required (see Database Schema section)

**Security Check Pattern**:
```typescript
// Server action pattern
export async function updateAssistantStatus(
  accountId: string,
  assistantId: string,
  newStatus: AssistantStatus,
  errorMessage?: string
) {
  'use server';

  const supabase = await createClient();

  // Step 1: Verify user has access to this account
  const { data: accounts } = await supabase.rpc('get_accounts_for_current_user');
  const hasAccess = accounts?.some(acc => acc.account_id === accountId);

  if (!hasAccess) {
    throw new Error('Unauthorized: Account access denied');
  }

  // Step 2: Verify assistant belongs to account
  const { data: assistant } = await supabase
    .from('assistants')
    .select('id, account_id, status')
    .eq('id', assistantId)
    .eq('account_id', accountId)
    .single();

  if (!assistant) {
    throw new Error('Assistant not found or access denied');
  }

  // Proceed with status update...
}
```

---

## Implementation Specifications

### Input Validation

```typescript
// Status enum definition
export enum AssistantStatus {
  CONFIGURING = 'configuring',
  ACTIVE = 'active',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
  INACTIVE = 'inactive', // For manually deactivated assistants
}

// Input validation schema
interface UpdateStatusInput {
  accountId: string;      // UUID format
  assistantId: string;    // UUID format
  newStatus: AssistantStatus;
  errorMessage?: string;  // Required if status === 'error', max 1000 chars
  metadata?: {            // Optional context for status change
    source?: 'webhook' | 'manual' | 'automatic';
    externalServiceId?: string;
    timestamp?: string;
  };
}

// Validation function
function validateStatusUpdateInput(input: UpdateStatusInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(input.accountId)) {
    errors.push('Invalid account_id format');
  }

  if (!uuidRegex.test(input.assistantId)) {
    errors.push('Invalid assistant_id format');
  }

  // Status enum validation
  if (!Object.values(AssistantStatus).includes(input.newStatus)) {
    errors.push(`Invalid status: ${input.newStatus}`);
  }

  // Error message validation
  if (input.newStatus === AssistantStatus.ERROR) {
    if (!input.errorMessage || input.errorMessage.trim().length === 0) {
      errors.push('error_message is required when status is "error"');
    } else if (input.errorMessage.length > 1000) {
      errors.push('error_message exceeds maximum length of 1000 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Database Operations

#### Query 1: Get Current Assistant Status
**Purpose**: Retrieve current status for validation and state machine checks
**Table**: `assistants`
**Filters**: `account_id`, `id`

```typescript
const { data: currentAssistant, error } = await supabase
  .from('assistants')
  .select('id, account_id, status, error_message, last_status_change')
  .eq('id', assistantId)
  .eq('account_id', accountId)
  .single();
```

#### Mutation 1: Update Assistant Status
**Purpose**: Set new status and error information
**Table**: `assistants`
**Data**: `status`, `error_message`, `last_status_change`

```typescript
const { data: updatedAssistant, error: updateError } = await supabase
  .from('assistants')
  .update({
    status: newStatus,
    error_message: errorMessage || null,
    last_status_change: new Date().toISOString(),
  })
  .eq('id', assistantId)
  .eq('account_id', accountId)
  .select()
  .single();
```

#### Mutation 2: Insert Status History Record
**Purpose**: Create audit trail of status changes
**Table**: `assistant_status_history`
**Data**: `assistant_id`, `account_id`, `status`, `error_message`, `metadata`

```typescript
const { data: historyRecord, error: historyError } = await supabase
  .from('assistant_status_history')
  .insert({
    assistant_id: assistantId,
    account_id: accountId,
    status: newStatus,
    error_message: errorMessage || null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  })
  .select()
  .single();
```

#### Query 2: Get Status History
**Purpose**: Retrieve last N status changes for display
**Table**: `assistant_status_history`
**Filters**: `assistant_id`, `account_id`
**Order**: `created_at DESC`
**Limit**: 5

```typescript
const { data: statusHistory, error } = await supabase
  .from('assistant_status_history')
  .select('id, status, error_message, created_at, metadata')
  .eq('assistant_id', assistantId)
  .eq('account_id', accountId)
  .order('created_at', { ascending: false })
  .limit(5);
```

### External Service Calls

#### Service 1: Railway WhatsApp Deployment Webhook

**Integration Point**: `/api/railway` route handler

**Payload Received**:
```typescript
interface RailwayWebhookPayload {
  status: 'SUCCESS' | 'FAILED' | 'DEPLOYING';
  service: {
    name: string; // Assistant namespace
    id: string;
  };
  error?: {
    message: string;
    code: string;
  };
}
```

**Status Mapping**:
- `SUCCESS` → `active`
- `FAILED` → `error`
- `DEPLOYING` → `configuring`

**Error Handling**:
- Retry logic: Not applicable (webhook driven)
- Fallback behavior: If webhook fails to arrive within 5 minutes, mark as `error` with timeout message
- Error message extraction: Use `payload.error.message` or generic "WhatsApp deployment failed"

**Implementation Pattern**:
```typescript
// Enhanced /api/railway route handler
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { status: statusRw, service, error: errorData } = body;

    if (statusRw === 'SUCCESS') {
      // Update to active status
      await updateAssistantStatusByNamespace(
        service.name,
        AssistantStatus.ACTIVE,
        null,
        { source: 'webhook', externalServiceId: service.id }
      );
      return NextResponse.json({ success: true }, { status: 200 });
    } else if (statusRw === 'FAILED') {
      // Update to error status
      const errorMessage = errorData?.message || 'WhatsApp deployment failed';
      await updateAssistantStatusByNamespace(
        service.name,
        AssistantStatus.ERROR,
        errorMessage,
        { source: 'webhook', externalServiceId: service.id }
      );
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }
  } catch (e) {
    console.error('Railway webhook error:', e);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

#### Service 2: Vapi Voice Assistant API

**Integration Point**: `createAssistantVoiceVapi` action

**Expected Response**:
```typescript
interface VapiCreateResponse {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  error?: string;
}
```

**Status Mapping**:
- Success → `active`
- API Error → `error`

**Error Handling**:
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Fallback behavior: Mark as `error` after retries exhausted
- Error message extraction: Parse Vapi API error response

**Implementation Pattern**:
```typescript
async function createAssistantVoiceVapi(
  accountId: string,
  name: string,
  // ... other params
) {
  'use server';

  const supabase = await createClient();

  // Create assistant record with 'configuring' status
  const { data: assistant } = await supabase
    .from('assistants')
    .insert({
      account_id: accountId,
      name,
      status: AssistantStatus.CONFIGURING,
      // ... other fields
    })
    .select()
    .single();

  try {
    // Call Vapi API with retry logic
    const vapiResponse = await retryWithBackoff(
      () => callVapiCreateAssistant({ name, /* ... */ }),
      { maxRetries: 3, initialDelay: 1000 }
    );

    // Update to active status
    await updateAssistantStatus(
      accountId,
      assistant.id,
      AssistantStatus.ACTIVE,
      null,
      { source: 'automatic', externalServiceId: vapiResponse.id }
    );

    return { success: true, assistant, vapiId: vapiResponse.id };
  } catch (error) {
    // Update to error status
    const errorMessage = error instanceof Error
      ? error.message
      : 'Voice assistant creation failed';

    await updateAssistantStatus(
      accountId,
      assistant.id,
      AssistantStatus.ERROR,
      errorMessage,
      { source: 'automatic' }
    );

    throw error;
  }
}
```

### Return Value

```typescript
// updateAssistantStatus return type
interface UpdateStatusResult {
  success: boolean;
  assistant?: {
    id: string;
    status: AssistantStatus;
    error_message: string | null;
    last_status_change: string;
  };
  history?: {
    id: string;
    created_at: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

// getAssistantStatusHistory return type
interface StatusHistoryResult {
  success: boolean;
  history?: Array<{
    id: string;
    status: AssistantStatus;
    error_message: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;
  error?: {
    message: string;
    code: string;
  };
}
```

---

## Status Transition State Machine

### Valid Transitions

```
┌─────────────┐
│ CONFIGURING │ ← Initial state for new assistants
└──────┬──────┘
       │
       ├──→ ACTIVE (deployment/activation successful)
       ├──→ ERROR (deployment/activation failed)
       └──→ INACTIVE (user cancels during configuration)

┌────────┐
│ ACTIVE │
└────┬───┘
     │
     ├──→ DISCONNECTED (external service connection lost)
     ├──→ ERROR (runtime error detected)
     ├──→ INACTIVE (user manually deactivates)
     └──→ CONFIGURING (re-deployment initiated)

┌─────────────┐
│ DISCONNECTED│
└──────┬──────┘
       │
       ├──→ ACTIVE (connection restored)
       ├──→ ERROR (reconnection attempts failed)
       └──→ INACTIVE (user deactivates)

┌───────┐
│ ERROR │
└───┬───┘
    │
    ├──→ CONFIGURING (user initiates retry)
    └──→ INACTIVE (user abandons/deletes)

┌──────────┐
│ INACTIVE │
└─────┬────┘
      │
      └──→ CONFIGURING (user re-activates)
```

### Transition Rules

```typescript
// State machine transition validator
const VALID_TRANSITIONS: Record<AssistantStatus, AssistantStatus[]> = {
  [AssistantStatus.CONFIGURING]: [
    AssistantStatus.ACTIVE,
    AssistantStatus.ERROR,
    AssistantStatus.INACTIVE,
  ],
  [AssistantStatus.ACTIVE]: [
    AssistantStatus.DISCONNECTED,
    AssistantStatus.ERROR,
    AssistantStatus.INACTIVE,
    AssistantStatus.CONFIGURING,
  ],
  [AssistantStatus.DISCONNECTED]: [
    AssistantStatus.ACTIVE,
    AssistantStatus.ERROR,
    AssistantStatus.INACTIVE,
  ],
  [AssistantStatus.ERROR]: [
    AssistantStatus.CONFIGURING,
    AssistantStatus.INACTIVE,
  ],
  [AssistantStatus.INACTIVE]: [
    AssistantStatus.CONFIGURING,
  ],
};

function isValidTransition(
  currentStatus: AssistantStatus,
  newStatus: AssistantStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

function validateStatusTransition(
  currentStatus: AssistantStatus,
  newStatus: AssistantStatus
): { valid: boolean; error?: string } {
  // Allow same-status updates (idempotent operations)
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  const isValid = isValidTransition(currentStatus, newStatus);

  if (!isValid) {
    return {
      valid: false,
      error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
    };
  }

  return { valid: true };
}
```

### Business Rules for Status Changes

1. **CONFIGURING → ACTIVE**
   - Requires: External service confirmation (webhook or API response)
   - Automatic: Yes (triggered by webhook)
   - User-initiated: No

2. **CONFIGURING → ERROR**
   - Requires: Error message describing failure
   - Automatic: Yes (on deployment failure)
   - User-initiated: No

3. **CONFIGURING → INACTIVE**
   - Requires: User confirmation
   - Automatic: No
   - User-initiated: Yes (cancel deployment)

4. **ACTIVE → DISCONNECTED**
   - Requires: Connection health check failure
   - Automatic: Yes (health monitoring)
   - User-initiated: No

5. **ACTIVE → ERROR**
   - Requires: Runtime error detection
   - Automatic: Yes (on service error)
   - User-initiated: No

6. **ACTIVE → INACTIVE**
   - Requires: User confirmation
   - Automatic: No
   - User-initiated: Yes (deactivate assistant)

7. **ERROR → CONFIGURING**
   - Requires: User initiates retry
   - Automatic: No
   - User-initiated: Yes (retry deployment)

---

## Error Handling Strategy

### Failure Points and Recovery

| Failure Point | Scenario | Recovery Action | User Message |
|--------------|----------|----------------|-------------|
| **Input Validation** | Invalid UUID format | Return validation error immediately | "Invalid assistant ID format" |
| **Authorization** | User not member of account | Return 403 Forbidden | "You don't have permission to modify this assistant" |
| **Assistant Not Found** | Assistant ID doesn't exist | Return 404 Not Found | "Assistant not found" |
| **Invalid Transition** | Attempting ERROR → ACTIVE | Reject with state machine error | "Cannot change status from Error to Active. Please reconfigure the assistant first." |
| **Database Update Failed** | Supabase update error | Log error, return 500 | "Failed to update assistant status. Please try again." |
| **History Insert Failed** | Supabase insert error | Rollback status update, return 500 | "Failed to record status change. Please try again." |
| **Webhook Processing** | Railway webhook malformed | Log error, return 400 | N/A (internal error, no UI message) |
| **External API Timeout** | Vapi API unresponsive | Retry 3x, then mark ERROR | "Voice assistant activation is taking longer than expected. Please check status in a few minutes." |
| **Concurrent Update** | Two status updates race | Last-write-wins, log conflict | "Assistant status was updated by another process" |

### Error Severity Levels

```typescript
enum ErrorSeverity {
  WARNING = 'warning',   // Recoverable, assistant may still function
  ERROR = 'error',       // Requires attention, assistant non-functional
  CRITICAL = 'critical', // System-wide issue, escalate to ops
}

interface EnhancedErrorMessage {
  message: string;
  severity: ErrorSeverity;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

**Severity Classification**:
- **WARNING**: Connection intermittent, rate limits, non-critical API failures
- **ERROR**: Deployment failed, API authentication failed, invalid configuration
- **CRITICAL**: Database connection lost, external service completely down, data corruption

### Error Propagation Pattern

```typescript
// Server action error handling pattern
export async function updateAssistantStatus(
  accountId: string,
  assistantId: string,
  newStatus: AssistantStatus,
  errorMessage?: string
): Promise<UpdateStatusResult> {
  'use server';

  try {
    // Validation layer
    const validation = validateStatusUpdateInput({ accountId, assistantId, newStatus, errorMessage });
    if (!validation.valid) {
      return {
        success: false,
        error: {
          message: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        },
      };
    }

    // Authorization layer
    const supabase = await createClient();
    const { data: accounts } = await supabase.rpc('get_accounts_for_current_user');
    const hasAccess = accounts?.some(acc => acc.account_id === accountId);

    if (!hasAccess) {
      return {
        success: false,
        error: {
          message: 'Unauthorized: Account access denied',
          code: 'UNAUTHORIZED',
        },
      };
    }

    // Business logic layer
    const { data: currentAssistant, error: fetchError } = await supabase
      .from('assistants')
      .select('id, status')
      .eq('id', assistantId)
      .eq('account_id', accountId)
      .single();

    if (fetchError || !currentAssistant) {
      return {
        success: false,
        error: {
          message: 'Assistant not found',
          code: 'NOT_FOUND',
        },
      };
    }

    // State machine validation
    const transitionCheck = validateStatusTransition(currentAssistant.status, newStatus);
    if (!transitionCheck.valid) {
      return {
        success: false,
        error: {
          message: transitionCheck.error!,
          code: 'INVALID_TRANSITION',
        },
      };
    }

    // Execute update transaction
    const updateResult = await executeStatusUpdateTransaction(
      supabase,
      accountId,
      assistantId,
      newStatus,
      errorMessage
    );

    return updateResult;

  } catch (error) {
    // Unexpected error layer
    console.error('Unexpected error in updateAssistantStatus:', error);

    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };
  }
}
```

---

## Rollback Procedures

### Scenario 1: Status Update Succeeds, History Insert Fails

**Failure Point**: After step 1 (assistant update) but before step 2 (history insert)

**Rollback Procedure**:
```typescript
async function executeStatusUpdateTransaction(
  supabase: SupabaseClient,
  accountId: string,
  assistantId: string,
  newStatus: AssistantStatus,
  errorMessage?: string
): Promise<UpdateStatusResult> {
  let previousStatus: AssistantStatus | null = null;

  try {
    // Step 0: Capture current state
    const { data: current } = await supabase
      .from('assistants')
      .select('status')
      .eq('id', assistantId)
      .single();

    previousStatus = current?.status;

    // Step 1: Update assistant status
    const { data: updated, error: updateError } = await supabase
      .from('assistants')
      .update({
        status: newStatus,
        error_message: errorMessage || null,
        last_status_change: new Date().toISOString(),
      })
      .eq('id', assistantId)
      .eq('account_id', accountId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message}`);
    }

    // Step 2: Insert history record
    const { data: history, error: historyError } = await supabase
      .from('assistant_status_history')
      .insert({
        assistant_id: assistantId,
        account_id: accountId,
        status: newStatus,
        error_message: errorMessage || null,
      })
      .select()
      .single();

    if (historyError) {
      // ROLLBACK: Revert status update
      console.error('History insert failed, rolling back status update:', historyError);

      await supabase
        .from('assistants')
        .update({
          status: previousStatus,
          error_message: null,
          last_status_change: new Date().toISOString(),
        })
        .eq('id', assistantId)
        .eq('account_id', accountId);

      throw new Error(`History insert failed: ${historyError.message}`);
    }

    return {
      success: true,
      assistant: updated,
      history,
    };

  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Transaction failed',
        code: 'TRANSACTION_ERROR',
      },
    };
  }
}
```

### Scenario 2: External Service Call Succeeds, Status Update Fails

**Failure Point**: Vapi/Railway call completes, but database update fails

**Rollback Procedure**:
- For Vapi: Call delete API to remove created assistant
- For Railway: Call webhook to cancel deployment (if API available)
- Log incident for manual review
- Return error to user with retry option

```typescript
async function createAssistantWithExternalService(
  accountId: string,
  assistantData: CreateAssistantInput
): Promise<CreateAssistantResult> {
  let externalServiceId: string | null = null;

  try {
    // Step 1: Create in external service (Vapi)
    const vapiResponse = await vapiService.createAssistant(assistantData);
    externalServiceId = vapiResponse.id;

    // Step 2: Create in database
    const supabase = await createClient();
    const { data: assistant, error: dbError } = await supabase
      .from('assistants')
      .insert({
        account_id: accountId,
        name: assistantData.name,
        status: AssistantStatus.ACTIVE,
        voice_assistant_id: externalServiceId,
        // ... other fields
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return { success: true, assistant };

  } catch (error) {
    // ROLLBACK: Delete from external service
    if (externalServiceId) {
      console.error('Database insert failed, cleaning up external service:', error);

      try {
        await vapiService.deleteAssistant(externalServiceId);
      } catch (cleanupError) {
        console.error('Failed to cleanup external service:', cleanupError);
        // Log for manual intervention
        await logIncident({
          type: 'ORPHANED_EXTERNAL_RESOURCE',
          service: 'vapi',
          resourceId: externalServiceId,
          accountId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Creation failed',
        code: 'CREATE_FAILED',
      },
    };
  }
}
```

---

## Performance Considerations

### Caching Opportunities

1. **Status History Query**:
   - Cache last 5 status changes for 30 seconds
   - Use SWR with stale-while-revalidate strategy
   - Invalidate on status update

```typescript
// Client-side caching with SWR
function useAssistantStatusHistory(assistantId: string) {
  return useSWR(
    `/api/assistants/${assistantId}/status-history`,
    fetcher,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
}
```

2. **Account Membership Check**:
   - Cache `get_accounts_for_current_user()` result for request duration
   - Use React Server Component cache (automatic in Next.js 15)

### Query Optimization Suggestions

1. **Status Update Query**:
   - Add composite index on `(account_id, id, status)` for faster lookups
   - Use `.single()` to avoid unnecessary array processing

2. **Status History Query**:
   - Add index on `(assistant_id, created_at DESC)` for fast ordered retrieval
   - Limit to 5 records to minimize data transfer

3. **Realtime Subscription**:
   - Filter at database level: `filter: account_id=eq.${accountId}`
   - Use `UPDATE` event only (ignore INSERT/DELETE for status-only changes)

### Batch Operation Possibilities

**Scenario**: Bulk status updates (e.g., mark all inactive assistants as disconnected)

```typescript
export async function bulkUpdateAssistantStatus(
  accountId: string,
  assistantIds: string[],
  newStatus: AssistantStatus,
  errorMessage?: string
): Promise<BulkUpdateResult> {
  'use server';

  const supabase = await createClient();

  // Batch update assistants
  const { data: updated, error: updateError } = await supabase
    .from('assistants')
    .update({
      status: newStatus,
      error_message: errorMessage || null,
      last_status_change: new Date().toISOString(),
    })
    .in('id', assistantIds)
    .eq('account_id', accountId)
    .select();

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Batch insert history records
  const historyRecords = updated.map(assistant => ({
    assistant_id: assistant.id,
    account_id: accountId,
    status: newStatus,
    error_message: errorMessage || null,
  }));

  await supabase
    .from('assistant_status_history')
    .insert(historyRecords);

  return { success: true, updated: updated.length };
}
```

---

## Security Checklist

- [x] **Authentication verified**: All server actions check user authentication via `createClient()`
- [x] **Account membership checked**: Explicit validation via `get_accounts_for_current_user()` RPC
- [x] **Input sanitized**: UUID format validation, status enum validation, error message length limits
- [x] **RLS policies enforced**: Database-level security for `assistants` and `assistant_status_history` tables
- [x] **Sensitive data protected**: Error messages sanitized to prevent information leakage
- [x] **SQL injection prevented**: Using Supabase query builder (parameterized queries)
- [x] **Authorization logic**: Account ownership verified before all mutations
- [x] **Rate limiting**: Consider implementing for webhook endpoints (100 requests/minute per account)

**Additional Security Measures**:

1. **Webhook Authentication**:
   - Implement HMAC signature verification for Railway webhooks
   - Use shared secret to validate webhook authenticity

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

2. **Error Message Sanitization**:
   - Strip sensitive information (API keys, internal paths) from error messages
   - Use predefined error templates for external display

---

## Testing Strategy

### Unit Tests

**Test File**: `src/lib/actions/__tests__/assistantStatus.test.ts`

#### Test Cases for Success Paths

```typescript
describe('updateAssistantStatus', () => {
  it('should update status from CONFIGURING to ACTIVE', async () => {
    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(true);
    expect(result.assistant?.status).toBe(AssistantStatus.ACTIVE);
  });

  it('should create status history record', async () => {
    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ERROR,
      'Deployment failed'
    );

    expect(result.history).toBeDefined();
    expect(result.history?.status).toBe(AssistantStatus.ERROR);
  });

  it('should allow idempotent updates (same status)', async () => {
    // First update
    await updateAssistantStatus(mockAccountId, mockAssistantId, AssistantStatus.ACTIVE);

    // Second update (same status)
    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(true);
  });
});
```

#### Test Cases for Edge Cases

```typescript
describe('updateAssistantStatus - edge cases', () => {
  it('should reject invalid status transition', async () => {
    // Set assistant to ERROR status
    await updateAssistantStatus(mockAccountId, mockAssistantId, AssistantStatus.ERROR);

    // Attempt invalid transition ERROR → ACTIVE
    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_TRANSITION');
  });

  it('should require error_message when status is ERROR', async () => {
    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ERROR
      // Missing errorMessage parameter
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('should reject updates for non-existent assistant', async () => {
    const result = await updateAssistantStatus(
      mockAccountId,
      'non-existent-id',
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('should reject updates for assistants in other accounts', async () => {
    const result = await updateAssistantStatus(
      'different-account-id',
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });
});
```

#### Test Cases for Error Scenarios

```typescript
describe('updateAssistantStatus - error handling', () => {
  it('should rollback on history insert failure', async () => {
    // Mock history insert to fail
    mockSupabaseClient.from('assistant_status_history').insert.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    });

    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(false);

    // Verify status was rolled back
    const { data: assistant } = await mockSupabaseClient
      .from('assistants')
      .select('status')
      .eq('id', mockAssistantId)
      .single();

    expect(assistant.status).toBe(AssistantStatus.CONFIGURING); // Original status
  });

  it('should handle database connection errors', async () => {
    mockSupabaseClient.from('assistants').update.mockResolvedValue({
      data: null,
      error: { message: 'Connection timeout' },
    });

    const result = await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TRANSACTION_ERROR');
  });
});
```

### Integration Tests

**Test File**: `src/lib/actions/__tests__/assistantStatusIntegration.test.ts`

```typescript
describe('Status Updates - Integration Tests', () => {
  it('should update status and trigger realtime broadcast', async () => {
    // Subscribe to realtime channel
    const realtimeCallback = jest.fn();
    supabase
      .channel(`assistants:${mockAccountId}`)
      .on('postgres_changes', { event: 'UPDATE', table: 'assistants' }, realtimeCallback)
      .subscribe();

    // Perform status update
    await updateAssistantStatus(
      mockAccountId,
      mockAssistantId,
      AssistantStatus.ACTIVE
    );

    // Wait for realtime event
    await waitFor(() => {
      expect(realtimeCallback).toHaveBeenCalled();
    });

    const eventPayload = realtimeCallback.mock.calls[0][0];
    expect(eventPayload.new.status).toBe(AssistantStatus.ACTIVE);
  });

  it('should handle Railway webhook end-to-end', async () => {
    // Create assistant in CONFIGURING state
    const assistant = await createAssistant(mockAccountId, {
      name: 'Test WhatsApp Bot',
      type: 'whatsapp',
    });

    expect(assistant.status).toBe(AssistantStatus.CONFIGURING);

    // Simulate Railway webhook callback
    const webhookResponse = await fetch('/api/railway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'SUCCESS',
        service: { name: assistant.namespace, id: 'railway-service-123' },
      }),
    });

    expect(webhookResponse.status).toBe(200);

    // Verify status updated to ACTIVE
    const { data: updatedAssistant } = await supabase
      .from('assistants')
      .select('status, activated_whatsApp')
      .eq('id', assistant.id)
      .single();

    expect(updatedAssistant.status).toBe(AssistantStatus.ACTIVE);
    expect(updatedAssistant.activated_whatsApp).toBe(true);
  });
});
```

### Data Setup/Cleanup Requirements

```typescript
// Test setup utility
async function setupTestAssistant(
  accountId: string,
  status: AssistantStatus = AssistantStatus.CONFIGURING
) {
  const supabase = createClient();

  const { data: assistant } = await supabase
    .from('assistants')
    .insert({
      account_id: accountId,
      name: 'Test Assistant',
      type_assistant: 'voice',
      namespace: `test-${Date.now()}`,
      status,
      template_id: 'test-template',
      prompt: 'Test prompt',
      temperature: 0.7,
      token: 1000,
    })
    .select()
    .single();

  return assistant;
}

// Test cleanup utility
async function cleanupTestAssistant(assistantId: string) {
  const supabase = createClient();

  // Delete history records
  await supabase
    .from('assistant_status_history')
    .delete()
    .eq('assistant_id', assistantId);

  // Delete assistant
  await supabase
    .from('assistants')
    .delete()
    .eq('id', assistantId);
}

// Test suite setup/teardown
beforeEach(async () => {
  testAssistant = await setupTestAssistant(testAccountId);
});

afterEach(async () => {
  await cleanupTestAssistant(testAssistant.id);
});
```

### Mocking Strategies for External Services

```typescript
// Mock Vapi service
jest.mock('@/services/vapiService', () => ({
  vapiService: {
    createAssistant: jest.fn().mockResolvedValue({
      id: 'vapi-assistant-123',
      status: 'active',
    }),
    deleteAssistant: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock Railway webhook
const mockRailwayWebhook = {
  success: {
    status: 'SUCCESS',
    service: { name: 'test-namespace', id: 'railway-123' },
  },
  failure: {
    status: 'FAILED',
    service: { name: 'test-namespace', id: 'railway-123' },
    error: { message: 'Deployment failed', code: 'DEPLOY_ERROR' },
  },
};
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Race Condition: Concurrent Status Updates** | Medium | Medium | Implement optimistic locking with version field; use database transactions |
| **Webhook Delivery Failure** | High | High | Implement timeout-based fallback (5-minute timeout → mark as ERROR); add webhook retry mechanism on Railway side |
| **Status History Table Growth** | High | Low | Implement retention policy: delete records older than 90 days; add scheduled cleanup job |
| **Realtime Subscription Scalability** | Low | Medium | Use account-scoped channels; implement connection pooling; monitor Supabase realtime quota |
| **External Service API Changes** | Medium | High | Version webhook API contracts; implement graceful degradation for unknown status values |
| **Database Migration Data Loss** | Low | Critical | Test migration on staging environment; add rollback SQL; backup production data before migration |
| **Invalid Status Transitions in Legacy Data** | Medium | Low | Add data migration to normalize existing statuses; implement backward compatibility for old status values |
| **Error Message Information Leakage** | Low | Medium | Sanitize error messages before storing; use predefined templates for user-facing errors |
| **Realtime Event Storms** | Low | Medium | Implement debouncing on client-side updates; rate-limit status change frequency (max 1 update per 5 seconds per assistant) |

---

## Dependencies

### Required Environment Variables

```bash
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PRIVATE_VAPI_KEY=<your-vapi-api-key>

# New variables for webhook security
RAILWAY_WEBHOOK_SECRET=<shared-secret-for-hmac-verification>

# Optional: Webhook timeout configuration
ASSISTANT_DEPLOYMENT_TIMEOUT_MS=300000  # 5 minutes
```

### External Service Availability

**Critical Dependencies**:
1. **Supabase Realtime**: Required for live status updates
   - Fallback: Poll API every 30 seconds if realtime unavailable

2. **Railway GraphQL API**: Required for WhatsApp deployment status
   - Fallback: Timeout-based error marking after 5 minutes

3. **Vapi API**: Required for voice assistant activation
   - Fallback: Retry 3x with exponential backoff, then mark ERROR

### Database Schema Requirements

**New Tables**:
- `assistant_status_history` (see Database Schema section)

**Modified Tables**:
- `assistants` table requires new columns:
  - `status` (enum: configuring, active, error, disconnected, inactive)
  - `error_message` (text, nullable)
  - `last_status_change` (timestamptz)

**New Enums**:
```sql
CREATE TYPE assistant_status AS ENUM (
  'configuring',
  'active',
  'error',
  'disconnected',
  'inactive'
);
```

**Indexes Required**:
```sql
-- For fast status lookups
CREATE INDEX idx_assistants_status ON assistants(status);

-- For account-scoped queries
CREATE INDEX idx_assistants_account_status ON assistants(account_id, status);

-- For status history queries
CREATE INDEX idx_status_history_assistant_created
ON assistant_status_history(assistant_id, created_at DESC);
```

---

## Next Steps

### Recommended Implementation Order

1. **Phase 1: Database Schema** (1-2 hours)
   - Create migration file for `assistant_status` enum
   - Add columns to `assistants` table
   - Create `assistant_status_history` table
   - Add RLS policies
   - Add indexes
   - Test migration on local Supabase instance

2. **Phase 2: Core Server Actions** (2-3 hours)
   - Implement `updateAssistantStatus` server action
   - Implement status transition state machine
   - Implement `getAssistantStatusHistory` server action
   - Implement validation utilities
   - Add unit tests

3. **Phase 3: External Service Integration** (2-3 hours)
   - Enhance `/api/railway` webhook handler
   - Update `activateWs` function to set initial status
   - Update `createAssistantVoiceVapi` to handle status
   - Implement retry logic with exponential backoff
   - Add integration tests

4. **Phase 4: Helper Functions** (1 hour)
   - Implement `updateAssistantStatusByNamespace` (for webhooks)
   - Implement `bulkUpdateAssistantStatus` (for batch operations)
   - Add error sanitization utilities

5. **Phase 5: Monitoring and Cleanup** (1 hour)
   - Add logging for status transitions
   - Implement status history retention policy (90 days)
   - Add webhook timeout monitoring
   - Create database cleanup job

### Coordination with Other Agents

**Frontend Integration (business-logic-architect)**:
- Review server action types and return values
- Ensure client-side error handling matches server error codes
- Coordinate on retry UX patterns

**Testing (backend-test-architect)**:
- Provide comprehensive test case definitions based on this plan
- Define mock strategies for external services
- Create test data fixtures

**Database Architecture (supabase-architect)**:
- Review migration SQL for optimization
- Validate RLS policies for security
- Optimize indexes for query performance

**UI Components (shadcn-ui-architect)**:
- Align status badge component with backend status enum
- Coordinate error message display patterns
- Define loading states during status transitions

---

## Database Schema Design

### New Enum Type

```sql
-- Create assistant_status enum
CREATE TYPE assistant_status AS ENUM (
  'configuring',
  'active',
  'error',
  'disconnected',
  'inactive'
);
```

### Assistants Table Modifications

```sql
-- Add status management columns to assistants table
ALTER TABLE assistants
  ADD COLUMN IF NOT EXISTS status assistant_status DEFAULT 'configuring',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistants_status
  ON assistants(status);

CREATE INDEX IF NOT EXISTS idx_assistants_account_status
  ON assistants(account_id, status);

-- Add comment for documentation
COMMENT ON COLUMN assistants.status IS 'Current operational status of the assistant';
COMMENT ON COLUMN assistants.error_message IS 'Error details when status is error';
COMMENT ON COLUMN assistants.last_status_change IS 'Timestamp of last status update';
```

### Status History Table

```sql
-- Create assistant_status_history table
CREATE TABLE assistant_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status assistant_status NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_status_history_assistant_created
  ON assistant_status_history(assistant_id, created_at DESC);

CREATE INDEX idx_status_history_account
  ON assistant_status_history(account_id);

-- Enable Row Level Security
ALTER TABLE assistant_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view status history for their assistants
CREATE POLICY "Users can view status history for their assistants"
  ON assistant_status_history
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert status history
CREATE POLICY "System can insert status history"
  ON assistant_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_user
      WHERE user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE assistant_status_history IS 'Audit trail of assistant status changes';
COMMENT ON COLUMN assistant_status_history.metadata IS 'Additional context about status change (source, external service ID, etc.)';
```

### Data Migration for Existing Assistants

```sql
-- Migrate existing assistants to new status system
-- Derive initial status from existing fields

UPDATE assistants
SET
  status = CASE
    WHEN activated_whatsApp = true THEN 'active'::assistant_status
    WHEN is_deploying_ws = true THEN 'configuring'::assistant_status
    ELSE 'inactive'::assistant_status
  END,
  last_status_change = updated_at
WHERE status IS NULL;

-- Create initial history records for existing assistants
INSERT INTO assistant_status_history (assistant_id, account_id, status, created_at)
SELECT
  id,
  account_id,
  status,
  updated_at
FROM assistants
WHERE status IS NOT NULL;
```

### Retention Policy Implementation

```sql
-- Function to cleanup old status history records
CREATE OR REPLACE FUNCTION cleanup_old_status_history()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM assistant_status_history
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Schedule cleanup job (requires pg_cron extension)
-- Run daily at 2:00 AM UTC
SELECT cron.schedule(
  'cleanup-status-history',
  '0 2 * * *',
  $$SELECT cleanup_old_status_history()$$
);
```

---

## Server Action Implementation Specifications

### File Location

**Path**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistantStatus.ts`

### Core Server Action: updateAssistantStatus

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { AssistantStatus, validateStatusUpdateInput, validateStatusTransition } from '@/types/assistants';

interface UpdateStatusMetadata {
  source?: 'webhook' | 'manual' | 'automatic';
  externalServiceId?: string;
  timestamp?: string;
}

interface UpdateStatusResult {
  success: boolean;
  assistant?: {
    id: string;
    status: AssistantStatus;
    error_message: string | null;
    last_status_change: string;
  };
  history?: {
    id: string;
    created_at: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

export async function updateAssistantStatus(
  accountId: string,
  assistantId: string,
  newStatus: AssistantStatus,
  errorMessage?: string,
  metadata?: UpdateStatusMetadata
): Promise<UpdateStatusResult> {
  try {
    // Step 1: Input validation
    const validation = validateStatusUpdateInput({
      accountId,
      assistantId,
      newStatus,
      errorMessage,
    });

    if (!validation.valid) {
      return {
        success: false,
        error: {
          message: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        },
      };
    }

    // Step 2: Authorization
    const supabase = await createClient();

    const { data: accounts, error: accountsError } = await supabase.rpc(
      'get_accounts_for_current_user'
    );

    if (accountsError || !accounts) {
      return {
        success: false,
        error: {
          message: 'Failed to verify account access',
          code: 'AUTH_ERROR',
        },
      };
    }

    const hasAccess = accounts.some(
      (acc: { account_id: string }) => acc.account_id === accountId
    );

    if (!hasAccess) {
      return {
        success: false,
        error: {
          message: 'Unauthorized: Account access denied',
          code: 'UNAUTHORIZED',
        },
      };
    }

    // Step 3: Fetch current assistant state
    const { data: currentAssistant, error: fetchError } = await supabase
      .from('assistants')
      .select('id, status, account_id')
      .eq('id', assistantId)
      .eq('account_id', accountId)
      .single();

    if (fetchError || !currentAssistant) {
      return {
        success: false,
        error: {
          message: 'Assistant not found',
          code: 'NOT_FOUND',
        },
      };
    }

    // Step 4: Validate status transition
    const transitionCheck = validateStatusTransition(
      currentAssistant.status,
      newStatus
    );

    if (!transitionCheck.valid) {
      return {
        success: false,
        error: {
          message: transitionCheck.error!,
          code: 'INVALID_TRANSITION',
        },
      };
    }

    // Step 5: Execute transaction
    return await executeStatusUpdateTransaction(
      supabase,
      accountId,
      assistantId,
      currentAssistant.status,
      newStatus,
      errorMessage,
      metadata
    );
  } catch (error) {
    console.error('Unexpected error in updateAssistantStatus:', error);
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };
  }
}

// Transaction execution helper
async function executeStatusUpdateTransaction(
  supabase: any,
  accountId: string,
  assistantId: string,
  previousStatus: AssistantStatus,
  newStatus: AssistantStatus,
  errorMessage?: string,
  metadata?: UpdateStatusMetadata
): Promise<UpdateStatusResult> {
  try {
    // Step 1: Update assistant status
    const { data: updatedAssistant, error: updateError } = await supabase
      .from('assistants')
      .update({
        status: newStatus,
        error_message: errorMessage || null,
        last_status_change: new Date().toISOString(),
      })
      .eq('id', assistantId)
      .eq('account_id', accountId)
      .select('id, status, error_message, last_status_change')
      .single();

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message}`);
    }

    // Step 2: Insert history record
    const { data: historyRecord, error: historyError } = await supabase
      .from('assistant_status_history')
      .insert({
        assistant_id: assistantId,
        account_id: accountId,
        status: newStatus,
        error_message: errorMessage || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .select('id, created_at')
      .single();

    if (historyError) {
      // Rollback: Revert status update
      console.error('History insert failed, rolling back:', historyError);

      await supabase
        .from('assistants')
        .update({
          status: previousStatus,
          error_message: null,
          last_status_change: new Date().toISOString(),
        })
        .eq('id', assistantId)
        .eq('account_id', accountId);

      throw new Error(`History insert failed: ${historyError.message}`);
    }

    return {
      success: true,
      assistant: updatedAssistant,
      history: historyRecord,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Transaction failed',
        code: 'TRANSACTION_ERROR',
      },
    };
  }
}
```

### Helper Action: updateAssistantStatusByNamespace

```typescript
// Helper for webhook callbacks that only have namespace
export async function updateAssistantStatusByNamespace(
  namespace: string,
  newStatus: AssistantStatus,
  errorMessage?: string,
  metadata?: UpdateStatusMetadata
): Promise<UpdateStatusResult> {
  try {
    const supabase = await createClient();

    // Find assistant by namespace
    const { data: assistant, error: fetchError } = await supabase
      .from('assistants')
      .select('id, account_id, status')
      .eq('namespace', namespace.replace(/^"(.*)"$/, '$1'))
      .single();

    if (fetchError || !assistant) {
      return {
        success: false,
        error: {
          message: 'Assistant not found for namespace',
          code: 'NOT_FOUND',
        },
      };
    }

    // Use main update function
    return await updateAssistantStatus(
      assistant.account_id,
      assistant.id,
      newStatus,
      errorMessage,
      metadata
    );
  } catch (error) {
    console.error('Error in updateAssistantStatusByNamespace:', error);
    return {
      success: false,
      error: {
        message: 'Failed to update status by namespace',
        code: 'INTERNAL_ERROR',
      },
    };
  }
}
```

### Query Action: getAssistantStatusHistory

```typescript
interface StatusHistoryItem {
  id: string;
  status: AssistantStatus;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface StatusHistoryResult {
  success: boolean;
  history?: StatusHistoryItem[];
  error?: {
    message: string;
    code: string;
  };
}

export async function getAssistantStatusHistory(
  accountId: string,
  assistantId: string,
  limit: number = 5
): Promise<StatusHistoryResult> {
  try {
    const supabase = await createClient();

    // Verify authorization
    const { data: accounts } = await supabase.rpc('get_accounts_for_current_user');
    const hasAccess = accounts?.some(
      (acc: { account_id: string }) => acc.account_id === accountId
    );

    if (!hasAccess) {
      return {
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      };
    }

    // Fetch history
    const { data: history, error } = await supabase
      .from('assistant_status_history')
      .select('id, status, error_message, created_at, metadata')
      .eq('assistant_id', assistantId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    // Parse metadata JSON
    const parsedHistory = history.map((item) => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null,
    }));

    return {
      success: true,
      history: parsedHistory,
    };
  } catch (error) {
    console.error('Error in getAssistantStatusHistory:', error);
    return {
      success: false,
      error: {
        message: 'Failed to retrieve status history',
        code: 'INTERNAL_ERROR',
      },
    };
  }
}
```

---

## Integration with Existing Code

### 1. Update `activateWs` Function

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistants.ts`

**Current Implementation** (line 287-315):
```typescript
const activateWs = async (
  assistant_id: string,
  service_id: string,
  urlQr: string,
  keyword_transfer_ws: string
) => {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("assistants")
      .update({
        is_deploying_ws: true,
        service_id_rw: service_id,
        qr_url: urlQr,
        keyword_transfer_ws: keyword_transfer_ws,
      })
      .eq("id", assistant_id)
      .select();

    if (error) {
      console.error("Error updating record:", error);
      return;
    }

    return data[0];
  } catch (e: any) {
    throw new Error(e.message);
  }
};
```

**Enhanced Implementation**:
```typescript
const activateWs = async (
  assistant_id: string,
  account_id: string, // Add account_id parameter
  service_id: string,
  urlQr: string,
  keyword_transfer_ws: string
) => {
  const supabase = createClient();
  try {
    // Update assistant with deployment info AND set status to configuring
    const { data, error } = await supabase
      .from("assistants")
      .update({
        is_deploying_ws: true,
        service_id_rw: service_id,
        qr_url: urlQr,
        keyword_transfer_ws: keyword_transfer_ws,
        status: AssistantStatus.CONFIGURING, // NEW: Set status
        last_status_change: new Date().toISOString(), // NEW: Track change time
      })
      .eq("id", assistant_id)
      .eq("account_id", account_id) // NEW: Multi-tenant safety
      .select();

    if (error) {
      console.error("Error updating record:", error);
      throw new Error(error.message);
    }

    // NEW: Create status history record
    await supabase
      .from('assistant_status_history')
      .insert({
        assistant_id,
        account_id,
        status: AssistantStatus.CONFIGURING,
        metadata: JSON.stringify({
          source: 'manual',
          action: 'whatsapp_deployment_initiated',
          service_id,
        }),
      });

    return data[0];
  } catch (e: any) {
    throw new Error(e.message);
  }
};
```

### 2. Update `wsStatusActiveUtil` Function

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistants.ts`

**Current Implementation** (line 317-353):
```typescript
const wsStatusActiveUtil = async (namespace: string) => {
  const supabase = createClient();

  namespace = namespace.replace(/^"(.*)"$/, "$1");

  console.log("Namespace:", namespace);

  // Verify namespace exists
  const { data: existingRecords, error: fetchError } = await supabase
    .from("assistants")
    .select("*")
    .eq("namespace", namespace);

  if (fetchError) {
    console.error("Error fetching record:", fetchError);
    return;
  }

  if (existingRecords.length === 0) {
    return;
  }

  // Update record
  const { data, error } = await supabase
    .from("assistants")
    .update({
      activated_whatsApp: true,
      is_deploying_ws: false,
    })
    .eq("namespace", namespace);

  if (error) {
    console.error("Error updating record:", error);
  } else {
    return data;
  }
};
```

**Enhanced Implementation**:
```typescript
const wsStatusActiveUtil = async (namespace: string) => {
  const supabase = createClient();

  namespace = namespace.replace(/^"(.*)"$/, "$1");

  console.log("Namespace:", namespace);

  // Verify namespace exists
  const { data: existingRecords, error: fetchError } = await supabase
    .from("assistants")
    .select("id, account_id, status") // Select only needed fields
    .eq("namespace", namespace);

  if (fetchError) {
    console.error("Error fetching record:", fetchError);
    return;
  }

  if (existingRecords.length === 0) {
    console.warn("No assistant found for namespace:", namespace);
    return;
  }

  const assistant = existingRecords[0];

  // NEW: Use updateAssistantStatus for consistent status management
  const result = await updateAssistantStatus(
    assistant.account_id,
    assistant.id,
    AssistantStatus.ACTIVE,
    null,
    {
      source: 'webhook',
      externalServiceId: namespace,
    }
  );

  if (!result.success) {
    console.error("Failed to update status:", result.error);
    return;
  }

  // Keep existing fields for backward compatibility
  const { data, error } = await supabase
    .from("assistants")
    .update({
      activated_whatsApp: true,
      is_deploying_ws: false,
    })
    .eq("namespace", namespace);

  if (error) {
    console.error("Error updating deployment flags:", error);
  }

  return data;
};
```

### 3. Update Railway Webhook Handler

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/api/railway/route.ts`

**Current Implementation**:
```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const { status: statusRw, service } = body as {
      status: string;
      service: { name: string };
    };

    console.log("Pase por aqui");
    console.log("statusRw", statusRw, "service", service);

    if (statusRw === "SUCCESS") {
      const response = await wsStatusActiveUtil(service.name);
      if (response && typeof response === "object") {
        return NextResponse.json(response, { status: 200 });
      } else {
        return NextResponse.json({ result: String(response) }, { status: 200 });
      }
    } else {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
  } catch (e) {
    console.error("Internal Server Error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

**Enhanced Implementation**:
```typescript
import { NextResponse, NextRequest } from "next/server";
import { updateAssistantStatusByNamespace } from "@/lib/actions/intelliaa/assistantStatus";
import { AssistantStatus } from "@/types/assistants";

interface RailwayWebhookPayload {
  status: 'SUCCESS' | 'FAILED' | 'DEPLOYING';
  service: {
    name: string; // namespace
    id: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: RailwayWebhookPayload = await req.json();

    const { status: statusRw, service, error: errorData } = body;

    console.log("Railway webhook received:", { status: statusRw, service });

    // Handle success case
    if (statusRw === "SUCCESS") {
      const result = await updateAssistantStatusByNamespace(
        service.name,
        AssistantStatus.ACTIVE,
        null,
        {
          source: 'webhook',
          externalServiceId: service.id,
        }
      );

      if (!result.success) {
        console.error("Failed to update status:", result.error);
        return NextResponse.json(
          { error: result.error?.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle failure case
    if (statusRw === "FAILED") {
      const errorMessage = errorData?.message || "WhatsApp deployment failed";

      const result = await updateAssistantStatusByNamespace(
        service.name,
        AssistantStatus.ERROR,
        errorMessage,
        {
          source: 'webhook',
          externalServiceId: service.id,
        }
      );

      if (!result.success) {
        console.error("Failed to update error status:", result.error);
        return NextResponse.json(
          { error: result.error?.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle deploying case (optional)
    if (statusRw === "DEPLOYING") {
      // Already in configuring state, just acknowledge
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Invalid status
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 }
    );
  } catch (e) {
    console.error("Railway webhook error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

### 4. Update Voice Assistant Creation

**File**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/assistantVoice.ts` (likely location)

**Pattern to Implement**:
```typescript
export async function createAssistantVoiceVapi(
  accountId: string,
  name: string,
  type: string,
  templateId: string,
  prompt: string,
  temperature: number,
  tokens: number,
  firstMessage: string
) {
  'use server';

  const supabase = await createClient();

  try {
    // Step 1: Create assistant in CONFIGURING state
    const { data: assistant, error: createError } = await supabase
      .from('assistants')
      .insert({
        account_id: accountId,
        name,
        type_assistant: type,
        template_id: templateId,
        prompt,
        temperature,
        token: tokens,
        namespace: `${Math.random().toString(36).substring(2, 15)}`,
        status: AssistantStatus.CONFIGURING, // NEW: Initial status
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create assistant: ${createError.message}`);
    }

    // Step 2: Create status history
    await supabase
      .from('assistant_status_history')
      .insert({
        assistant_id: assistant.id,
        account_id: accountId,
        status: AssistantStatus.CONFIGURING,
        metadata: JSON.stringify({
          source: 'manual',
          action: 'voice_assistant_creation_initiated',
        }),
      });

    // Step 3: Call Vapi API with retry logic
    try {
      const vapiResponse = await retryWithBackoff(
        async () => {
          const response = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              firstMessage,
              model: {
                provider: 'openai',
                model: 'gpt-4',
                temperature,
                maxTokens: tokens,
                systemPrompt: prompt,
              },
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Vapi API error');
          }

          return await response.json();
        },
        { maxRetries: 3, initialDelay: 1000 }
      );

      // Step 4: Update to ACTIVE status
      await updateAssistantStatus(
        accountId,
        assistant.id,
        AssistantStatus.ACTIVE,
        null,
        {
          source: 'automatic',
          externalServiceId: vapiResponse.id,
        }
      );

      // Step 5: Update voice_assistant_id
      await supabase
        .from('assistants')
        .update({ voice_assistant_id: vapiResponse.id })
        .eq('id', assistant.id);

      return { success: true, assistant, vapiId: vapiResponse.id };

    } catch (vapiError) {
      // Step 4 (error path): Update to ERROR status
      const errorMessage = vapiError instanceof Error
        ? vapiError.message
        : 'Voice assistant creation failed';

      await updateAssistantStatus(
        accountId,
        assistant.id,
        AssistantStatus.ERROR,
        errorMessage,
        {
          source: 'automatic',
        }
      );

      throw vapiError;
    }
  } catch (error) {
    console.error('Error in createAssistantVoiceVapi:', error);
    throw error;
  }
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; initialDelay: number }
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < options.maxRetries) {
        const delay = options.initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

---

## Summary

This backend business logic architecture provides a comprehensive foundation for implementing real-time status visualization for assistants in the IntelliAA platform. The design emphasizes:

1. **Transactional Integrity**: All status updates are atomic and include history tracking
2. **Multi-Tenant Security**: Account isolation enforced at every layer
3. **State Machine Validation**: Invalid transitions prevented through business rules
4. **External Service Integration**: Robust handling of WhatsApp and Voice assistant workflows
5. **Error Resilience**: Comprehensive error handling and rollback procedures
6. **Performance**: Optimized queries, caching strategies, and batch operations
7. **Testability**: Clear unit and integration test specifications

**Next Steps**: Coordinate with database architect (supabase-architect) for schema review, and backend test architect (backend-test-architect) for comprehensive test case development.
