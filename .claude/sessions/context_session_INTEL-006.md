# Context Session: INTEL-006 - Delete PDF from Storage

## Feature Overview
Implement PDF document deletion from storage with complete cleanup across all systems (Pinecone vectors, VAPI files, database records).

## User Story
As a user, I want to delete individual PDF documents from a storage, so that I can remove outdated or incorrect information from my knowledge base.

## Initial Analysis

### Current System State
- Documents are stored in `pdf_docs` table
- Vectors are stored in Pinecone with ID pattern: `{pdfDocId}-chunk-{index}`
- Files are managed in VAPI knowledge base
- Document storages can contain multiple PDFs

### Key Requirements
1. Delete confirmation dialog before deletion
2. Remove vectors from Pinecone namespace
3. Delete file from VAPI and update knowledge base
4. Delete database record from `pdf_docs`
5. Handle last document deletion (trigger storage deletion)
6. Proper error handling for partial failures
7. UI updates and feedback

### Technical Dependencies
- VAPI Knowledge Base Service (INTEL-002)
- Pinecone Service (INTEL-003) - needs list/delete by prefix capability
- Document storage creation (INTEL-004/INTEL-005)
- Related to storage deletion (INTEL-007)

### Files to Review/Modify
- `src/lib/actions/intelliaa/documents.ts` - Server action for deletion
- Document storage detail page (frontend)
- Pinecone service for vector operations
- VAPI service for file deletion

## Implementation Plan Status
- [x] Phase 1: Planning and architecture review
- [x] Phase 2: Implementation
- [ ] Phase 3: QA validation and iteration

## Subagents Consultation Plan
1. **backend-business-logic-architect**: Review deletion flow and error handling strategy ✅ COMPLETED
2. **shadcn-ui-architect**: Plan confirmation dialog and UI updates ✅ COMPLETED
3. **qa-criteria-validator**: Final validation of acceptance criteria

---

## Backend Business Logic Architecture Analysis

### Business Logic Analysis: Delete PDF Document from Storage

#### Overview
This operation handles the complete deletion of a PDF document from a document storage, including cleanup across Pinecone vector store, VAPI file system, VAPI knowledge base, and Supabase database. The operation must handle the special case where deleting the last document triggers complete storage deletion.

---

### Architecture Plan

#### Operation Flow

1. **Pre-Deletion Validation**
   - Validate input parameters (documentStorageId, pdfDocId, vapiFileId, namespace)
   - Verify user authentication and account access
   - Acquire deletion lock to prevent concurrent deletions
   - Fetch document and storage metadata from database
   - Check if this is the last document in storage

2. **Last Document Detection**
   - Query `pdf_docs` table for count: `SELECT COUNT(*) FROM pdf_docs WHERE document_storage_id = ?`
   - Query `qa_docs` table for count (non-PDF documents)
   - If total count === 1, mark as last document deletion
   - If last document: delegate to `deleteAllDocumentStorageById()`

3. **Vector Deletion from Pinecone (INTEL-003)**
   - Use document ID as prefix: `{pdfDocId}-chunk-*`
   - Query Pinecone namespace for vectors matching prefix
   - Delete all matching vectors using `deleteVectorsByIds()`
   - Log success/failure but continue on error (non-critical)

4. **VAPI Knowledge Base Update (INTEL-002)**
   - Fetch associated VAPI KB ID from `vapi_knowledge_bases` table
   - Remove file ID from KB's file list using `removeFilesFromVapiKB()`
   - Handle case where KB doesn't exist (feature flag disabled)
   - Log error but continue on failure (non-critical)

5. **VAPI File Deletion**
   - Call `vapiService.deleteFile(vapiFileId)`
   - Log error but continue on failure (non-critical)

6. **Database Record Deletion (CRITICAL)**
   - Delete record from `pdf_docs` table: `DELETE FROM pdf_docs WHERE id = ?`
   - This is the transaction boundary - must succeed or rollback
   - If this fails, attempt to rollback external service deletions (best effort)

7. **Lock Release and Cleanup**
   - Release deletion lock
   - Return success/error response

#### Transaction Boundaries

**Critical Atomic Unit**: Database Deletion
- **Operations**: Delete from `pdf_docs` table
- **Rollback Strategy**: If database deletion fails, attempt to restore:
  - Re-upsert vectors to Pinecone (if vector IDs were tracked)
  - Re-add file to VAPI KB (if KB update was successful)
  - Note: VAPI file deletion is irreversible, but not critical

