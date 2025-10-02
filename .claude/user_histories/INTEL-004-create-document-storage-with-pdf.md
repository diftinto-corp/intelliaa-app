# INTEL-004: Create Document Storage with Initial PDF

**Epic**: Document Storage Creation
**Priority**: P0 - Critical
**Estimate**: 8 points
**Labels**: feature, backend, frontend, document-storage

## User Story

As a user, I want to create a new document storage with an initial PDF file, so that I can build a knowledge base for my AI assistants.

## Acceptance Criteria

### AC1: Successful Creation Flow
**Given** I have a valid name, description, and PDF file (<50MB)
**When** I submit the document storage creation form
**Then** the system creates a document storage, processes the PDF, and redirects me to the detail page with success message

### AC2: Loading State
**Given** my PDF file is being processed
**When** the upload is in progress
**Then** I see a loading indicator with real-time processing status (uploading, embedding, saving)

### AC3: Vector Storage
**Given** embeddings are generated from the PDF
**When** the storage creation completes
**Then** vectors are stored in Pinecone with a unique namespace pattern `{name}-{random-6-chars}`

### AC4: VAPI Knowledge Base Creation
**Given** the file is uploaded to VAPI successfully
**When** the storage creation completes
**Then** a VAPI knowledge base is automatically created with the uploaded file ID

### AC5: Rollback on Failure
**Given** any service fails during creation (embedding, Pinecone, VAPI, or database)
**When** the error occurs
**Then** the system rolls back all changes, cleans up partial data, and shows a descriptive error message

### AC6: Multi-tenant Isolation
**Given** I'm logged into organization A
**When** I create a document storage
**Then** it's only visible within organization A and RLS policies prevent access from other organizations

### AC7: Namespace Uniqueness
**Given** I create a storage with a name that already exists in my account
**When** the system generates the namespace
**Then** the unique random suffix ensures no namespace collisions occur

### AC8: File Size Validation
**Given** I attempt to upload a PDF larger than 50MB
**When** I submit the form
**Then** the system shows a validation error before processing begins

### AC9: File Type Validation
**Given** I attempt to upload a non-PDF file
**When** I submit the form
**Then** the system shows a validation error indicating only PDF files are supported

### AC10: Empty File Handling
**Given** I attempt to upload an empty file (0 bytes)
**When** I submit the form
**Then** the system shows a validation error preventing the upload

## Technical Notes

### Implementation Details
- **Frontend**: Update modal component at document storage list page
- **Backend**: Create server action in `src/lib/actions/intelliaa/documents.ts`
- **API Route**: May need new API route for file upload handling

### Processing Flow
1. Validate file (size, type, not empty)
2. Generate unique namespace: `${sanitizedName}-${randomString(6)}`
3. Generate embeddings using INTEL-001 service
4. Store vectors in Pinecone using INTEL-003 service
5. Upload file to VAPI using existing `vapiService.uploadFile`
6. Create VAPI knowledge base using INTEL-002 service
7. Insert record into `document_storages` table
8. Insert record into `pdf_docs` table
9. Return success with storage ID

### Database Schema Updates

**document_storages** table may need updates:
- Add `vapi_knowledge_base_id` column (TEXT) to store VAPI KB ID
- Keep existing columns: `id`, `account_id`, `name`, `description`, `namespace`

**pdf_docs** table (existing structure):
- `id` (UUID)
- `account_id` (UUID, FK)
- `document_storage_id` (UUID, FK)
- `name` (TEXT)
- `id_vapi_doc` (TEXT)
- `url` (TEXT)
- `created_at` (TIMESTAMP)

### Error Handling & Rollback Strategy

```typescript
try {
  // 1. Generate embeddings
  const embeddings = await embeddingService.generateEmbeddings(fileBuffer);

  // 2. Store in Pinecone
  await pineconeService.upsertVectors(namespace, embeddings);

  // 3. Upload to VAPI
  const vapiFile = await vapiService.uploadFile(file);

  // 4. Create VAPI knowledge base
  const knowledgeBase = await vapiKBService.createKnowledgeBase({
    name: `${name} KB`,
    fileIds: [vapiFile.id]
  });

  // 5. Save to Supabase
  const storage = await supabase.from('document_storages').insert(...);
  await supabase.from('pdf_docs').insert(...);

  return { success: true, storageId: storage.id };
} catch (error) {
  // Rollback in reverse order
  if (knowledgeBase?.id) await vapiKBService.deleteKnowledgeBase(knowledgeBase.id);
  if (vapiFile?.id) await vapiService.deleteFile(vapiFile.id);
  if (namespace) await pineconeService.deleteNamespace(namespace);
  throw error;
}
```

### Frontend Components to Update
- Modal component with form (name, description, file upload)
- File dropzone with validation feedback
- Processing status indicator (multi-step progress)
- Error message display with retry option
- Redirect logic to detail page on success

### Performance Considerations
- Show optimistic UI updates where possible
- Stream processing status to frontend
- Use Next.js Server Actions for seamless integration
- Implement timeout of 5 minutes for entire process

## Definition of Done

- [ ] Backend server action implemented with all services integrated
- [ ] Rollback logic tested for all failure scenarios
- [ ] Frontend modal updated with new form
- [ ] File validation implemented (client and server-side)
- [ ] Processing status indicator implemented
- [ ] Error handling with user-friendly messages
- [ ] Database records created correctly
- [ ] RLS policies verified
- [ ] Unit tests for server action
- [ ] Integration test covering happy path
- [ ] Manual testing of all edge cases
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-001 (Embedding Service)
- **Requires**: INTEL-002 (VAPI Knowledge Base Service)
- **Requires**: INTEL-003 (Pinecone Service)
- **Requires**: Existing `vapiService.uploadFile` functionality

## Related Stories

- **Blocked By**: INTEL-001, INTEL-002, INTEL-003
- **Blocks**: INTEL-005 (Add PDF to Storage)
- **Related**: INTEL-007 (Delete Document Storage)
