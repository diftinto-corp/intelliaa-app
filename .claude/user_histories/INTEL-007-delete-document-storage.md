# INTEL-007: Delete Document Storage with Validation

**Epic**: Document Storage Lifecycle
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: feature, backend, frontend, document-storage

## User Story

As a user, I want to delete an entire document storage, so that I can remove knowledge bases I no longer need and free up resources.

## Acceptance Criteria

### AC1: Delete Confirmation
**Given** I'm viewing a document storage detail page
**When** I click the delete storage button (trash icon)
**Then** the system shows a confirmation dialog with storage name and warning about permanent deletion

### AC2: Assignment Validation
**Given** the document storage is assigned to one or more assistants
**When** I attempt to delete the storage
**Then** the system prevents deletion and shows which assistants are currently using this storage

### AC3: Pinecone Namespace Deletion
**Given** I confirm deletion of an unassigned storage
**When** the deletion process starts
**Then** all vectors in the namespace are removed from Pinecone

### AC4: VAPI Knowledge Base Deletion
**Given** I confirm deletion
**When** the deletion process continues
**Then** the VAPI knowledge base is deleted along with all file references

### AC5: VAPI Files Deletion
**Given** I confirm deletion
**When** the deletion process continues
**Then** all VAPI files associated with this storage are deleted

### AC6: Database Cascade Deletion
**Given** I confirm deletion
**When** the deletion process completes
**Then** all related records are deleted in order: `pdf_docs`, `qa_docs`, `document_storages`

### AC7: Partial Failure Handling
**Given** deletion fails at any stage
**When** the error occurs
**Then** the system logs the error, shows user-friendly message with rollback status, and allows retry

### AC8: Successful Deletion Redirect
**Given** the storage is successfully deleted
**When** the deletion completes
**Then** I'm redirected to the document storage list page with success message

### AC9: Concurrent Deletion Prevention
**Given** a deletion is in progress
**When** another deletion request is made for the same storage
**Then** the system prevents concurrent deletion attempts

## Technical Notes

### Implementation Details
- **Frontend**: Update document storage detail page with delete button and confirmation modal
- **Backend**: Refactor `deleteAllDocumentStorageById` in `src/lib/actions/intelliaa/documents.ts`
- **Validation**: Check `document_storage-assistants` junction table

### Processing Flow
1. Check if storage is assigned to any assistants
2. If assigned: Return error with assistant names
3. If not assigned: Show confirmation dialog
4. Get all documents in storage (`pdf_docs` + `qa_docs`)
5. Delete all VAPI files using `vapiService.deleteFile`
6. Delete VAPI knowledge base using INTEL-002 service
7. Delete Pinecone namespace using INTEL-003 service
8. Delete database records: `pdf_docs`, `qa_docs`, `document_storages`
9. Return success and redirect to list page

### Server Action Signature
```typescript
async function deleteAllDocumentStorageById(
  documentStorageId: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
  assignedAssistants?: string[];
}>
```

### Assignment Check
```typescript
// Check if storage is assigned to any assistants
const { data: assignments } = await supabase
  .from('document_storage-assistants')
  .select('assistant(id, name)')
  .eq('document_storage', documentStorageId);

if (assignments && assignments.length > 0) {
  const assistantNames = assignments.map(a => a.assistant.name);
  return {
    status: 'error',
    message: 'Cannot delete storage assigned to assistants',
    assignedAssistants: assistantNames
  };
}
```

### Deletion Order (Critical for Data Integrity)
1. **VAPI files**: Delete all files first
2. **VAPI knowledge base**: Delete the knowledge base
3. **Pinecone namespace**: Delete all vectors
4. **Database - pdf_docs**: Delete document records
5. **Database - qa_docs**: Delete Q&A records
6. **Database - document_storages**: Delete storage record last

### Error Handling Strategy

**Assignment check fails**:
- Assume storage is assigned (safe default)
- Don't proceed with deletion
- Show error to user

**VAPI file deletion fails**:
- Log error and continue
- Files will be orphaned but not critical
- Background cleanup job can handle later

**VAPI KB deletion fails**:
- Log error and continue
- KB will be orphaned
- Can be cleaned up manually

**Pinecone deletion fails**:
- Log error but continue
- Vectors will remain but namespace won't be reused
- Background job can clean up later

**Database deletion fails**:
- This is critical failure
- Don't proceed further
- Show error with details
- Manual intervention may be needed

### Rollback Strategy
Due to the distributed nature of deletions, implement compensating transactions:
```typescript
const deletionLog = {
  vapiFilesDeleted: [],
  vapiKbDeleted: false,
  pineconeDeleted: false,
  dbRecordsDeleted: []
};

// Track each deletion step
// On error, log what was successfully deleted
// Background job can handle cleanup/retry
```

### Frontend Updates
- Delete button (trash icon) on detail page
- Confirmation modal with:
  - Storage name
  - Document count
  - Warning about permanent deletion
  - List of assigned assistants (if any)
- Loading state during deletion
- Error modal with assignment details
- Success redirect to list page

### Performance Considerations
- Batch VAPI file deletions if many files
- Use Promise.allSettled for parallel deletions where safe
- Implement timeout of 2 minutes for entire operation
- Show progress indicator for long operations

## Definition of Done

- [ ] Assignment validation implemented
- [ ] Server action refactored with new services
- [ ] Deletion order implemented correctly
- [ ] Error handling and logging implemented
- [ ] Frontend delete button and confirmation modal
- [ ] Assignment blocking UI implemented
- [ ] Success redirect implemented
- [ ] Unit tests for all scenarios
- [ ] Integration tests covering happy and error paths
- [ ] Manual testing of edge cases
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-002 (VAPI Knowledge Base Service)
- **Requires**: INTEL-003 (Pinecone Service)
- **Requires**: Existing `vapiService.deleteFile`
- **Related**: INTEL-006 (called when last document deleted)

## Related Stories

- **Blocked By**: INTEL-002, INTEL-003
- **Called By**: INTEL-006 (when deleting last document)
- **Related**: INTEL-008, INTEL-009 (assistant assignments)