**Non-Critical Operations**: External Service Cleanup
- Pinecone vector deletion
- VAPI KB file removal
- VAPI file deletion
- These can fail without blocking the entire operation
- Failed operations should be logged for manual cleanup or retry by background job

#### Multi-Tenant Considerations

- All database queries must filter by `account_id` to enforce RLS
- Namespace validation ensures vectors are deleted from correct tenant scope
- Account membership verified before any destructive operations
- Document ownership validated: `document_storage.account_id === user.account_id`

---

### Implementation Specifications

#### Input Validation

```typescript
interface DeletePdfInput {
  documentStorageId: string;  // UUID format
  pdfDocId: string;            // UUID format, used as vector ID prefix
  vapiFileId: string;          // VAPI file identifier
  namespace: string;           // Pinecone namespace (3-63 chars)
}

// Validation rules:
// 1. All fields required and non-empty
// 2. documentStorageId and pdfDocId must be valid UUIDs
// 3. namespace must match pattern: /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/
// 4. User must be authenticated
// 5. User must have account membership for document's account_id
```

#### Database Operations

**Query 1: Fetch Document Metadata**
- **Purpose**: Get document details and verify ownership
- **Table**: `pdf_docs`
- **Query**:
  ```sql
  SELECT pd.*, ds.namespace, ds.account_id, ds.vapi_knowledge_base_id, ds.name
  FROM pdf_docs pd
  JOIN document_storages ds ON pd.document_storage_id = ds.id
  WHERE pd.id = ? AND ds.account_id = ?
  ```
- **Expected Result**: Single row with document and storage data

**Query 2: Count Documents in Storage**
- **Purpose**: Determine if this is last document
- **Function**: `getDocumentCounts(documentStorageId)`
- **Returns**: Array of all documents (pdf_docs + qa_docs)

**Query 3: Get VAPI Knowledge Base**
- **Purpose**: Get KB ID for file removal
- **Table**: `vapi_knowledge_bases`
- **Query**:
  ```sql
  SELECT id, vapi_kb_id, vapi_file_ids
  FROM vapi_knowledge_bases
  WHERE id = (SELECT vapi_knowledge_base_id FROM document_storages WHERE id = ?)
  AND deleted_at IS NULL
  ```

**Mutation 1: Delete PDF Record**
- **Purpose**: Remove document from database (CRITICAL)
- **Table**: `pdf_docs`
- **Query**: `DELETE FROM pdf_docs WHERE id = ? AND account_id = ?`
- **Rollback**: Not possible - this is the commit point

#### External Service Calls

**Service 1: Pinecone Vector Deletion**
- **Endpoint**: Pinecone Index API (via pineconeService)
- **Operation**: `deleteVectorsByIds(namespace, vectorIds)`
- **Vector ID Pattern**: `{pdfDocId}-chunk-0`, `{pdfDocId}-chunk-1`, ..., `{pdfDocId}-chunk-N`
- **Finding Vectors**: Query by metadata filter `{ documentId: pdfDocId }`
- **Expected Response**: Success (no return value)
- **Error Handling**: Log error, continue with deletion process
- **Retry Logic**: No retry (2 attempts built into service)

**Service 2: VAPI Knowledge Base Update**
- **Endpoint**: VAPI API (via removeFilesFromVapiKB)
- **Operation**: `removeFilesFromVapiKB(kbId, [vapiFileId])`
- **Payload**: KB ID + array of file IDs to remove
- **Expected Response**: `{ success: true, data: VapiKnowledgeBase }`
- **Error Handling**: Log error, continue with deletion
- **Feature Flag**: Only execute if `shouldUseVapiKB() === true`

**Service 3: VAPI File Deletion**
- **Endpoint**: `DELETE https://api.vapi.ai/file/{fileId}`
- **Operation**: `vapiService.deleteFile(vapiFileId)`
- **Headers**: `Authorization: Bearer ${VAPI_KEY}`
- **Expected Response**: JSON confirmation
- **Error Handling**: Log error, continue (file orphaned but not referenced)

#### Return Value

