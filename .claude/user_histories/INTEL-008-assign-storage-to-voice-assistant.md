# INTEL-008: Assign Document Storage to Voice Assistant

**Epic**: Assistant Integration
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: feature, backend, vapi, assistant, integration

## User Story

As a user, I want to assign document storages to voice assistants, so that my voice AI can answer questions using my knowledge base documents.

## Acceptance Criteria

### AC1: Assign Storage to Assistant
**Given** I have a voice assistant and an available document storage
**When** I assign the storage to the assistant via the UI
**Then** a VAPI query tool is created and linked to the assistant configuration

### AC2: Query Tool Configuration
**Given** a VAPI query tool is created
**When** the assignment completes
**Then** the query tool is configured to search the correct VAPI knowledge base

### AC3: Assistant Functionality
**Given** a storage is assigned to an assistant
**When** I test the assistant with a question about the documents
**Then** the assistant retrieves relevant information from the knowledge base and includes it in responses

### AC4: Multiple Storage Assignment
**Given** an assistant with one storage already assigned
**When** I assign additional storages
**Then** the assistant can query across all assigned storages

### AC5: Junction Table Record
**Given** a storage assignment succeeds
**When** the process completes
**Then** a record is created in `document_storage-assistants` table linking the entities

### AC6: Assignment Validation
**Given** I attempt to assign the same storage twice to the same assistant
**When** the system processes the request
**Then** it detects the duplicate and either ignores it or shows appropriate message

### AC7: Error Handling
**Given** VAPI API fails during query tool creation
**When** the error occurs
**Then** the system doesn't create the junction table record and shows descriptive error message

### AC8: Unassign Storage
**Given** a storage is assigned to an assistant
**When** I unassign/remove the storage
**Then** the query tool is removed from the assistant and the junction table record is deleted

## Technical Notes

### Implementation Details
- **Location**: Update assistant configuration UI (voice assistants page)
- **Backend**: Create server actions for assign/unassign operations
- **VAPI Integration**: Use INTEL-002 service for query tool management

### VAPI Query Tool Structure
According to VAPI documentation, query tools are added to assistant configuration:
```typescript
{
  model: { ... },
  tools: [
    {
      type: 'knowledgeBase',
      knowledgeBaseId: 'kb_xxx',
      function: {
        name: 'searchKnowledgeBase',
        description: 'Search the knowledge base for relevant information to answer questions'
      }
    }
  ]
}
```

### Server Action Signatures
```typescript
async function assignDocumentStorageToVoiceAssistant(
  assistantId: string,
  documentStorageId: string,
  accountId: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
}>

async function unassignDocumentStorageFromVoiceAssistant(
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
3. Get VAPI knowledge base ID from document storage
4. Create query tool configuration
5. Update assistant configuration in VAPI with new tool
6. Insert record into `document_storage-assistants` table
7. Return success

### Processing Flow (Unassign)
1. Validate assignment exists
2. Get assistant's VAPI configuration
3. Remove query tool from assistant configuration
4. Update assistant in VAPI
5. Delete record from `document_storage-assistants` table
6. Return success

### Database Schema
**document_storage-assistants** table:
- `id` (UUID, PK)
- `assistant` (UUID, FK to assistants)
- `document_storage` (UUID, FK to document_storages)
- `created_at` (TIMESTAMP)
- Unique constraint on (assistant, document_storage)

### VAPI Assistant Update
Update assistant configuration:
```typescript
// Get current assistant config
const assistant = await vapiService.getAssistant(assistantId);

// Add query tool to tools array
const updatedTools = [
  ...(assistant.tools || []),
  {
    type: 'knowledgeBase',
    knowledgeBaseId: storage.vapi_knowledge_base_id,
    function: {
      name: `search_${storage.name.toLowerCase().replace(/\s+/g, '_')}`,
      description: `Search ${storage.name} knowledge base`
    }
  }
];

// Update assistant
await vapiService.updateAssistant(assistantId, { tools: updatedTools });
```

### Multiple Storage Handling
When assistant has multiple storages:
- Each storage gets its own query tool
- VAPI will search all query tools when responding
- Tools have unique names based on storage name
- User can see all assigned storages in UI

### Error Scenarios
- Assistant doesn't exist: Validation error
- Storage doesn't exist: Validation error
- VAPI KB not created for storage: Show error with instructions
- VAPI API failure: Retry with backoff, show error if fails
- Database constraint violation: Handle duplicate assignment gracefully

### UI Updates
- Document storage selection dropdown/modal on assistant page
- List of assigned storages with unassign buttons
- Loading states during assignment operations
- Success/error notifications
- Refresh assistant configuration after changes

## Definition of Done

- [ ] Server actions for assign/unassign implemented
- [ ] VAPI query tool creation logic implemented
- [ ] Junction table operations implemented
- [ ] Duplicate assignment prevention implemented
- [ ] Frontend UI for storage assignment
- [ ] List of assigned storages displayed
- [ ] Error handling for all scenarios
- [ ] Unit tests for server actions
- [ ] Integration tests with VAPI
- [ ] Manual testing of assignment workflows
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Dependencies

- **Requires**: INTEL-002 (VAPI Knowledge Base Service)
- **Requires**: INTEL-004 (Document storages must exist)
- **Requires**: Existing VAPI service for assistant management
- **Related**: INTEL-007 (deletion validation checks assignments)

## Related Stories

- **Blocked By**: INTEL-002, INTEL-004
- **Related**: INTEL-009 (WhatsApp assistant assignment)
- **Related**: INTEL-007 (prevents storage deletion if assigned)
