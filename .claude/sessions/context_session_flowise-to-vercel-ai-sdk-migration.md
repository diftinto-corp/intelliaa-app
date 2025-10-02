# Session Context: Flowise to Vercel AI SDK Migration

## Migration Overview

**Feature Name**: Migrate Document Storage from Flowise to Vercel AI SDK + VAPI
**Session ID**: flowise-to-vercel-ai-sdk-migration
**Date Started**: 2025-10-02
**Phase**: Phase 1 - Planning and User Story Creation

## Business Context

IntelliAA is a multi-tenant AI voice and WhatsApp assistant platform that currently uses Flowise for document processing and vector embeddings. The goal is to migrate from Flowise to Vercel AI SDK while maintaining VAPI integration for voice assistants.

## Current Architecture Analysis

### Existing Implementation

**Flowise Service** (`src/services/flowiseService.ts`):
- Creates document stores via Flowise API
- Processes PDF files using pdfFile loader
- Uses OpenAI embeddings (text-embedding-ada-002)
- Stores vectors in Pinecone with namespace isolation
- Uses PostgreSQL Record Manager for tracking
- Configuration: chunkSize: 1500, chunkOverlap: 750

**Document Actions** (`src/lib/actions/intelliaa/documents.ts`):
- Creates document storages with namespace pattern: `{name}-{random-6-chars}`
- Dual upload: Flowise for embeddings + VAPI for voice file storage
- Database tables: `document_storages`, `pdf_docs`, `qa_docs`
- Multi-tenant isolation via `account_id` and RLS policies
- Deletion cascade: Flowise vector store -> VAPI files -> Supabase records
- Validation: Cannot delete document storage if assigned to assistant

### Data Flow

1. **Document Storage Creation**:
   - User submits name, description, PDF file
   - Generate unique namespace: `{name}-{random}`
   - Create document store in Flowise
   - Process file with OpenAI embeddings to Pinecone
   - Upload file to VAPI
   - Save metadata to Supabase

2. **Document Addition**:
   - Upload PDF to existing document storage
   - Process with Flowise (same namespace)
   - Upload to VAPI
   - Save to `pdf_docs` table

3. **Document Deletion**:
   - Delete loader from Flowise
   - Reprocess vector store
   - Delete file from VAPI
   - Remove from Supabase
   - If last document: delete entire document storage

4. **Assistant Integration**:
   - WhatsApp assistants: Use namespace-based filtering
   - Voice assistants: Use VAPI file IDs via `documents_vapi` array
   - Junction table: `document_storage-assistants`

### Database Schema

**document_storages**:
- id (UUID, from Flowise)
- account_id (UUID, FK to accounts)
- name (text)
- description (text)
- namespace (text, unique per storage)

**pdf_docs**:
- id (UUID, from Flowise docId)
- account_id (UUID)
- document_storage_id (UUID, FK)
- name (text)
- id_vapi_doc (text, VAPI file ID)
- url (text, VAPI file URL)

**qa_docs**:
- Similar structure for Q&A document types
- vapiFileId (text)

**document_storage-assistants**:
- assistant (UUID, FK)
- document_storage (UUID, FK)

## Migration Requirements

### User Flow (Must Be Preserved)

1. User navigates to `/[accountSlug]/documents`
2. View list of document storages
3. Create new document storage:
   - Modal with name, description, first PDF
   - Embed document on creation
   - Redirect to detail page
4. Document detail page:
   - Preview documents
   - Edit description
   - Add new PDFs
   - Delete individual documents
   - Delete entire storage (with validation)
5. Multi-tenancy: Organization-level isolation via RLS

### Technical Requirements

1. **Vercel AI SDK Integration**:
   - Replace Flowise embeddings with Vercel AI SDK
   - Maintain OpenAI embeddings (text-embedding-ada-002)
   - Keep Pinecone as vector store
   - Preserve namespace isolation pattern

2. **VAPI Integration**:
   - Continue dual storage (embeddings + VAPI files)
   - Create VAPI knowledge bases after embedding
   - Use VAPI query tools for assistant integration

