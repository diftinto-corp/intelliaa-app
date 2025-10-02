# Testing Implementation Plan: Vercel AI SDK Embedding Service

**Story**: INTEL-001 - Create Vercel AI SDK Embedding Service
**Created**: 2025-10-02
**Status**: Planning Phase
**Testing Framework**: Vitest (recommended for Next.js 15+)

---

## Executive Summary

This document outlines a comprehensive testing strategy for the new Vercel AI SDK embedding service (`src/services/embeddingService.ts`). The testing approach covers unit tests with mocked OpenAI API calls, integration tests with real API calls (local-only), and robust test data management. The strategy ensures high code quality (>80% coverage for critical paths) while maintaining fast test execution and clear failure messages.

**Key Testing Goals:**
- Verify text chunking algorithm correctness and edge cases
- Validate OpenAI API integration with proper retry logic
- Ensure error handling for all failure scenarios (rate limits, invalid files, network errors)
- Test PDF parsing with various document structures
- Validate multi-tenant data isolation and RLS compliance

**Recommended Testing Stack:**
- **Framework**: Vitest (faster than Jest, better Next.js 15 compatibility)
- **Mocking**: Vitest's `vi.mock()` for OpenAI SDK
- **Assertions**: Vitest's built-in Chai-based assertions
- **Coverage**: Vitest's native coverage tools (c8)
- **Environment**: Node.js (for server-side code)

---

## 1. Testing Architecture

### 1.1 Testing Pyramid

```
                    Integration Tests (Real OpenAI API)
                    ~5 tests, skipped in CI
                   /                        \
                  /                          \
                 /    Unit Tests (Mocked)     \
                /     ~25-30 tests, fast       \
               /________________________________\
```

### 1.2 Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| PDF Parsing | 90% | Critical |
| Text Chunking | 95% | Critical |
| Embedding Generation | 85% | Critical |
| Retry Logic | 90% | Critical |
| Error Handling | 80% | High |
| File Validation | 100% | High |
| Helper Functions | 70% | Medium |

### 1.3 Test Categories

**Unit Tests (Mocked - Run in CI)**
- Text chunking algorithm with various inputs
- PDF parsing with mocked pdf-parse
- OpenAI API calls with mocked responses
- Retry logic with simulated failures
- File validation (type, size)
- Error message construction
- Configuration handling

**Integration Tests (Real API - Local Only)**
- End-to-end document processing with real OpenAI
- Large file handling (100+ pages)
- Rate limit handling with actual 429 responses
- Network timeout scenarios
- Cost estimation validation

**Edge Case Tests**
- Empty PDFs
- Corrupted PDF files
- PDFs with only images (no text)
- Very small chunks (<100 chars)
- Very large chunks (>10,000 chars)
- Unicode and special characters
- PDFs with tables and complex layouts

---

## 2. File-by-File Implementation Plan

### 2.1 Test File Structure

```
src/
├── services/
│   ├── embeddingService.ts                    # Implementation
│   └── __tests__/
│       ├── embeddingService.unit.test.ts      # Unit tests (mocked)
│       ├── embeddingService.integration.test.ts # Integration tests (real API)
│       └── fixtures/
│           ├── sample-small.pdf               # 5 pages, ~10 chunks
│           ├── sample-medium.pdf              # 20 pages, ~40 chunks
│           ├── sample-large.pdf               # 100 pages, ~200 chunks
│           ├── empty.pdf                      # Empty document
│           ├── corrupted.pdf                  # Malformed PDF
│           ├── images-only.pdf                # No extractable text
│           └── unicode-test.pdf               # Special characters
└── __tests__/
    └── setup.ts                               # Global test configuration
```

### 2.2 New Files to Create

#### File 1: `vitest.config.ts` (Root Level)

**Purpose**: Configure Vitest for the project

**Content**:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Test environment
    environment: 'node', // Use 'jsdom' for component tests

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/services/**/*.ts'],
      exclude: [
        'src/services/**/*.test.ts',
        'src/services/**/__tests__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Setup files
    setupFiles: ['./src/__tests__/setup.ts'],

    // Test globals
    globals: true,

    // Timeout configuration
    testTimeout: 10000, // 10 seconds
    hookTimeout: 10000,

    // Include/exclude patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next'],

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
    },
  },
});
```

**Rationale**:
- Vitest is faster than Jest and has better Next.js 15 support
- Path aliases from tsconfig.json are automatically resolved
- Coverage thresholds enforce quality gates

---

#### File 2: `src/__tests__/setup.ts`

**Purpose**: Global test setup and configuration

**Content**:
```typescript
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'sk-test-mock-key';
process.env.EMBEDDING_CHUNK_SIZE = '1500';
process.env.EMBEDDING_CHUNK_OVERLAP = '750';
process.env.EMBEDDING_MAX_RETRIES = '3';

// Extend Vitest matchers if needed
expect.extend({
  toBeValidEmbedding(received: number[]) {
    const pass =
      Array.isArray(received) &&
      received.length === 1536 &&
      received.every(n => typeof n === 'number');

    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid embedding`
        : `Expected ${received} to be a valid embedding (1536 floats)`,
    };
  },
});

// Global test utilities
global.createMockPdfBuffer = (text: string): Buffer => {
  // Simple mock PDF structure for testing
  return Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);
};

// Silence console errors/warnings in tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
```

**Rationale**:
- Centralizes test configuration
- Provides custom matchers for embedding validation
- Mocks environment variables for consistent test runs
- Silences console noise during tests

---

#### File 3: `src/services/__tests__/embeddingService.unit.test.ts`

**Purpose**: Unit tests with mocked OpenAI API calls

**Content**:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEmbeddings, chunkDocument, validatePdfFile } from '../embeddingService';
import type { EmbeddingServiceConfig, EmbeddingResult } from '../embeddingService';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock dependencies
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn(() => ({
      modelId: 'text-embedding-ada-002',
    })),
  },
}));

