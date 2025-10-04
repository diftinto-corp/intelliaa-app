# QA Criteria & Validation Framework: INTEL-008 - Assign Document Storage to Voice Assistant

**Feature**: Document Storage Assignment to Voice Assistants
**Epic**: Assistant Integration
**Priority**: P1 - High
**Created**: 2025-10-04
**Status**: Validation Framework Defined

---

## Executive Summary

This document defines the comprehensive QA criteria, validation framework, and quality gates for the document storage assignment feature (INTEL-008). The feature enables voice assistants to query knowledge bases by assigning document storages, creating VAPI query tools, and managing the junction table relationships. This validation framework ensures quality across backend integration (VAPI API, Supabase), frontend UX (shadcn/ui components), database integrity (RLS policies), and multi-tenant security.

**Key Quality Dimensions:**
- **Functional Correctness**: VAPI integration, junction table operations, duplicate prevention
- **Data Integrity**: Multi-tenant isolation, RLS enforcement, referential integrity
- **User Experience**: Optimistic UI, loading states, error handling, accessibility (WCAG 2.1 AA)
- **Performance**: API response times <500ms p95, optimistic UI updates
- **Security**: Authentication validation, account ownership verification, input sanitization
- **Reliability**: Rollback procedures, error recovery, partial failure handling

---

## Table of Contents

