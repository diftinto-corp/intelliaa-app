# INTEL-001: Create Vercel AI SDK Embedding Service

**Epic**: Backend Service Migration
**Priority**: P0 - Critical
**Estimate**: 5 points
**Labels**: backend, infrastructure, embeddings

## User Story

As a backend developer, I want to create a new embedding service using Vercel AI SDK, so that I can generate document embeddings without depending on Flowise.

## Acceptance Criteria

### AC1: Basic Embedding Generation
**Given** a PDF file buffer and document metadata
**When** I call the embedding service with the file data
**Then** it returns embedding vectors using OpenAI text-embedding-ada-002 model

### AC2: Document Chunking
**Given** a document larger than 10 pages
**When** processing the document
**Then** the service chunks the text into segments of 1500 characters with 750 character overlap

### AC3: Error Handling with Retry
**Given** the embedding generation fails due to temporary API error
**When** the service encounters the error
**Then** it implements retry logic with exponential backoff (max 3 attempts) and throws descriptive error if all retries fail

### AC4: Response Format
**Given** embeddings are generated successfully
**When** the function returns
**Then** it returns an array of objects with structure: `{text: string, embedding: number[], metadata: Record<string, any>}`

### AC5: File Type Validation
**Given** a non-PDF file is provided
**When** attempting to process
**Then** the service validates the file type and returns a validation error before processing

### AC6: Rate Limit Handling
**Given** the OpenAI API is rate-limited (429 status)
**When** processing embeddings
**Then** the service implements exponential backoff retry strategy with delays: 1s, 2s, 4s

### AC7: Batch Processing Optimization
**Given** multiple document chunks need embedding
**When** processing
**Then** the service uses `embedMany` function to batch process up to 50 chunks at once for efficiency

## Technical Notes

### Implementation Details
- **Package**: Use `ai` package from Vercel AI SDK (v4+)
- **Provider**: Import OpenAI provider: `import { openai } from '@ai-sdk/openai'`
- **Functions**: Use `embed` for single embeddings, `embedMany` for batch processing
- **File Location**: Create `src/services/embeddingService.ts`

### Dependencies to Install
```bash
npm install ai @ai-sdk/openai pdf-parse --legacy-peer-deps
```

### Environment Variables
```
OPENAI_API_KEY=sk-... (required)
```

### Text Chunking Algorithm
Implement RecursiveCharacterTextSplitter pattern:
- Chunk size: 1500 characters
- Overlap: 750 characters
- Separators priority: `\n\n`, `\n`, `. `, ` `, ``
- Preserve word boundaries

### PDF Parsing
- Use `pdf-parse` library for text extraction
- Handle multi-page PDFs
- Extract metadata (page numbers, title, author)
- Clean extracted text (remove excessive whitespace, special characters)

### Service Interface
```typescript
interface EmbeddingServiceConfig {
  model?: string; // default: 'text-embedding-ada-002'
  chunkSize?: number; // default: 1500
  chunkOverlap?: number; // default: 750
  maxRetries?: number; // default: 3
}

interface EmbeddingResult {
  text: string;
  embedding: number[];
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    totalChunks: number;
    [key: string]: any;
  };
}

export async function generateEmbeddings(
  file: Buffer,
  config?: EmbeddingServiceConfig
): Promise<EmbeddingResult[]>
```

## Definition of Done

- [ ] Service file created at `src/services/embeddingService.ts`
- [ ] Dependencies installed and configured
- [ ] Unit tests written with mock OpenAI responses
- [ ] Integration test with real OpenAI API (skipped in CI)
- [ ] Error handling tested for all failure scenarios
- [ ] Documentation added with usage examples
- [ ] Code reviewed and approved
- [ ] Environment variables documented in `.env.example`

## Dependencies

- OpenAI API key must be configured
- Package installations must be completed before development
- No blocking dependencies from other stories

## Related Stories

- **Blocks**: INTEL-004 (Create Document Storage with Initial PDF)
- **Blocks**: INTEL-005 (Add PDF Documents to Existing Storage)
- **Related**: INTEL-003 (Pinecone Vector Store Service)