vi.mock('ai', () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

describe('embeddingService - Unit Tests', () => {
  // Import mocked modules
  const { embed, embedMany } = await import('ai');
  const pdfParse = (await import('pdf-parse')).default;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validatePdfFile', () => {
    it('should accept valid PDF files', () => {
      const validBuffer = Buffer.from('%PDF-1.4\ntest content\n%%EOF');

      expect(() => validatePdfFile(validBuffer, 'test.pdf')).not.toThrow();
    });

    it('should reject files exceeding max size', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      expect(() => validatePdfFile(largeBuffer, 'large.pdf')).toThrow(
        'File size exceeds maximum allowed size of 10MB'
      );
    });

    it('should reject non-PDF file types', () => {
      const invalidBuffer = Buffer.from('not a pdf');

      expect(() => validatePdfFile(invalidBuffer, 'document.txt')).toThrow(
        'Invalid file type. Only PDF files are supported'
      );
    });

    it('should reject empty files', () => {
      const emptyBuffer = Buffer.alloc(0);

      expect(() => validatePdfFile(emptyBuffer, 'empty.pdf')).toThrow(
        'File is empty'
      );
    });

    it('should validate PDF magic number', () => {
      const invalidPdfBuffer = Buffer.from('fake pdf content');

      expect(() => validatePdfFile(invalidPdfBuffer, 'fake.pdf')).toThrow(
        'Invalid PDF file format'
      );
    });
  });

  describe('chunkDocument', () => {
    it('should chunk text with default configuration', async () => {
      const text = 'A'.repeat(3000); // 3000 characters
      const chunks = await chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].text.length).toBeLessThanOrEqual(1500);
      expect(chunks[0].metadata.chunkIndex).toBe(0);
      expect(chunks[0].metadata.totalChunks).toBe(chunks.length);
    });

    it('should respect custom chunk size', async () => {
      const text = 'B'.repeat(2000);
      const config: EmbeddingServiceConfig = {
        chunkSize: 500,
        chunkOverlap: 100,
      };

      const chunks = await chunkDocument(text, config);

      expect(chunks.every(c => c.text.length <= 500)).toBe(true);
    });

    it('should handle overlap correctly', async () => {
      const text = 'This is a test sentence. '.repeat(100);
      const config: EmbeddingServiceConfig = {
        chunkSize: 100,
        chunkOverlap: 20,
      };

      const chunks = await chunkDocument(text, config);

      // Check that consecutive chunks have overlapping content
      if (chunks.length > 1) {
        const chunk1End = chunks[0].text.slice(-20);
        const chunk2Start = chunks[1].text.slice(0, 20);

        // There should be some overlap
        expect(chunk2Start).toContain(chunk1End.slice(0, 10));
      }
    });

    it('should handle very short text', async () => {
      const text = 'Short text';
      const chunks = await chunkDocument(text);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should preserve word boundaries', async () => {
      const text = 'word1 word2 word3 '.repeat(200);
      const chunks = await chunkDocument(text);

      // No chunk should split words (end/start with partial words)
      chunks.forEach(chunk => {
        if (chunk.text.length > 10) {
          // Should start and end with complete words or punctuation
          expect(chunk.text.trim()).toMatch(/^[\w\s].*[\w\s.]$/);
        }
      });
    });

    it('should handle empty text', async () => {
      const chunks = await chunkDocument('');

      expect(chunks.length).toBe(0);
    });

    it('should handle unicode characters', async () => {
      const text = 'Hello 世界 🌍 '.repeat(200);
      const chunks = await chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('世界');
      expect(chunks[0].text).toContain('🌍');
    });

    it('should add metadata to each chunk', async () => {
      const text = 'Test '.repeat(500);
      const chunks = await chunkDocument(text, {
        metadata: { documentId: 'doc-123' }
      });

      chunks.forEach((chunk, idx) => {
        expect(chunk.metadata.chunkIndex).toBe(idx);
        expect(chunk.metadata.totalChunks).toBe(chunks.length);
        expect(chunk.metadata.documentId).toBe('doc-123');
      });
    });
  });

  describe('generateEmbeddings - PDF Parsing', () => {
    it('should parse PDF and extract text', async () => {
      const mockPdfData = {
        text: 'This is extracted PDF text',
        numpages: 1,
        info: { Title: 'Test Document' },
      };

      vi.mocked(pdfParse).mockResolvedValue(mockPdfData as any);
      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [[0.1, 0.2, ...Array(1534).fill(0)]],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer);

      expect(pdfParse).toHaveBeenCalledWith(pdfBuffer);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle PDF parsing errors', async () => {
      vi.mocked(pdfParse).mockRejectedValue(new Error('Corrupted PDF'));

      const pdfBuffer = Buffer.from('corrupted data');

      await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
        'Failed to parse PDF'
      );
    });

    it('should handle PDFs with no extractable text', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: '',
        numpages: 1,
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
        'No text could be extracted from PDF'
      );
    });

    it('should extract page numbers from metadata', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Page 1 content\f\nPage 2 content',
        numpages: 2,
      } as any);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [
          Array(1536).fill(0.1),
          Array(1536).fill(0.2),
        ],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer);

      // Verify page numbers are tracked
      expect(results.some(r => r.metadata.pageNumber !== undefined)).toBe(true);
    });
  });

  describe('generateEmbeddings - OpenAI API Integration', () => {
    it('should use embedMany for batch processing', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'A'.repeat(10000), // Creates multiple chunks
        numpages: 5,
      } as any);

      const mockEmbeddings = Array(10).fill(null).map(() =>
        Array(1536).fill(Math.random())
      );

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: mockEmbeddings,
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer);

      expect(embedMany).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(mockEmbeddings.length);
      expect(results[0].embedding).toHaveLength(1536);
    });

    it('should batch process large documents in groups of 50', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'A'.repeat(150000), // Creates ~100 chunks
        numpages: 100,
      } as any);

      const mockEmbedding = Array(1536).fill(0.5);
      vi.mocked(embedMany).mockImplementation(async ({ values }) => ({
        embeddings: values.map(() => mockEmbedding),
      } as any));

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      await generateEmbeddings(pdfBuffer);

      // Should call embedMany multiple times (100 chunks / 50 per batch = 2 calls)
      expect(vi.mocked(embedMany).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should use correct embedding model', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [Array(1536).fill(0.1)],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      await generateEmbeddings(pdfBuffer, {
        model: 'text-embedding-ada-002',
      });

      // Verify correct model is passed
      expect(embedMany).toHaveBeenCalled();
      const callArgs = vi.mocked(embedMany).mock.calls[0][0];
      expect(callArgs.model.modelId).toBe('text-embedding-ada-002');
    });
  });

  describe('generateEmbeddings - Retry Logic', () => {
    it('should retry on rate limit errors (429)', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      // First 2 calls fail with 429, 3rd succeeds
      vi.mocked(embedMany)
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockResolvedValueOnce({
          embeddings: [Array(1536).fill(0.1)],
        } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer, {
        maxRetries: 3,
      });

      expect(embedMany).toHaveBeenCalledTimes(3);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use exponential backoff for retries', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      const startTime = Date.now();

      vi.mocked(embedMany)
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValueOnce({
          embeddings: [Array(1536).fill(0.1)],
        } as any);

      // Use fake timers
      vi.useFakeTimers();

      const promise = generateEmbeddings(Buffer.from('%PDF-1.4\ntest\n%%EOF'), {
        maxRetries: 3,
      });

      // Advance timers to simulate backoff delays
      await vi.advanceTimersByTimeAsync(1000); // 1st retry: 1s
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry: 2s

      await promise;

      vi.useRealTimers();

      expect(embedMany).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exhausted', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded'
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');

      await expect(
        generateEmbeddings(pdfBuffer, { maxRetries: 3 })
      ).rejects.toThrow('Failed to generate embeddings after 3 retries');
    });

    it('should not retry on non-retryable errors', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockRejectedValue({
        status: 400,
        message: 'Invalid request'
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');

      await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow();

      // Should only be called once (no retries for 400 errors)
      expect(embedMany).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          embeddings: [Array(1536).fill(0.1)],
        } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer);

      expect(embedMany).toHaveBeenCalledTimes(2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('generateEmbeddings - Error Handling', () => {
    it('should provide descriptive error messages', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockRejectedValue({
        status: 401,
        message: 'Invalid API key',
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');

      await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
        /API key/i
      );
    });

    it('should sanitize errors for user display', async () => {
      vi.mocked(pdfParse).mockRejectedValue(
        new Error('Internal error with sensitive data: API_KEY=sk-123')
      );

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');

      await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow();

      // Error should not contain sensitive data
      try {
        await generateEmbeddings(pdfBuffer);
      } catch (error: any) {
        expect(error.message).not.toContain('sk-');
      }
    });

    it('should track partial progress on failure', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'A'.repeat(150000), // ~100 chunks
        numpages: 100,
      } as any);

      const mockEmbedding = Array(1536).fill(0.5);

      // First batch succeeds, second fails
      vi.mocked(embedMany)
        .mockResolvedValueOnce({
          embeddings: Array(50).fill(mockEmbedding),
        } as any)
        .mockRejectedValueOnce(new Error('API Error'));

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');

      try {
        await generateEmbeddings(pdfBuffer);
      } catch (error: any) {
        // Error should include progress information
        expect(error.message).toMatch(/50.*100/); // "50 of 100 chunks"
      }
    });
  });

  describe('generateEmbeddings - Configuration', () => {
    it('should use default configuration when not provided', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [Array(1536).fill(0.1)],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      await generateEmbeddings(pdfBuffer);

      // Verify default chunk size (1500) was used
      const callArgs = vi.mocked(embedMany).mock.calls[0][0];
      expect(callArgs.values[0].length).toBeLessThanOrEqual(1500);
    });

    it('should merge custom config with defaults', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'A'.repeat(5000),
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [Array(1536).fill(0.1)],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      await generateEmbeddings(pdfBuffer, {
        chunkSize: 500, // Custom
        // chunkOverlap defaults to 750
        // maxRetries defaults to 3
      });

      // Verify custom chunk size was applied
      const callArgs = vi.mocked(embedMany).mock.calls[0][0];
      expect(callArgs.values.every((v: string) => v.length <= 500)).toBe(true);
    });

    it('should pass metadata through to results', async () => {
      vi.mocked(pdfParse).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
      } as any);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [Array(1536).fill(0.1)],
      } as any);

      const pdfBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      const results = await generateEmbeddings(pdfBuffer, {
        metadata: {
          accountId: 'acc-123',
          documentId: 'doc-456',
        },
      });

      expect(results[0].metadata.accountId).toBe('acc-123');
      expect(results[0].metadata.documentId).toBe('doc-456');
    });
  });
});
```

**Test Count**: ~30 unit tests
**Execution Time**: <5 seconds (all mocked)
**Coverage Target**: 85%+

---

#### File 4: `src/services/__tests__/embeddingService.integration.test.ts`

**Purpose**: Integration tests with real OpenAI API (local-only, skipped in CI)

**Content**:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { generateEmbeddings } from '../embeddingService';
import { readFileSync } from 'fs';
import { join } from 'path';

// Skip these tests in CI environment
const runIntegrationTests = !process.env.CI && process.env.OPENAI_API_KEY;

describe.skipIf(!runIntegrationTests)('embeddingService - Integration Tests', () => {
  const fixturesPath = join(__dirname, 'fixtures');

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Skipping integration tests: OPENAI_API_KEY not set');
    }
  });

  it('should process a real small PDF (5 pages)', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-small.pdf'));

    const results = await generateEmbeddings(pdfBuffer);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(20); // ~10 chunks expected

    // Verify embedding structure
    results.forEach(result => {
      expect(result.embedding).toHaveLength(1536);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.metadata.chunkIndex).toBeGreaterThanOrEqual(0);
    });
  }, 30000); // 30 second timeout

  it('should process a medium PDF (20 pages)', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-medium.pdf'));

    const startTime = Date.now();
    const results = await generateEmbeddings(pdfBuffer);
    const duration = Date.now() - startTime;

    expect(results.length).toBeGreaterThan(20);
    expect(results.length).toBeLessThan(60);

    // Performance check
    console.log(`Medium PDF processed in ${duration}ms (${results.length} chunks)`);
    expect(duration).toBeLessThan(15000); // Should complete in <15 seconds
  }, 30000);

  it('should handle large PDF (100 pages) with batch processing', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-large.pdf'));

    const startTime = Date.now();
    const results = await generateEmbeddings(pdfBuffer);
    const duration = Date.now() - startTime;

    expect(results.length).toBeGreaterThan(100);

    // Verify batching occurred (should be multiple API calls)
    console.log(`Large PDF processed in ${duration}ms (${results.length} chunks)`);

    // Cost estimation
    const estimatedTokens = results.length * 750; // ~750 tokens per chunk
    const estimatedCost = (estimatedTokens / 1000) * 0.0001; // $0.0001 per 1K tokens
    console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
  }, 60000); // 60 second timeout

  it('should handle rate limits gracefully', async () => {
    // Process multiple documents rapidly to potentially trigger rate limit
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-small.pdf'));

    const promises = Array(5).fill(null).map(() =>
      generateEmbeddings(pdfBuffer)
    );

    // All should eventually succeed with retry logic
    const results = await Promise.all(promises);

    expect(results.every(r => r.length > 0)).toBe(true);
  }, 120000);

  it('should produce consistent embeddings for identical content', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-small.pdf'));

    const results1 = await generateEmbeddings(pdfBuffer);
    const results2 = await generateEmbeddings(pdfBuffer);

    // Same number of chunks
    expect(results1.length).toBe(results2.length);

    // Embeddings should be nearly identical (cosine similarity ~1.0)
    const embedding1 = results1[0].embedding;
    const embedding2 = results2[0].embedding;

    const cosineSimilarity = calculateCosineSimilarity(embedding1, embedding2);
    expect(cosineSimilarity).toBeGreaterThan(0.99);
  }, 30000);

  it('should handle PDFs with complex layouts', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'complex-layout.pdf'));

    const results = await generateEmbeddings(pdfBuffer);

    expect(results.length).toBeGreaterThan(0);

    // Verify text extraction quality
    const allText = results.map(r => r.text).join(' ');
    expect(allText.length).toBeGreaterThan(100);

    // Should not have excessive whitespace or garbled text
    expect(allText).not.toMatch(/\s{10,}/); // No 10+ consecutive spaces
  }, 30000);

  it('should track costs accurately', async () => {
    const pdfBuffer = readFileSync(join(fixturesPath, 'sample-medium.pdf'));

    const startTime = Date.now();
    const results = await generateEmbeddings(pdfBuffer, {
      metadata: { trackCost: true },
    });
    const duration = Date.now() - startTime;

    // Calculate actual cost
    const totalChunks = results.length;
    const estimatedTokens = totalChunks * 750;
    const estimatedCost = (estimatedTokens / 1000) * 0.0001;

    console.log({
      chunks: totalChunks,
      estimatedTokens,
      estimatedCost: `$${estimatedCost.toFixed(6)}`,
      processingTime: `${duration}ms`,
    });

    expect(estimatedCost).toBeLessThan(0.01); // Should be less than 1 cent
  }, 30000);
});

// Helper function
function calculateCosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

**Test Count**: ~7 integration tests
**Execution Time**: 2-5 minutes (real API calls)
**Purpose**: Validate real-world behavior and performance

---

#### File 5: `src/services/__tests__/fixtures/README.md`

**Purpose**: Document test fixtures

**Content**:
```markdown
# Test Fixtures for Embedding Service