3. **Compatibility**:
   - WhatsApp assistants (v0 SDK)
   - Voice assistants (VAPI)

4. **Security**:
   - Maintain RLS policies
   - Account-based isolation
   - Namespace-based vector isolation

5. **Migration Path**:
   - Gradual migration or complete replacement
   - Backward compatibility considerations
   - Data migration strategy for existing documents

## Key Documentation

- Vercel AI SDK Embeddings: https://ai-sdk.dev/docs/ai-sdk-core/embeddings
- VAPI Custom Knowledge Base: https://docs.vapi.ai/knowledge-base/custom-knowledge-base
- VAPI Query Tool: https://docs.vapi.ai/knowledge-base/using-query-tool

## Next Steps

1. Consult specialized agents:
   - vercel-ai-sdk-architect: RAG architecture design
   - vapi-implementation-planner: VAPI knowledge base integration
   - supabase-architect: Database schema optimization
   - architecture-planner: Overall system integration

2. Define detailed user stories with acceptance criteria

3. Plan implementation phases

## Agents Consulted

- [x] Product Manager (self) - Created comprehensive user stories
- [ ] vercel-ai-sdk-architect - Can be consulted during implementation
- [ ] vapi-implementation-planner - Can be consulted during implementation
- [ ] supabase-architect - Can be consulted during implementation
- [ ] architecture-planner - Can be consulted during implementation

## Implementation Plan

### Phase 1: Foundation (P0 - Critical)
**Epic: Backend Service Migration**

1. **INTEL-011**: Update Environment Configuration (2 points)
   - Configure OpenAI, Pinecone, VAPI environment variables
   - Create validation utility
   - Update documentation

2. **INTEL-001**: Create Vercel AI SDK Embedding Service (5 points)
   - Implement embedding generation with OpenAI
   - Create text chunking logic (1500 chars, 750 overlap)
   - Handle PDF parsing and metadata extraction

3. **INTEL-003**: Create Pinecone Vector Store Service (5 points)
   - Implement upsert, query, delete operations
   - Namespace isolation and validation
   - Batch processing optimization

4. **INTEL-002**: Create VAPI Knowledge Base Service (5 points)
   - Create/update/delete knowledge bases
   - Generate query tool configurations
   - Handle batch document operations

### Phase 2: Core Features (P0 - Critical)
**Epic: Document Storage Creation & Management**

5. **INTEL-004**: Create Document Storage with Initial PDF (8 points)
   - Frontend modal with form
   - Backend integration with all services
   - Rollback logic for failures
   - Multi-tenant security enforcement

6. **INTEL-010**: Verify Multi-tenant Security (3 points)
   - Audit RLS policies
   - Test cross-account access prevention
   - Validate authorization in all endpoints

### Phase 3: Advanced Features (P1 - High)
**Epic: Document Management & Lifecycle**

7. **INTEL-005**: Add PDF Documents to Existing Storage (5 points)
   - Upload additional PDFs
   - Update existing knowledge bases
   - Handle concurrent uploads

8. **INTEL-006**: Delete PDF Document from Storage (5 points)
   - Individual document deletion
   - Vector and file cleanup
   - Last document cascade logic

9. **INTEL-007**: Delete Document Storage with Validation (5 points)
   - Full storage deletion
   - Assignment validation
   - Complete cleanup across services

### Phase 4: Assistant Integration (P1 - High)
**Epic: Assistant Integration**

10. **INTEL-008**: Assign Document Storage to Voice Assistant (5 points)
    - VAPI query tool creation
    - Assistant configuration updates
    - Multiple storage support

11. **INTEL-009**: Assign Document Storage to WhatsApp Assistant (5 points)
    - Namespace-based assignment
    - Railway configuration updates
    - Backward compatibility with v0 SDK

### Phase 5: API Layer (P1 - High)
**Epic: Backend Infrastructure**

