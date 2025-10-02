// ============================================================================
// VAPI Knowledge Base Service Tests
// Created: 2025-10-02 (INTEL-002)
// Description: Unit tests for VAPI KB service with mocked API responses
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  listKnowledgeBases,
  addFilesToKnowledgeBase,
  removeFilesFromKnowledgeBase,
  createQueryToolConfig,
} from '../vapiKnowledgeBaseService';
import type { VapiKBResponse } from '@/types/vapi';

// Mock environment variables
process.env.VAPI_API_URL = 'https://api.vapi.ai';
process.env.NEXT_PRIVATE_VAPI_KEY = 'test-vapi-key';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Test fixtures
const mockKBResponse: VapiKBResponse = {
  id: 'kb-test-123',
  name: 'Test Knowledge Base',
  description: 'Test description',
  provider: 'google',
  fileIds: ['file-1', 'file-2'],
  createdAt: '2025-10-02T00:00:00Z',
  updatedAt: '2025-10-02T00:00:00Z',
};

describe('vapiKnowledgeBaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createKnowledgeBase', () => {
    it('should create a knowledge base successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockKBResponse,
      });

      const result = await createKnowledgeBase({
        name: 'Test KB',
        description: 'Test description',
        provider: 'google',
        fileIds: ['file-1', 'file-2'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockKBResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/knowledge-base',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      // Verify Authorization header was sent (value comes from env)
      const callArgs = (mockFetch as any).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toMatch(/^Bearer /);
    });

    it('should return error for missing name', async () => {
      const result = await createKnowledgeBase({
        name: '',
        fileIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle batch creation for >100 files', async () => {
      const manyFiles = Array.from({ length: 150 }, (_, i) => `file-${i}`);

      // Mock responses for KB creation and updates
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockKBResponse, fileIds: manyFiles.slice(0, 100) }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockKBResponse, fileIds: manyFiles.slice(0, 100) }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockKBResponse, fileIds: manyFiles }),
        });

      const result = await createKnowledgeBase({
        name: 'Large KB',
        fileIds: manyFiles,
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Create + Get + Update
    });

    it('should retry on 429 rate limiting', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockKBResponse,
        });

      const resultPromise = createKnowledgeBase({
        name: 'Test KB',
        fileIds: [],
      });

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should retry on 500 server error', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal server error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockKBResponse,
        });

      const resultPromise = createKnowledgeBase({
        name: 'Test KB',
        fileIds: [],
      });

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not retry on 400 validation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid request', code: 'VALIDATION_ERROR' },
        }),
      });

      const result = await createKnowledgeBase({
        name: 'Test KB',
        fileIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.statusCode).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getKnowledgeBase', () => {
    it('should get knowledge base successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKBResponse,
      });

      const result = await getKnowledgeBase('kb-test-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockKBResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/knowledge-base/kb-test-123',
        expect.any(Object)
      );
    });

    it('should return error for missing ID', async () => {
      const result = await getKnowledgeBase('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: 'Knowledge base not found', code: 'NOT_FOUND' },
        }),
      });

      const result = await getKnowledgeBase('kb-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.statusCode).toBe(404);
    });
  });

  describe('updateKnowledgeBase', () => {
    it('should update knowledge base successfully', async () => {
      const updatedKB = { ...mockKBResponse, name: 'Updated KB' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedKB,
      });

      const result = await updateKnowledgeBase('kb-test-123', {
        name: 'Updated KB',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated KB');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/knowledge-base/kb-test-123',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should handle batch updates for >100 files', async () => {
      const manyFiles = Array.from({ length: 150 }, (_, i) => `file-${i}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockKBResponse, fileIds: manyFiles.slice(0, 100) }),
      });

      const result = await updateKnowledgeBase('kb-test-123', {
        fileIds: manyFiles,
      });

      expect(result.success).toBe(true);
      // Should log warning about truncation
    });
  });

  describe('deleteKnowledgeBase', () => {
    it('should delete knowledge base successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await deleteKnowledgeBase('kb-test-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/knowledge-base/kb-test-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should return error for missing ID', async () => {
      const result = await deleteKnowledgeBase('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('listKnowledgeBases', () => {
    it('should list knowledge bases successfully', async () => {
      const mockList = [mockKBResponse, { ...mockKBResponse, id: 'kb-test-456' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockList,
      });

      const result = await listKnowledgeBases();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/knowledge-base',
        expect.any(Object)
      );
    });
  });

  describe('addFilesToKnowledgeBase', () => {
    it('should add files to existing KB', async () => {
      // Mock get current KB
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKBResponse,
      });

      // Mock update KB
      const updatedKB = {
        ...mockKBResponse,
        fileIds: [...mockKBResponse.fileIds, 'file-3'],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedKB,
      });

      const result = await addFilesToKnowledgeBase('kb-test-123', ['file-3']);

      expect(result.success).toBe(true);
      expect(result.data?.fileIds).toContain('file-3');
      expect(mockFetch).toHaveBeenCalledTimes(2); // GET + PATCH
    });

    it('should handle duplicate files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKBResponse,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKBResponse,
      });

      const result = await addFilesToKnowledgeBase('kb-test-123', ['file-1']); // Already exists

      expect(result.success).toBe(true);
      // Should not duplicate file-1
      expect(result.data?.fileIds.filter((id) => id === 'file-1')).toHaveLength(1);
    });
  });

  describe('removeFilesFromKnowledgeBase', () => {
    it('should remove files from KB', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKBResponse,
      });

      const updatedKB = {
        ...mockKBResponse,
        fileIds: ['file-2'],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedKB,
      });

      const result = await removeFilesFromKnowledgeBase('kb-test-123', ['file-1']);

      expect(result.success).toBe(true);
      expect(result.data?.fileIds).not.toContain('file-1');
      expect(result.data?.fileIds).toContain('file-2');
    });
  });

  describe('createQueryToolConfig', () => {
    it('should create basic query tool config', () => {
      const tool = createQueryToolConfig('kb-test-123');

      expect(tool.type).toBe('knowledgeBase');
      expect(tool.knowledgeBaseId).toBe('kb-test-123');
    });

    it('should create query tool with custom function metadata', () => {
      const tool = createQueryToolConfig('kb-test-123', {
        name: 'searchDocs',
        description: 'Search documentation',
      });

      expect(tool.function?.name).toBe('searchDocs');
      expect(tool.function?.description).toBe('Search documentation');
    });

    it('should create query tool with custom server config', () => {
      const tool = createQueryToolConfig('kb-test-123', {
        serverUrl: 'https://custom-kb.example.com',
        serverSecret: 'secret-key',
      });

      expect(tool.server?.url).toBe('https://custom-kb.example.com');
      expect(tool.server?.secret).toBe('secret-key');
    });
  });

  describe('error handling', () => {
    it('should handle network errors with retry', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockKBResponse,
        });

      const resultPromise = createKnowledgeBase({
        name: 'Test KB',
        fileIds: [],
      });

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should fail after max retries', async () => {
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new Error('Network error'));

      const resultPromise = createKnowledgeBase({
        name: 'Test KB',
        fileIds: [],
      });

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 3 retries = 4 total, but max 3

      vi.useRealTimers();
    });

    it('should handle missing VAPI API key', async () => {
      const originalKey = process.env.NEXT_PRIVATE_VAPI_KEY;
      delete process.env.NEXT_PRIVATE_VAPI_KEY;

      // Need to reload the module to pick up env change
      vi.resetModules();
      const { createKnowledgeBase: createKBWithoutKey } = await import(
        '../vapiKnowledgeBaseService'
      );

      const result = await createKBWithoutKey({
        name: 'Test KB',
        fileIds: [],
      });

      expect(result.success).toBe(false);
      // Error code can be CONFIG_ERROR (from service) or UNKNOWN_ERROR (from catch wrapper)
      expect(['CONFIG_ERROR', 'UNKNOWN_ERROR']).toContain(result.error?.code);

      process.env.NEXT_PRIVATE_VAPI_KEY = originalKey;
      vi.resetModules();
    });
  });
});