This directory contains PDF files used for testing the embedding service.

## Files

### sample-small.pdf
- **Size**: ~50KB
- **Pages**: 5
- **Expected Chunks**: ~10
- **Use Case**: Fast unit tests, basic functionality

### sample-medium.pdf
- **Size**: ~200KB
- **Pages**: 20
- **Expected Chunks**: ~40
- **Use Case**: Integration tests, performance benchmarks

### sample-large.pdf
- **Size**: ~1MB
- **Pages**: 100
- **Expected Chunks**: ~200
- **Use Case**: Stress testing, batch processing validation

### empty.pdf
- **Size**: <1KB
- **Pages**: 0
- **Content**: No text
- **Use Case**: Error handling for empty documents

### corrupted.pdf
- **Size**: ~10KB
- **Content**: Malformed PDF structure
- **Use Case**: Error handling for invalid files

### images-only.pdf
- **Size**: ~500KB
- **Pages**: 5
- **Content**: Only images, no extractable text
- **Use Case**: Edge case for documents without text

### unicode-test.pdf
- **Size**: ~30KB
- **Pages**: 3
- **Content**: Multiple languages (English, Chinese, Arabic, Emoji)
- **Use Case**: Unicode handling, special characters

### complex-layout.pdf
- **Size**: ~150KB
- **Pages**: 10
- **Content**: Tables, multi-column text, headers/footers
- **Use Case**: Complex layout extraction

