// ============================================================================
// VAPI Knowledge Base Server Actions Tests
// Created: 2025-10-02 (INTEL-002)
// Description: Unit tests for VAPI KB server actions with mocked Supabase
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createVapiKnowledgeBase,
  updateVapiKnowledgeBase,
  deleteVapiKnowledgeBase,
  listVapiKnowledgeBases,
  getVapiKnowledgeBase,
  addFilesToVapiKB,
  removeFilesFromVapiKB,
  getQueryToolForKB,
  updateKBSyncStatus,
} from '../vapiKnowledgeBase';
import type { VapiKnowledgeBase } from '@/types/vapi';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/services/vapiKnowledgeBaseService', () => ({
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
  deleteKnowledgeBase: vi.fn(),
  getKnowledgeBase: vi.fn(),
  createQueryToolConfig: vi.fn((kbId, options) => ({
    type: 'knowledgeBase',
    knowledgeBaseId: kbId,
    function: options?.name
      ? {
          name: options.name,
          description: options.description || '',
        }
      : undefined,
  })),
}));

import { createClient } from '@/lib/supabase/server';
import * as vapiService from '@/services/vapiKnowledgeBaseService';

// Test fixtures
const mockUser = {
  id: 'user-123',
};

const mockKBRecord: VapiKnowledgeBase = {
  id: 'kb-uuid-123',
  account_id: 'account-123',
  vapi_kb_id: 'vapi-kb-123',
  name: 'Test KB',
  description: 'Test description',
  provider: 'google',
  vapi_file_ids: ['file-1', 'file-2'],
  file_count: 2,
  assistant_id: null,
  tool_name: null,
  tool_description: null,
  custom_server_url: null,
  custom_server_secret: null,
  status: 'active',
  error_message: null,
  created_by: 'user-123',
  updated_by: 'user-123',
  created_at: '2025-10-02T00:00:00Z',
  updated_at: '2025-10-02T00:00:00Z',
  deleted_at: null,
  last_synced_at: null,
};