```typescript
interface DeletePdfResponse {
  status: 'success' | 'error';
  message?: string;
  storageDeleted?: boolean;  // True if last document triggered storage deletion
  warnings?: string[];        // Non-critical failures (Pinecone, VAPI, etc.)
}

// Success examples:
// { status: 'success', message: 'Document deleted successfully' }
// { status: 'success', storageDeleted: true, message: 'Last document deleted, storage removed' }
// { status: 'success', warnings: ['Pinecone deletion failed', 'VAPI KB update failed'] }

// Error example:
// { status: 'error', message: 'Database deletion failed: permission denied' }
```

---

### Error Handling Strategy

| Failure Point | Recovery Action | User Message | Severity |
|--------------|----------------|-------------|----------|
| Invalid input parameters | Return validation error immediately | "Invalid document or storage ID" | High |
| User not authenticated | Return unauthorized error | "You must be logged in to delete documents" | High |
| No account access | Return forbidden error | "You don't have permission to delete this document" | High |
| Document not found | Return not found error | "Document not found or already deleted" | Medium |
| Lock acquisition failed | Return conflict error | "Document is currently being deleted, please try again" | Medium |
| Pinecone vector deletion fails | Log error, add to warnings, continue | "Document deleted but vector cleanup may be incomplete" | Low |
| VAPI KB update fails | Log error, add to warnings, continue | "Document deleted but knowledge base may need manual update" | Low |
| VAPI file deletion fails | Log error, add to warnings, continue | "Document deleted but file may remain in VAPI storage" | Low |
| Database deletion fails | **CRITICAL**: Return error, attempt rollback | "Failed to delete document from database" | Critical |

---

### Rollback Procedures

#### Scenario 1: Database Deletion Fails After External Service Cleanup

**What happened**: Vectors deleted from Pinecone, file removed from VAPI KB, VAPI file deleted, but database DELETE failed.

**Rollback Actions** (best effort):
1. **Pinecone Rollback**: Not feasible without saved vector data
   - Log warning about orphaned vector cleanup
   - Background job can identify orphaned vectors later

2. **VAPI KB Rollback**: Re-add file to knowledge base
   - Call `addFilesToVapiKB(kbId, [vapiFileId])`
   - Log success/failure

3. **VAPI File Rollback**: Not possible (file already deleted)
   - File is orphaned but database still references it
   - Future cleanup will handle this

**User Communication**: "Failed to delete document. Some cleanup may be incomplete. Please contact support."

#### Scenario 2: Lock Acquisition Fails

**What happened**: Another deletion is in progress for same document.

**Rollback Actions**: None needed, no state changed.

**User Communication**: "This document is currently being deleted. Please wait and try again."

#### Scenario 3: Last Document Deletion Triggers Full Storage Deletion Failure

**What happened**: `getDocumentCounts()` returned 1, called `deleteAllDocumentStorageById()`, which failed.

**Rollback Actions**: Handled by `deleteAllDocumentStorageById()` internal rollback.

**User Communication**: Use error message from `deleteAllDocumentStorageById()`.

---

### Performance Considerations

**Caching Opportunities**:
- Cache document count result during lock acquisition
- Cache VAPI KB metadata to avoid repeated fetches
- Cache namespace validation result

**Query Optimization**:
- Single JOIN query to fetch document + storage data (avoid N+1)
- Use indexed columns: `id`, `account_id`, `document_storage_id`
- Consider materialized view for document counts if performance critical

**Batch Operation Possibilities**:
- If deleting multiple documents, batch Pinecone deletions
- Batch VAPI KB updates to remove multiple files at once
- Not applicable for single document deletion

**Pinecone Vector Deletion Strategy**:
- Use metadata query instead of listing all vectors
- Query: `filter: { documentId: pdfDocId }` returns only relevant vectors
- Alternative: Fetch vector IDs from database if stored during upload

---

### Security Checklist

- [x] **Authentication verified**: Check user session via `getCurrentUserId()`
- [x] **Account membership checked**: Validate user belongs to document's account
- [x] **Input sanitized**: UUID validation, namespace pattern validation
- [x] **RLS policies enforced**: All queries filter by `account_id`
- [x] **Sensitive data protected**: No exposure of internal IDs in error messages
- [x] **Concurrent deletion prevented**: Mutex lock using `uploadLock` mechanism
- [x] **Audit trail**: Log all deletion attempts with user ID and timestamp
- [x] **Rate limiting**: Consider implementing per-account deletion rate limits

---

### Testing Strategy