## Generating Fixtures

To regenerate test fixtures:

```bash
npm run generate-fixtures
```

This will create sample PDFs with known content for consistent testing.

## Notes

- All fixtures are committed to git for reproducible tests
- Real PDF files from public domain sources
- No sensitive or copyrighted content
```

---

### 2.3 Configuration Files to Update

#### File: `package.json`

**Changes**:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:integration": "INTEGRATION_TESTS=true vitest run src/services/__tests__/*.integration.test.ts",
    "generate-fixtures": "node scripts/generateTestFixtures.js"
  },
  "devDependencies": {
    "@cloudflare/next-on-pages": "^1.12.1",
    "@types/node": "^22.10.5",
    "@types/react": "19.1.17",
    "@types/react-dom": "19.1.11",
    "@vitejs/plugin-react": "^4.3.4",
    "@vitest/coverage-v8": "^2.1.8",
    "@vitest/ui": "^2.1.8",
    "encoding": "^0.1.13",
    "framer-motion": "^11.3.17",
    "jsdom": "^25.0.1",
    "pnpm": "^9.5.0",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^2.1.8",
    "wrangler": "^3.65.0"
  }
}
```

**Dependencies to Install**:
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths jsdom --legacy-peer-deps
```

---

#### File: `.env.test` (New File)

**Purpose**: Environment variables specific to test environment

**Content**:
```bash
# Test Environment Configuration
NODE_ENV=test

# OpenAI API Key (use test key or mock)
OPENAI_API_KEY=sk-test-mock-key-do-not-use-in-production

# Embedding Service Configuration
EMBEDDING_CHUNK_SIZE=1500
EMBEDDING_CHUNK_OVERLAP=750
EMBEDDING_MAX_RETRIES=3

# Feature Flags
NEXT_PUBLIC_USE_VERCEL_EMBEDDINGS=true

# Skip integration tests in CI
CI=false

# Database (use test database)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
```

**Note**: For real integration tests locally, developers should copy `.env.test.local.example` and add their real `OPENAI_API_KEY`.

---

#### File: `.gitignore`

**Add**:
```
# Test coverage
coverage/
.vitest/

# Local test environment
.env.test.local

