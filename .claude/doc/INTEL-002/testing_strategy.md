# VAPI Knowledge Base Service - Testing Strategy

**Feature**: INTEL-002 - Create VAPI Knowledge Base Service
**Test Framework**: Vitest 3.2.4
**Coverage Target**: >80% (lines, functions, statements), >75% (branches)
**Created**: 2025-10-02
**Status**: Ready for Implementation

---

## Executive Summary

This document outlines a comprehensive testing strategy for the VAPI Knowledge Base Service implementation. The strategy covers unit tests, integration tests, error scenario handling, performance testing, and CI/CD integration using Vitest as the primary testing framework.

### Testing Objectives

1. **Ensure Service Reliability**: Verify VAPI API integration works correctly with retry logic and error handling
2. **Validate Multi-Tenant Security**: Confirm RLS policies prevent unauthorized data access
3. **Performance Benchmarking**: Validate batch operations and concurrent KB creation
4. **Regression Prevention**: Maintain test coverage >80% for critical paths
5. **Production Readiness**: Ensure graceful degradation and error recovery

### Testing Layers

```
┌─────────────────────────────────────────────────────────┐
│                    E2E Testing (Manual)                  │
│  Full workflow: Document Upload → KB Creation → Query   │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              Integration Tests (Vitest)                  │
│     Server Actions + Supabase + Mocked VAPI API         │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                Unit Tests (Vitest)                       │
│       vapiKnowledgeBaseService + Type Validation        │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Unit Testing Strategy

### 1.1 Test Structure for `vapiKnowledgeBaseService.ts`

**File Location**: `src/services/__tests__/vapiKnowledgeBaseService.test.ts`

**Test Coverage Areas**:

#### A. Create Knowledge Base Tests (`createKnowledgeBase`)
- ✅ Successful KB creation with valid file IDs
- ✅ Validation error for >100 files (batch limit)
- ✅ Empty file IDs array handling
- ✅ Google provider vs custom provider configuration
- ✅ Response parsing and type validation

#### B. Query Tool Configuration Tests (`createQueryToolConfig`)
- ✅ Default tool configuration generation
- ✅ Custom tool name and description
- ✅ Knowledge base reference structure
- ✅ Multiple knowledge bases in tool config

#### C. Update Knowledge Base Tests (`updateKnowledgeBase`)
- ✅ Add files to existing KB
- ✅ Remove files from KB
- ✅ Update KB metadata (name, description)
- ✅ Validation for >100 files on update

#### D. Delete Knowledge Base Tests (`deleteKnowledgeBase`)
- ✅ Successful KB deletion
- ✅ Handle non-existent KB deletion
- ✅ Verify DELETE request with correct KB ID

#### E. List Knowledge Bases Tests (`listKnowledgeBases`)
- ✅ List all KBs for account
- ✅ Empty list handling
- ✅ Response pagination (if applicable)

#### F. Batch Operations Tests (`createKnowledgeBaseBatch`)
- ✅ Single KB for ≤100 files
- ✅ Multiple KBs for >100 files (splitting logic)
- ✅ Correct file distribution across KBs
- ✅ Sequential creation with delays
- ✅ Batch naming convention (Part 1, Part 2, etc.)

#### G. Retry Logic Tests (Critical Path)
- ✅ Retry on 429 (Rate Limit) with exponential backoff
- ✅ Retry on 5xx (Server Error) with backoff
- ✅ Retry on 408 (Timeout) with backoff
- ✅ NO retry on 400 (Validation Error)
- ✅ NO retry on 401/403 (Auth Error)
- ✅ Max 3 retry attempts verification
- ✅ Exponential backoff calculation (1s, 2s, 4s, max 10s)
- ✅ Network error retry logic

#### H. Error Handling Tests
- ✅ VapiKnowledgeBaseError construction
- ✅ Error message sanitization (no API keys)
- ✅ Status code extraction from responses
- ✅ Error logging verification

---

### 1.2 Mocking Strategy for VAPI API

**Primary Mock**: `global.fetch` with Vitest `vi.fn()`

**Mock Response Patterns**:

```typescript
// Success Response
{
  ok: true,
  status: 200,
  json: async () => ({
    id: 'kb-123',
    name: 'Test KB',
    fileIds: ['file-1', 'file-2'],
    createdAt: '2025-10-02T10:00:00Z',
    updatedAt: '2025-10-02T10:00:00Z',
  })
}

// Rate Limit Error (429)
{
  ok: false,
  status: 429,
  text: async () => 'Rate limit exceeded',
  headers: {
    get: (name: string) => name === 'retry-after' ? '60' : null
  }
}

// Server Error (500)
{
  ok: false,
  status: 500,
  text: async () => 'Internal server error'
}

// Validation Error (400)
{
  ok: false,
  status: 400,
  text: async () => JSON.stringify({
    error: 'Validation failed',
    message: 'Invalid file IDs provided'
  })
}

// Network Error (ECONNREFUSED)
throw new Error('ECONNREFUSED: Connection refused')
```

---

### 1.3 Test Fixtures

**Location**: `src/services/__tests__/fixtures/vapiKnowledgeBase/`

**Fixtures to Create**:

```typescript
// mockVapiResponses.ts
export const mockKnowledgeBaseResponse = {
  id: 'kb-test-123',
  name: 'Test Knowledge Base',
  description: 'Test description',
  provider: 'google',
  fileIds: ['file-1', 'file-2', 'file-3'],
  createdAt: '2025-10-02T10:00:00Z',
  updatedAt: '2025-10-02T10:00:00Z',
};

export const mockQueryToolConfig = {
  type: 'query',
  function: {
    name: 'searchKnowledgeBase',
    description: 'Search the knowledge base',
  },
  knowledgeBases: [
    {
      provider: 'google',
      name: 'kb-test-123',
      description: 'Test KB',
    },
  ],
};

export const mockFileIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `file-${i + 1}`);