**Unit Tests** (for backend-test-architect):
1. Input validation rejects invalid UUIDs
2. Input validation rejects malformed namespaces
3. Unauthenticated user receives 401 error
4. User without account access receives 403 error
5. Non-existent document returns 404 error
6. Lock acquisition prevents concurrent deletions
7. Last document detection correctly identifies count === 1
8. Pinecone deletion failure logged but doesn't block operation
9. VAPI KB update failure logged but doesn't block operation
10. Database deletion failure triggers rollback attempts
11. Successful deletion returns proper response structure
12. Warnings array populated when external services fail

**Integration Tests**:
1. End-to-end deletion with all services healthy
2. End-to-end last document deletion triggers storage deletion
3. Pinecone unavailable - deletion continues
4. VAPI unavailable - deletion continues
5. Database failure - operation aborts with error
6. Concurrent deletion attempts - second fails with conflict error
7. Verify vectors actually deleted from Pinecone namespace
8. Verify file removed from VAPI knowledge base
9. Verify database record removed from `pdf_docs`
10. Verify lock released after operation completes

**Edge Cases**:
1. Document already deleted (idempotency)
2. Storage doesn't exist
3. VAPI KB feature flag disabled
4. Namespace contains no vectors for document
5. VAPI file already deleted
6. Multiple documents deleted rapidly in sequence
7. Storage deleted while document deletion in progress

---

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Orphaned vectors in Pinecone | Medium | Low | Background cleanup job to identify orphaned vectors |
| Orphaned files in VAPI | Medium | Low | Periodic audit to match database records with VAPI files |
| Incomplete KB file list | Medium | Low | Sync validation to detect and repair KB file mismatches |
| Concurrent deletion race condition | Low | Medium | Mutex lock prevents concurrent deletions |
| Database deletion succeeds but others fail | Low | Medium | Track partial failures, allow manual retry |
| Last document detection incorrect | Very Low | High | Use transaction-level snapshot isolation for count query |
| User deletes wrong document | Medium | High | Confirmation dialog with document name display |
| Lock not released on crash | Low | Medium | TTL-based lock expiration (e.g., 60 seconds) |

---

### Dependencies

**Required Environment Variables**:
- `NEXT_PRIVATE_VAPI_KEY` - VAPI API authentication
- `PINECONE_API_KEY` or `NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE` - Pinecone authentication
- `PINECONE_INDEX` or `NEXT_PUBLIC_PINECONE_INDEX` - Pinecone index name
- `NEXT_PUBLIC_USE_VAPI_KB` - Feature flag for VAPI KB integration

**External Service Availability**:
- Pinecone Index API (graceful degradation)
- VAPI API (graceful degradation)
- Supabase PostgreSQL (critical - no degradation)

**Database Schema Requirements**:
- `pdf_docs` table with columns: `id`, `account_id`, `document_storage_id`, `name`, `id_vapi_doc`
- `document_storages` table with columns: `id`, `account_id`, `namespace`, `vapi_knowledge_base_id`, `name`
- `vapi_knowledge_bases` table with columns: `id`, `vapi_kb_id`, `vapi_file_ids`, `deleted_at`
- `account_user` table for account membership validation
- Existing lock mechanism tables (if using database-based locks)

**Service Dependencies**:
- `pineconeService.ts` - Must support metadata-based vector query and deletion
- `vapiService.ts` - File deletion functionality
- `vapiKnowledgeBase.ts` - KB file removal functionality
- `uploadLock.ts` - Concurrency control
- `documents.ts` - `deleteAllDocumentStorageById()` for last document scenario

---

### Next Steps

1. **Enhance Pinecone Service** (CRITICAL)
   - Add method to query vectors by metadata filter: `queryVectorIdsByMetadata(namespace, filter)`
   - This is needed to find all chunks for a document: `{ documentId: pdfDocId }`
   - Alternative: Add `listVectorsByPrefix(namespace, prefix)` if API supports it

2. **Implement Core Deletion Logic**
   - Create new `deletePdfDocument()` function following this architecture
   - Replace current `deletePdf()` function (lines 779-918 in documents.ts)

3. **Add Concurrent Deletion Protection**
   - Reuse `uploadLock` mechanism with new lock key: `pdf-delete-${pdfDocId}`
   - Set lock timeout to 60 seconds
   - Return specific error for lock acquisition failure

4. **Implement Partial Failure Tracking**
   - Create warnings array to collect non-critical failures
   - Return warnings in response for user awareness

5. **Add Audit Logging**
   - Log deletion attempts: `{ userId, accountId, documentId, timestamp, success, warnings }`
   - Store in new `document_deletion_log` table or application logs

