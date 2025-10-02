# INTEL-005: Add PDF Documents to Existing Storage

**Epic**: Document Management
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: feature, backend, frontend, document-storage

## User Story

As a user, I want to add additional PDF files to an existing document storage, so that I can expand my knowledge base over time.

## Acceptance Criteria

### AC1: Upload Additional PDF
**Given** I'm viewing a document storage detail page
**When** I click "Add New Document" button and upload a PDF (<50MB)
**Then** the document is processed, embedded, and added to the same namespace

### AC2: Real-time Processing Status
**Given** my PDF file is being processed
**When** the upload is in progress
**Then** I see real-time processing status updates (uploading, embedding, updating knowledge base, saving)

### AC3: Same Namespace Embedding
**Given** embeddings are generated from the new PDF
**When** storing in Pinecone
**Then** new vectors are upserted to the same namespace as existing documents in this storage

### AC4: VAPI Knowledge Base Update
**Given** the file is uploaded to VAPI successfully
**When** the process completes
**Then** the existing VAPI knowledge base is updated to include the new file ID

### AC5: Duplicate File Name Handling
**Given** I upload a file with the same name as an existing document in the storage
**When** processing the upload
**Then** the system allows it and creates a unique identifier in the database

### AC6: Partial Failure Handling
**Given** the upload fails at any stage (embedding, Pinecone, VAPI, or database)
**When** the error occurs
**Then** the system shows a clear error message, doesn't create partial records, and allows retry

### AC7: Document List Update
**Given** a new document is successfully added
**When** the process completes
**Then** the document list on the detail page automatically updates to show the new document

### AC8: File Validation
**Given** I attempt to upload an invalid file (wrong type, too large, or empty)
**When** I select the file
**Then** the system shows validation error before starting the upload

## Technical Notes

### Implementation Details
- **Frontend**: Update document storage detail page
- **Backend**: Create/update server action `uploadPdf` in `src/lib/actions/intelliaa/documents.ts`
- **Existing Code**: Refactor existing `uploadPdf` function to use new services

### Processing Flow
1. Validate file (size, type, not empty)
2. Get document storage details (namespace, vapi_knowledge_base_id)
3. Generate embeddings using INTEL-001 service
4. Upsert vectors to Pinecone in existing namespace using INTEL-003
5. Upload file to VAPI using `vapiService.uploadFile`
6. Update VAPI knowledge base with new file ID using INTEL-002
7. Insert record into `pdf_docs` table with reference to storage
8. Return success with document details

### Server Action Signature
```typescript
async function uploadPdf(
  documentStorageId: string,
  account_id: string,
  formData: FormData,
  documentStorageNamespace: string
): Promise<{
  status: 'success' | 'error';
  data?: any;
  message?: string;
}>
```

### Error Handling Strategy
- Embedding failure: Show error, don't proceed
- Pinecone upsert failure: Attempt cleanup, show error
- VAPI upload failure: Clean up Pinecone, show error
- VAPI KB update failure: Try to delete VAPI file, show error
- Database insert failure: Clean up all external services, show error

### Concurrent Upload Handling
- Allow only one upload at a time per storage
- Show queue status if multiple uploads attempted
- Implement optimistic locking to prevent race conditions

### Frontend Updates
- Add "Add New Document" button on detail page
- File upload modal with drag-and-drop
- Progress indicator with steps
- Document list with real-time updates
- Error toast notifications

### Database Consistency
- Ensure `pdf_docs` record is created only after all external services succeed
- Use database transactions where applicable
- Implement idempotency for retry scenarios

## Definition of Done

- [ ] Server action implemented with new services
- [ ] Error handling and rollback logic implemented
- [ ] Frontend upload modal created
- [ ] File validation implemented (client and server)
- [ ] Progress indicator implemented
- [ ] Document list auto-refresh implemented
- [ ] Unit tests for server action
- [ ] Integration test covering happy path and failures
- [ ] Manual testing of edge cases
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-001 (Embedding Service)
- **Requires**: INTEL-002 (VAPI Knowledge Base Service)
- **Requires**: INTEL-003 (Pinecone Service)
- **Requires**: INTEL-004 (Document Storage must exist first)

## Related Stories

- **Blocked By**: INTEL-001, INTEL-002, INTEL-003, INTEL-004
- **Related**: INTEL-006 (Delete PDF from Storage)
- **Related**: INTEL-004 (Create Document Storage)