# Test output
test-results/
```

---

## 3. Mock Strategies for External Services

### 3.1 OpenAI API Mocking

**Strategy**: Use Vitest's `vi.mock()` to intercept OpenAI SDK calls

**Mock Implementation**:
```typescript
// In test files
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn((modelId: string) => ({
      modelId,
      provider: 'openai',
    })),
  },
}));

vi.mock('ai', () => ({
  embed: vi.fn(async ({ model, value }) => ({
    embedding: Array(1536).fill(0.5), // Mock 1536-dim vector
    usage: { tokens: value.length },
  })),

  embedMany: vi.fn(async ({ model, values }) => ({
    embeddings: values.map(() => Array(1536).fill(0.5)),
    usage: { tokens: values.reduce((sum, v) => sum + v.length, 0) },
  })),
}));
```

**Mock Response Structures**:
```typescript
// Success response
const mockSuccessResponse = {
  embeddings: [
    Array(1536).fill(0.123),  // First chunk embedding
    Array(1536).fill(0.456),  // Second chunk embedding
  ],
  usage: {
    promptTokens: 1500,
    totalTokens: 1500,
  },
};

// Rate limit error (429)
const mockRateLimitError = {
  status: 429,
  message: 'Rate limit exceeded',
  type: 'rate_limit_error',
};

// Invalid API key error (401)
const mockAuthError = {
  status: 401,
  message: 'Invalid API key',
  type: 'authentication_error',
};

// Network error
const mockNetworkError = new Error('ECONNREFUSED');
mockNetworkError.code = 'ECONNREFUSED';
```

### 3.2 PDF-Parse Mocking

**Strategy**: Mock `pdf-parse` library to control extracted text

**Mock Implementation**:
```typescript
vi.mock('pdf-parse', () => ({
  default: vi.fn(async (buffer: Buffer) => ({
    text: 'Mocked extracted text from PDF',
    numpages: 5,
    info: {
      Title: 'Test Document',
      Author: 'Test Author',
      CreationDate: new Date('2025-01-01'),
    },
    metadata: null,
    version: '1.4',
  })),
}));
```

**Mock Scenarios**:
```typescript
// Empty PDF
vi.mocked(pdfParse).mockResolvedValue({
  text: '',
  numpages: 0,
});

// Corrupted PDF
vi.mocked(pdfParse).mockRejectedValue(
  new Error('Failed to parse PDF: Invalid PDF structure')
);

// Multi-page with form feeds
vi.mocked(pdfParse).mockResolvedValue({
  text: 'Page 1 content\f\nPage 2 content\f\nPage 3 content',
  numpages: 3,
});
```

### 3.3 File System Mocking (if needed)

**Strategy**: Use `memfs` for in-memory file system

**Setup**:
```bash
npm install --save-dev memfs
```

**Usage**:
```typescript
import { vol } from 'memfs';

beforeEach(() => {
  vol.reset();
  vol.fromJSON({
    '/test/sample.pdf': Buffer.from('%PDF-1.4\ntest\n%%EOF'),
  });
});
```

---

## 4. Test Data Management

### 4.1 Sample PDF Fixtures

**Fixture Generation Strategy**:

Create a script to generate test PDFs programmatically:

**File**: `scripts/generateTestFixtures.js`

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '../src/services/__tests__/fixtures');

// Ensure directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Generate small PDF (5 pages)
function generateSmallPDF() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(fixturesDir, 'sample-small.pdf')));

  for (let i = 1; i <= 5; i++) {
    if (i > 1) doc.addPage();
    doc.fontSize(16).text(`Page ${i}`, 100, 100);
    doc.fontSize(12).text(
      'This is sample content for testing. '.repeat(50),
      100, 150, { width: 400, align: 'justify' }
    );
  }

  doc.end();
}

// Generate medium PDF (20 pages)
function generateMediumPDF() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(fixturesDir, 'sample-medium.pdf')));

  for (let i = 1; i <= 20; i++) {
    if (i > 1) doc.addPage();
    doc.fontSize(16).text(`Chapter ${i}`, 100, 100);
    doc.fontSize(12).text(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100),
      100, 150, { width: 400, align: 'justify' }
    );
  }

  doc.end();
}

// Generate large PDF (100 pages)
function generateLargePDF() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(fixturesDir, 'sample-large.pdf')));

  for (let i = 1; i <= 100; i++) {
    if (i > 1) doc.addPage();
    doc.fontSize(14).text(`Section ${i}`, 100, 100);
    doc.fontSize(10).text(
      'Sample text content. '.repeat(200),
      100, 130, { width: 400 }
    );
  }

  doc.end();
}

// Generate empty PDF
function generateEmptyPDF() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(fixturesDir, 'empty.pdf')));
  doc.end();
}

// Generate unicode test PDF
function generateUnicodePDF() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(fixturesDir, 'unicode-test.pdf')));

  doc.fontSize(14).text('Unicode Test Document', 100, 100);
  doc.fontSize(12)
    .text('English: Hello World', 100, 150)
    .text('Chinese: 你好世界', 100, 180)
    .text('Arabic: مرحبا بالعالم', 100, 210)
    .text('Emoji: 🌍 🚀 💻', 100, 240);

  doc.end();
}

// Generate all fixtures
console.log('Generating test fixtures...');
generateSmallPDF();
generateMediumPDF();
generateLargePDF();
generateEmptyPDF();
generateUnicodePDF();
console.log('Test fixtures generated successfully!');
```

**Dependencies for fixture generation**:
```bash
npm install --save-dev pdfkit
```

### 4.2 Mock Response Structures

**File**: `src/services/__tests__/mocks/openaiResponses.ts`

```typescript
export const mockOpenAIResponses = {
  success: {
    singleChunk: {
      embeddings: [Array(1536).fill(0.123)],
      usage: { promptTokens: 750, totalTokens: 750 },
    },

    multipleChunks: {
      embeddings: Array(10).fill(null).map((_, i) =>
        Array(1536).fill(0.1 * (i + 1))
      ),
      usage: { promptTokens: 7500, totalTokens: 7500 },
    },

    largeBatch: {
      embeddings: Array(50).fill(null).map(() =>
        Array(1536).fill(Math.random())
      ),
      usage: { promptTokens: 37500, totalTokens: 37500 },
    },
  },

  errors: {
    rateLimitError: {
      status: 429,
      message: 'Rate limit exceeded. Please try again later.',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },

    invalidApiKey: {
      status: 401,
      message: 'Invalid API key provided',
      type: 'authentication_error',
      code: 'invalid_api_key',
    },

    invalidRequest: {
      status: 400,
      message: 'Invalid request: text is empty',
      type: 'invalid_request_error',
      code: 'invalid_request',
    },

    serverError: {
      status: 500,
      message: 'Internal server error',
      type: 'api_error',
      code: 'internal_error',
    },

    networkError: Object.assign(
      new Error('Network request failed'),
      { code: 'ECONNREFUSED' }
    ),
  },
};
```