1. [Acceptance Criteria (Given-When-Then)](#1-acceptance-criteria-given-when-then)
2. [Quality Gates - Backend](#2-quality-gates---backend)
3. [Quality Gates - Frontend](#3-quality-gates---frontend)
4. [Quality Gates - Database](#4-quality-gates---database)
5. [Edge Case Scenarios & Validation Rules](#5-edge-case-scenarios--validation-rules)
6. [Performance Benchmarks](#6-performance-benchmarks)
7. [Security Validation Checklist](#7-security-validation-checklist)
8. [Rollback Criteria & Failure Scenarios](#8-rollback-criteria--failure-scenarios)
9. [Test Coverage Requirements](#9-test-coverage-requirements)
10. [Definition of Done (DoD)](#10-definition-of-done-dod)

---

## 1. Acceptance Criteria (Given-When-Then)

### AC1: Assign Document Storage to Voice Assistant

**Given** I am an authenticated user with a voice assistant and an available document storage in my account
**When** I select the document storage and click "Assign" in the assistant's storage management UI
**Then** the system should:
- Validate that both assistant and storage belong to my account (RLS enforced)
- Check for duplicate assignment (idempotent operation)
- Retrieve the VAPI knowledge base ID linked to the document storage
- Fetch the current VAPI assistant configuration via API
- Create a query tool configuration with sanitized tool name (alphanumeric + underscore, max 40 chars)
- Update the VAPI assistant by adding the query tool to the `tools` array
- Insert a record into `document_storage-assistants` junction table
- Display success toast notification with storage name
- Refresh the UI to show the newly assigned storage in the list

**Success Criteria:**
- Junction table record created with unique constraint validated
- VAPI assistant has new query tool in tools array
- UI shows assigned storage with "Assigned X ago" timestamp
- No error messages displayed

**Error Scenarios:**
- If storage has no VAPI KB: Show error "Este almacenamiento no tiene una base de conocimientos VAPI configurada."
- If VAPI API fails: Show error "Error al comunicarse con el servicio de voz. Intenta nuevamente."
- If database insert fails: Rollback VAPI update, show error "Error al guardar la asignación."

---

### AC2: VAPI Query Tool Configuration

**Given** a document storage is successfully assigned to a voice assistant
**When** the VAPI query tool is created
**Then** the tool configuration should:
- Have `type: 'knowledgeBase'`
- Have `knowledgeBaseId` matching the VAPI KB ID from `vapi_knowledge_bases` table
- Have `function.name` sanitized from storage name (e.g., "My Documents" → "my_documents")
- Have `function.description` containing the storage name (e.g., "Search My Documents knowledge base")
- Be appended to the existing `tools` array (not replacing existing tools)

**Validation:**
- Query VAPI API: `GET /assistant/{voice_assistant_id}` and verify tool exists in response
- Verify tool name is unique across assistant's tools (no naming conflicts)
- Verify tool name max length is 40 characters

---

### AC3: Assistant Retrieves Information from Knowledge Base

**Given** a document storage with uploaded documents is assigned to a voice assistant
**When** a user asks the assistant a question about the document content during a call
**Then** the assistant should:
- Query the VAPI knowledge base via the query tool
- Retrieve relevant chunks from the document storage
- Include the retrieved information in the response
- Cite the source document if possible

**Testing Approach:**
- Use VAPI test call feature with a known question about document content
- Verify the response contains information from the documents
- Check VAPI logs to confirm knowledge base was queried

**Note:** This is an integration test with VAPI's RAG functionality. If retrieval fails, verify:
- VAPI KB has files uploaded (check `vapi_knowledge_bases` table and VAPI dashboard)
- Query tool configuration is correct
- Documents are properly embedded in VAPI

---

### AC4: Multiple Storage Assignment

**Given** a voice assistant with one document storage already assigned
**When** I assign an additional document storage
**Then** the assistant should:
- Have multiple query tools in the VAPI configuration (one per storage)
- Be able to query across all assigned storages during calls
- Display all assigned storages in the UI list

**Validation:**
- Fetch VAPI assistant config and verify `tools` array has multiple `knowledgeBase` tools
- Each tool should have a unique `knowledgeBaseId`
- Junction table should have multiple records for the assistant

**Edge Case:**
- If assistant has >5 storages, show warning: "Este asistente tiene muchos almacenamientos asignados. Esto podría afectar el rendimiento."

---

### AC5: Junction Table Record Creation

**Given** a storage assignment operation completes successfully
**When** the system creates the junction table record
**Then** the record should:
- Be inserted into `document_storage-assistants` table
- Have `assistant` FK pointing to the assistant UUID
- Have `document_storage` FK pointing to the storage UUID
- Have `created_at` timestamp set to current time
- Respect the unique constraint on (assistant, document_storage)

**Validation Queries:**
```sql
-- Verify record exists
SELECT * FROM "document_storage-assistants"
WHERE assistant = '{assistant_id}'
AND document_storage = '{storage_id}';

-- Verify unique constraint (should fail on duplicate insert)
INSERT INTO "document_storage-assistants" (assistant, document_storage)
VALUES ('{assistant_id}', '{storage_id}');
-- Expected: ERROR: duplicate key value violates unique constraint
```

---

### AC6: Duplicate Assignment Prevention (Idempotency)

**Given** a document storage is already assigned to a voice assistant
**When** I attempt to assign the same storage again
**Then** the system should:
- Detect the existing assignment via pre-check query
- Return success status with message: "Este almacenamiento ya está asignado al asistente"
- NOT create a duplicate junction table record
- NOT add a duplicate query tool to VAPI

**Validation:**
- Call assignment action twice with same parameters
- Verify only one junction table record exists
- Verify VAPI assistant has only one query tool for that storage

---

### AC7: Error Handling - VAPI API Failure

**Given** the VAPI API is unavailable or returns an error during assignment
**When** the system attempts to update the assistant configuration
**Then** the system should:
- NOT create the junction table record (abort operation)
- Display error message to user: "Error al actualizar el asistente de voz. Intenta nuevamente."
- Log the error with context (assistant ID, storage ID, error details)
- Implement retry logic with exponential backoff (1s, 2s, 4s delays, max 3 attempts)

**Error Scenarios:**
- **401 Unauthorized**: Invalid VAPI API key → Log critical error, show "Error de configuración del servicio. Contacta soporte."
- **404 Not Found**: Assistant deleted externally → Show "Asistente no encontrado o sin acceso"
- **500 Server Error**: VAPI downtime → Retry with backoff, show "El servicio de voz está tardando más de lo esperado."
- **Timeout (>30s)**: Network issue → Retry with backoff

---

### AC8: Unassign Document Storage

**Given** a document storage is assigned to a voice assistant
**When** I click "Unassign" and confirm in the AlertDialog
**Then** the system should:
- Fetch the current VAPI assistant configuration
- Identify the query tool by matching `knowledgeBaseId` with the storage's VAPI KB ID
- Remove the matching tool from the `tools` array
- Update the VAPI assistant with the filtered tools array
- Delete the record from `document_storage-assistants` junction table
- Display success toast: "Almacenamiento '[Storage Name]' desasignado correctamente"
- Refresh the UI to remove the storage from the assigned list

**Validation:**
- Query VAPI API and verify tool is removed from `tools` array
- Query junction table and verify record is deleted
- Other query tools should remain intact (no accidental deletion)

**Error Scenario:**
- If VAPI update fails: Abort operation, show error, do NOT delete junction record

---

## 2. Quality Gates - Backend

### 2.1 Server Actions Quality Gate

**File**: `/src/lib/actions/intelliaa/documentStorageAssignment.ts`

#### Quality Criteria:

1. **Input Validation** (MUST PASS)
   - All UUIDs validated using regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
   - Required parameters checked (assistantId, documentStorageId, accountId)
   - Return descriptive error if validation fails

2. **Authentication & Authorization** (MUST PASS)
   - User session verified via `await createClient()` → `auth.getUser()`
   - Account ownership validated for assistant (RLS + explicit check)
   - Account ownership validated for storage (RLS + explicit check)
   - Cross-account assignment blocked (assistant in account A, storage in account B)

3. **Duplicate Prevention** (MUST PASS)
   - Pre-check query for existing assignment before VAPI update
   - Return idempotent success if duplicate detected
   - Unique constraint on junction table prevents race conditions

4. **Error Handling** (MUST PASS)
   - All try-catch blocks log errors with context
   - User-friendly error messages returned (Spanish, no stack traces)
   - Server-side errors logged to console with `[INTEL-008]` prefix

5. **Transaction Safety** (CRITICAL)
   - VAPI update executed BEFORE database insert (order matters)
   - If VAPI succeeds and DB fails: Rollback VAPI update (remove tool)
   - If VAPI fails: Abort early, no DB changes
   - Rollback procedures tested in integration tests

#### Quality Gate Checklist:

- [ ] All inputs validated before processing
- [ ] Authentication verified (user session exists)
- [ ] Authorization validated (account ownership for both resources)
- [ ] Duplicate detection implemented and tested
- [ ] VAPI API errors handled with retry logic
- [ ] Database errors handled gracefully
- [ ] Rollback procedures implemented for partial failures
- [ ] All error messages are user-friendly (Spanish)
- [ ] Logging includes sufficient context for debugging
- [ ] Server actions marked with `'use server'` directive

#### Acceptance Threshold:
- **Zero unhandled errors** in server actions
- **100% code coverage** for error handling paths
- **All validation rules** enforced before external API calls

---

### 2.2 VAPI Integration Quality Gate

**Service**: VAPI API calls in server actions

#### Quality Criteria:

1. **API Client Configuration** (MUST PASS)
   - VAPI API key from environment variable `NEXT_PRIVATE_VAPI_KEY`
   - Base URL: `https://api.vapi.ai`
   - Authorization header: `Bearer ${NEXT_PRIVATE_VAPI_KEY}`
   - Content-Type: `application/json`
   - Timeout: 30 seconds

2. **Query Tool Creation** (MUST PASS)
   - Tool type: `knowledgeBase`
   - Knowledge base ID from `vapi_knowledge_bases.vapi_kb_id`
   - Tool name sanitized: alphanumeric + underscore only, max 40 chars
   - Tool description includes storage name
   - Tool appended to existing tools array (not replaced)

3. **API Response Validation** (MUST PASS)
   - Verify 2xx status code before processing response
   - Parse JSON response safely (handle malformed JSON)
   - Validate response contains expected fields (`id`, `tools`)

4. **Retry Logic** (MUST PASS)
   - Exponential backoff: 1s, 2s, 4s delays
   - Max 3 retry attempts for transient errors (500, 503, timeout)
   - No retry for client errors (400, 401, 404)

5. **Error Classification** (MUST PASS)
   - **Retryable**: 500, 503, network timeout
   - **Non-retryable**: 400, 401, 404, 409
   - **Critical**: 401 (API key invalid) → Alert administrators

#### Quality Gate Checklist:

- [ ] VAPI API key configured and validated
- [ ] API client handles all HTTP status codes appropriately
- [ ] Tool name sanitization prevents injection attacks
- [ ] Retry logic implemented with exponential backoff
- [ ] Response validation prevents processing invalid data
- [ ] Tool merging preserves existing tools (no data loss)
- [ ] API errors logged with full context (request/response)

#### Acceptance Threshold:
- **API call success rate ≥99%** under normal conditions
- **Retry logic reduces transient error impact by ≥80%**
- **Zero data loss** from accidental tool array replacement

---

### 2.3 Database Operations Quality Gate

**Table**: `document_storage-assistants` junction table

#### Quality Criteria:

1. **Data Integrity** (MUST PASS)
   - Foreign key `assistant` references `assistants.id` (valid UUID)
   - Foreign key `document_storage` references `document_storages.id` (valid UUID)
   - Unique constraint on (assistant, document_storage) enforced
   - No orphaned records (cascading delete if assistant/storage deleted)

2. **RLS Policies** (CRITICAL)
   - SELECT policy: User can only see assignments for assistants in their accounts
   - INSERT policy: User can only assign storages they own to assistants they own
   - DELETE policy: User can only delete assignments for their own assistants
   - Policy enforcement tested with multi-account scenarios

3. **Query Performance** (MUST PASS)
   - Index on (assistant, document_storage) for unique constraint (provides fast lookups)
   - Index on assistant for foreign key queries
   - Index on document_storage for foreign key queries
   - Queries complete in <50ms for junction table operations

#### Quality Gate Checklist:

- [ ] Foreign key constraints validated (prevent orphaned records)
- [ ] Unique constraint prevents duplicates
- [ ] RLS policies tested with multi-user scenarios
- [ ] Indexes created for optimal query performance
- [ ] Cascading delete configured (if assistant deleted, remove assignments)
- [ ] Database migrations tested (up and down migrations)

#### Acceptance Threshold:
- **Zero orphaned records** in junction table
- **RLS policies block 100%** of unauthorized access attempts
- **Query performance <50ms** for all junction table operations

---

## 3. Quality Gates - Frontend

### 3.1 UI Component Quality Gate

**Components**: AssignStorageSection, StorageSelectionCombobox, AssignedStorageCard

#### Quality Criteria:

1. **State Management** (MUST PASS)
   - Optimistic UI updates for assignment/unassignment
   - Rollback on error (restore previous state)
   - Loading states shown during async operations
   - No state inconsistencies between UI and backend

2. **User Feedback** (MUST PASS)
   - Toast notifications for success/error
   - Loading spinners during operations
   - Disabled states prevent double-submission
   - Error messages are user-friendly and actionable

3. **Data Fetching** (MUST PASS)
   - Available storages fetched and filtered (exclude assigned)
   - Assigned storages fetched from junction table with joins
   - Data refreshed after assignment/unassignment
   - Real-time updates via Supabase subscriptions (optional enhancement)

4. **Component Integration** (MUST PASS)
   - Components integrated into `TabAssistantVoice.tsx`
   - Props passed correctly from parent to children
   - Event handlers trigger correct server actions
   - UI reflects backend state accurately

#### Quality Gate Checklist:

- [ ] Optimistic updates implemented with rollback on error
- [ ] Toast notifications shown for all user actions
- [ ] Loading states prevent multiple submissions
- [ ] Error states display actionable messages
- [ ] Data fetching logic filters correctly (no duplicates)
- [ ] UI updates reflect backend changes accurately
- [ ] Components render without hydration mismatches

#### Acceptance Threshold:
- **Zero UI state inconsistencies** after operations
- **User feedback displayed within 100ms** of action
- **All loading states prevent race conditions**

---

### 3.2 Accessibility (WCAG 2.1 AA) Quality Gate

#### Quality Criteria:

1. **Keyboard Navigation** (MUST PASS)
   - All interactive elements keyboard accessible (Tab, Enter, Escape)
   - Combobox navigable with arrow keys
   - AlertDialog focus trap when open
   - Logical tab order (top to bottom, left to right)

2. **Screen Reader Support** (MUST PASS)
   - All buttons have `aria-label` or visible text
   - Combobox has `role="combobox"` and `aria-expanded`
   - AlertDialog announces title and description
   - Loading states announced via `aria-live="polite"` regions
   - Error messages associated with form fields via `aria-describedby`

3. **Color Contrast** (MUST PASS)
   - All text meets 4.5:1 contrast ratio (normal text)
   - Large text meets 3:1 contrast ratio
   - Primary color (#14B8A6) tested against backgrounds
   - Destructive actions use high-contrast red

4. **Focus Management** (MUST PASS)
   - Focus indicators visible (ring-2 ring-ring)
   - Dialog returns focus to trigger on close
   - No focus traps except in modals

#### Quality Gate Checklist:

- [ ] Lighthouse accessibility score ≥95
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader announces all state changes
- [ ] Color contrast tested with WebAIM tool (all pass)
- [ ] Focus indicators visible on all elements
- [ ] Focus management correct for dialogs/modals
- [ ] ARIA attributes correct and complete

#### Acceptance Threshold:
- **Lighthouse accessibility score ≥95**
- **Zero keyboard navigation issues**
- **All screen reader tests pass** (NVDA, VoiceOver)
- **Color contrast ratio ≥4.5:1** for all text

---

### 3.3 Responsive Design Quality Gate

#### Quality Criteria:

1. **Mobile (< 640px)** (MUST PASS)
   - Cards stack vertically
   - Buttons full-width
   - Combobox popover full viewport width
   - Touch targets ≥44x44px

2. **Tablet (640px - 1024px)** (MUST PASS)
   - 2-column grid for assigned storages
   - Side-by-side action buttons
   - Wider combobox popover

3. **Desktop (> 1024px)** (MUST PASS)
   - 3-column grid for assigned storages (if many)
   - Fixed-width combobox popover (400px)
   - Hover states enabled

#### Quality Gate Checklist:

- [ ] Mobile layout tested on iPhone 12/13/14
- [ ] Tablet layout tested on iPad
- [ ] Desktop layout tested on 1920x1080 screen
- [ ] Touch targets meet minimum size (44x44px)
- [ ] Horizontal scrolling avoided on all breakpoints
- [ ] Text remains readable at all viewport sizes

#### Acceptance Threshold:
- **All breakpoints render correctly** without overflow
- **Touch targets ≥44x44px** on mobile
- **No horizontal scrolling** on any device

---

### 3.4 Dark/Light Mode Quality Gate

#### Quality Criteria:

1. **Theme Integration** (MUST PASS)
   - All colors use CSS variables (hsl(var(--primary)))
   - No hardcoded colors (except transparent)
   - Cards use `bg-card` and `text-card-foreground`
   - Borders use `border-border`

2. **Hydration Safety** (CRITICAL)
   - Theme-dependent rendering uses `mounted` state
   - Skeleton shown on initial render (avoids mismatch)
   - No flash of unstyled content (FOUC)

3. **Visual Testing** (MUST PASS)
   - All states tested in dark mode
   - Icons have proper opacity (0.7 for muted)
   - Badge colors adapt (bg-primary/10 pattern)
   - Contrast maintained in both modes

#### Quality Gate Checklist:

- [ ] All colors use CSS variables
- [ ] No hydration mismatches in dark/light mode
- [ ] Dark mode contrast tested (WebAIM)
- [ ] Icons visible in both modes
- [ ] No FOUC on theme toggle
- [ ] Skeleton loading matches final component structure

#### Acceptance Threshold:
- **Zero hydration errors** related to theming
- **Color contrast ≥4.5:1** in both dark and light modes
- **No visual glitches** on theme toggle

---

## 4. Quality Gates - Database

### 4.1 RLS Policy Validation

**Policies**: `document_storage-assistants` table policies

#### Quality Criteria:

1. **SELECT Policy** (MUST PASS)
   - User can only see assignments for assistants they have access to
   - Account isolation enforced via `account_user` membership check
   - Cross-account data leakage prevented

2. **INSERT Policy** (MUST PASS)
   - User can only assign storages they own to assistants they own
   - Both assistant and storage must belong to user's account
   - Validation via subqueries to assistants and document_storages tables

3. **DELETE Policy** (MUST PASS)
   - User can only delete assignments for assistants in their accounts
   - Cascading delete if assistant/storage deleted
   - Orphaned records cleaned up automatically

#### RLS Test Scenarios:

| Scenario | Expected Result |
|----------|----------------|
| User A assigns storage A to assistant A (same account) | ✅ Success |
| User A assigns storage B to assistant A (storage in account B) | ❌ Blocked by INSERT policy |
| User A views assignments for assistant B (different account) | ❌ Blocked by SELECT policy (0 rows returned) |
| User A deletes assignment for assistant A (same account) | ✅ Success |
| User A deletes assignment for assistant B (different account) | ❌ Blocked by DELETE policy |
| Assistant deleted → assignments cascaded | ✅ Junction records auto-deleted |
| Storage deleted → assignments cascaded | ✅ Junction records auto-deleted |

#### Quality Gate Checklist:

- [ ] RLS policies tested with multi-account setup (≥3 accounts)
- [ ] Cross-account access blocked (100% isolation)
- [ ] Cascading deletes configured and tested
- [ ] Policy performance tested (no N+1 queries)
- [ ] All policies use indexes (no full table scans)

#### Acceptance Threshold:
- **100% account isolation** (zero data leakage)
- **Zero orphaned records** after deletions
- **RLS policy queries <50ms** with proper indexes

---

### 4.2 Data Integrity Validation

#### Quality Criteria:

1. **Foreign Key Constraints** (MUST PASS)
   - `assistant` FK references valid assistant UUID
   - `document_storage` FK references valid storage UUID
   - Invalid UUIDs rejected (constraint violation)
   - Orphaned records prevented by cascading delete

2. **Unique Constraint** (MUST PASS)
   - Combination (assistant, document_storage) is unique
   - Duplicate assignment prevented at database level
   - Race conditions handled (concurrent inserts blocked)

3. **Referential Integrity** (MUST PASS)
   - Junction records always reference existing entities
   - Deleted assistants/storages cascade to junction table
   - No dangling references

#### Data Integrity Test Scenarios:

| Test Case | Expected Result |
|-----------|----------------|
| Insert assignment with invalid assistant UUID | ❌ FK constraint violation |
| Insert assignment with invalid storage UUID | ❌ FK constraint violation |
| Insert duplicate assignment | ❌ Unique constraint violation |
| Delete assistant → check junction table | ✅ Assignment record auto-deleted |
| Delete storage → check junction table | ✅ Assignment record auto-deleted |
| Concurrent duplicate inserts (race condition) | ❌ One succeeds, one fails with unique constraint error |

#### Quality Gate Checklist:

- [ ] Foreign key constraints enforced (no invalid references)
- [ ] Unique constraint prevents duplicates (100% effectiveness)
- [ ] Cascading deletes configured for assistant and storage
- [ ] Race conditions handled by unique constraint
- [ ] Database schema migration tested (up/down)

#### Acceptance Threshold:
- **Zero orphaned records** in junction table
- **100% referential integrity** maintained
- **Unique constraint blocks all duplicates** (including race conditions)

---

### 4.3 Query Performance Validation

#### Quality Criteria:

1. **Index Coverage** (MUST PASS)
   - Unique index on (assistant, document_storage)
   - Index on assistant for FK queries
   - Index on document_storage for FK queries
   - Indexes used by RLS policies

2. **Query Execution Time** (MUST PASS)
   - SELECT assignments for assistant: <50ms
   - INSERT assignment: <100ms
   - DELETE assignment: <50ms
   - Join queries (with assistants/storages): <100ms

3. **Query Plan Analysis** (MUST PASS)
   - No full table scans (seq scan)
   - Indexes used for all WHERE clauses
   - JOIN operations use indexes
   - RLS policies use indexes (no performance penalty)

#### Performance Test Scenarios:

| Query | Expected Execution Time | Index Used |
|-------|------------------------|-----------|
| `SELECT * FROM "document_storage-assistants" WHERE assistant = $1` | <50ms | assistant index |
| `SELECT * FROM "document_storage-assistants" WHERE assistant = $1 AND document_storage = $2` | <50ms | unique index |
| `INSERT INTO "document_storage-assistants" (...)` | <100ms | unique index (duplicate check) |
| `DELETE FROM "document_storage-assistants" WHERE id = $1` | <50ms | primary key index |
| Join query with assistants and storages | <100ms | FK indexes |

#### Quality Gate Checklist:

- [ ] All indexes created in migration
- [ ] Query plans analyzed with EXPLAIN ANALYZE
- [ ] No full table scans in production queries
- [ ] Performance tested with ≥1000 junction records
- [ ] RLS policies do not degrade performance (verified with EXPLAIN)

#### Acceptance Threshold:
- **All queries complete <100ms** (p95)
- **100% index usage** for WHERE and JOIN clauses
- **Zero full table scans** in production queries

---

## 5. Edge Case Scenarios & Validation Rules

### 5.1 Assignment Edge Cases

| Edge Case | Expected Behavior | Validation Method |
|-----------|------------------|-------------------|
| **Assign storage without VAPI KB** | Error: "Este almacenamiento no tiene una base de conocimientos VAPI configurada." | Query `vapi_knowledge_bases` table, return error if null |
| **Assign to assistant with 0 existing tools** | Success: Create first query tool, tools array = [newTool] | Verify VAPI response has tools array with single item |
| **Assign to assistant with 10+ existing tools** | Warning (but allow): "Este asistente tiene muchas herramientas asignadas." | Check tools.length > 10, log warning, proceed |
| **Assign with extremely long storage name (>100 chars)** | Success: Tool name sanitized and truncated to 40 chars | Verify tool name length ≤40 in VAPI config |
| **Assign when VAPI assistant deleted externally** | Error: VAPI 404 → "Asistente no encontrado en el servicio de voz." | Handle 404 response, log data inconsistency |
| **Assign during VAPI service downtime** | Retry 3x with backoff, then error: "El servicio de voz no está disponible." | Mock VAPI timeout, verify retry logic |
| **Concurrent assignment attempts (2 users)** | One succeeds, one gets duplicate message (idempotent) | Simulate concurrent server action calls |
| **Assign with special characters in storage name** | Success: Name sanitized (e.g., "My Docs!" → "my_docs") | Verify tool name matches regex `^[a-z0-9_]+$` |
| **Assign when user loses account access mid-operation** | Error: RLS blocks operation, user sees "Sin acceso" | Revoke account membership during operation |

---

### 5.2 Unassignment Edge Cases

| Edge Case | Expected Behavior | Validation Method |
|-----------|------------------|-------------------|
| **Unassign non-existent assignment** | Error: "Asignación no encontrada" | Query junction table, return 404 if not found |
| **Unassign when VAPI assistant deleted externally** | Success: Delete junction record anyway (data cleanup) | Handle VAPI 404 gracefully, proceed with DB delete |
| **Unassign when VAPI API fails** | Warning logged, but delete junction record (user requested it) | Mock VAPI error, verify DB delete proceeds |
| **Unassign when storage already deleted** | Success: Remove junction record (orphan cleanup) | Soft-delete storage, verify unassignment still works |
| **Unassign last storage from assistant** | Success: Assistant has empty tools array or no knowledgeBase tools | Verify VAPI config has tools.length = 0 or no KB tools |
| **Unassign with multiple tools (preserve others)** | Success: Only remove matching tool, others remain | Verify other tools intact in VAPI config |

---

### 5.3 VAPI Integration Edge Cases

| Edge Case | Expected Behavior | Validation Method |
|-----------|------------------|-------------------|
| **VAPI returns malformed JSON** | Error: "Error al procesar respuesta del servicio de voz." | Mock invalid JSON response, verify error handling |
| **VAPI returns 401 (invalid API key)** | Critical error logged, user sees "Error de configuración del servicio. Contacta soporte." | Mock 401 response, verify critical log entry |
| **VAPI returns 409 (tool name conflict)** | Retry with randomized tool name suffix (e.g., "my_docs_a7f3") | Mock 409 response, verify retry with new name |
| **VAPI rate limit hit (429)** | Exponential backoff, queue request for background retry | Mock 429 response, verify backoff logic |
| **Tool name collision (same storage assigned twice with different KB)** | Unique constraint prevents, but tool names differ (kb_id suffix) | Attempt duplicate with different KB IDs |
| **VAPI assistant has legacy `knowledgeBase` config (not tools array)** | Migration scenario: Convert to tools array or show migration notice | Check for legacy config, handle gracefully |

---

### 5.4 Database Edge Cases

| Edge Case | Expected Behavior | Validation Method |
|-----------|------------------|-------------------|
| **Database connection lost during insert** | Rollback VAPI update, show error to user | Simulate connection drop, verify rollback |
| **Unique constraint violation (race condition)** | Handle gracefully, return "already assigned" message | Concurrent inserts via parallel server action calls |
| **Junction record orphaned (assistant deleted without cascade)** | Should not happen: Cascade delete configured in schema | Verify ON DELETE CASCADE in migration |
| **RLS policy blocks insert but VAPI succeeds** | Critical: Rollback VAPI update immediately | Mock RLS failure, verify rollback |
| **Transaction timeout (>30s)** | Rollback entire operation, show timeout error | Mock slow DB query, verify timeout handling |

---

### 5.5 UI/UX Edge Cases

| Edge Case | Expected Behavior | Validation Method |
|-----------|------------------|-------------------|
| **User clicks "Assign" multiple times (double-submit)** | Button disabled after first click, subsequent clicks ignored | Test rapid clicking, verify single request |
| **Optimistic update fails (backend rejects)** | Rollback UI state, show error, restore original list | Mock backend failure, verify UI rollback |
| **User navigates away during operation** | Operation continues, toast shown when complete (or lost) | Navigate away mid-operation, verify behavior |
| **Storage deleted while assignment dialog open** | Error on submit: "Almacenamiento no encontrado" | Delete storage in another tab, submit assignment |
| **Assistant deleted while viewing assignments** | Error on any action: "Asistente no encontrado" | Delete assistant in another tab, attempt operation |
| **Combobox search with no results** | Show empty state: "No se encontraron almacenamientos" | Search for non-existent storage name |
| **Assigned list with >20 storages** | Pagination or virtualized list (performance) | Load 50+ storages, verify performance |
| **Dark mode toggle during operation** | No visual glitches, operation completes normally | Toggle theme mid-operation |

---

## 6. Performance Benchmarks

### 6.1 Backend Performance

| Operation | Metric | Threshold | Measurement Method |
|-----------|--------|-----------|-------------------|
| **assignDocumentStorageToVoiceAssistant()** | Response time (p95) | <500ms | Server action timing logs |
| **VAPI API call (GET assistant)** | Response time (p95) | <200ms | HTTP request timing |
| **VAPI API call (PATCH assistant)** | Response time (p95) | <300ms | HTTP request timing |
| **Database query (check duplicate)** | Execution time | <50ms | Supabase query timing |
| **Database insert (junction table)** | Execution time | <100ms | Supabase query timing |
| **unassignDocumentStorageFromVoiceAssistant()** | Response time (p95) | <400ms | Server action timing logs |
| **Database delete (junction table)** | Execution time | <50ms | Supabase query timing |

**Performance Test Methodology:**
1. Use Artillery or k6 for load testing (50 concurrent users)
2. Measure p50, p95, p99 latencies
3. Monitor VAPI API response times with logging middleware
4. Use Supabase slow query log for database performance
5. Test under production-like conditions (network latency, DB load)

**Acceptance Criteria:**
- p95 latency <500ms for assignment operations
- p99 latency <1000ms for assignment operations
- Zero timeout errors under 50 concurrent users
- Database queries complete in <100ms (p95)

---

### 6.2 Frontend Performance

| Metric | Threshold | Measurement Method |
|--------|-----------|-------------------|
| **Optimistic UI update** | <100ms perceived latency | User perceives instant response |
| **Data fetching (available storages)** | <300ms | React DevTools Profiler |
| **Data fetching (assigned storages)** | <200ms | React DevTools Profiler |
| **Combobox search (filter)** | <50ms | Client-side filtering, useMemo |
| **Component render time** | <50ms | React DevTools Profiler |
| **Toast notification display** | <100ms after action | Visual timing test |
| **Skeleton to content transition** | <300ms | Lighthouse performance score |

**Frontend Benchmarks:**
- **Lighthouse Performance Score**: ≥90
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Cumulative Layout Shift (CLS)**: <0.1
- **Time to Interactive (TTI)**: <3.5s

**Optimization Techniques:**
- Memoize filtered storage lists with `useMemo`
- Debounce search input (300ms)
- Virtual scrolling for >100 storages (`@tanstack/react-virtual`)
- Lazy load assigned storages when section in viewport (`useInView`)

---

### 6.3 API Rate Limiting & Caching

**VAPI API Rate Limits** (assumed, verify with VAPI docs):
- 100 requests/minute per API key
- Burst: 20 requests/second

**Mitigation Strategies:**
1. **Caching**: Cache VAPI assistant configs for 5 minutes (reduce redundant API calls)
2. **Batch Operations**: If assigning multiple storages, batch VAPI update (single API call)
3. **Exponential Backoff**: On 429 rate limit, wait 1s, 2s, 4s, 8s before retry
4. **Queue System**: For high-concurrency scenarios, queue assignment requests

**Caching Strategy:**
```typescript
// Cache VAPI assistant config (in-memory or Redis)
const cacheKey = `vapi_assistant_${voiceAssistantId}`;
const cachedConfig = await cache.get(cacheKey);

if (cachedConfig && cacheAge < 5 * 60 * 1000) { // 5 min TTL
  return cachedConfig;
}

const freshConfig = await fetchVapiAssistant(voiceAssistantId);
await cache.set(cacheKey, freshConfig, { ttl: 300 }); // 5 min
return freshConfig;
```

---

## 7. Security Validation Checklist

### 7.1 Authentication & Authorization

- [ ] **User Authentication Verified**
  - Server actions check `auth.getUser()` before processing
  - Unauthenticated users receive 401 error
  - Session validation via Supabase middleware

- [ ] **Account Ownership Validated**
  - Assistant belongs to user's account (RLS + explicit query)
  - Storage belongs to user's account (RLS + explicit query)
  - Cross-account assignment blocked (tested with multi-account setup)

- [ ] **Role-Based Access Control (if applicable)**
  - Team members with "member" role can assign storages
  - Team members with "owner" role can assign/unassign
  - Guest users (if exists) cannot assign (tested)

---

### 7.2 Input Validation & Sanitization

- [ ] **UUID Validation**
  - All UUIDs validated with regex before database queries
  - Invalid UUIDs rejected early (before external API calls)

- [ ] **Tool Name Sanitization**
  - Storage name sanitized to alphanumeric + underscore only
  - Special characters removed (prevent injection: `<script>`, `; DROP TABLE`)
  - Max length enforced (40 chars)
  - Regex: `^[a-z0-9_]+$`

- [ ] **SQL Injection Prevention**
  - Parameterized queries used (Supabase client prevents SQL injection)
  - No raw SQL with user input
  - ORM/query builder validates all inputs

- [ ] **XSS Prevention**
  - Storage names sanitized before rendering in UI
  - React escapes all user-generated content automatically
  - No `dangerouslySetInnerHTML` used

---

### 7.3 Data Protection & Privacy

- [ ] **Sensitive Data Protection**
  - VAPI API key stored in server-side env variable (NEXT_PRIVATE_VAPI_KEY)
  - API key never exposed to client (verified in network tab)
  - No sensitive data in client-side logs

- [ ] **Multi-Tenant Isolation**
  - RLS policies enforce account-based isolation (100% tested)
  - Cross-account data leakage prevented (verified with security tests)
  - Junction table records scoped to account_id

- [ ] **Audit Logging**
  - All assignment/unassignment operations logged with user context
  - Logs include: user_id, account_id, assistant_id, storage_id, timestamp
  - Logs stored securely (no PII in plain text logs)

---

### 7.4 API Security

- [ ] **VAPI API Key Security**
  - API key rotation procedure documented
  - Invalid API key (401) triggers critical alert
  - API key not committed to version control (.env.local in .gitignore)

- [ ] **Request Validation**
  - Server actions validate all request parameters
  - Malformed requests rejected before processing
  - Rate limiting on server actions (prevent abuse)

- [ ] **CSRF Protection**
  - Next.js server actions include CSRF protection
  - SameSite cookie attribute set (Supabase cookies)

---

### 7.5 Error Handling Security

- [ ] **Error Message Sanitization**
  - No stack traces exposed to client
  - Error messages user-friendly, not revealing internals
  - Detailed errors logged server-side only

- [ ] **Fail-Safe Defaults**
  - On error, deny access (fail closed, not open)
  - Partial failures rolled back (no partial state)
  - Critical errors alert administrators

---

## 8. Rollback Criteria & Failure Scenarios

### 8.1 Rollback Scenarios

#### Scenario 1: VAPI Update Succeeds, Database Insert Fails

**Sequence:**
1. ✅ VAPI assistant updated (query tool added to tools array)
2. ❌ Database insert to `document_storage-assistants` fails (constraint violation, connection loss)

**Rollback Procedure:**
```typescript
// Pseudocode
try {
  const vapiResult = await updateVapiAssistant(voiceAssistantId, newTools);
  if (!vapiResult.ok) throw new Error('VAPI update failed');

  const dbResult = await supabase
    .from('document_storage-assistants')
    .insert({ assistant: assistantId, document_storage: storageId });

  if (dbResult.error) {
    // ROLLBACK: Remove tool from VAPI
    console.error('[INTEL-008] DB insert failed, rolling back VAPI');

    const currentAssistant = await getVapiAssistant(voiceAssistantId);
    const rollbackTools = currentAssistant.tools.filter(
      tool => !(tool.type === 'knowledgeBase' && tool.knowledgeBaseId === vapiKbId)
    );

    await updateVapiAssistant(voiceAssistantId, rollbackTools);

    throw new Error('DB insert failed, VAPI rolled back');
  }
} catch (error) {
  return { status: 'error', message: 'Error al guardar la asignación.' };
}
```

**Verification:**
- Query VAPI API: Verify tool is removed (tools array matches pre-assignment state)
- Query database: Verify no junction record exists
- User sees error: "Error al guardar la asignación. Por favor, intenta nuevamente."

---

#### Scenario 2: VAPI Update Fails (Abort Early)

**Sequence:**
1. ❌ VAPI assistant update fails (network error, VAPI downtime, 500 error)

**Rollback Procedure:**
- Abort operation immediately
- No database insert attempted
- No rollback needed (no state change)

**Verification:**
- Query database: Verify no junction record created
- User sees error: "Error al actualizar el asistente de voz. Intenta nuevamente."

---

#### Scenario 3: Rollback Fails (Critical Error)

**Sequence:**
1. ✅ VAPI update succeeds
2. ❌ Database insert fails
3. ❌ VAPI rollback fails (VAPI API unavailable)

**Recovery Procedure:**
- Log critical error with full context (assistant_id, storage_id, vapi_kb_id)
- Alert administrators via monitoring system (e.g., Sentry, Slack webhook)
- Manual intervention required:
  - Manually remove tool from VAPI via dashboard
  - Or run reconciliation job to detect and fix mismatches

**Critical Error Log:**
```
[INTEL-008 CRITICAL] VAPI rollback failed after DB insert error
- Assistant ID: {assistant_id}
- Storage ID: {storage_id}
- VAPI KB ID: {vapi_kb_id}
- Rollback Error: {error_message}
- Action Required: Manually remove tool from VAPI assistant {voice_assistant_id}
```

---

### 8.2 Failure Detection

**Health Checks:**
1. **Database Connectivity**: Ping Supabase on app start
2. **VAPI API Availability**: Heartbeat check every 5 minutes
3. **Data Consistency**: Reconciliation job (nightly)
   - Query junction table and VAPI API
   - Detect mismatches (junction record exists but tool missing, or vice versa)
   - Log discrepancies for review

**Monitoring Alerts:**
- **VAPI 401 errors**: Alert immediately (API key invalid)
- **Rollback failures**: Alert immediately (requires manual intervention)
- **High error rate (>5% of operations)**: Alert within 5 minutes
- **VAPI API downtime (>5 min)**: Alert and display system status to users

---

### 8.3 Emergency Rollback Criteria

**Criteria to Trigger Full Rollback (Stop All Assignment Operations):**

1. **VAPI API Downtime >30 minutes**
   - Disable assignment feature in UI (show maintenance notice)
   - Queue operations for retry when service recovers

2. **Database Corruption Detected**
   - Lock junction table (prevent writes)
   - Restore from backup
   - Reconcile with VAPI state

3. **Data Inconsistency >10% of Records**
   - Pause assignment operations
   - Run reconciliation job to identify root cause
   - Fix inconsistencies before resuming

4. **Security Vulnerability Discovered**
   - Disable feature immediately
   - Audit logs for exploitation
   - Deploy security patch before re-enabling

**Rollback Execution:**
1. Feature flag: `FEATURE_STORAGE_ASSIGNMENT_ENABLED=false`
2. UI displays: "La asignación de almacenamientos está temporalmente deshabilitada para mantenimiento."
3. Investigate root cause
4. Deploy fix
5. Re-enable feature with gradual rollout (10% → 50% → 100% of users)

---

## 9. Test Coverage Requirements

### 9.1 Unit Tests

**File**: `/src/lib/actions/intelliaa/documentStorageAssignment.test.ts`

**Coverage Target**: ≥90% line coverage, ≥80% branch coverage

**Test Cases:**

#### assignDocumentStorageToVoiceAssistant()
1. ✅ **Valid Assignment**
   - Given: Valid assistant, storage, account IDs
   - When: Assignment action called
   - Then: Junction record created, VAPI tool added, success returned

2. ✅ **Duplicate Assignment (Idempotency)**
   - Given: Storage already assigned
   - When: Assignment action called again
   - Then: Success returned with "already assigned" message, no duplicate record

3. ❌ **Non-Existent Assistant**
   - Given: Invalid assistant ID
   - When: Assignment action called
   - Then: Error "Asistente no encontrado"

4. ❌ **Non-Existent Storage**
   - Given: Invalid storage ID
   - When: Assignment action called
   - Then: Error "Almacenamiento de documentos no encontrado"

5. ❌ **Cross-Account Assignment**
   - Given: Assistant in account A, storage in account B
   - When: Assignment action called
   - Then: Blocked by RLS or validation, error returned

6. ❌ **No VAPI KB for Storage**
   - Given: Storage has no VAPI knowledge base
   - When: Assignment action called
   - Then: Error "Este almacenamiento no tiene una base de conocimientos VAPI configurada."

7. ❌ **VAPI API Failure**
   - Given: VAPI API returns 500 error
   - When: Assignment action called
   - Then: Retry logic triggered, error returned after max retries

8. ❌ **Database Insert Failure**
   - Given: VAPI update succeeds, DB insert fails
   - When: Assignment action called
   - Then: VAPI rolled back, error returned

9. ✅ **Tool Name Sanitization**
   - Given: Storage name "My Docs! @2024"
   - When: Assignment action called
   - Then: Tool name = "my_docs_2024"

10. ✅ **Long Storage Name (>100 chars)**
    - Given: Storage name with 150 characters
    - When: Assignment action called
    - Then: Tool name truncated to 40 chars

#### unassignDocumentStorageFromVoiceAssistant()
1. ✅ **Valid Unassignment**
   - Given: Storage assigned to assistant
   - When: Unassignment action called
   - Then: Junction record deleted, VAPI tool removed, success returned

2. ❌ **Non-Existent Assignment**
   - Given: Storage not assigned to assistant
   - When: Unassignment action called
   - Then: Error "Asignación no encontrada"

3. ✅ **Unassign with Multiple Tools**
   - Given: Assistant has 3 query tools
   - When: Unassignment action called for one
   - Then: Only that tool removed, other 2 tools remain

4. ✅ **VAPI Failure During Unassignment**
   - Given: VAPI API unavailable
   - When: Unassignment action called
   - Then: Warning logged, junction record deleted anyway

#### Helper Functions
1. ✅ **sanitizeToolName()**
   - Input: "My Docs! @2024" → Output: "my_docs_2024"
   - Input: "Test__Name" → Output: "test_name"
   - Input: "A".repeat(60) → Output: 40 char string

---

### 9.2 Integration Tests

**File**: `/tests/integration/documentStorageAssignment.test.ts`

**Coverage Target**: All critical flows tested with mocked external services

**Test Cases:**

1. ✅ **End-to-End Assignment Flow**
   - Mock: Supabase client, VAPI API
   - Flow: Assign → Verify DB record → Verify VAPI tool
   - Assert: Junction record exists, VAPI has tool

2. ✅ **Rollback Scenario (VAPI Succeeds, DB Fails)**
   - Mock: VAPI API (success), Supabase client (insert fails)
   - Flow: Trigger assignment, simulate DB error
   - Assert: VAPI rollback called, tool removed

3. ✅ **Concurrent Duplicate Assignment**
   - Mock: Supabase client
   - Flow: Two parallel assignment calls for same storage
   - Assert: One succeeds, one gets duplicate message

4. ✅ **Multiple Storage Assignment**
   - Mock: VAPI API, Supabase client
   - Flow: Assign 3 storages to same assistant
   - Assert: 3 junction records, 3 query tools in VAPI

5. ✅ **Assignment After Storage Deletion**
   - Mock: Supabase client (storage query returns null)
   - Flow: Attempt assignment
   - Assert: Error "Almacenamiento de documentos no encontrado"

---

### 9.3 E2E Tests (Playwright)

**File**: `/e2e/documentStorageAssignment.spec.ts`

**Coverage Target**: All user workflows tested in real browser

**Test Cases:**

1. ✅ **User Assigns Storage to Assistant**
   - Setup: Login, navigate to assistant page
   - Action: Open combobox, select storage, confirm
   - Assert: Success toast displayed, storage appears in assigned list

2. ✅ **User Unassigns Storage from Assistant**
   - Setup: Assign storage first
   - Action: Click "Unassign", confirm in AlertDialog
   - Assert: Success toast displayed, storage removed from list

3. ✅ **Duplicate Assignment Prevented**
   - Setup: Assign storage
   - Action: Attempt to assign same storage again
   - Assert: "Already assigned" message displayed

4. ✅ **Optimistic UI Rollback on Error**
   - Setup: Mock server action to fail
   - Action: Assign storage
   - Assert: Optimistic update shown, then rolled back with error toast

5. ✅ **Loading States Displayed**
   - Setup: Mock slow server action (2s delay)
   - Action: Assign storage
   - Assert: Loading spinner shown, button disabled during operation

6. ✅ **Keyboard Navigation**
   - Setup: Navigate to assistant page
   - Action: Tab to combobox, press Enter, use arrow keys, press Enter to select
   - Assert: Storage assigned without mouse

7. ✅ **Screen Reader Announces State Changes**
   - Setup: Enable screen reader (e.g., VoiceOver)
   - Action: Assign storage
   - Assert: Screen reader announces "Asignando almacenamiento..." → "Almacenamiento asignado correctamente"

8. ✅ **Responsive Design (Mobile)**
   - Setup: Resize browser to 375px width
   - Action: Assign/unassign storage
   - Assert: UI renders correctly, touch targets ≥44x44px

---

### 9.4 Mock Strategies

**Supabase Client Mock:**
```typescript
// Jest mock
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => ({ data: { user: mockUser }, error: null }))
    },
    from: jest.fn((table) => ({
      select: jest.fn(() => ({ /* mock query builder */ })),
      insert: jest.fn(() => ({ /* mock insert */ })),
      delete: jest.fn(() => ({ /* mock delete */ }))
    }))
  }))
}));
```

**VAPI API Mock:**
```typescript
// MSW (Mock Service Worker)
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('https://api.vapi.ai/assistant/:id', (req, res, ctx) => {
    return res(ctx.json({ id: req.params.id, tools: [] }));
  }),
  rest.patch('https://api.vapi.ai/assistant/:id', (req, res, ctx) => {
    return res(ctx.json({ id: req.params.id, tools: req.body.tools }));
  })
);
```

---

## 10. Definition of Done (DoD)

### 10.1 Backend Implementation

- [ ] Server actions implemented:
  - [ ] `assignDocumentStorageToVoiceAssistant()`
  - [ ] `unassignDocumentStorageFromVoiceAssistant()`
- [ ] Input validation implemented for all parameters
- [ ] VAPI integration implemented with retry logic
- [ ] Rollback procedures implemented for partial failures
- [ ] Error handling implemented for all scenarios
- [ ] Logging implemented with `[INTEL-008]` prefix
- [ ] All backend quality gates passed
- [ ] Unit tests written (≥90% coverage)
- [ ] Integration tests written (all critical flows)
- [ ] Code reviewed and approved

---

### 10.2 Frontend Implementation

- [ ] UI components implemented:
  - [ ] `AssignStorageSection.tsx`
  - [ ] `StorageSelectionCombobox.tsx`
  - [ ] `AssignedStoragesList.tsx`
  - [ ] `AssignedStorageCard.tsx`
- [ ] Optimistic UI updates implemented
- [ ] Loading states implemented (skeletons, spinners)
- [ ] Empty states implemented (no storages, no assignments)
- [ ] Error states implemented (network errors, validation errors)
- [ ] Toast notifications implemented (success, error)
- [ ] Components integrated into `TabAssistantVoice.tsx`
- [ ] All frontend quality gates passed
- [ ] Accessibility tested (WCAG 2.1 AA compliance)
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Dark/light mode tested (no hydration issues)
- [ ] E2E tests written (all user workflows)
- [ ] Code reviewed and approved

---

### 10.3 Database Implementation

- [ ] Junction table `document_storage-assistants` created
- [ ] Foreign key constraints configured
- [ ] Unique constraint on (assistant, document_storage) enforced
- [ ] Cascading delete configured (if assistant/storage deleted)
- [ ] Indexes created for performance
- [ ] RLS policies implemented and tested
- [ ] Database migration tested (up and down)
- [ ] All database quality gates passed
- [ ] Query performance validated (<100ms p95)
- [ ] Data integrity tests passed (100% referential integrity)

---

### 10.4 Security & Compliance

- [ ] Authentication verified (user session required)
- [ ] Authorization validated (account ownership for both resources)
- [ ] Input sanitization implemented (tool names, UUIDs)
- [ ] RLS policies enforced (100% account isolation)
- [ ] VAPI API key secured (server-side only, not exposed to client)
- [ ] Audit logging implemented (all operations logged)
- [ ] Error messages sanitized (no stack traces to client)
- [ ] Security validation checklist completed
- [ ] Penetration testing performed (if applicable)

---

### 10.5 Performance & Reliability

- [ ] Performance benchmarks met:
  - [ ] Assignment operation <500ms (p95)
  - [ ] Unassignment operation <400ms (p95)
  - [ ] Database queries <100ms (p95)
  - [ ] VAPI API calls <300ms (p95)
- [ ] Load testing performed (50 concurrent users)
- [ ] Optimistic UI perceived latency <100ms
- [ ] Lighthouse performance score ≥90
- [ ] No performance regressions detected

---

### 10.6 Documentation & Knowledge Transfer

- [ ] User documentation updated (if needed)
- [ ] Technical documentation updated:
  - [ ] Server action signatures documented (JSDoc)
  - [ ] VAPI integration flow documented
  - [ ] Rollback procedures documented
  - [ ] Error codes documented for frontend
- [ ] Architecture diagrams updated (if needed)
- [ ] Runbook created for operations team
- [ ] Knowledge transfer session completed (if needed)

---

### 10.7 Testing & Validation

- [ ] Unit tests written and passing (≥90% coverage)
- [ ] Integration tests written and passing
- [ ] E2E tests written and passing
- [ ] Accessibility tests passing (WCAG 2.1 AA)
- [ ] Responsive design tests passing (mobile, tablet, desktop)
- [ ] Dark/light mode tests passing (no hydration issues)
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari)
- [ ] Edge case scenarios tested and validated
- [ ] Rollback scenarios tested
- [ ] Manual QA performed by QA team
- [ ] Regression testing completed (no existing features broken)

---

### 10.8 Deployment & Monitoring

- [ ] Feature flag implemented (if gradual rollout planned)
- [ ] Monitoring alerts configured:
  - [ ] VAPI API errors (401, 500, timeout)
  - [ ] Rollback failures (critical alerts)
  - [ ] High error rate (>5% of operations)
- [ ] Logging dashboards created (assignment/unassignment metrics)
- [ ] Deployment plan reviewed and approved
- [ ] Rollback plan documented and tested
- [ ] Production deployment successful
- [ ] Post-deployment smoke tests passed

---

### 10.9 Sign-Off

- [ ] Product Owner approves feature
- [ ] QA team approves quality
- [ ] Security team approves (if applicable)
- [ ] Operations team ready to support
- [ ] All acceptance criteria validated
- [ ] All quality gates passed
- [ ] Definition of Done checklist completed

---

## Appendix A: Risk Assessment Matrix

| Risk | Likelihood | Impact | Severity | Mitigation Strategy |
|------|-----------|--------|----------|---------------------|
| **VAPI API Downtime During Assignment** | Medium | High | **CRITICAL** | 1. Implement retry logic with exponential backoff (1s, 2s, 4s)<br>2. Queue failed operations for background retry<br>3. Display maintenance notice if VAPI down >30 min<br>4. Monitor VAPI status with heartbeat checks |
| **Database and VAPI Out of Sync** | Low | High | **HIGH** | 1. Order operations correctly (VAPI first, DB second)<br>2. Implement comprehensive rollback on failures<br>3. Reconciliation job (nightly) to detect mismatches<br>4. Alert on data inconsistencies |
| **Tool Name Collisions** | Very Low | Medium | **LOW** | 1. Unique constraint prevents DB duplicates<br>2. Sanitize tool names consistently<br>3. Add random suffix on VAPI 409 conflict<br>4. Pre-check for duplicate assignments |
| **VAPI Assistant Deleted Externally** | Low | Medium | **MEDIUM** | 1. Handle 404 responses gracefully<br>2. Mark assistant as "orphaned" in DB<br>3. Show user-friendly error message<br>4. Admin dashboard to detect orphaned records |
| **User Assigns Too Many Storages** | Medium | Low | **LOW** | 1. Soft limit: Warn at 3+ storages<br>2. Hard limit: Block at 10+ storages (optional)<br>3. UI displays warning about performance<br>4. Monitor assistant performance metrics |
| **VAPI API Key Rotation Breaks Operations** | Very Low | Critical | **CRITICAL** | 1. Monitor for 401 errors (alert immediately)<br>2. Document key rotation procedure<br>3. Test key rotation in staging environment<br>4. Graceful degradation (queue ops if key invalid) |
| **Race Condition (Concurrent Duplicates)** | Low | Low | **LOW** | 1. Unique constraint handles DB-level duplicates<br>2. Pre-check reduces likelihood<br>3. Handle constraint errors gracefully<br>4. Return "already assigned" on duplicate |
| **Long Tool Names Exceed VAPI Limits** | Low | Medium | **MEDIUM** | 1. Sanitize and truncate to 40 chars max<br>2. Add random suffix if conflict detected<br>3. Validate tool name length before VAPI call<br>4. Test with edge case storage names |
| **Rollback Failures (VAPI Unavailable)** | Low | High | **HIGH** | 1. Log critical error with full context<br>2. Alert administrators immediately<br>3. Manual intervention procedure documented<br>4. Reconciliation job detects issues |
| **Cross-Account Data Leakage** | Very Low | Critical | **CRITICAL** | 1. RLS policies enforced on all tables<br>2. Explicit account ownership validation<br>3. Security testing with multi-account setup<br>4. Penetration testing if applicable |

**Risk Severity Levels:**
- **CRITICAL**: Immediate action required, blocks release
- **HIGH**: Must be addressed before release
- **MEDIUM**: Should be addressed, can be deferred to next release
- **LOW**: Monitor, address if pattern emerges

---

## Appendix B: Monitoring & Observability

### Key Metrics to Track

**Operational Metrics:**
1. **Assignment Success Rate**: (Successful assignments / Total attempts) × 100
   - Target: ≥98%
   - Alert: <95%

2. **Unassignment Success Rate**: (Successful unassignments / Total attempts) × 100
   - Target: ≥99%
   - Alert: <97%

3. **VAPI API Latency**: p50, p95, p99 response times
   - Target: p95 <300ms
   - Alert: p95 >500ms

4. **Database Query Latency**: p50, p95, p99 execution times
   - Target: p95 <100ms
   - Alert: p95 >200ms

5. **Rollback Frequency**: Number of rollbacks per day
   - Target: <5 per day
   - Alert: >10 per day

**Error Metrics:**
1. **VAPI API Error Rate**: (VAPI errors / Total VAPI calls) × 100
   - Target: <2%
   - Alert: >5%

2. **Database Error Rate**: (DB errors / Total DB operations) × 100
   - Target: <1%
   - Alert: >3%

3. **Validation Error Rate**: (Validation errors / Total attempts) × 100
   - Target: <5% (user errors expected)
   - Alert: >10% (indicates UX issue)

**Business Metrics:**
1. **Storages Assigned per Day**: Count of successful assignments
2. **Active Assistants with Storages**: Count of assistants with ≥1 storage assigned
3. **Average Storages per Assistant**: Total assignments / Total assistants
4. **Storage Assignment Adoption**: (Assistants with storages / Total assistants) × 100

### Alerting Rules

**Critical Alerts (Immediate Response):**
- VAPI 401 errors (invalid API key)
- Rollback failures (data inconsistency risk)
- RLS policy bypass detected (security breach)
- Database connection loss >5 minutes

**High Priority Alerts (Response within 30 min):**
- VAPI error rate >5%
- Database error rate >3%
- Assignment success rate <95%
- VAPI API downtime >15 minutes

**Medium Priority Alerts (Response within 2 hours):**
- Performance degradation (p95 >500ms)
- High rollback frequency (>10/day)
- Data inconsistency detected by reconciliation job

### Dashboards

**Operations Dashboard:**
- Assignment/unassignment success rates (last 24h, 7d, 30d)
- VAPI API latency (p50, p95, p99)
- Database query latency (p50, p95, p99)
- Error rates by category (VAPI, DB, validation)
- Rollback frequency

**Business Dashboard:**
- Storages assigned per day (trend chart)
- Active assistants with storages (gauge)
- Average storages per assistant (KPI)
- Top 10 most-assigned storages
- Storage assignment adoption rate (funnel)

---

## Appendix C: Troubleshooting Guide

### Common Issues & Solutions

**Issue 1: "Este almacenamiento no tiene una base de conocimientos VAPI configurada."**

**Cause**: Document storage has no linked VAPI knowledge base record in `vapi_knowledge_bases` table.

**Solution:**
1. Verify VAPI KB feature is enabled: `NEXT_PUBLIC_USE_VAPI_KB='true'`
2. Check if storage has VAPI files uploaded (query `document_storages` table)
3. If missing, create VAPI KB via INTEL-002 service:
   ```typescript
   await createVapiKnowledgeBase(storageId, storageName, accountId);
   ```
4. Retry assignment after KB creation

---

**Issue 2: "Error al comunicarse con el servicio de voz. Intenta nuevamente."**

**Cause**: VAPI API is unavailable, network timeout, or rate limit hit.

**Solution:**
1. Check VAPI status: https://status.vapi.ai (if available)
2. Verify VAPI API key is valid:
   ```bash
   curl -H "Authorization: Bearer $NEXT_PRIVATE_VAPI_KEY" https://api.vapi.ai/assistant/{id}
   ```
3. Check server logs for detailed error (401, 500, timeout)
4. If rate limited (429), wait and retry after backoff period
5. If VAPI downtime >30 min, enable maintenance mode

---

**Issue 3: "Error al guardar la asignación. Por favor, intenta nuevamente."**

**Cause**: Database insert failed after VAPI update succeeded (rollback triggered).

**Solution:**
1. Check database connection (Supabase status)
2. Verify unique constraint not violated (query junction table)
3. Check server logs for rollback success/failure
4. If rollback failed (critical error), manually remove tool from VAPI:
   - VAPI Dashboard → Assistant → Tools → Delete query tool
5. If issue persists, check RLS policies (may be blocking insert)

---

**Issue 4: Storage appears assigned in UI but assistant can't query it**

**Cause**: Data inconsistency between junction table and VAPI configuration.

**Solution:**
1. Query junction table for assignment record:
   ```sql
   SELECT * FROM "document_storage-assistants"
   WHERE assistant = '{assistant_id}' AND document_storage = '{storage_id}';
   ```
2. Query VAPI API for assistant tools:
   ```bash
   curl -H "Authorization: Bearer $NEXT_PRIVATE_VAPI_KEY" \
     https://api.vapi.ai/assistant/{voice_assistant_id}
   ```
3. If junction record exists but tool missing in VAPI:
   - Manually re-assign storage (will recreate tool)
   - Or run reconciliation job to auto-fix
4. If tool exists but junction record missing:
   - Delete junction record (data cleanup)
   - Re-assign storage properly

---

**Issue 5: Optimistic UI update doesn't rollback on error**

**Cause**: Frontend state management bug, error not caught, or toast notification failed.

**Solution:**
1. Check browser console for JavaScript errors
2. Verify server action returns proper error status:
   ```typescript
   { status: 'error', message: '...' }
   ```
3. Verify optimistic update rollback logic:
   ```typescript
   setAssignedStorages(prev => prev.filter(a => a.id !== optimisticId));
   setAvailableStorages(prev => [...prev, storage]);
   ```
4. Check toast notification is triggered on error:
   ```typescript
   toast({ title: "Error", description: error.message, variant: "destructive" });
   ```

---

**Issue 6: "Asistente no encontrado o sin acceso"**

**Cause**: Assistant deleted, user lost account access, or RLS policy blocking.

**Solution:**
1. Verify assistant exists in database:
   ```sql
   SELECT * FROM assistants WHERE id = '{assistant_id}';
   ```
2. Verify user has account access:
   ```sql
   SELECT * FROM account_user WHERE user_id = '{user_id}' AND account_id = '{account_id}';
   ```
3. If assistant deleted, inform user (show "Assistant no longer exists" message)
4. If account access revoked, redirect to account selection page
5. If RLS issue, check policy definitions and user session

---

## Appendix D: Integration with Existing Codebase

### Files to Modify

**Server Actions:**
- **Create**: `/src/lib/actions/intelliaa/documentStorageAssignment.ts` (new file)
  - Functions: `assignDocumentStorageToVoiceAssistant()`, `unassignDocumentStorageFromVoiceAssistant()`

**UI Components:**
- **Create**: `/src/components/intelliaa/assistants/voice/AssignStorageSection.tsx` (new file)
- **Create**: `/src/components/intelliaa/assistants/voice/StorageSelectionCombobox.tsx` (new file)
- **Create**: `/src/components/intelliaa/assistants/voice/AssignedStoragesList.tsx` (new file)
- **Create**: `/src/components/intelliaa/assistants/voice/AssignedStorageCard.tsx` (new file)
- **Modify**: `/src/components/intelliaa/assistants/voice/TabAssistantVoice.tsx`
  - Add import: `import { AssignStorageSection } from './AssignStorageSection';`
  - Add new tab or section for storage assignment

**TypeScript Interfaces:**
- **Modify**: `/src/interfaces/intelliaa/documentStorage.ts`
  - Add interfaces: `AssignedStorage`, `StorageAssignmentResponse`

**Database Migration:**
- **Create**: Supabase migration file (if junction table not exists)
- **Verify**: Foreign key constraints, unique constraint, RLS policies

**Environment Variables:**
- **Verify**: `NEXT_PRIVATE_VAPI_KEY` is set
- **Verify**: `NEXT_PUBLIC_USE_VAPI_KB` is set (if using KB feature)

### Breaking Changes

**None**: This is a new feature, no breaking changes to existing functionality.

**Compatibility Notes:**
- If legacy `docs_keys` array exists in `assistants` table, this feature uses new junction table instead
- Migration path: Optionally create junction records for existing `docs_keys` assignments

---

## Appendix E: Next.js 15 & React 19 Specific Validations

### Next.js 15 Async API Compliance

**Server Actions:**
- [ ] All server actions use `'use server'` directive
- [ ] `createClient()` is awaited: `const supabase = await createClient();`
- [ ] No server-only functions imported in Client Components (cookies, headers, revalidatePath)

**Component Patterns:**
- [ ] Client Components marked with `"use client"` directive
- [ ] Server Components use async/await for data fetching
- [ ] Props passed from Server to Client Components are serializable (no functions)

### React 19 Hydration Safety

**Theme Handling:**
- [ ] Theme-dependent rendering uses `mounted` state
- [ ] Skeleton component structure matches actual component
- [ ] No hydration mismatches in dark/light mode

**Example:**
```typescript
export function AssignStorageSection({ ... }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <AssignStorageSectionSkeleton />;
  }

  return (
    // Actual component
  );
}
```

**Ref Types:**
- [ ] `useRef` typed correctly: `useRef<HTMLElement>(null)` (not `useRef<HTMLElement>()`)
- [ ] `RefObject` types accept `| null` where needed

---

## Summary

This QA criteria and validation framework provides comprehensive quality gates across all dimensions of the document storage assignment feature. Implementation teams should use this document as a checklist throughout development, testing, and deployment phases.

**Key Takeaways:**
- **Backend**: VAPI integration with rollback procedures is critical for data consistency
- **Frontend**: Optimistic UI with proper error handling ensures great UX
- **Database**: RLS policies and unique constraints enforce multi-tenant security
- **Performance**: All operations must complete in <500ms (p95) for acceptable UX
- **Security**: 100% account isolation and input sanitization are non-negotiable
- **Testing**: ≥90% code coverage with unit, integration, and E2E tests required

**Validation Process:**
1. ✅ All acceptance criteria pass (Given-When-Then scenarios)
2. ✅ All quality gates pass (backend, frontend, database)
3. ✅ All edge cases validated
4. ✅ Performance benchmarks met
5. ✅ Security checklist completed
6. ✅ Rollback procedures tested
7. ✅ Test coverage requirements met
8. ✅ Definition of Done checklist completed

**Success Metrics:**
- Assignment success rate ≥98%
- VAPI API latency p95 <300ms
- Database query latency p95 <100ms
- Lighthouse accessibility score ≥95
- Zero account isolation breaches
- Zero unhandled errors in production

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Maintained By**: QA Criteria Validator Agent
**Review Cycle**: After each major implementation milestone
