# INTEL-002: Create VAPI Knowledge Base Service

**Epic**: Backend Service Migration
**Priority**: P0 - Critical
**Estimate**: 5 points
**Labels**: backend, infrastructure, vapi, knowledge-base

## User Story

As a backend developer, I want to create a VAPI knowledge base service, so that I can create and manage VAPI knowledge bases for document storages.

## Acceptance Criteria

### AC1: Create Knowledge Base
**Given** one or more documents uploaded to VAPI
**When** I call `createKnowledgeBase` with document file IDs and name
**Then** the service creates a VAPI knowledge base and returns the knowledge base ID

### AC2: Create Query Tool Configuration
**Given** a knowledge base ID exists
**When** I call `createQueryTool` with the knowledge base ID
**Then** the service returns a VAPI query tool configuration object ready for assistant integration

### AC3: Update Knowledge Base
**Given** a knowledge base exists
**When** I add or remove document file IDs
**Then** the service updates the knowledge base with the new document list

### AC4: Delete Knowledge Base
**Given** a knowledge base exists
**When** I call `deleteKnowledgeBase` with the knowledge base ID
**Then** the service removes the knowledge base and all associated query tools from VAPI

### AC5: Error Handling with Retry
**Given** VAPI API fails with 5xx error
**When** calling any service method
**Then** it implements retry logic with exponential backoff (max 3 attempts)

### AC6: Batch Document Handling
**Given** multiple documents need to be added to a knowledge base
**When** creating or updating the knowledge base
**Then** the service batches document IDs appropriately (max 100 per request)

### AC7: List Knowledge Bases
**Given** an account has knowledge bases
**When** I call `listKnowledgeBases`
**Then** the service returns all knowledge bases with their metadata

## Technical Notes

### Implementation Details
- **File Location**: Create `src/services/vapiKnowledgeBaseService.ts`
- **Existing Service**: Extend or replace logic in `src/services/vapiService.ts`
- **API Documentation**: https://docs.vapi.ai/knowledge-base/custom-knowledge-base

### VAPI API Endpoints
```
POST /knowledge-base - Create knowledge base
GET /knowledge-base/:id - Get knowledge base details
PATCH /knowledge-base/:id - Update knowledge base
DELETE /knowledge-base/:id - Delete knowledge base
POST /tool - Create query tool
```

### Environment Variables
```
NEXT_PRIVATE_VAPI_KEY=xxx (already configured)
VAPI_API_URL=https://api.vapi.ai (default)
```

### Service Interface
```typescript
interface KnowledgeBaseConfig {
  name: string;
  description?: string;
  fileIds: string[]; // VAPI file IDs
}

interface QueryToolConfig {
  type: 'knowledgeBase';
  knowledgeBaseId: string;
  server?: {
    url: string;
  };
}

export async function createKnowledgeBase(
  config: KnowledgeBaseConfig
): Promise<{ id: string; name: string }>

export async function createQueryTool(
  knowledgeBaseId: string,
  name?: string
): Promise<QueryToolConfig>

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  updates: Partial<KnowledgeBaseConfig>
): Promise<void>

export async function deleteKnowledgeBase(
  knowledgeBaseId: string
): Promise<void>

export async function listKnowledgeBases(): Promise<Array<{
  id: string;
  name: string;
  fileIds: string[];
}>>
```

### Query Tool Integration
According to VAPI docs, query tools are created separately and linked to assistants:
```typescript
// Example query tool configuration
{
  type: 'knowledgeBase',
  knowledgeBaseId: 'kb_xxx',
  function: {
    name: 'searchKnowledgeBase',
    description: 'Search the knowledge base for relevant information'
  }
}
```

### Error Handling Strategy
- 400 errors: Validation issues, don't retry
- 401/403 errors: Authentication issues, don't retry
- 429 errors: Rate limiting, retry with backoff
- 5xx errors: Server issues, retry with backoff
- Network errors: Retry with backoff

## Definition of Done

- [ ] Service file created with all CRUD operations
- [ ] Error handling and retry logic implemented
- [ ] Unit tests with mocked VAPI API responses
- [ ] Integration test with real VAPI API (manual testing)
- [ ] Documentation with usage examples
- [ ] Code reviewed and approved
- [ ] Existing `vapiService.ts` refactored if needed

## Dependencies

- VAPI API key must be configured (already done)
- Document files must be uploaded to VAPI before creating knowledge bases
- No blocking dependencies from other stories

## Related Stories

- **Blocks**: INTEL-004 (Create Document Storage with Initial PDF)
- **Blocks**: INTEL-008 (Assign Document Storage to Voice Assistant)
- **Related**: Existing VAPI file upload functionality in `vapiService.ts`
