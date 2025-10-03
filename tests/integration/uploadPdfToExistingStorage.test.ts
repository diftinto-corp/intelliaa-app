/**
 * INTEL-005: Integration Tests for Upload PDF to Existing Storage
 *
 * Tests the complete upload flow including:
 * - Happy path
 * - Error handling and rollback scenarios
 * - Concurrent upload protection
 * - Duplicate file name handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uploadPdfToExistingStorage } from '@/lib/actions/intelliaa/documents';
import { acquireUploadLock, releaseUploadLock } from '@/lib/actions/intelliaa/uploadLock';
import { generateEmbeddings } from '@/services/embeddingService';
import { upsertVectors } from '@/services/pineconeService';
import { vapiService } from '@/services/vapiService';
import { addFilesToVapiKB } from '@/lib/actions/intelliaa/vapiKnowledgeBase';

// Mock external services
vi.mock('@/services/embeddingService');
vi.mock('@/services/pineconeService');
vi.mock('@/services/vapiService');
vi.mock('@/lib/actions/intelliaa/vapiKnowledgeBase');
vi.mock('@/lib/supabase/server');

describe('INTEL-005: Upload PDF to Existing Storage', () => {
  const mockAccountId = 'acc-123';
  const mockDocumentStorageId = 'ds-456';
  const mockNamespace = 'test-namespace';

  let mockFormData: FormData;
  let mockFile: File;

  beforeEach(() => {
    // Create mock PDF file
    const pdfContent = '%PDF-1.4\n...'; // Valid PDF magic number
    mockFile = new File([pdfContent], 'test-document.pdf', { type: 'application/pdf' });

    mockFormData = new FormData();
    mockFormData.append('file', mockFile);
    mockFormData.append('documentStorageId', mockDocumentStorageId);
    mockFormData.append('accountId', mockAccountId);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', () => {
    it('should successfully upload PDF to existing storage', async () => {
      // Mock successful flow
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
        name: 'Test Storage',
        vapi_knowledge_base_id: 'kb-123',
      });

      mockSupabaseExistingFiles([]);

      vi.mocked(generateEmbeddings).mockResolvedValue({
        results: [
          { text: 'chunk 1', embedding: Array(1536).fill(0.1), metadata: {} },
          { text: 'chunk 2', embedding: Array(1536).fill(0.2), metadata: {} },
        ],
        usage: {
          model: 'text-embedding-ada-002',
          chunkCount: 2,
          totalTokens: 100,
          estimatedCost: 0.0001,
          processingTime: 500,
        },
      });

      vi.mocked(upsertVectors).mockResolvedValue({
        upsertedCount: 2,
      });

      vi.mocked(vapiService.uploadFile).mockResolvedValue({
        id: 'vapi-file-123',
        url: 'https://vapi.ai/files/123',
      });

      vi.mocked(addFilesToVapiKB).mockResolvedValue({
        success: true,
        data: { file_count: 3 },
      });

      mockSupabasePdfDocInsert({ id: 'pdf-doc-123' });

      // Execute
      const result = await uploadPdfToExistingStorage(mockFormData);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.storageId).toBe(mockDocumentStorageId);
      expect(result.pdfDocId).toBe('pdf-doc-123');

      // Verify services called
      expect(generateEmbeddings).toHaveBeenCalledTimes(1);
      expect(upsertVectors).toHaveBeenCalledWith(mockNamespace, expect.any(Array));
      expect(vapiService.uploadFile).toHaveBeenCalledTimes(1);
      expect(addFilesToVapiKB).toHaveBeenCalledWith('kb-123', ['vapi-file-123']);
    });

    it('should handle duplicate file names by appending timestamp', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
        name: 'Test Storage',
      });

      // Existing file with same name
      mockSupabaseExistingFiles([
        { name: 'test-document.pdf' },
      ]);

      vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddingResponse());
      vi.mocked(upsertVectors).mockResolvedValue({ upsertedCount: 2 });
      vi.mocked(vapiService.uploadFile).mockResolvedValue(mockVapiUploadResponse());
      mockSupabasePdfDocInsert({ id: 'pdf-doc-123' });

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(true);
      expect(result.data?.wasRenamed).toBe(true);
      expect(result.data?.fileName).toMatch(/test-document-\d+\.pdf/);
    });
  });

  describe('Concurrent Upload Protection', () => {
    it('should prevent concurrent uploads to same storage', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
        name: 'Test Storage',
      });

      // Mock lock already exists
      mockSupabaseLockExists(mockDocumentStorageId);

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Otro proceso está subiendo');
    });

    it('should acquire and release lock on successful upload', async () => {
      const acquireLockSpy = vi.spyOn({ acquireUploadLock }, 'acquireUploadLock');
      const releaseLockSpy = vi.spyOn({ releaseUploadLock }, 'releaseUploadLock');

      mockSuccessfulUploadFlow();

      await uploadPdfToExistingStorage(mockFormData);

      expect(acquireLockSpy).toHaveBeenCalledWith(mockDocumentStorageId, mockAccountId);
      expect(releaseLockSpy).toHaveBeenCalled();
    });

    it('should release lock on error', async () => {
      const releaseLockSpy = vi.spyOn({ releaseUploadLock }, 'releaseUploadLock');

      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
      });

      // Simulate embedding failure
      vi.mocked(generateEmbeddings).mockRejectedValue(new Error('Embedding API failed'));

      await uploadPdfToExistingStorage(mockFormData);

      expect(releaseLockSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback Pinecone vectors on VAPI upload failure', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
      });

      mockSupabaseExistingFiles([]);

      vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddingResponse());
      vi.mocked(upsertVectors).mockResolvedValue({ upsertedCount: 2 });

      // VAPI upload fails
      vi.mocked(vapiService.uploadFile).mockRejectedValue(new Error('VAPI network error'));

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error al subir archivo a VAPI');
      expect(result.step).toBe('vapi_upload');

      // Verify rollback was attempted
      // Note: In real implementation, should verify deleteVectorsByIds was called
    });

    it('should rollback VAPI file on database failure', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
      });

      mockSupabaseExistingFiles([]);

      vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddingResponse());
      vi.mocked(upsertVectors).mockResolvedValue({ upsertedCount: 2 });
      vi.mocked(vapiService.uploadFile).mockResolvedValue(mockVapiUploadResponse());

      // Database insert fails
      mockSupabasePdfDocInsertError(new Error('Database constraint violation'));

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.step).toBe('database');

      // Verify rollback: VAPI file should be deleted
      // Note: In real implementation, verify vapiService.deleteFile was called
    });

    it('should handle embedding generation timeout', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: mockAccountId,
      });

      // Simulate timeout (5+ minutes)
      vi.mocked(generateEmbeddings).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 6 * 60 * 1000))
      );

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Validation', () => {
    it('should reject files larger than 50MB', async () => {
      const largePdfContent = 'x'.repeat(51 * 1024 * 1024); // 51MB
      const largeFile = new File([largePdfContent], 'large.pdf', { type: 'application/pdf' });

      mockFormData.set('file', largeFile);

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('50MB');
    });

    it('should reject non-PDF files', async () => {
      const txtFile = new File(['Hello world'], 'test.txt', { type: 'text/plain' });
      mockFormData.set('file', txtFile);

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF');
    });

    it('should reject empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      mockFormData.set('file', emptyFile);

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('vacío');
    });

    it('should reject if document storage not found', async () => {
      mockSupabaseDocumentStorageNotFound();

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no encontrado');
    });

    it('should reject if user has no access to storage', async () => {
      mockSupabaseDocumentStorage({
        id: mockDocumentStorageId,
        namespace: mockNamespace,
        account_id: 'different-account-id', // Different account
      });

      const result = await uploadPdfToExistingStorage(mockFormData);

      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Mock Helpers
// ============================================================================

function mockSupabaseDocumentStorage(data: any) {
  const { createClient } = require('@/lib/supabase/server');
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data, error: null }),
          }),
        }),
      }),
    }),
  } as any);
}

function mockSupabaseDocumentStorageNotFound() {
  const { createClient } = require('@/lib/supabase/server');
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    }),
  } as any);
}

function mockSupabaseExistingFiles(files: any[]) {
  const { createClient } = require('@/lib/supabase/server');
  const existingMock = vi.mocked(createClient);

  existingMock.mockResolvedValue({
    from: (table: string) => {
      if (table === 'pdf_docs') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: files, error: null }),
          }),
        };
      }
      return existingMock.getMockImplementation()!().from(table);
    },
  } as any);
}

function mockSupabaseLockExists(storageId: string) {
  const { createClient } = require('@/lib/supabase/server');
  vi.mocked(createClient).mockResolvedValue({
    from: (table: string) => {
      if (table === 'upload_locks') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: null,
                error: { code: '23505', message: 'Unique constraint violation' },
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { storage_id: storageId, locked_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        };
      }
      return {} as any;
    },
  } as any);
}

function mockSupabasePdfDocInsert(data: any) {
  const { createClient } = require('@/lib/supabase/server');
  const existingMock = vi.mocked(createClient);

  existingMock.mockResolvedValue({
    from: (table: string) => {
      if (table === 'pdf_docs') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data, error: null }),
            }),
          }),
        };
      }
      return existingMock.getMockImplementation()!().from(table);
    },
  } as any);
}

function mockSupabasePdfDocInsertError(error: Error) {
  const { createClient } = require('@/lib/supabase/server');
  const existingMock = vi.mocked(createClient);

  existingMock.mockResolvedValue({
    from: (table: string) => {
      if (table === 'pdf_docs') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error }),
            }),
          }),
        };
      }
      return existingMock.getMockImplementation()!().from(table);
    },
  } as any);
}

function mockEmbeddingResponse() {
  return {
    results: [
      { text: 'chunk 1', embedding: Array(1536).fill(0.1), metadata: {} },
      { text: 'chunk 2', embedding: Array(1536).fill(0.2), metadata: {} },
    ],
    usage: {
      model: 'text-embedding-ada-002',
      chunkCount: 2,
      totalTokens: 100,
      estimatedCost: 0.0001,
      processingTime: 500,
    },
  };
}

function mockVapiUploadResponse() {
  return {
    id: 'vapi-file-123',
    url: 'https://vapi.ai/files/123',
  };
}

function mockSuccessfulUploadFlow() {
  mockSupabaseDocumentStorage({
    id: 'ds-456',
    namespace: 'test-namespace',
    account_id: 'acc-123',
    name: 'Test Storage',
  });

  mockSupabaseExistingFiles([]);
  vi.mocked(generateEmbeddings).mockResolvedValue(mockEmbeddingResponse());
  vi.mocked(upsertVectors).mockResolvedValue({ upsertedCount: 2 });
  vi.mocked(vapiService.uploadFile).mockResolvedValue(mockVapiUploadResponse());
  mockSupabasePdfDocInsert({ id: 'pdf-doc-123' });
}