6. **Testing Infrastructure**
   - Create test fixtures for document deletion scenarios
   - Mock external services for unit tests
   - Setup integration test environment with test namespace

7. **Frontend Coordination**
   - Work with shadcn-ui-architect for confirmation modal
   - Ensure UI handles warnings array display
   - Handle `storageDeleted` flag to redirect user

8. **Documentation**
   - Update API documentation with new signature
   - Document rollback procedures for operations team
   - Create runbook for manual cleanup of orphaned resources

---

### Critical Implementation Notes

**Pinecone Vector ID Pattern**:
According to INTEL-005 implementation, vectors are stored with ID format:
```typescript
const vectorId = `${pdfDocId}-chunk-${chunkIndex}`;
```

This means we can query vectors by metadata:
```typescript
const results = await queryVectors(namespace, queryEmbedding, {
  filter: { documentId: pdfDocId },
  topK: 10000,  // Get all chunks
});
const vectorIds = results.map(r => r.id);
await deleteVectorsByIds(namespace, vectorIds);
```

**Alternative Approach**: If Pinecone supports prefix-based deletion (check API docs), we could delete by prefix directly without querying first.

**Last Document Deletion**:
Current implementation calls `deleteDocumentStorageById()` which may have different behavior than `deleteAllDocumentStorageById()`. Need to verify which function to use for last document scenario.

**VAPI KB Feature Flag**:
The `shouldUseVapiKB()` check must be consistent with upload flow. If feature is disabled, skip KB-related operations entirely.

**Transaction Isolation**:
Database deletion should use explicit transaction if available, or rely on Supabase RLS row-level locking to prevent race conditions.

---

*Analysis completed: 2025-10-03*
*Architect: backend-business-logic-architect*

---
*Session started: 2025-10-03*


---

## UI Implementation Plan (shadcn-ui-planner)

**Document Location**: `/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/doc/INTEL-006/shadcn_ui_implementation_plan.md`

### Summary

The UI implementation plan provides comprehensive guidance for adding PDF document deletion confirmation using shadcn/ui AlertDialog component. Key highlights:

**Components to Install:**
- AlertDialog (via `npx shadcn@latest add alert-dialog`)

**Files to Modify:**
1. `document-list.tsx` - Add AlertDialog confirmation, improve deletion logic
2. `page.tsx` - Remove duplicate delete handler, simplify component
3. `document-viewer.tsx` - Remove delete-related props, pass accountSlug

**Key Features:**
- Confirmation dialog with document name display
- Last document warning (storage deletion notice)
- Loading states with spinner feedback
- Success/error toast notifications
- Automatic redirect on storage deletion
- Concurrent deletion prevention
- WCAG 2.1 AA accessibility compliance
- Mobile-responsive design
- Dark/light theme support

**Critical Implementation Notes:**
1. Fix toast placement (move success out of `finally` block)
2. Add `accountSlug` prop to DocumentList for redirect
3. Controlled dialog state prevents hydration issues
4. Per-document loading state prevents concurrent deletions
5. Realtime subscriptions handle optimistic UI updates

**Accessibility:**
- Keyboard navigation (Tab, Enter, Escape)
- ARIA labels on all interactive elements
- Focus trap in dialog
- Screen reader announcements
- Touch targets >= 40px

**Responsive Breakpoints:**
- Mobile (<640px): Full-width dialog, stacked buttons
- Tablet (640-1024px): Max-width dialog, horizontal buttons
- Desktop (>1024px): Optimal layout with hover states

**Testing Checklist:**
- Functional: Delete flow, cancel, loading, error handling
- Accessibility: Keyboard nav, screen reader, ARIA
- Responsive: Mobile, tablet, desktop layouts
- Themes: Light/dark mode colors and contrast

**Troubleshooting Guide:**
- AlertDialog not found → Run `npx shadcn@latest add alert-dialog`
- Dialog doesn't close → Check `setIsDialogOpen(false)` in cancel handler
- Toast on error → Move success toast out of `finally` block
- Concurrent deletions → Verify `disabled={loadingDeleteMap[doc.id]}`
- Focus issues → Radix UI handles automatically, check `open` prop

For complete implementation details, TypeScript code examples, and architecture diagrams, see the full document.

---

*UI implementation planning completed: 2025-10-03*
*Next step: Implementation phase (Phase 2)*