describe('vapiKnowledgeBase server actions', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
      rpc: vi.fn(),
    };

    (createClient as any).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createVapiKnowledgeBase', () => {
    it('should create KB successfully', async () => {
      // Mock account access validation
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock VAPI service
      vi.spyOn(vapiService, 'createKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: ['file-1'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      // Mock Supabase insert
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      const result = await createVapiKnowledgeBase({
        accountId: 'account-123',
        name: 'Test KB',
        fileIds: ['file-1'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.vapi_kb_id).toBe('vapi-kb-123');
      expect(vapiService.createKnowledgeBase).toHaveBeenCalled();
    });

    it('should reject unauthorized access', async () => {
      // Mock no account access
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No access' },
      });

      const result = await createVapiKnowledgeBase({
        accountId: 'account-999',
        name: 'Test KB',
        fileIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should rollback on DB error', async () => {
      // Mock account access
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock VAPI success
      vi.spyOn(vapiService, 'createKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: [],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      // Mock Supabase insert failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      // Mock VAPI delete (rollback)
      vi.spyOn(vapiService, 'deleteKnowledgeBase').mockResolvedValueOnce({
        success: true,
      });

      const result = await createVapiKnowledgeBase({
        accountId: 'account-123',
        name: 'Test KB',
        fileIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
      expect(vapiService.deleteKnowledgeBase).toHaveBeenCalledWith('vapi-kb-123');
    });
  });

  describe('updateVapiKnowledgeBase', () => {
    it('should update KB successfully', async () => {
      // Mock get current KB
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      // Mock account access
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock VAPI update
      vi.spyOn(vapiService, 'updateKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Updated KB',
          provider: 'google',
          fileIds: ['file-1', 'file-2'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      // Mock Supabase update
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockKBRecord, name: 'Updated KB' },
        error: null,
      });

      const result = await updateVapiKnowledgeBase('kb-uuid-123', {
        name: 'Updated KB',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated KB');
    });

    it('should handle incremental file additions', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      vi.spyOn(vapiService, 'updateKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: ['file-1', 'file-2', 'file-3'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockKBRecord,
          vapi_file_ids: ['file-1', 'file-2', 'file-3'],
        },
        error: null,
      });

      const result = await updateVapiKnowledgeBase('kb-uuid-123', {
        addFileIds: ['file-3'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.vapi_file_ids).toContain('file-3');
    });

    it('should handle incremental file removals', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      vi.spyOn(vapiService, 'updateKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: ['file-2'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockKBRecord, vapi_file_ids: ['file-2'] },
        error: null,
      });

      const result = await updateVapiKnowledgeBase('kb-uuid-123', {
        removeFileIds: ['file-1'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.vapi_file_ids).not.toContain('file-1');
    });
  });

  describe('deleteVapiKnowledgeBase', () => {
    it('should soft delete KB successfully', async () => {
      // Mock get KB
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      // Mock account access
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock VAPI delete
      vi.spyOn(vapiService, 'deleteKnowledgeBase').mockResolvedValueOnce({
        success: true,
      });

      // Mock Supabase RPC soft delete
      mockSupabase.rpc.mockResolvedValueOnce({
        error: null,
      });

      const result = await deleteVapiKnowledgeBase('kb-uuid-123');

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('soft_delete_vapi_kb', {
        kb_id: 'kb-uuid-123',
      });
    });

    it('should continue with soft delete even if VAPI delete fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock VAPI delete failure
      vi.spyOn(vapiService, 'deleteKnowledgeBase').mockResolvedValueOnce({
        success: false,
        error: { code: 'API_ERROR', message: 'Failed to delete' },
      });

      // Mock Supabase soft delete success
      mockSupabase.rpc.mockResolvedValueOnce({
        error: null,
      });

      const result = await deleteVapiKnowledgeBase('kb-uuid-123');

      expect(result.success).toBe(true);
    });
  });

  describe('listVapiKnowledgeBases', () => {
    it('should list KBs for account', async () => {
      // Mock account access
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      // Mock Supabase query
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.is.mockReturnThis();
      mockSupabase.order = vi.fn().mockResolvedValueOnce({
        data: [mockKBRecord],
        error: null,
      });

      const result = await listVapiKnowledgeBases({
        accountId: 'account-123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.is.mockReturnThis();
      mockSupabase.order = vi.fn().mockResolvedValueOnce({
        data: [mockKBRecord],
        error: null,
      });

      const result = await listVapiKnowledgeBases({
        accountId: 'account-123',
        status: 'active',
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('should filter by assistant_id', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.is.mockReturnThis();
      mockSupabase.order = vi.fn().mockResolvedValueOnce({
        data: [mockKBRecord],
        error: null,
      });

      const result = await listVapiKnowledgeBases({
        accountId: 'account-123',
        assistantId: 'assistant-123',
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.eq).toHaveBeenCalledWith('assistant_id', 'assistant-123');
    });
  });

  describe('getVapiKnowledgeBase', () => {
    it('should get single KB', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      const result = await getVapiKnowledgeBase('kb-uuid-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('kb-uuid-123');
    });

    it('should reject unauthorized access', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No access' },
      });

      const result = await getVapiKnowledgeBase('kb-uuid-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('addFilesToVapiKB', () => {
    it('should use updateVapiKnowledgeBase with addFileIds', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      vi.spyOn(vapiService, 'updateKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: ['file-1', 'file-2', 'file-3'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockKBRecord,
          vapi_file_ids: ['file-1', 'file-2', 'file-3'],
        },
        error: null,
      });

      const result = await addFilesToVapiKB('kb-uuid-123', ['file-3']);

      expect(result.success).toBe(true);
    });
  });

  describe('removeFilesFromVapiKB', () => {
    it('should use updateVapiKnowledgeBase with removeFileIds', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      vi.spyOn(vapiService, 'updateKnowledgeBase').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'vapi-kb-123',
          name: 'Test KB',
          provider: 'google',
          fileIds: ['file-2'],
          createdAt: '2025-10-02T00:00:00Z',
          updatedAt: '2025-10-02T00:00:00Z',
        },
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockKBRecord, vapi_file_ids: ['file-2'] },
        error: null,
      });

      const result = await removeFilesFromVapiKB('kb-uuid-123', ['file-1']);

      expect(result.success).toBe(true);
    });
  });

  describe('getQueryToolForKB', () => {
    it('should generate query tool config', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockKBRecord,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { account_id: 'account-123' },
        error: null,
      });

      const result = await getQueryToolForKB('kb-uuid-123');

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('knowledgeBase');
      expect(result.data?.knowledgeBaseId).toBe('vapi-kb-123');
    });
  });

  describe('updateKBSyncStatus', () => {
    it('should update sync status', async () => {
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        error: null,
      });

      const result = await updateKBSyncStatus('kb-uuid-123', 'syncing');

      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'syncing',
        })
      );
    });

    it('should include error message when provided', async () => {
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        error: null,
      });

      const result = await updateKBSyncStatus(
        'kb-uuid-123',
        'error',
        'Sync failed'
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'Sync failed',
        })
      );
    });
  });
});