### 4.3 Test Data Cleanup

**Strategy**: Use `beforeEach` and `afterEach` hooks

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

describe('Embedding Service Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset modules to ensure fresh imports
    vi.resetModules();

    // Set up fresh environment variables
    process.env.OPENAI_API_KEY = 'sk-test-mock-key';
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();

    // Clear any timers
    vi.clearAllTimers();
  });
});
```

---

## 5. Testing Tools and Configuration

### 5.1 Recommended Testing Framework: Vitest

**Why Vitest over Jest?**

| Feature | Vitest | Jest |
|---------|--------|------|
| **Speed** | Faster (Vite-powered) | Slower |
| **Next.js 15 Support** | Native ESM, better compatibility | Requires configuration |
| **Setup Complexity** | Minimal | More configuration needed |
| **Watch Mode** | HMR-based, instant | Slower reloads |
| **TypeScript** | Native support | Requires ts-jest |
| **Coverage** | Built-in (c8) | Requires istanbul |
| **Compatibility** | Jest-compatible API | Industry standard |

**Decision**: Use **Vitest** for this project due to Next.js 15 and faster execution.

### 5.2 Mocking Libraries

**Built-in Vitest Mocking**:
- `vi.mock()` - Module mocking
- `vi.fn()` - Function mocking
- `vi.spyOn()` - Spy on methods
- `vi.useFakeTimers()` - Timer mocking
- `vi.stubGlobal()` - Global mocking

**No additional mocking libraries needed** - Vitest provides everything required.

### 5.3 Assertion Patterns

**Standard Assertions**:
```typescript
import { expect } from 'vitest';

// Basic assertions
expect(result).toBe(expected);
expect(result).toEqual(expected);
expect(result).toBeTruthy();
expect(result).toBeDefined();

// Array/Object assertions
expect(array).toHaveLength(5);
expect(array).toContain(item);
expect(object).toHaveProperty('key', 'value');

// Error assertions
expect(() => fn()).toThrow('Error message');
expect(() => fn()).toThrow(CustomError);
await expect(asyncFn()).rejects.toThrow();

// Mock assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(3);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg);

// Number assertions
expect(number).toBeGreaterThan(10);
expect(number).toBeLessThanOrEqual(100);
expect(number).toBeCloseTo(0.3, 2); // Within 2 decimal places

// String assertions
expect(string).toMatch(/regex/);
expect(string).toContain('substring');
```

**Custom Matchers** (defined in setup.ts):
```typescript
expect(embedding).toBeValidEmbedding(); // 1536-dim array of numbers
```

---

## 6. Coverage Requirements

### 6.1 Coverage Thresholds

**Global Thresholds** (configured in `vitest.config.ts`):
```typescript
coverage: {
  thresholds: {
    lines: 80,        // 80% of lines must be executed
    functions: 80,    // 80% of functions must be called
    branches: 75,     // 75% of branches must be taken
    statements: 80,   // 80% of statements must execute
  },
}
```

### 6.2 Critical Paths That MUST Be Tested

**Priority 1 (100% Coverage Required)**:
- File validation (`validatePdfFile`)
- Error handling and retry logic
- API key validation
- Rate limit handling (429 errors)

**Priority 2 (90%+ Coverage Required)**:
- PDF parsing and text extraction
- Text chunking algorithm
- Batch processing logic
- Embedding generation with OpenAI

**Priority 3 (80%+ Coverage Required)**:
- Configuration merging
- Metadata handling
- Progress tracking
- Cost estimation

### 6.3 Areas That Can Be Skipped

**Low Priority** (<70% coverage acceptable):
- Logging statements
- Type definitions
- Constants and configuration objects
- Helper utilities for formatting

**Excluded from Coverage**:
- Type-only files (`*.d.ts`)
- Test files themselves
- Mock implementations
- Generated code

### 6.4 Coverage Reporting

**Generate Coverage Report**:
```bash
npm run test:coverage
```

**Output**:
- `coverage/index.html` - HTML report (open in browser)
- `coverage/lcov.info` - LCOV format (for CI tools)
- `coverage/coverage-final.json` - JSON format

**Example Coverage Report**:
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
embeddingService.ts |   88.23 |    82.50 |   90.00 |   89.47 |
  validatePdfFile   |  100.00 |   100.00 |  100.00 |  100.00 |
  chunkDocument     |   95.83 |    91.67 |  100.00 |   96.15 |
  generateEmbeddings|   85.71 |    80.00 |   87.50 |   86.96 |
--------------------|---------|----------|---------|---------|
```

---

## 7. CI/CD Considerations

### 7.1 Tests Safe to Run in CI

**Unit Tests** (Fast, Mocked):
- All tests in `embeddingService.unit.test.ts`
- Run on every commit
- No external dependencies
- Execution time: <10 seconds

**Configuration for CI** (`.github/workflows/test.yml`):
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Run unit tests
        run: npm run test -- --run --coverage
        env:
          CI: true
          NODE_ENV: test
          OPENAI_API_KEY: sk-test-mock-key

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests
```

### 7.2 Tests for Local Development Only

**Integration Tests** (Slow, Real API):
- All tests in `embeddingService.integration.test.ts`
- Require real `OPENAI_API_KEY`
- Cost money (OpenAI API charges)
- Execution time: 2-5 minutes

**Skip in CI**:
```typescript
// In integration test file
const runIntegrationTests = !process.env.CI && process.env.OPENAI_API_KEY;

describe.skipIf(!runIntegrationTests)('Integration Tests', () => {
  // Tests here only run locally
});
```

**Local Execution**:
```bash
# Set real API key
export OPENAI_API_KEY=sk-real-key-here

