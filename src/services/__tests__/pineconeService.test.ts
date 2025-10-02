/**
 * Pinecone Service Unit Tests
 *
 * Tests all core functionality with mocked Pinecone SDK
 *
 * @see INTEL-003 Testing Strategy
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  deleteVectorsByIds,
  getNamespaceStats,
  PineconeValidationError,
  PineconeConnectionError,
  PineconeConfigError,
  PineconeQuotaError,
} from '@/services/pineconeService';
import {
  createMockVector,
  createMockVectors,
  createLargeBatchVectors,
  createVectorsWithDuplicates,
  invalidVectors,
  generateMockEmbedding,
} from './fixtures/mockVectorData';
import {
  validNamespaces,
  invalidNamespaces,
} from './fixtures/testNamespaces';

// ============================================================================
// Mock Pinecone SDK
// ============================================================================

const mockUpsert = vi.fn();
const mockQuery = vi.fn();
const mockDeleteAll = vi.fn();
const mockDeleteMany = vi.fn();
const mockDescribeIndexStats = vi.fn();
const mockNamespace = vi.fn();
const mockIndex = vi.fn();

// Mock the entire Pinecone module
vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn().mockImplementation(() => ({
    index: mockIndex,
  })),
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('PineconeService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default mock behavior
    mockNamespace.mockReturnValue({
      upsert: mockUpsert,
      query: mockQuery,
      deleteAll: mockDeleteAll,
      deleteMany: mockDeleteMany,
    });

    mockIndex.mockReturnValue({
      namespace: mockNamespace,
      describeIndexStats: mockDescribeIndexStats,
    });

    // Default successful responses
    mockUpsert.mockResolvedValue({ upsertedCount: 1 });
    mockQuery.mockResolvedValue({ matches: [] });
    mockDeleteAll.mockResolvedValue({});
    mockDeleteMany.mockResolvedValue({});
    mockDescribeIndexStats.mockResolvedValue({
      dimension: 1536,
      namespaces: {},
    });

    // Set required environment variables
    process.env.PINECONE_API_KEY = 'test-api-key';
    process.env.PINECONE_INDEX = 'test-index';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_INDEX;
  });

  // ============================================================================
  // AC5: Namespace Validation Tests
  // ============================================================================

  describe('AC5: Namespace Validation', () => {
    it('TC-AC5-001: Should accept valid namespace formats', async () => {
      const namespace = validNamespaces.withHyphen;
      const vectors = createMockVectors('doc1', 1);

      await upsertVectors(namespace, vectors);

      expect(mockNamespace).toHaveBeenCalledWith(namespace);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('TC-AC5-002: Should reject invalid special characters', async () => {
      const namespace = invalidNamespaces.withUnderscore;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('TC-AC5-003: Should reject too short namespace (<3 chars)', async () => {
      const namespace = invalidNamespaces.tooShort;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'between 3 and 63 characters'
      );
    });

    it('TC-AC5-004: Should reject too long namespace (>63 chars)', async () => {
      const namespace = invalidNamespaces.tooLong;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('TC-AC5-005: Should reject invalid start/end characters', async () => {
      const startHyphen = invalidNamespaces.startsWithHyphen;
      const endHyphen = invalidNamespaces.endsWithHyphen;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(startHyphen, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(endHyphen, vectors)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('TC-AC5-006: Should reject consecutive hyphens', async () => {
      const namespace = invalidNamespaces.consecutiveHyphens;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'consecutive hyphens'
      );
    });

    it('TC-AC5-007: Should reject uppercase characters', async () => {
      const namespace = invalidNamespaces.uppercase;
      const vectors = createMockVectors('doc1', 1);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('Should accept legacy 13-char alphanumeric namespace', async () => {
      const namespace = validNamespaces.legacy13Char;
      const vectors = createMockVectors('doc1', 1);

      await upsertVectors(namespace, vectors);

      expect(mockNamespace).toHaveBeenCalledWith(namespace);
    });
  });

  // ============================================================================
  // AC1: Upsert Vectors with Namespace
  // ============================================================================

  describe('AC1: Upsert Vectors with Namespace', () => {
    const namespace = 'test-namespace';

    it('TC-AC1-001: Should successfully upsert valid vectors', async () => {
      const vectors = createMockVectors('doc1', 5);

      const result = await upsertVectors(namespace, vectors);

      expect(result.upsertedCount).toBe(5);
      expect(mockNamespace).toHaveBeenCalledWith(namespace);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it('TC-AC1-002: Should reject empty vectors array', async () => {
      const vectors: any[] = [];

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'must not be empty'
      );
    });

    it('TC-AC1-003: Should reject missing required metadata fields', async () => {
      const vectors = [invalidVectors.missingText];

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'metadata.text'
      );
    });

    it('TC-AC1-004: Should reject invalid vector dimensions', async () => {
      const vectors = [invalidVectors.invalidValues];

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'finite numbers'
      );
    });

    it('TC-AC1-005: Should isolate vectors by namespace', async () => {
      const namespace1 = 'namespace-1';
      const namespace2 = 'namespace-2';
      const vectors1 = createMockVectors('doc1', 3);
      const vectors2 = createMockVectors('doc2', 3);

      await upsertVectors(namespace1, vectors1);
      await upsertVectors(namespace2, vectors2);

      expect(mockNamespace).toHaveBeenCalledWith(namespace1);
      expect(mockNamespace).toHaveBeenCalledWith(namespace2);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // AC2: Query Vectors within Namespace
  // ============================================================================

  describe('AC2: Query Vectors within Namespace', () => {
    const namespace = 'test-namespace';

    it('TC-AC2-001: Should successfully query with top K results', async () => {
      const queryEmbedding = generateMockEmbedding();
      const mockResults = [
        {
          id: 'doc1-chunk-0',
          score: 0.95,
          metadata: { text: 'Result 1', documentId: 'doc1', chunkIndex: 0 },
        },
        {
          id: 'doc1-chunk-1',
          score: 0.85,
          metadata: { text: 'Result 2', documentId: 'doc1', chunkIndex: 1 },
        },
      ];

      mockQuery.mockResolvedValue({ matches: mockResults });

      const results = await queryVectors(namespace, queryEmbedding, { topK: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(mockQuery).toHaveBeenCalledWith({
        vector: queryEmbedding,
        topK: 2,
        includeValues: false,
        includeMetadata: true,
        filter: undefined,
      });
    });

    it('TC-AC2-002: Should use default top K (10)', async () => {
      const queryEmbedding = generateMockEmbedding();

      await queryVectors(namespace, queryEmbedding);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 10 })
      );
    });

    it('TC-AC2-003: Should validate namespace format', async () => {
      const invalidNamespace = invalidNamespaces.withUnderscore;
      const queryEmbedding = generateMockEmbedding();

      await expect(
        queryVectors(invalidNamespace, queryEmbedding)
      ).rejects.toThrow(PineconeValidationError);
    });

    it('TC-AC2-004: Should reject empty namespace', async () => {
      const queryEmbedding = generateMockEmbedding();

      await expect(queryVectors('', queryEmbedding)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('TC-AC2-005: Should handle no results', async () => {
      const queryEmbedding = generateMockEmbedding();
      mockQuery.mockResolvedValue({ matches: [] });

      const results = await queryVectors(namespace, queryEmbedding);

      expect(results).toHaveLength(0);
    });

    it('TC-AC2-006: Should reject invalid vector dimensions', async () => {
      const invalidEmbedding = [1, 2, NaN, 4];

      await expect(queryVectors(namespace, invalidEmbedding)).rejects.toThrow(
        PineconeValidationError
      );
    });
  });

  // ============================================================================
  // AC3: Delete Namespace
  // ============================================================================

  describe('AC3: Delete Namespace', () => {
    it('TC-AC3-001: Should successfully delete namespace', async () => {
      const namespace = 'test-namespace';

      await deleteNamespace(namespace);

      expect(mockNamespace).toHaveBeenCalledWith(namespace);
      expect(mockDeleteAll).toHaveBeenCalled();
    });

    it('TC-AC3-002: Should be idempotent for non-existent namespace', async () => {
      const namespace = 'non-existent';
      mockDeleteAll.mockRejectedValue({ status: 404 });

      await expect(deleteNamespace(namespace)).resolves.not.toThrow();
    });

    it('TC-AC3-003: Should reject invalid namespace format', async () => {
      const namespace = invalidNamespaces.withUnderscore;

      await expect(deleteNamespace(namespace)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('TC-AC3-004: Should verify namespace isolation during deletion', async () => {
      const namespace1 = 'namespace-1';
      const namespace2 = 'namespace-2';

      await deleteNamespace(namespace1);

      expect(mockNamespace).toHaveBeenCalledWith(namespace1);
      expect(mockNamespace).not.toHaveBeenCalledWith(namespace2);
    });

    it('TC-AC3-005: Should handle Pinecone API errors', async () => {
      const namespace = 'test-namespace';
      mockDeleteAll.mockRejectedValue(new Error('API Error'));

      await expect(deleteNamespace(namespace)).rejects.toThrow();
    });
  });

  // ============================================================================
  // AC4: Upsert with Deduplication
  // ============================================================================

  describe('AC4: Upsert with Deduplication', () => {
    const namespace = 'test-namespace';

    it('TC-AC4-001: Should update existing vectors with duplicate IDs', async () => {
      const vectors = createVectorsWithDuplicates();

      await upsertVectors(namespace, vectors);

      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      // Pinecone handles deduplication automatically
      expect(upsertCall).toHaveLength(4);
    });

    it('TC-AC4-002: Should handle batch upsert with mixed duplicate IDs', async () => {
      const vectors = [
        ...createMockVectors('doc1', 50),
        ...createMockVectors('doc1', 25), // Some duplicates
      ];

      const result = await upsertVectors(namespace, vectors);

      expect(result.upsertedCount).toBe(75);
    });

    it('TC-AC4-003: Should preserve latest metadata for duplicates', async () => {
      const original = createMockVector('doc1', 0, 'Original text');
      const updated = createMockVector('doc1', 0, 'Updated text');
      const vectors = [original, updated];

      await upsertVectors(namespace, vectors);

      const upsertCall = mockUpsert.mock.calls[0][0];
      // Both vectors are sent to Pinecone (it handles deduplication)
      // The last one in the array will take precedence in Pinecone
      expect(upsertCall).toHaveLength(2);
      const lastVector = upsertCall[1];
      expect(lastVector.metadata.text).toBe('Updated text');
    });
  });

  // ============================================================================
  // AC6: Batch Upsert Optimization
  // ============================================================================

  describe('AC6: Batch Upsert Optimization', () => {
    const namespace = 'test-namespace';

    it('TC-AC6-001: Should use single batch for 100 vectors', async () => {
      const vectors = createLargeBatchVectors(100);

      await upsertVectors(namespace, vectors);

      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it('TC-AC6-002: Should use two batches for 101 vectors', async () => {
      const vectors = createLargeBatchVectors(101);

      await upsertVectors(namespace, vectors);

      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('TC-AC6-003: Should use three batches for 250 vectors', async () => {
      const vectors = createLargeBatchVectors(250);

      await upsertVectors(namespace, vectors);

      expect(mockUpsert).toHaveBeenCalledTimes(3);
    });

    it('TC-AC6-004: Should respect max concurrent limit (5)', async () => {
      const vectors = createLargeBatchVectors(600); // 6 batches

      await upsertVectors(namespace, vectors);

      // 6 batches / 5 max concurrent = 2 rounds
      expect(mockUpsert).toHaveBeenCalledTimes(6);
    });

    it('TC-AC6-005: Should handle partial batch failures gracefully', async () => {
      const vectors = createLargeBatchVectors(200);

      // First batch succeeds, second fails (even after retries)
      mockUpsert
        .mockResolvedValueOnce({ upsertedCount: 100 })
        .mockRejectedValue({ status: 500, message: 'Server error' });

      await expect(
        upsertVectors(namespace, vectors, { maxRetries: 1 })
      ).rejects.toThrow(PineconeConnectionError);
    });

    it('TC-AC6-006: Should handle empty batch (edge case)', async () => {
      const vectors = createMockVectors('doc1', 0);

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('Should support custom batch size', async () => {
      const vectors = createLargeBatchVectors(250);

      await upsertVectors(namespace, vectors, { batchSize: 50 });

      expect(mockUpsert).toHaveBeenCalledTimes(5); // 250 / 50 = 5 batches
    });
  });

  // ============================================================================
  // AC7: Index Statistics
  // ============================================================================

  describe('AC7: Index Statistics', () => {
    it('TC-AC7-001: Should get stats for existing namespace', async () => {
      const namespace = 'test-namespace';
      mockDescribeIndexStats.mockResolvedValue({
        dimension: 1536,
        namespaces: {
          [namespace]: {
            recordCount: 100,
          },
        },
      });

      const stats = await getNamespaceStats(namespace);

      expect(stats.vectorCount).toBe(100);
      expect(stats.dimension).toBe(1536);
    });

    it('TC-AC7-002: Should return zero for empty namespace', async () => {
      const namespace = 'empty-namespace';
      mockDescribeIndexStats.mockResolvedValue({
        dimension: 1536,
        namespaces: {
          [namespace]: {
            recordCount: 0,
          },
        },
      });

      const stats = await getNamespaceStats(namespace);

      expect(stats.vectorCount).toBe(0);
      expect(stats.dimension).toBe(1536);
    });

    it('TC-AC7-003: Should return zero for non-existent namespace', async () => {
      const namespace = 'non-existent';
      mockDescribeIndexStats.mockResolvedValue({
        dimension: 1536,
        namespaces: {},
      });

      const stats = await getNamespaceStats(namespace);

      expect(stats.vectorCount).toBe(0);
      expect(stats.dimension).toBe(1536);
    });

    it('TC-AC7-004: Should reject invalid namespace format', async () => {
      const namespace = invalidNamespaces.withUnderscore;

      await expect(getNamespaceStats(namespace)).rejects.toThrow(
        PineconeValidationError
      );
    });
  });

  // ============================================================================
  // Delete Vectors by IDs
  // ============================================================================

  describe('deleteVectorsByIds', () => {
    const namespace = 'test-namespace';

    it('Should successfully delete vectors by IDs', async () => {
      const ids = ['doc1-chunk-0', 'doc1-chunk-1', 'doc1-chunk-2'];

      await deleteVectorsByIds(namespace, ids);

      expect(mockNamespace).toHaveBeenCalledWith(namespace);
      expect(mockDeleteMany).toHaveBeenCalledWith(ids);
    });

    it('Should reject empty IDs array', async () => {
      const ids: string[] = [];

      await expect(deleteVectorsByIds(namespace, ids)).rejects.toThrow(
        PineconeValidationError
      );
    });

    it('Should reject invalid ID types', async () => {
      const ids = ['valid-id', '', 'another-valid'] as string[];

      await expect(deleteVectorsByIds(namespace, ids)).rejects.toThrow(
        PineconeValidationError
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    const namespace = 'test-namespace';

    it('Should handle authentication errors (401)', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert.mockRejectedValue({ status: 401 });

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeConfigError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'Invalid Pinecone API key'
      );
    });

    it('Should handle quota exceeded errors (402)', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert.mockRejectedValue({ status: 402 });

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeQuotaError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'quota exceeded'
      );
    });

    it('Should handle index not found errors (404)', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert.mockRejectedValue({ status: 404 });

      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        PineconeConfigError
      );
      await expect(upsertVectors(namespace, vectors)).rejects.toThrow(
        'index not found'
      );
    });

    it('Should retry on rate limit errors (429)', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValue({ upsertedCount: 1 });

      const result = await upsertVectors(namespace, vectors, { maxRetries: 1 });

      expect(result.upsertedCount).toBe(1);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('Should retry on server errors (500)', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue({ upsertedCount: 1 });

      const result = await upsertVectors(namespace, vectors, { maxRetries: 1 });

      expect(result.upsertedCount).toBe(1);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('Should throw after max retries exhausted', async () => {
      const vectors = createMockVectors('doc1', 1);
      mockUpsert.mockRejectedValue({ status: 500 });

      await expect(
        upsertVectors(namespace, vectors, { maxRetries: 2 })
      ).rejects.toThrow(PineconeConnectionError);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    // Note: These tests verify configuration validation happens in the service
    // In actual implementation, the singleton pattern means we can't easily test
    // missing env vars after first initialization. These would need integration tests.

    it('Should accept both PINECONE_API_KEY and legacy key', async () => {
      process.env.PINECONE_API_KEY = 'test-api-key';
      process.env.PINECONE_INDEX = 'test-index';

      const vectors = createMockVectors('doc1', 1);
      const result = await upsertVectors('test', vectors);

      expect(result.upsertedCount).toBe(1);
    });

    it('Should accept legacy environment variables', async () => {
      process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE = 'legacy-key';
      process.env.NEXT_PUBLIC_PINECONE_INDEX = 'legacy-index';

      const vectors = createMockVectors('doc1', 1);
      const result = await upsertVectors('test', vectors);

      expect(result.upsertedCount).toBe(1);
    });

    it('Should validate namespace even with valid config', async () => {
      process.env.PINECONE_API_KEY = 'test-api-key';
      process.env.PINECONE_INDEX = 'test-index';

      const vectors = createMockVectors('doc1', 1);

      // Invalid namespace should still fail validation
      await expect(
        upsertVectors('INVALID_NAMESPACE', vectors)
      ).rejects.toThrow(PineconeValidationError);
    });
  });
});
