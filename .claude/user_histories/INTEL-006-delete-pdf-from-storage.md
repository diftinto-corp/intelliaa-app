# INTEL-006: Delete PDF Document from Storage

**Epic**: Document Management
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: feature, backend, frontend, document-storage

## User Story

As a user, I want to delete individual PDF documents from a storage, so that I can remove outdated or incorrect information from my knowledge base.

## Acceptance Criteria

### AC1: Delete Confirmation
**Given** I'm viewing a document in the storage detail page
**When** I click the delete button for a document
**Then** the system shows a confirmation dialog displaying the document name

### AC2: Vector Removal from Pinecone
**Given** I confirm the deletion
**When** the deletion process starts
**Then** all vectors associated with this document are removed from the Pinecone namespace

### AC3: VAPI File Deletion
**Given** I confirm the deletion
**When** the deletion process continues
**Then** the file is removed from VAPI and the knowledge base is updated to exclude this file ID

### AC4: Database Record Deletion
**Given** I confirm the deletion
**When** the deletion process completes successfully
**Then** the database record is deleted from the `pdf_docs` table

### AC5: Last Document Deletion
**Given** I'm deleting the last document in a storage
**When** the deletion is confirmed
**Then** the entire document storage is automatically deleted, including the namespace and VAPI knowledge base

### AC6: Partial Failure Handling
**Given** deletion fails at any stage
**When** the error occurs
**Then** the system logs the error, attempts to maintain data consistency, and shows user-friendly error message with details

### AC7: UI Update
**Given** a document is successfully deleted
**When** the deletion completes
**Then** the document list updates immediately to remove the deleted document

### AC8: Concurrent Deletion Prevention
**Given** a deletion is in progress for a document
**When** another deletion request is made for the same document
**Then** the system prevents concurrent deletion and shows appropriate message

## Technical Notes

### Implementation Details
- **Frontend**: Update document storage detail page with delete button and confirmation modal
- **Backend**: Update/refactor `deletePdf` function in `src/lib/actions/intelliaa/documents.ts`
- **Cascading Logic**: Handle last document scenario

### Processing Flow
1. Show confirmation dialog with document name
2. Check if this is the last document in storage
3. Get document details (id, id_vapi_doc, namespace)
4. Delete vectors from Pinecone by document ID prefix
5. Update VAPI knowledge base to remove file ID
6. Delete VAPI file using `vapiService.deleteFile`
7. Delete database record from `pdf_docs`
8. If last document: trigger storage deletion (INTEL-007)

### Server Action Signature
```typescript
async function deletePdf(
  documentStorageId: string,
  pdfDocId: string,
  vapiFileId: string,
  documentStorageNamespace: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
  storageDeleted?: boolean;
}>
```

### Vector Deletion Strategy
Delete vectors by ID prefix:
```typescript
// Vector IDs follow pattern: {pdfDocId}-chunk-{index}
const vectorIds = await pineconeService.listVectorsByPrefix(
  namespace,
  `${pdfDocId}-chunk-`
);
await pineconeService.deleteVectorsByIds(namespace, vectorIds);
```

### Last Document Detection
```typescript
const documentCount = await getDocumentCounts(documentStorageId);
const isLastDocument = documentCount.length === 1;

if (isLastDocument) {
  // Trigger full storage deletion
  await deleteAllDocumentStorageById(documentStorageId);
  return { status: 'success', storageDeleted: true };
}
```

### Error Handling Strategy

**Pinecone deletion fails**:
- Log error but continue with other deletions
- Mark document as "pending deletion" in database
- Background job can retry later

**VAPI KB update fails**:
- Log error and continue
- File will remain in VAPI but not referenced
- Can be cleaned up by background job

**VAPI file deletion fails**:
- Log error and continue
- File will remain in VAPI
- No critical impact

**Database deletion fails**:
- This is critical - don't proceed
- Attempt rollback of external service deletions
- Show error to user

### Consistency Considerations
- Use soft delete pattern if data consistency is critical
- Implement background cleanup job for failed deletions
- Log all deletion attempts for audit trail

### Frontend Updates
- Delete button on each document in list
- Confirmation modal with document details
- Loading state during deletion
- Success/error toast notifications
- Automatic redirect if storage deleted

## Definition of Done

- [ ] Server action refactored to use new services
- [ ] Last document detection implemented
- [ ] Vector deletion logic implemented
- [ ] VAPI knowledge base update logic implemented
- [ ] Error handling for partial failures
- [ ] Frontend delete button and confirmation modal
- [ ] UI updates after deletion
- [ ] Unit tests for server action
- [ ] Integration tests for all scenarios
- [ ] Manual testing of edge cases
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-002 (VAPI Knowledge Base Service)
- **Requires**: INTEL-003 (Pinecone Service - needs list/delete by prefix)
- **Requires**: INTEL-004 or INTEL-005 (Documents must exist)
- **Related**: INTEL-007 (Storage deletion for last document scenario)

## Related Stories

- **Blocked By**: INTEL-002, INTEL-003
- **Blocks**: INTEL-007 (may trigger storage deletion)
- **Related**: INTEL-005 (Add PDF to Storage)