# Run integration tests
npm run test:integration
```

### 7.3 Environment Variable Handling for Tests

**CI Environment** (`.env.test`):
```bash
NODE_ENV=test
CI=true
OPENAI_API_KEY=sk-test-mock-key  # Fake key for mocked tests
```

**Local Environment** (`.env.test.local` - gitignored):
```bash
NODE_ENV=test
CI=false
OPENAI_API_KEY=sk-real-openai-key-here  # Real key for integration tests
```

**Environment Loading in Tests**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
    },
    envFile: process.env.CI ? '.env.test' : '.env.test.local',
  },
});
```

### 7.4 Performance Benchmarks

**Acceptable Performance Thresholds**:

| Operation | Target | Maximum |
|-----------|--------|---------|
| Small PDF (5 pages) | <5s | <10s |
| Medium PDF (20 pages) | <10s | <20s |
| Large PDF (100 pages) | <30s | <60s |
| Single chunk embedding | <1s | <3s |
| Batch (50 chunks) | <5s | <10s |

**Performance Test Example**:
```typescript
it('should process medium PDF within time limit', async () => {
  const startTime = performance.now();

  await generateEmbeddings(mediumPdfBuffer);

  const duration = performance.now() - startTime;

  expect(duration).toBeLessThan(15000); // 15 seconds max
});
```

---

## 8. Edge Case Scenarios

### 8.1 Test Data for Edge Cases

#### Empty Files
```typescript
it('should reject empty PDF', async () => {
  const emptyBuffer = Buffer.alloc(0);

  await expect(generateEmbeddings(emptyBuffer)).rejects.toThrow('File is empty');
});
```

#### Corrupted PDFs
```typescript
it('should handle corrupted PDF gracefully', async () => {
  const corruptedBuffer = Buffer.from('not a valid pdf');

  await expect(generateEmbeddings(corruptedBuffer)).rejects.toThrow(
    'Invalid PDF file format'
  );
});
```

#### PDFs with Only Images
```typescript
it('should handle image-only PDFs', async () => {
  vi.mocked(pdfParse).mockResolvedValue({
    text: '', // No text extracted
    numpages: 5,
  } as any);

  await expect(generateEmbeddings(imageOnlyPdfBuffer)).rejects.toThrow(
    'No text could be extracted from PDF'
  );
});
```

#### Rate Limits
```typescript
it('should handle rate limit with exponential backoff', async () => {
  vi.mocked(embedMany)
    .mockRejectedValueOnce({ status: 429 })
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ embeddings: [mockEmbedding] });

  const result = await generateEmbeddings(pdfBuffer);

  expect(embedMany).toHaveBeenCalledTimes(3);
  expect(result).toBeDefined();
});
```

#### Network Timeouts
```typescript
it('should retry on network timeouts', async () => {
  vi.mocked(embedMany)
    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
    .mockResolvedValueOnce({ embeddings: [mockEmbedding] });

  const result = await generateEmbeddings(pdfBuffer);

  expect(result).toBeDefined();
});
```

#### Very Large Files
```typescript
it('should reject files exceeding size limit', async () => {
  const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

  await expect(generateEmbeddings(largeBuffer)).rejects.toThrow(
    'File size exceeds maximum'
  );
});
```

#### Unicode and Special Characters
```typescript
it('should handle unicode characters correctly', async () => {
  const unicodeText = 'Hello 世界 🌍 مرحبا';

  vi.mocked(pdfParse).mockResolvedValue({
    text: unicodeText,
    numpages: 1,
  } as any);

  const result = await generateEmbeddings(pdfBuffer);

  expect(result[0].text).toContain('世界');
  expect(result[0].text).toContain('🌍');
});
```

### 8.2 Boundary Conditions

**Text Chunking**:
- Exactly chunk size (1500 chars)
- One character over chunk size (1501 chars)
- Very small text (<100 chars)
- Empty string
- Single word (no spaces for splitting)

**API Batching**:
- Exactly 50 chunks (batch limit)
- 51 chunks (requires 2 batches)
- 100 chunks (requires 2 batches)
- 1 chunk (no batching needed)

**Retry Logic**:
- 0 retries (fail immediately)
- 1 retry (succeeds on retry)
- Max retries (exhausts all attempts)
- Alternating success/failure

---

## 9. Documentation and Critical Notes

### 9.1 Breaking Changes from Next.js 14 to 15

**Async APIs Impact on Testing**:

```typescript
// WRONG - Next.js 14 pattern
import { cookies } from 'next/headers';
const cookieStore = cookies(); // Synchronous

// CORRECT - Next.js 15 pattern
import { cookies } from 'next/headers';
const cookieStore = await cookies(); // Async
```

**Testing Implication**:
- All Server Actions must be async
- Mock `cookies()` as async function
- Use `await` in all test assertions for Server Components

**Example Test**:
```typescript
// Mock async cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Test Server Action
it('should handle cookies in Server Action', async () => {
  const result = await myServerAction();

  expect(cookies).toHaveBeenCalled();
  expect(result).toBeDefined();
});
```

### 9.2 Supabase Testing with RLS

**RLS Policy Testing**:

```typescript
import { createClient } from '@/lib/supabase/server';

describe('Multi-tenant isolation', () => {
  it('should enforce RLS policies', async () => {
    const supabase = await createClient();

    // Attempt to access another account's documents
    const { data, error } = await supabase
      .from('pdf_docs')
      .select('*')
      .eq('account_id', 'other-account-id');

    // Should be blocked by RLS
    expect(data).toHaveLength(0);
    expect(error).toBeNull(); // RLS returns empty, not error
  });
});
```

**Mock Supabase Client**:
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: mockData, error: null })),
        })),
      })),
      insert: vi.fn(() => ({ data: mockData, error: null })),
    })),
  })),
}));
```

### 9.3 External Service Mocking Best Practices

**OpenAI SDK Mocking**:
- Mock at module level, not function level
- Provide realistic response structures
- Simulate all error types (401, 429, 500, network)
- Use `mockResolvedValue` for async operations

**PDF-Parse Mocking**:
- Mock with realistic PDF structure
- Include metadata (pages, title, author)
- Test both success and failure scenarios

**Avoid Over-Mocking**:
- Don't mock internal utilities
- Don't mock simple helper functions
- Only mock external dependencies

### 9.4 Performance Benchmarks

**Expected Performance** (with mocked OpenAI):
- Unit tests: <5 seconds for full suite
- Single test: <100ms
- Integration tests: 2-5 minutes

**Optimization Tips**:
- Use `vi.useFakeTimers()` to speed up retry tests
- Mock large embeddings with sparse arrays
- Skip integration tests in watch mode

### 9.5 Troubleshooting Guide

**Common Issues and Solutions**:

#### Issue: Tests fail with "Cannot find module '@ai-sdk/openai'"
**Solution**:
```typescript
// Ensure mock is before imports
vi.mock('@ai-sdk/openai', () => ({ ... }));