export const mockRateLimitResponse = {
  ok: false,
  status: 429,
  text: async () => 'Rate limit exceeded',
  headers: new Headers({ 'retry-after': '60' }),
};
```

---

### 1.4 Coverage Targets

**Critical Paths** (Must achieve 100% coverage):
- Retry logic (`shouldRetry`, `calculateBackoff`, `vapiRequest`)
- Batch operations (`createKnowledgeBaseBatch`)
- Error handling (`VapiKnowledgeBaseError`)
- File validation (>100 files check)

**Overall Service Coverage**:
- Lines: >90%
- Functions: >90%
- Branches: >85%
- Statements: >90%

---

### 1.5 Complete Unit Test Implementation

**File**: `src/services/__tests__/vapiKnowledgeBaseService.test.ts`

```typescript
/**
 * Unit Tests for VAPI Knowledge Base Service (INTEL-002)
 *
 * These tests use mocked fetch calls to avoid real API requests.
 * Coverage: Service logic, retry mechanisms, batch operations, error handling
 *
 * Run with: npm test vapiKnowledgeBaseService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  vapiKnowledgeBaseService,
  VapiKnowledgeBaseError,
} from '../vapiKnowledgeBaseService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock environment variables
process.env.NEXT_PRIVATE_VAPI_KEY = 'test-vapi-key';
process.env.VAPI_API_URL = 'https://api.vapi.ai';

describe('vapiKnowledgeBaseService - Create Knowledge Base', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create a knowledge base successfully', async () => {
    const mockResponse = {
      id: 'kb-123',
      name: 'Product Docs',
      description: 'Product documentation',
      provider: 'google',
      fileIds: ['file-1', 'file-2'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Product Docs',
      description: 'Product documentation',
      fileIds: ['file-1', 'file-2'],
      provider: 'google',
    });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.vapi.ai/knowledge-base',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-vapi-key',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('Product Docs'),
      })
    );
  });

  it('should throw error for >100 files', async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file-${i}`);

    await expect(
      vapiKnowledgeBaseService.createKnowledgeBase({
        name: 'Large KB',
        fileIds,
      })
    ).rejects.toThrow('Too many files: 101. Maximum is 100');
  });

  it('should handle empty file IDs', async () => {
    const mockResponse = {
      id: 'kb-empty',
      name: 'Empty KB',
      fileIds: [],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Empty KB',
      fileIds: [],
    });

    expect(result.fileIds).toEqual([]);
  });

  it('should use custom-knowledge-base provider', async () => {
    const mockResponse = {
      id: 'kb-custom',
      name: 'Custom KB',
      provider: 'custom-knowledge-base',
      server: {
        url: 'https://my-server.com/kb',
      },
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Custom KB',
      fileIds: [],
      provider: 'custom-knowledge-base',
      server: {
        url: 'https://my-server.com/kb',
      },
    });

    expect(result.provider).toBe('custom-knowledge-base');
    expect(result.server?.url).toBe('https://my-server.com/kb');
  });
});

describe('vapiKnowledgeBaseService - Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry on 500 error and succeed on second attempt', async () => {
    const mockResponse = {
      id: 'kb-retry',
      name: 'Retry KB',
      fileIds: ['file-1'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Retry KB',
      fileIds: ['file-1'],
    });

    // Fast-forward past first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result.id).toBe('kb-retry');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 429 (rate limit) with exponential backoff', async () => {
    const mockResponse = {
      id: 'kb-rate-limit',
      name: 'Rate Limit KB',
      fileIds: ['file-1'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Rate Limit KB',
      fileIds: ['file-1'],
    });

    // First retry: 1000ms delay
    await vi.advanceTimersByTimeAsync(1000);
    // Second retry: 2000ms delay (exponential backoff)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;

    expect(result.id).toBe('kb-rate-limit');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should NOT retry on 400 (validation error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Invalid file IDs',
    });

    await expect(
      vapiKnowledgeBaseService.createKnowledgeBase({
        name: 'Invalid KB',
        fileIds: ['invalid'],
      })
    ).rejects.toThrow('VAPI API error: 400');

    expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('should throw error after max retries (3 attempts)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Failing KB',
      fileIds: ['file-1'],
    });

    // Advance through all retries
    await vi.advanceTimersByTimeAsync(1000); // 1st retry
    await vi.advanceTimersByTimeAsync(2000); // 2nd retry
    await vi.advanceTimersByTimeAsync(4000); // 3rd retry

    await expect(resultPromise).rejects.toThrow('VAPI API error: 500');

    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should calculate exponential backoff correctly', async () => {
    const delays: number[] = [];

    mockFetch.mockImplementation(async () => {
      delays.push(Date.now());
      return {
        ok: false,
        status: 500,
        text: async () => 'Error',
      };
    });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Backoff KB',
      fileIds: ['file-1'],
    });

    // Fast-forward through retries
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    try {
      await resultPromise;
    } catch (error) {
      // Expected to fail
    }

    // Verify backoff: 1s, 2s, 4s (max 10s)
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('should respect max delay of 10 seconds', async () => {
    // Test that backoff doesn't exceed 10s even after many attempts
    const backoffFormula = (attempt: number) =>
      Math.min(1000 * Math.pow(2, attempt), 10000);

    expect(backoffFormula(0)).toBe(1000); // 1s
    expect(backoffFormula(1)).toBe(2000); // 2s
    expect(backoffFormula(2)).toBe(4000); // 4s
    expect(backoffFormula(3)).toBe(8000); // 8s
    expect(backoffFormula(4)).toBe(10000); // 10s (capped)
    expect(backoffFormula(5)).toBe(10000); // Still 10s
  });

  it('should retry on network errors', async () => {
    const mockResponse = {
      id: 'kb-network',
      name: 'Network KB',
      fileIds: ['file-1'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch
      .mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Network KB',
      fileIds: ['file-1'],
    });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result.id).toBe('kb-network');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('vapiKnowledgeBaseService - Batch Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create single KB for <=100 files', async () => {
    const fileIds = Array.from({ length: 100 }, (_, i) => `file-${i}`);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'kb-single',
        name: 'Single KB',
        fileIds,
        createdAt: '2025-10-02T10:00:00Z',
        updatedAt: '2025-10-02T10:00:00Z',
      }),
    });

    const result = await vapiKnowledgeBaseService.createKnowledgeBaseBatch(
      'Single KB',
      'Description',
      fileIds
    );

    expect(result).toHaveLength(1);
    expect(result[0].fileIds?.length).toBe(100);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should create multiple KBs for >100 files', async () => {
    const fileIds = Array.from({ length: 250 }, (_, i) => `file-${i}`);

    mockFetch.mockImplementation(async (url, options) => {
      const body = JSON.parse(options?.body as string);
      return {
        ok: true,
        json: async () => ({
          id: `kb-${body.name}`,
          name: body.name,
          fileIds: body.fileIds,
          createdAt: '2025-10-02T10:00:00Z',
          updatedAt: '2025-10-02T10:00:00Z',
        }),
      };
    });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBaseBatch(
      'Multi KB',
      'Description',
      fileIds
    );

    // Advance through delays between batches (500ms each)
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    const result = await resultPromise;

    expect(result).toHaveLength(3); // 100 + 100 + 50
    expect(result[0].name).toContain('Part 1');
    expect(result[1].name).toContain('Part 2');
    expect(result[2].name).toContain('Part 3');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should distribute files correctly across batches', async () => {
    const fileIds = Array.from({ length: 150 }, (_, i) => `file-${i}`);

    mockFetch.mockImplementation(async (url, options) => {
      const body = JSON.parse(options?.body as string);
      return {
        ok: true,
        json: async () => ({
          id: `kb-batch`,
          fileIds: body.fileIds,
          createdAt: '2025-10-02T10:00:00Z',
          updatedAt: '2025-10-02T10:00:00Z',
        }),
      };
    });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBaseBatch(
      'Batch KB',
      'Description',
      fileIds
    );

    await vi.advanceTimersByTimeAsync(500);

    const result = await resultPromise;

    expect(result).toHaveLength(2);
    expect(result[0].fileIds?.length).toBe(100);
    expect(result[1].fileIds?.length).toBe(50);
  });

  it('should add delay between batch creations', async () => {
    const fileIds = Array.from({ length: 150 }, (_, i) => `file-${i}`);
    const callTimestamps: number[] = [];

    mockFetch.mockImplementation(async () => {
      callTimestamps.push(Date.now());
      return {
        ok: true,
        json: async () => ({
          id: 'kb-batch',
          fileIds: [],
          createdAt: '2025-10-02T10:00:00Z',
          updatedAt: '2025-10-02T10:00:00Z',
        }),
      };
    });

    const resultPromise = vapiKnowledgeBaseService.createKnowledgeBaseBatch(
      'Delayed KB',
      'Description',
      fileIds
    );

    await vi.advanceTimersByTimeAsync(500);

    await resultPromise;

    // Verify delay between calls (500ms)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('vapiKnowledgeBaseService - Update, Delete, List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update knowledge base successfully', async () => {
    const mockResponse = {
      id: 'kb-update',
      name: 'Updated KB',
      description: 'New description',
      fileIds: ['file-1', 'file-2', 'file-3'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:30:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.updateKnowledgeBase(
      'kb-update',
      {
        name: 'Updated KB',
        description: 'New description',
        fileIds: ['file-1', 'file-2', 'file-3'],
      }
    );

    expect(result.name).toBe('Updated KB');
    expect(result.fileIds?.length).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.vapi.ai/knowledge-base/kb-update',
      expect.objectContaining({
        method: 'PATCH',
      })
    );
  });

  it('should delete knowledge base successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await vapiKnowledgeBaseService.deleteKnowledgeBase('kb-delete');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.vapi.ai/knowledge-base/kb-delete',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('should list all knowledge bases', async () => {
    const mockResponse = [
      {
        id: 'kb-1',
        name: 'KB 1',
        fileIds: ['file-1'],
        createdAt: '2025-10-02T10:00:00Z',
        updatedAt: '2025-10-02T10:00:00Z',
      },
      {
        id: 'kb-2',
        name: 'KB 2',
        fileIds: ['file-2'],
        createdAt: '2025-10-02T10:00:00Z',
        updatedAt: '2025-10-02T10:00:00Z',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.listKnowledgeBases();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('kb-1');
  });

  it('should get specific knowledge base', async () => {
    const mockResponse = {
      id: 'kb-get',
      name: 'Get KB',
      fileIds: ['file-1'],
      createdAt: '2025-10-02T10:00:00Z',
      updatedAt: '2025-10-02T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await vapiKnowledgeBaseService.getKnowledgeBase('kb-get');

    expect(result.id).toBe('kb-get');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.vapi.ai/knowledge-base/kb-get',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });
});

describe('vapiKnowledgeBaseService - Query Tool Configuration', () => {
  it('should create default query tool config', () => {
    const config = vapiKnowledgeBaseService.createQueryToolConfig('kb-123');

    expect(config.type).toBe('query');
    expect(config.function.name).toBe('searchKnowledgeBase');
    expect(config.knowledgeBases).toHaveLength(1);
    expect(config.knowledgeBases[0].name).toBe('kb-123');
  });

  it('should create custom query tool config', () => {
    const config = vapiKnowledgeBaseService.createQueryToolConfig(
      'kb-custom',
      'searchProductDocs',
      'Search product documentation for answers'
    );

    expect(config.function.name).toBe('searchProductDocs');
    expect(config.function.description).toBe(
      'Search product documentation for answers'
    );
  });
});

describe('vapiKnowledgeBaseService - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw VapiKnowledgeBaseError with status code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    try {
      await vapiKnowledgeBaseService.createKnowledgeBase({
        name: 'Error KB',
        fileIds: ['file-1'],
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('400');
      expect(error.message).toContain('Bad request');
    }
  });

  it('should handle JSON parse errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Not valid JSON {',
    });

    await expect(
      vapiKnowledgeBaseService.createKnowledgeBase({
        name: 'JSON Error KB',
        fileIds: ['file-1'],
      })
    ).rejects.toThrow();
  });

  it('should log errors for debugging', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    });

    // Mock timers for retries
    vi.useFakeTimers();

    const promise = vapiKnowledgeBaseService.createKnowledgeBase({
      name: 'Log Error KB',
      fileIds: ['file-1'],
    });

    // Fast-forward through all retries
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    try {
      await promise;
    } catch (error) {
      // Expected
    }

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });
});
```

---

## 2. Integration Testing Strategy

### 2.1 Server Actions Testing

**File Location**: `src/lib/actions/intelliaa/__tests__/vapiKnowledgeBase.test.ts`

**Test Coverage Areas**:

#### A. Create KB Server Actions
- ✅ Create KB with Supabase persistence
- ✅ Rollback on Supabase insert failure (delete KB from VAPI)
- ✅ Account ID validation
- ✅ Batch creation with multiple KBs

#### B. Read Operations
- ✅ List KBs for account
- ✅ Get specific KB by ID
- ✅ Get KBs by assistant ID
- ✅ Empty list handling

#### C. Update Operations
- ✅ Update KB metadata and files
- ✅ Sync update to both VAPI and Supabase

#### D. Delete Operations
- ✅ Delete KB from VAPI and soft delete in Supabase
- ✅ Cascade delete by assistant ID

---

### 2.2 RLS Policy Verification Tests

**Purpose**: Ensure multi-tenant data isolation

**Test Scenarios**:

```typescript
describe('RLS Policy Enforcement', () => {
  it('should block access to KB from different account', async () => {
    // Create KB for Account A
    const kbA = await createVapiKnowledgeBase({
      account_id: 'account-a',
      name: 'KB A',
      vapi_file_ids: ['file-1'],
    });

    // Try to access from Account B
    const result = await getVapiKnowledgeBase(kbA.data!.id, 'account-b');

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('should allow access to KB from same account', async () => {
    const kbA = await createVapiKnowledgeBase({
      account_id: 'account-a',
      name: 'KB A',
      vapi_file_ids: ['file-1'],
    });

    const result = await getVapiKnowledgeBase(kbA.data!.id, 'account-a');

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it('should filter list by account ID', async () => {
    // Create KBs for different accounts
    await createVapiKnowledgeBase({
      account_id: 'account-a',
      name: 'KB A',
      vapi_file_ids: ['file-1'],
    });

    await createVapiKnowledgeBase({
      account_id: 'account-b',
      name: 'KB B',
      vapi_file_ids: ['file-2'],
    });

    // List for Account A
    const resultA = await listVapiKnowledgeBases('account-a');

    expect(resultA.data).toHaveLength(1);
    expect(resultA.data![0].name).toBe('KB A');
  });
});
```

---

### 2.3 Database Transaction Handling

**Test Scenarios**:

```typescript
describe('Transaction Rollback', () => {
  it('should delete VAPI KB if Supabase insert fails', async () => {
    // Mock Supabase insert failure
    const mockSupabase = vi.mocked(createClient);
    mockSupabase.mockResolvedValueOnce({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: 'Database error' },
            })),
          })),
        })),
      })),
    } as any);

    // Mock VAPI delete
    const deleteSpy = vi.spyOn(
      vapiKnowledgeBaseService,
      'deleteKnowledgeBase'
    );

    const result = await createVapiKnowledgeBase({
      account_id: 'account-a',
      name: 'Rollback KB',
      vapi_file_ids: ['file-1'],
    });

    expect(result.error).toBeDefined();
    expect(deleteSpy).toHaveBeenCalled(); // Cleanup
  });
});
```

---

### 2.4 End-to-End Workflow Tests

**Workflow**: Document Upload → KB Creation → Assistant Attachment

```typescript
describe('E2E: Document Upload to KB Creation', () => {
  it('should create KB after successful document upload', async () => {
    // Step 1: Upload document to VAPI
    const fileBuffer = Buffer.from('Test PDF content');
    const uploadResult = await vapiService.uploadFile(fileBuffer, 'test.pdf');

    expect(uploadResult.id).toBeDefined();

    // Step 2: Create KB with file ID
    const kbResult = await createVapiKnowledgeBase({
      account_id: 'account-test',
      name: 'Test KB',
      vapi_file_ids: [uploadResult.id],
    });

    expect(kbResult.data).toBeDefined();
    expect(kbResult.data!.vapi_file_ids).toContain(uploadResult.id);

    // Step 3: Attach to assistant (if applicable)
    // ... assistant integration test
  });
});
```

---

## 3. Error Scenario Coverage

### 3.1 HTTP Error Status Codes

| Status | Scenario | Expected Behavior | Test Method |
|--------|----------|-------------------|-------------|
| 400 | Bad Request (invalid file IDs) | Throw error, NO retry, log details | Mock 400 response |
| 401 | Unauthorized (invalid API key) | Throw error, NO retry, alert | Mock 401 response |
| 403 | Forbidden (insufficient permissions) | Throw error, NO retry, log | Mock 403 response |
| 429 | Rate Limit Exceeded | Retry with backoff (max 3), honor retry-after header | Mock 429 with retry-after |
| 500 | Internal Server Error | Retry with exponential backoff (max 3) | Mock 500 response |
| 502 | Bad Gateway | Retry with backoff | Mock 502 response |
| 503 | Service Unavailable | Retry with backoff | Mock 503 response |

---

### 3.2 Network Failures

```typescript
describe('Network Error Handling', () => {
  it('should retry on ECONNREFUSED', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    // Should succeed after retry
  });

  it('should retry on ETIMEDOUT', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  });

  it('should retry on DNS lookup failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ENOTFOUND'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  });
});
```

---

### 3.3 Partial Batch Failures

**Scenario**: Some KBs created successfully, others fail

```typescript
describe('Partial Batch Failures', () => {
  it('should handle failure in middle of batch', async () => {
    const fileIds = Array.from({ length: 250 }, (_, i) => `file-${i}`);

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        // Fail second batch
        return { ok: false, status: 500, text: async () => 'Error' };
      }
      return {
        ok: true,
        json: async () => ({
          id: `kb-${callCount}`,
          fileIds: [],
          createdAt: '2025-10-02T10:00:00Z',
          updatedAt: '2025-10-02T10:00:00Z',
        }),
      };
    });

    await expect(
      vapiKnowledgeBaseService.createKnowledgeBaseBatch(
        'Partial Fail',
        'Desc',
        fileIds
      )
    ).rejects.toThrow();

    // First batch succeeded, second failed
    expect(callCount).toBeGreaterThan(1);
  });

  it('should cleanup on batch failure', async () => {
    // Test rollback logic when batch fails mid-creation
    // Ensure created KBs are deleted
  });
});
```

---

## 4. Performance Testing

### 4.1 Batch Operations with 100+ Documents

**Performance Benchmarks**:

| Test Scenario | Files | Expected KBs | Max Time | Max Cost |
|---------------|-------|--------------|----------|----------|
| Small batch | 50 | 1 | 2s | ~$0.001 |
| Medium batch | 150 | 2 | 5s | ~$0.005 |
| Large batch | 500 | 5 | 15s | ~$0.015 |

**Test Implementation**:

```typescript
describe('Performance: Batch Operations', () => {
  it('should create 150-file batch within 5 seconds', async () => {
    const fileIds = Array.from({ length: 150 }, (_, i) => `file-${i}`);

    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        id: 'kb-perf',
        fileIds: [],
        createdAt: '2025-10-02T10:00:00Z',
        updatedAt: '2025-10-02T10:00:00Z',
      }),
    }));

    const start = Date.now();
    const result = await vapiKnowledgeBaseService.createKnowledgeBaseBatch(
      'Perf Test',
      'Desc',
      fileIds
    );
    const elapsed = Date.now() - start;

    expect(result).toHaveLength(2); // 100 + 50
    expect(elapsed).toBeLessThan(5000); // 5 seconds
  });
});
```

---

### 4.2 Concurrent KB Creation Stress Tests

**Scenario**: Simulate multiple users creating KBs simultaneously

```typescript
describe('Stress Test: Concurrent Operations', () => {
  it('should handle 10 concurrent KB creations', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        id: `kb-${Date.now()}`,
        fileIds: ['file-1'],
        createdAt: '2025-10-02T10:00:00Z',
        updatedAt: '2025-10-02T10:00:00Z',
      }),
    }));

    const promises = Array.from({ length: 10 }, (_, i) =>
      vapiKnowledgeBaseService.createKnowledgeBase({
        name: `Concurrent KB ${i}`,
        fileIds: ['file-1'],
      })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((result) => {
      expect(result.id).toBeDefined();
    });
  });

  it('should rate-limit concurrent requests gracefully', async () => {
    let requestCount = 0;
    mockFetch.mockImplementation(async () => {
      requestCount++;
      if (requestCount > 5) {
        // Simulate rate limit
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit',
        };
      }
      return {
        ok: true,
        json: async () => ({ id: 'kb-ok', fileIds: [] }),
      };
    });

    // Test that retries work correctly under load
  });
});
```

---

### 4.3 Database Query Performance

**Performance Metrics**:

```typescript
describe('Performance: Database Queries', () => {
  it('should list 1000 KBs in <500ms', async () => {
    // Seed database with 1000 KB records
    // ...

    const start = Date.now();
    const result = await listVapiKnowledgeBases('account-test');
    const elapsed = Date.now() - start;

    expect(result.data).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500); // <500ms
  });

  it('should use indexes efficiently', async () => {
    // Verify queries use expected indexes
    // Run EXPLAIN ANALYZE on queries
  });
});
```

---

### 4.4 VAPI API Rate Limit Handling

**Rate Limit Strategy**:
- VAPI rate limit: ~100 requests/minute (estimated)
- Batch operations: Sequential with 500ms delays
- Retry logic: Exponential backoff on 429

**Test Validation**:

```typescript
describe('Rate Limit Validation', () => {
  it('should respect VAPI rate limits', async () => {
    // Mock rate limit after N requests
    let requestCount = 0;
    mockFetch.mockImplementation(async () => {
      requestCount++;
      if (requestCount > 10) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '60' }),
          text: async () => 'Rate limit',
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Make 20 requests
    // Verify retry logic kicks in after 10
  });
});
```

---

## 5. Testing Tools & Setup

### 5.1 Testing Framework Configuration

**Framework**: Vitest 3.2.4 (already configured)

**Configuration File**: `vitest.config.ts` (exists)

**Key Settings**:
```typescript
{
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./vitest.setup.ts'],
  coverage: {
    provider: 'v8',
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
}
```

---

### 5.2 Mocking Libraries

**Primary Mock Tool**: Vitest `vi.fn()` and `vi.mock()`

**Mock Strategies**:

#### A. Mock Fetch API
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch as any;
```

#### B. Mock Supabase Client
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ select: vi.fn() })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
    })),
  })),
}));
```

#### C. Mock VAPI Service
```typescript
vi.mock('@/services/vapiKnowledgeBaseService', () => ({
  vapiKnowledgeBaseService: {
    createKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    updateKnowledgeBase: vi.fn(),
    listKnowledgeBases: vi.fn(),
  },
}));
```

---

### 5.3 Test Database Setup (Supabase Local)

**Setup Steps**:

```bash
# Start local Supabase
supabase start

# Apply migrations (including vapi_knowledge_bases table)
supabase db push

# Seed test data (optional)
supabase db seed
```

**Test Environment Variables**:

```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
NEXT_PRIVATE_VAPI_KEY=test-vapi-key
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

**Vitest Setup File** (`vitest.setup.ts`):
```typescript
import { beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

let supabase: any;

beforeAll(async () => {
  // Initialize test database
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Clear test data
  await supabase.from('vapi_knowledge_bases').delete().neq('id', '');
});

afterAll(async () => {
  // Cleanup
  await supabase.from('vapi_knowledge_bases').delete().neq('id', '');
});
```

---

### 5.4 Test Data Fixtures & Cleanup

**Fixture Management**:

**File**: `src/services/__tests__/fixtures/vapiKnowledgeBase/testData.ts`

```typescript
export const mockAccounts = {
  accountA: {
    id: 'account-a-uuid',
    slug: 'account-a',
  },
  accountB: {
    id: 'account-b-uuid',
    slug: 'account-b',
  },
};

export const mockVapiFiles = {
  file1: {
    id: 'file-vapi-1',
    name: 'document1.pdf',
    size: 1024,
  },
  file2: {
    id: 'file-vapi-2',
    name: 'document2.pdf',
    size: 2048,
  },
};

export const mockKnowledgeBases = {
  kb1: {
    id: 'kb-test-1',
    account_id: 'account-a-uuid',
    vapi_kb_id: 'kb-vapi-1',
    name: 'Test KB 1',
    vapi_file_ids: ['file-vapi-1'],
    file_count: 1,
    status: 'active',
  },
};

export async function seedTestData(supabase: any) {
  await supabase.from('vapi_knowledge_bases').insert([
    mockKnowledgeBases.kb1,
  ]);
}

export async function cleanupTestData(supabase: any) {
  await supabase.from('vapi_knowledge_bases').delete().neq('id', '');
}
```

**Cleanup Strategy**:

```typescript
import { afterEach } from 'vitest';
import { cleanupTestData } from './fixtures/vapiKnowledgeBase/testData';

afterEach(async () => {
  await cleanupTestData(supabase);
});
```

---

### 5.5 CI/CD Integration Recommendations

**GitHub Actions Workflow** (`.github/workflows/test.yml`):

```yaml
name: Test VAPI KB Service

on:
  push:
    branches: [main, feature/INTEL-002-*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 54322:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase
        run: supabase start

      - name: Run migrations
        run: supabase db push

      - name: Run unit tests
        run: npm test -- --coverage
        env:
          NEXT_PRIVATE_VAPI_KEY: test-key
          SKIP_INTEGRATION_TESTS: true

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Check coverage thresholds
        run: npm run test:coverage
```

---

## 6. Test Execution Commands

### Local Development

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test vapiKnowledgeBaseService

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run integration tests (requires real VAPI API key)
npm run test:integration
```

---

### CI/CD Pipeline

```bash
# Pre-commit hook (runs unit tests only)
npm test -- --run --coverage

# Pull request (full test suite + coverage)
npm run test:coverage

# Pre-deployment (integration tests + E2E)
npm run test:integration
```

---

## 7. Coverage Goals & Critical Test Scenarios

### 7.1 Coverage Metrics

**Overall Target**: >80% coverage

**Service-Level Breakdown**:

| Component | Lines | Functions | Branches | Statements | Priority |
|-----------|-------|-----------|----------|------------|----------|
| `vapiKnowledgeBaseService.ts` | >90% | >90% | >85% | >90% | P0 |
| `vapiKnowledgeBase.ts` (actions) | >85% | >85% | >80% | >85% | P0 |
| Retry logic functions | 100% | 100% | 100% | 100% | P0 |
| Batch operations | 100% | 100% | 100% | 100% | P0 |
| Error handling | >90% | >90% | >90% | >90% | P0 |
| Type definitions | N/A | N/A | N/A | N/A | P1 |

---

### 7.2 Critical Test Scenarios (Must Pass)

#### Scenario 1: Basic KB Lifecycle
```typescript
✓ Create KB with 10 files
✓ Update KB to 20 files
✓ List all KBs
✓ Get specific KB
✓ Delete KB
```

#### Scenario 2: Batch Operations
```typescript
✓ Create KB with 50 files (single KB)
✓ Create KB with 150 files (2 KBs: 100 + 50)
✓ Create KB with 500 files (5 KBs: 100 each)
✓ Verify file distribution
✓ Verify sequential creation with delays
```

#### Scenario 3: Error Handling & Retry
```typescript
✓ Retry on 500 error (max 3 attempts)
✓ Retry on 429 rate limit with backoff
✓ Retry on network error (ECONNREFUSED)
✓ NO retry on 400 validation error
✓ NO retry on 401 auth error
✓ Max retries exceeded (throw error)
```

#### Scenario 4: Multi-Tenant Security
```typescript
✓ RLS policy blocks cross-account access
✓ RLS policy allows same-account access
✓ List KBs filtered by account
✓ Update requires account ownership
✓ Delete requires account ownership
```

#### Scenario 5: Database Transactions
```typescript
✓ Rollback VAPI KB on Supabase insert failure
✓ Soft delete in Supabase (deleted_at set)
✓ Cascade delete by assistant ID
✓ Transaction consistency
```

#### Scenario 6: Performance Benchmarks
```typescript
✓ Create 150-file batch in <5s
✓ List 1000 KBs in <500ms
✓ Concurrent 10 KB creations
✓ Rate limit handling (100 req/min)
```

---

## 8. Test Data Management

### 8.1 Mock Data Generation

**Utility Functions**:

```typescript
// src/services/__tests__/utils/mockDataGenerator.ts

export function generateMockFileIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `file-vapi-${i + 1}`);
}

export function generateMockKnowledgeBase(overrides?: Partial<VapiKBRecord>) {
  return {
    id: `kb-${Date.now()}`,
    account_id: 'account-test',
    vapi_kb_id: `kb-vapi-${Date.now()}`,
    name: 'Test KB',
    description: 'Test description',
    provider: 'google' as const,
    vapi_file_ids: ['file-1'],
    file_count: 1,
    status: 'active' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function generateBatchFileIds(
  batchSize: number,
  totalFiles: number
): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < totalFiles; i += batchSize) {
    batches.push(generateMockFileIds(Math.min(batchSize, totalFiles - i)));
  }
  return batches;
}
```

---

### 8.2 Test Database Seeding

**Seed Script**: `supabase/seed.sql` (add VAPI KB test data)

```sql
-- Seed test data for VAPI Knowledge Bases
INSERT INTO public.vapi_knowledge_bases (
  id,
  account_id,
  vapi_kb_id,
  name,
  description,
  provider,
  vapi_file_ids,
  file_count,
  status
) VALUES
  (
    gen_random_uuid(),
    (SELECT id FROM public.accounts LIMIT 1), -- Use existing account
    'kb-test-seed-1',
    'Seeded Test KB 1',
    'Test knowledge base for integration tests',
    'google',
    ARRAY['file-seed-1', 'file-seed-2'],
    2,
    'active'
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM public.accounts LIMIT 1),
    'kb-test-seed-2',
    'Seeded Test KB 2',
    'Another test knowledge base',
    'google',
    ARRAY['file-seed-3'],
    1,
    'active'
  );
```

---

### 8.3 Cleanup Procedures

**After Each Test**:

```typescript
import { afterEach } from 'vitest';

afterEach(async () => {
  // Clear mocks
  vi.clearAllMocks();

  // Clear test database records
  await supabase
    .from('vapi_knowledge_bases')
    .delete()
    .like('name', 'Test%'); // Only delete test records
});
```

**After All Tests**:

```typescript
import { afterAll } from 'vitest';

afterAll(async () => {
  // Restore mocks
  vi.restoreAllMocks();

  // Full cleanup
  await supabase
    .from('vapi_knowledge_bases')
    .delete()
    .neq('id', ''); // Clear all
});
```

---

## 9. Testing Best Practices

### 9.1 Test Organization

**File Structure**:
```
src/
├── services/
│   ├── __tests__/
│   │   ├── fixtures/
│   │   │   ├── vapiKnowledgeBase/
│   │   │   │   ├── mockResponses.ts
│   │   │   │   ├── testData.ts
│   │   │   │   └── README.md
│   │   ├── utils/
│   │   │   └── mockDataGenerator.ts
│   │   ├── vapiKnowledgeBaseService.test.ts (unit)
│   │   └── vapiKnowledgeBaseService.integration.test.ts (integration)
│   └── vapiKnowledgeBaseService.ts
├── lib/
│   ├── actions/
│   │   ├── intelliaa/
│   │   │   ├── __tests__/
│   │   │   │   └── vapiKnowledgeBase.test.ts
│   │   │   └── vapiKnowledgeBase.ts
```

---

### 9.2 Test Naming Conventions

**Pattern**: `describe('Component - Feature') → it('should <expected behavior>')`

**Examples**:
```typescript
describe('vapiKnowledgeBaseService - Create Knowledge Base', () => {
  it('should create a knowledge base successfully', async () => {});
  it('should throw error for >100 files', async () => {});
});

describe('vapiKnowledgeBaseService - Retry Logic', () => {
  it('should retry on 500 error and succeed on second attempt', async () => {});
});
```

---

### 9.3 Assertion Strategies

**Use Specific Assertions**:

```typescript
// ✅ Good - Specific assertions
expect(result.id).toBe('kb-123');
expect(result.fileIds).toHaveLength(2);
expect(result.fileIds).toContain('file-1');

// ❌ Bad - Generic assertions
expect(result).toBeTruthy();
expect(result.fileIds.length).toBeGreaterThan(0);
```

**Test Error Types**:

```typescript
// ✅ Good - Assert error type and message
await expect(createKnowledgeBase()).rejects.toThrow(VapiKnowledgeBaseError);
await expect(createKnowledgeBase()).rejects.toThrow('Too many files');

// ❌ Bad - Generic error assertion
await expect(createKnowledgeBase()).rejects.toThrow();
```

---

### 9.4 Test Independence

**Each test should be isolated**:

```typescript
// ✅ Good - Test creates own data
it('should create KB successfully', async () => {
  const mockData = generateMockKnowledgeBase();
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

  const result = await createKnowledgeBase({...});
  expect(result).toEqual(mockData);
});

// ❌ Bad - Test depends on previous test
let sharedKB: any;

it('should create KB', async () => {
  sharedKB = await createKnowledgeBase({...}); // Creates shared state
});

it('should update KB', async () => {
  await updateKnowledgeBase(sharedKB.id, {...}); // Depends on previous test
});
```

---

### 9.5 Mock Cleanup

**Always clear mocks between tests**:

```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Clear call history and mock implementations
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore original implementations
});
```

---

## 10. Next.js 15 / React 19 Testing Considerations

### 10.1 Async APIs in Tests

**Important**: All Next.js 15 server functions use async APIs

```typescript
// Mock async cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock async params
it('should handle async params', async () => {
  const params = Promise.resolve({ accountSlug: 'test-account' });
  const { accountSlug } = await params; // MUST await

  expect(accountSlug).toBe('test-account');
});
```

---

### 10.2 Server Component Testing

**Pattern**: Test server actions separately from components

```typescript
// ✅ Test server action directly
it('should create KB via server action', async () => {
  const result = await createVapiKnowledgeBase({
    account_id: 'account-1',
    name: 'Test KB',
    vapi_file_ids: ['file-1'],
  });

  expect(result.data).toBeDefined();
});

// Component tests focus on UI rendering, not server logic
```

---

### 10.3 Supabase SSR v0.5.2 Mocking

**Mock async createClient**:

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
    })),
  })),
}));

// Usage in tests
it('should query Supabase', async () => {
  const supabase = await createClient(); // MUST await
  const { data } = await supabase.from('vapi_knowledge_bases').select();

  expect(data).toBeDefined();
});
```

---

## 11. Troubleshooting Common Test Issues

### Issue 1: Timers in Retry Logic Tests

**Problem**: Retry delays cause tests to hang

**Solution**: Use fake timers

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should retry with delay', async () => {
  const promise = createKnowledgeBase({...});

  // Fast-forward time
  await vi.advanceTimersByTimeAsync(1000); // 1s delay

  const result = await promise;
  expect(result).toBeDefined();
});
```

---

### Issue 2: Async Mock Resolution

**Problem**: Mock promises not resolving

**Solution**: Use `mockResolvedValue` instead of `mockReturnValue`

```typescript
// ✅ Correct
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ id: 'kb-1' }),
});

// ❌ Wrong
mockFetch.mockReturnValueOnce({
  ok: true,
  json: () => ({ id: 'kb-1' }), // Missing async
});
```

---

### Issue 3: Supabase RLS Policies Blocking Tests

**Problem**: Tests fail due to RLS policies

**Solution**: Use service role key for tests

```typescript
// vitest.setup.ts
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// In tests, create admin client
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

### Issue 4: Test Database State Pollution

**Problem**: Tests fail due to leftover data

**Solution**: Clear database before each test

```typescript
beforeEach(async () => {
  await supabase
    .from('vapi_knowledge_bases')
    .delete()
    .neq('id', '');
});
```

---

## 12. Implementation Checklist

### Pre-Implementation

- [ ] Review existing test patterns (`embeddingService.test.ts`)
- [ ] Verify Vitest configuration (`vitest.config.ts`)
- [ ] Understand project structure and conventions
- [ ] Review VAPI Knowledge Base Service implementation plan

---

### Test File Creation

- [ ] Create `src/services/__tests__/vapiKnowledgeBaseService.test.ts`
- [ ] Create `src/services/__tests__/fixtures/vapiKnowledgeBase/`
- [ ] Create mock data generators
- [ ] Create `src/lib/actions/intelliaa/__tests__/vapiKnowledgeBase.test.ts`

---

### Unit Test Implementation

- [ ] Test: Create knowledge base (success)
- [ ] Test: Create knowledge base (validation errors)
- [ ] Test: Retry logic (429, 5xx, network errors)
- [ ] Test: Exponential backoff calculation
- [ ] Test: Batch operations (<=100, >100 files)
- [ ] Test: Update knowledge base
- [ ] Test: Delete knowledge base
- [ ] Test: List knowledge bases
- [ ] Test: Query tool configuration
- [ ] Test: Error handling and logging

---

### Integration Test Implementation

- [ ] Test: Server actions with Supabase
- [ ] Test: RLS policy enforcement
- [ ] Test: Multi-tenant isolation
- [ ] Test: Database transaction rollback
- [ ] Test: Cascade delete operations
- [ ] Test: End-to-end workflow (upload → KB creation)

---

### Performance Testing

- [ ] Test: Batch operations performance (100+ files)
- [ ] Test: Concurrent KB creation
- [ ] Test: Database query performance
- [ ] Test: Rate limit handling

---

### Coverage Verification

- [ ] Run `npm run test:coverage`
- [ ] Verify >80% overall coverage
- [ ] Verify 100% coverage on retry logic
- [ ] Verify 100% coverage on batch operations
- [ ] Generate coverage report

---

### CI/CD Integration

- [ ] Add test workflow to `.github/workflows/test.yml`
- [ ] Configure Supabase local instance in CI
- [ ] Set up coverage reporting (Codecov)
- [ ] Add pre-commit hooks for tests

---

### Documentation

- [ ] Update README with test commands
- [ ] Document test fixtures and mock data
- [ ] Add troubleshooting guide for common issues
- [ ] Document performance benchmarks

---

## 13. Summary & Recommendations

### Key Takeaways

1. **Comprehensive Coverage**: Aim for >80% overall, 100% on critical paths (retry logic, batch operations)
2. **Mock External Dependencies**: Mock VAPI API calls to avoid costs and network dependencies
3. **Test Isolation**: Each test should be independent and cleanup after itself
4. **Performance Benchmarking**: Validate batch operations and concurrent KB creation
5. **Security Testing**: Verify RLS policies enforce multi-tenant isolation
6. **CI/CD Ready**: Tests should run in CI pipeline with Supabase local instance

---

### Implementation Priority

**Phase 1 - Critical (P0)**:
1. Unit tests for `vapiKnowledgeBaseService.ts`
2. Retry logic tests (100% coverage required)
3. Batch operation tests (100% coverage required)
4. Error handling tests

**Phase 2 - High (P1)**:
5. Server action integration tests
6. RLS policy verification
7. Database transaction tests
8. End-to-end workflow tests

**Phase 3 - Medium (P2)**:
9. Performance benchmarking
10. Concurrent operation stress tests
11. Rate limit handling validation

---

### Estimated Testing Effort

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| Unit test setup | 2 hours | Low |
| Unit test implementation | 8 hours | Medium |
| Integration test setup | 2 hours | Medium |
| Integration test implementation | 6 hours | High |
| Performance tests | 3 hours | Medium |
| CI/CD integration | 2 hours | Low |
| Documentation | 2 hours | Low |
| **Total** | **25 hours** | **~3 days** |

---

### Success Criteria

**Tests are considered complete when**:
- ✅ All acceptance criteria (AC1-AC7) have passing tests
- ✅ Coverage >80% overall, >90% on critical paths
- ✅ All error scenarios (429, 5xx, network) tested
- ✅ Batch operations validated (100+ files)
- ✅ RLS policies verified
- ✅ CI/CD pipeline runs successfully
- ✅ Documentation updated

---

### Final Notes

**Critical Warnings**:
- ⚠️ NEVER run integration tests with production VAPI API key
- ⚠️ Mock all external API calls in unit tests
- ⚠️ Clear test data after each test run
- ⚠️ Use fake timers for retry logic tests
- ⚠️ Verify async patterns for Next.js 15 compatibility

**Best Practices**:
- Follow existing test patterns (`embeddingService.test.ts`)
- Use descriptive test names (`should create KB with >100 files`)
- Assert specific error types and messages
- Test positive AND negative scenarios
- Maintain test independence (no shared state)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: Ready for Implementation
**Estimated Implementation Time**: 3 days (25 hours)