12. **INTEL-012**: Create Document Storage API Routes (5 points)
    - RESTful API routes following Next.js 15 patterns
    - Authentication middleware
    - Request validation and error handling

### Total Effort Estimate
- **Total Story Points**: 58 points
- **Estimated Sprints**: 3-4 sprints (2-week sprints)
- **Critical Path**: INTEL-011 → INTEL-001/002/003 → INTEL-004 → INTEL-010

## Decisions & Trade-offs

### Key Architectural Decisions

1. **Complete Replacement vs Gradual Migration**
   - **Decision**: Complete replacement of Flowise
   - **Rationale**: Cleaner architecture, avoids dual maintenance, simpler testing
   - **Trade-off**: Requires more upfront development, no fallback to Flowise

2. **Vector Store Management**
   - **Decision**: Direct Pinecone client management via SDK
   - **Rationale**: More control, no Flowise abstraction overhead
   - **Trade-off**: Need to implement chunking and batching logic ourselves

3. **Document Storage ID Generation**
   - **Decision**: Generate UUIDs in application instead of using Flowise IDs
   - **Rationale**: Removes Flowise dependency, full control over ID format
   - **Trade-off**: Need to update database schema if using Flowise IDs currently

4. **VAPI Knowledge Base Timing**
   - **Decision**: Create knowledge base during document storage creation
   - **Rationale**: Ensures knowledge base exists before assistant assignment
   - **Trade-off**: Creates VAPI resource even if not immediately used

5. **Error Handling Strategy**
   - **Decision**: Rollback on partial failures with compensating transactions
   - **Rationale**: Maintains data consistency across distributed services
   - **Trade-off**: Complex error handling, potential for orphaned resources

6. **Multi-tenant Isolation**
   - **Decision**: RLS policies + namespace isolation + application-level checks
   - **Rationale**: Defense in depth, multiple layers of security
   - **Trade-off**: Performance overhead from multiple validation checks

### Technical Trade-offs

**Pros of Migration**:
- Direct control over embedding pipeline
- Reduced external dependencies (no Flowise)
- Better error handling and observability
- Simplified architecture
- Cost optimization (fewer API calls)
- Faster iteration on document processing

**Cons of Migration**:
- Increased development effort (58 story points)
- Need to implement chunking logic ourselves
- More code to maintain
- Migration complexity for existing data
- Testing complexity across multiple services

### Risk Assessment

**High Risk**:
- Data consistency across distributed services (Pinecone, VAPI, Supabase)
- Migration of existing document storages
- Performance with large PDFs (>100 pages)

**Medium Risk**:
- VAPI API rate limiting
- Pinecone quota limits
- Concurrent document operations

**Low Risk**:
- OpenAI API availability (mature service)
- RLS policy enforcement (well-tested pattern)

### Mitigation Strategies

1. **Data Consistency**: Implement comprehensive rollback logic and background cleanup jobs
2. **Performance**: Batch operations, implement timeouts, show progress indicators
3. **Rate Limiting**: Exponential backoff retry logic, queue management
4. **Migration**: Phase existing data migration separately, provide migration tools

## User Stories Created

All 12 user stories have been documented in `.claude/user_histories/`:

1. INTEL-001: Create Vercel AI SDK Embedding Service
2. INTEL-002: Create VAPI Knowledge Base Service
3. INTEL-003: Create Pinecone Vector Store Service
4. INTEL-004: Create Document Storage with Initial PDF
5. INTEL-005: Add PDF Documents to Existing Storage
6. INTEL-006: Delete PDF Document from Storage
7. INTEL-007: Delete Document Storage with Validation
8. INTEL-008: Assign Document Storage to Voice Assistant
9. INTEL-009: Assign Document Storage to WhatsApp Assistant
10. INTEL-010: Verify Multi-tenant Security
11. INTEL-011: Update Environment Configuration
12. INTEL-012: Create Document Storage API Routes

Each story includes:
- User story in standard format
- Detailed acceptance criteria (Given-When-Then)
- Technical implementation notes
- Dependencies and related stories
- Definition of done checklist
