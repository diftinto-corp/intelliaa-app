# INTEL-009: Assign Document Storage to WhatsApp Assistant

**Epic**: Assistant Integration
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: feature, backend, whatsapp, assistant, integration

## User Story

As a user, I want to assign document storages to WhatsApp assistants, so that my WhatsApp bot can answer questions using my knowledge base documents.

## Acceptance Criteria

### AC1: Assign Storage to WhatsApp Assistant
**Given** I have a WhatsApp assistant and an available document storage
**When** I assign the storage to the assistant via the UI
**Then** the namespace is added to the assistant's configuration

### AC2: Namespace Configuration
**Given** a storage is assigned
**When** the assignment completes
**Then** the assistant configuration includes the Pinecone namespace for query operations

### AC3: Assistant Functionality
**Given** a storage is assigned to a WhatsApp assistant
**When** a user asks the bot a question about the documents
**Then** the bot queries the correct Pinecone namespace and retrieves relevant information

### AC4: Multiple Storage Assignment
**Given** a WhatsApp assistant with one storage already assigned
**When** I assign additional storages
**Then** the assistant has access to all namespaces and can query across them

### AC5: Junction Table Record
**Given** a storage assignment succeeds
**When** the process completes
**Then** a record is created in `document_storage-assistants` table linking the entities

### AC6: WhatsApp Bot Configuration Update
**Given** a storage is assigned
**When** the assignment completes
**Then** the WhatsApp bot configuration is updated (Railway/Flowise) with the new namespace list

### AC7: Assignment Validation
**Given** I attempt to assign the same storage twice to the same assistant
**When** the system processes the request
**Then** it detects the duplicate and prevents it or shows appropriate message

### AC8: Unassign Storage
**Given** a storage is assigned to a WhatsApp assistant
**When** I unassign/remove the storage
**Then** the namespace is removed from the configuration and the junction table record is deleted

## Technical Notes

### Implementation Details
- **Location**: Update assistant configuration UI (WhatsApp assistants page)
- **Backend**: Create server actions for assign/unassign operations
- **Integration**: Update Railway/Buildship configuration with namespaces

### WhatsApp Assistant Configuration
WhatsApp assistants use namespace-based filtering in Pinecone:
```typescript
// Assistant configuration includes array of namespaces
{
  id: 'assistant-id',
  name: 'My WhatsApp Bot',
  prompt: '...',
  namespaces: ['storage1-abc123', 'storage2-def456'], // Pinecone namespaces
  // ... other config
}
```

### Server Action Signatures
```typescript
async function assignDocumentStorageToWhatsAppAssistant(
  assistantId: string,
  documentStorageId: string,
  accountId: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
}>

async function unassignDocumentStorageFromWhatsAppAssistant(
  assistantId: string,
  documentStorageId: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
}>
```

### Processing Flow (Assign)
1. Validate assistant and storage exist in same account
2. Check if already assigned (prevent duplicates)
3. Get namespace from document storage
4. Get current assistant configuration
5. Add namespace to assistant's namespace array
6. Update assistant in database (and Railway if deployed)
7. Insert record into `document_storage-assistants` table
8. Return success

### Processing Flow (Unassign)
1. Validate assignment exists
2. Get namespace from document storage
3. Get current assistant configuration
4. Remove namespace from assistant's namespace array
5. Update assistant in database (and Railway if deployed)
6. Delete record from `document_storage-assistants` table
7. Return success

### Database Updates
Update `assistants` table to include namespace array:
```sql
-- May need to add column if not exists
ALTER TABLE assistants
ADD COLUMN IF NOT EXISTS namespaces TEXT[];
```

Or store in existing JSON column like `docs_keys`:
```typescript
// Option: Store in existing docs_keys JSONB column
docs_keys: {
  pinecone_namespaces: ['storage1-abc123', 'storage2-def456']
}
```

### Railway Integration
If WhatsApp bot is deployed to Railway, update configuration:
```typescript
// Update Railway deployment with new namespace list
await updateAssistantWs(assistantId, {
  namespaces: updatedNamespaces
});
```

### Multiple Storage Handling
- Each storage contributes its namespace to the array
- When querying Pinecone, bot searches across all namespaces
- Merge results from multiple namespaces
- Rank by relevance across all results

### Namespace Query Pattern
```typescript
// Query multiple namespaces in WhatsApp bot
const results = await Promise.all(
  namespaces.map(namespace =>
    pineconeService.queryVectors(namespace, queryEmbedding, topK)
  )
);

// Merge and sort by score
const mergedResults = results
  .flat()
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

### Error Scenarios
- Assistant doesn't exist: Validation error
- Storage doesn't exist: Validation error
- Namespace not found: Show error
- Railway update fails: Log error, allow retry
- Database constraint violation: Handle duplicate gracefully

### UI Updates
- Document storage selection dropdown/modal on WhatsApp assistant page
- List of assigned storages with unassign buttons
- Visual indication of namespace configuration
- Loading states during assignment operations
- Success/error notifications
- Refresh assistant configuration after changes

### Compatibility Note
This implementation maintains compatibility with v0 SDK and existing WhatsApp assistant architecture. The namespace-based approach works with both:
- Current Flowise-based document processing
- New Vercel AI SDK-based document processing

## Definition of Done

- [ ] Server actions for assign/unassign implemented
- [ ] Namespace array management logic implemented
- [ ] Junction table operations implemented
- [ ] Railway configuration update implemented
- [ ] Duplicate assignment prevention implemented
- [ ] Frontend UI for storage assignment
- [ ] List of assigned storages displayed
- [ ] Error handling for all scenarios
- [ ] Unit tests for server actions
- [ ] Integration tests with Railway
- [ ] Manual testing of assignment workflows
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-004 (Document storages must exist)
- **Requires**: Existing WhatsApp assistant infrastructure
- **Related**: INTEL-007 (deletion validation checks assignments)

## Related Stories

- **Blocked By**: INTEL-004
- **Related**: INTEL-008 (Voice assistant assignment)
- **Related**: INTEL-007 (prevents storage deletion if assigned)