// Then import
import { generateEmbeddings } from '../embeddingService';
```

#### Issue: "OPENAI_API_KEY is not defined"
**Solution**:
```typescript
// In setup.ts or beforeEach
process.env.OPENAI_API_KEY = 'sk-test-mock-key';
```

#### Issue: Integration tests timeout
**Solution**:
```typescript
// Increase timeout for specific test
it('should handle large PDF', async () => {
  // Test code
}, 60000); // 60 second timeout
```

#### Issue: Coverage reports are empty
**Solution**:
```bash
# Ensure coverage provider is installed
npm install --save-dev @vitest/coverage-v8

# Run with coverage flag
npm run test:coverage
```

#### Issue: Mocks are not cleared between tests
**Solution**:
```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Clear call history
  vi.resetModules();  // Reset module cache
});
```

### 9.6 Migration from Jest (if applicable)

**API Compatibility**:
- Vitest uses Jest-compatible API
- Most assertions work identically
- `describe`, `it`, `expect` are the same

**Changes Needed**:
- Replace `jest.fn()` with `vi.fn()`
- Replace `jest.mock()` with `vi.mock()`
- Replace `jest.spyOn()` with `vi.spyOn()`
- Update config from `jest.config.js` to `vitest.config.ts`

---

## 10. Next Steps and Implementation Order

### 10.1 Recommended Implementation Order

**Phase 1: Setup (Day 1)**
1. Install Vitest and dependencies
2. Create `vitest.config.ts`
3. Create `src/__tests__/setup.ts`
4. Update `package.json` scripts
5. Verify basic test runs

**Phase 2: Unit Tests (Day 2-3)**
1. Create `embeddingService.unit.test.ts`
2. Write file validation tests
3. Write text chunking tests
4. Write PDF parsing tests (mocked)
5. Write OpenAI API tests (mocked)
6. Write retry logic tests

**Phase 3: Integration Tests (Day 4)**
1. Generate test fixtures (PDFs)
2. Create `embeddingService.integration.test.ts`
3. Write real API tests (local-only)
4. Test performance benchmarks
5. Document cost estimation

**Phase 4: CI/CD Integration (Day 5)**
1. Create GitHub Actions workflow
2. Configure coverage reporting
3. Set up Codecov integration
4. Test full CI pipeline
5. Document deployment process

### 10.2 Success Criteria

**Definition of Done for Testing**:
- [ ] All unit tests pass (100% success rate)
- [ ] Code coverage >80% overall
- [ ] Critical paths have >90% coverage
- [ ] Integration tests pass locally
- [ ] CI pipeline runs tests automatically
- [ ] Coverage reports generated
- [ ] Documentation complete
- [ ] Team can run tests locally
- [ ] All edge cases covered
- [ ] Performance benchmarks met

### 10.3 Priorities

**Must Have** (P0):
- Unit tests for all core functions
- Mock strategy for OpenAI API
- File validation tests
- Error handling tests
- CI/CD integration

**Should Have** (P1):
- Integration tests with real API
- Performance benchmarks
- Edge case tests
- Coverage reporting
- Test fixtures

**Nice to Have** (P2):
- Custom matchers
- Test utilities
- Detailed documentation
- Advanced error scenarios

---

## 11. Final Checklist

### Pre-Implementation
- [ ] Review existing codebase for testing patterns
- [ ] Confirm Vitest compatibility with Next.js 15
- [ ] Install all required dependencies
- [ ] Set up test environment variables

### During Implementation
- [ ] Follow TDD approach (write tests first)
- [ ] Maintain >80% coverage throughout
- [ ] Document complex test scenarios
- [ ] Review with team regularly

### Post-Implementation
- [ ] Run full test suite locally
- [ ] Verify CI/CD pipeline
- [ ] Generate coverage report
- [ ] Update documentation
- [ ] Conduct code review
- [ ] Deploy to staging environment

---

## Appendix: Example Test Runs

### Unit Test Execution
```bash
$ npm run test

 RUN  v2.1.8 /Volumes/raul-1TB/Proyectos/intelliaa-app

 ✓ src/services/__tests__/embeddingService.unit.test.ts (30 tests) 3.2s
   ✓ validatePdfFile (5 tests) 120ms
   ✓ chunkDocument (8 tests) 450ms
   ✓ generateEmbeddings - PDF Parsing (5 tests) 780ms
   ✓ generateEmbeddings - OpenAI API Integration (3 tests) 890ms
   ✓ generateEmbeddings - Retry Logic (6 tests) 650ms
   ✓ generateEmbeddings - Error Handling (3 tests) 310ms

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Duration  3.2s (transform 89ms, setup 12ms, collect 1.1s, tests 3.2s)

PASS  Coverage: 88.5% Lines, 85.2% Branches
```

### Integration Test Execution
```bash
$ npm run test:integration

 RUN  v2.1.8 /Volumes/raul-1TB/Proyectos/intelliaa-app

 ✓ src/services/__tests__/embeddingService.integration.test.ts (7 tests) 127s
   ✓ should process a real small PDF (5 pages) 4.2s
   ✓ should process a medium PDF (20 pages) 12.8s
   ✓ should handle large PDF (100 pages) with batch processing 38.5s
   ✓ should handle rate limits gracefully 45.3s
   ✓ should produce consistent embeddings 8.7s
   ✓ should handle PDFs with complex layouts 11.2s
   ✓ should track costs accurately 6.3s

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  127s

Estimated total cost: $0.0247
```

---

## Summary

This testing implementation plan provides a comprehensive strategy for ensuring the quality and reliability of the Vercel AI SDK embedding service. The plan emphasizes:

1. **High Test Coverage** (>80%) for critical paths
2. **Fast Unit Tests** (<5s) with mocked dependencies
3. **Real Integration Tests** (local-only) for validation
4. **Robust Error Handling** for all failure scenarios
5. **CI/CD Integration** for automated testing
6. **Performance Benchmarks** to ensure acceptable response times

By following this plan, the implementation team will have a solid foundation for building a production-ready embedding service with confidence in its correctness, performance, and error handling capabilities.
