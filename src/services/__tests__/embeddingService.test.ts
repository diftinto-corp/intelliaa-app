/**
 * Unit Tests for Embedding Service (INTEL-001)
 *
 * These tests use mocks for OpenAI API and pdf-parse to avoid:
 * - Making real API calls (costs money)
 * - Requiring actual PDF files
 * - Network dependencies
 *
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateEmbeddings,
  validatePDF,
  splitTextRecursive,
  addOverlap,
} from '../embeddingService';
import {
  EmbeddingValidationError,
  EmbeddingParseError,
  EmbeddingAPIError,
  EmbeddingRateLimitError,
} from '@/types/embeddings';

// Mock the Vercel AI SDK
vi.mock('ai', () => ({
  embedMany: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn((model: string) => ({ model })),
  },
}));

// Mock pdf-parse
vi.mock('pdf-parse/lib/pdf-parse.js', () => ({
  default: vi.fn(),
}));

// Import mocked modules
import { embedMany } from 'ai';
import PDFParser from 'pdf-parse/lib/pdf-parse.js';

describe('embeddingService - Text Chunking', () => {
  describe('splitTextRecursive', () => {
    it('should split text into chunks of specified size', () => {
      const text = 'a'.repeat(3000);
      const chunks = splitTextRecursive(text, 1500, 0);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(1500);
      });
    });

    it('should add overlap between chunks', () => {
      const text = 'This is a test. Another sentence. More text here.';
      const chunks = splitTextRecursive(text, 20, 5);

      expect(chunks.length).toBeGreaterThan(1);
      // Verify overlap exists between chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        const overlap = prevChunk.slice(-5);
        expect(currentChunk).toContain(overlap.trim());
      }
    });

    it('should handle text smaller than chunk size', () => {
      const text = 'Short text';
      const chunks = splitTextRecursive(text, 1500, 750);

      expect(chunks).toEqual([text]);
    });

    it('should split by paragraph first, then sentences', () => {
      const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const chunks = splitTextRecursive(text, 20, 0);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle Unicode characters correctly', () => {
      const text = '你好世界 Hello 🌍 مرحبا';
      const chunks = splitTextRecursive(text, 10, 2);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('addOverlap', () => {
    it('should add overlap between chunks', () => {
      const chunks = ['chunk one', 'chunk two', 'chunk three'];
      const overlapped = addOverlap(chunks, 3);

      expect(overlapped.length).toBe(chunks.length);
      expect(overlapped[0]).toBe('chunk one');
      expect(overlapped[1]).toContain('one');
      expect(overlapped[2]).toContain('two');
    });

    it('should handle zero overlap', () => {
      const chunks = ['chunk one', 'chunk two'];
      const overlapped = addOverlap(chunks, 0);

      expect(overlapped).toEqual(chunks);
    });

    it('should handle single chunk', () => {
      const chunks = ['only chunk'];
      const overlapped = addOverlap(chunks, 5);

      expect(overlapped).toEqual(chunks);
    });
  });
});

describe('embeddingService - PDF Validation', () => {
  it('should validate PDF files with correct magic number', () => {
    const validPDF = Buffer.from('%PDF-1.4\n%âãÏÓ\nSome content', 'utf-8');

    expect(() => validatePDF(validPDF)).not.toThrow();
  });

  it('should throw EmbeddingValidationError for non-PDF files', () => {
    const notAPDF = Buffer.from('This is not a PDF file', 'utf-8');

    expect(() => validatePDF(notAPDF)).toThrow(EmbeddingValidationError);
    expect(() => validatePDF(notAPDF)).toThrow('File is not a valid PDF');
  });

  it('should throw EmbeddingValidationError for empty buffer', () => {
    const emptyBuffer = Buffer.alloc(0);

    expect(() => validatePDF(emptyBuffer)).toThrow(EmbeddingValidationError);
  });
});

describe('embeddingService - Generate Embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate embeddings successfully', async () => {
    // Mock PDF parsing
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 5,
      text: 'This is a test PDF document with some content that will be chunked.',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    // Mock embedMany
    const mockEmbeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    vi.mocked(embedMany).mockResolvedValue({
      embeddings: mockEmbeddings,
      usage: { tokens: 50 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nSome content', 'utf-8');
    const result = await generateEmbeddings(pdfBuffer, {
      chunkSize: 30,
      chunkOverlap: 10,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('text');
    expect(result.results[0]).toHaveProperty('embedding');
    expect(result.results[0]).toHaveProperty('metadata');
    expect(result.usage).toHaveProperty('totalTokens');
    expect(result.usage).toHaveProperty('estimatedCost');
    expect(result.usage).toHaveProperty('processingTime');
  });

  it('should throw EmbeddingValidationError for empty PDF', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: '',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    const pdfBuffer = Buffer.from('%PDF-1.4\n', 'utf-8');

    await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
      EmbeddingParseError
    );
  });

  it('should throw EmbeddingParseError for corrupted PDF', async () => {
    vi.mocked(PDFParser).mockRejectedValue(new Error('Invalid PDF structure'));

    const corruptedPDF = Buffer.from('%PDF-corrupted', 'utf-8');

    await expect(generateEmbeddings(corruptedPDF)).rejects.toThrow(
      EmbeddingParseError
    );
  });

  it('should throw EmbeddingRateLimitError on 429 status', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Some text',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    const rateLimitError = new Error('Rate limit exceeded') as any;
    rateLimitError.statusCode = 429;
    rateLimitError.retryAfter = 60;

    vi.mocked(embedMany).mockRejectedValue(rateLimitError);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');

    await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
      EmbeddingRateLimitError
    );
  });

  it('should throw EmbeddingAPIError on API errors', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Some text',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    const apiError = new Error('API Error') as any;
    apiError.statusCode = 500;

    vi.mocked(embedMany).mockRejectedValue(apiError);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');

    await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
      EmbeddingAPIError
    );
  });

  it('should calculate cost correctly', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Test content',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 1000 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');
    const result = await generateEmbeddings(pdfBuffer);

    // text-embedding-ada-002 costs $0.0001 per 1K tokens
    const expectedCost = (1000 / 1000) * 0.0001;
    expect(result.usage.estimatedCost).toBeCloseTo(expectedCost, 6);
  });

  it('should include metadata in results', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 2,
      text: 'Test content for metadata',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 50 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');
    const customMetadata = { documentId: 'test-123', accountId: 'acc-456' };

    const result = await generateEmbeddings(pdfBuffer, {
      metadata: customMetadata,
    });

    expect(result.results[0].metadata).toMatchObject(customMetadata);
    expect(result.results[0].metadata.totalChunks).toBeGreaterThan(0);
    expect(result.results[0].metadata.chunkIndex).toBeGreaterThanOrEqual(0);
  });

  it('should respect chunk size configuration', async () => {
    const longText = 'word '.repeat(500); // ~2500 characters

    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: longText,
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: Array(3).fill([0.1, 0.2]),
      usage: { tokens: 100 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\n', 'utf-8');
    const result = await generateEmbeddings(pdfBuffer, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Should create multiple chunks due to text length
    expect(result.results.length).toBeGreaterThan(1);
  });

  it('should sanitize error messages', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Test',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    const error = new Error(
      'API Error with key sk-1234567890abcdefghij and path /home/user/file.pdf'
    ) as any;
    error.statusCode = 500;

    vi.mocked(embedMany).mockRejectedValue(error);

    const pdfBuffer = Buffer.from('%PDF-1.4\n', 'utf-8');

    try {
      await generateEmbeddings(pdfBuffer);
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      // API keys should be sanitized
      expect(error.message).not.toContain('sk-1234567890abcdefghij');
      expect(error.message).toContain('sk-***');

      // File paths should be sanitized
      expect(error.message).not.toContain('/home/user/file.pdf');
      expect(error.message).toContain('<path>');
    }
  });
});

describe('embeddingService - Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use default configuration when not provided', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Test content',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 50 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');
    await generateEmbeddings(pdfBuffer);

    // Verify embedMany was called with default model
    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({ model: 'text-embedding-ada-002' }),
      })
    );
  });

  it('should respect custom model configuration', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Test content',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 50 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');
    await generateEmbeddings(pdfBuffer, {
      model: 'text-embedding-3-small',
    });

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({ model: 'text-embedding-3-small' }),
      })
    );
  });

  it('should respect maxRetries configuration', async () => {
    vi.mocked(PDFParser).mockResolvedValue({
      numpages: 1,
      text: 'Test content',
      version: '1.10.100',
      info: {},
      metadata: null,
    });

    vi.mocked(embedMany).mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 50 },
      rawResponse: {},
    } as any);

    const pdfBuffer = Buffer.from('%PDF-1.4\nContent', 'utf-8');
    await generateEmbeddings(pdfBuffer, {
      maxRetries: 5,
    });

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 5,
      })
    );
  });
});
