# Testing Implementation Plan: Pinecone Vector Store Service (INTEL-003)

**Feature**: Pinecone Vector Store Service
**Story**: INTEL-003
**Created**: 2025-10-02
**Test Framework**: Vitest 3.2.4
**Coverage Target**: >80% (lines, functions, statements), >75% (branches)

---

## Executive Summary

This document outlines a comprehensive testing strategy for the Pinecone Vector Store Service, covering unit tests with mocked Pinecone client, integration tests with real Pinecone API, edge cases, error scenarios, and performance tests. The strategy ensures all acceptance criteria (AC1-AC7) are validated with appropriate test coverage, mock strategies, and data fixtures.

**Testing Philosophy:**
- Unit tests focus on business logic, validation, and error handling with fully mocked dependencies
- Integration tests verify real Pinecone API interactions (manual execution only)
- Performance tests validate batch operations and timeout constraints
- Edge case coverage ensures robustness for production use

---

## Testing Architecture

### Test File Structure

```
src/services/
├── pineconeService.ts                           # Service implementation
└── __tests__/
    ├── pineconeService.test.ts                  # Unit tests (mocked)
    ├── pineconeService.integration.test.ts      # Integration tests (real API)
    ├── pineconeService.performance.test.ts      # Performance benchmarks
    └── fixtures/
        ├── mockVectorData.ts                    # Mock vector fixtures
        ├── testNamespaces.ts                    # Test namespace patterns
        └── README.md                            # Fixture documentation
```

### Test Organization

**Unit Tests** (`pineconeService.test.ts`):
- Mock all Pinecone SDK calls
- Focus on validation logic, error handling, and business rules
- Fast execution (<2s total)
- Run on every commit via CI/CD

**Integration Tests** (`pineconeService.integration.test.ts`):
- Real Pinecone API calls (requires API key)
- Validate actual vector storage, retrieval, and deletion
- Slower execution (30-60s)
- Manual execution only (not in CI)

**Performance Tests** (`pineconeService.performance.test.ts`):
- Validate batch processing efficiency
- Test concurrent request handling
- Verify timeout constraints
- Benchmark large-scale operations

---

## Test Coverage Mapping by Acceptance Criteria

### AC1: Upsert Vectors with Namespace

**Test Cases:**

1. **TC-AC1-001: Successful Upsert with Valid Namespace**
   - **Description**: Verify vectors are successfully upserted to a valid namespace
   - **Input Data**:
     ```typescript
     const namespace = "test-assistant-abc123";
     const vectors: VectorRecord[] = [
       {
         id: "doc-1-chunk-0",
         values: Array(1536).fill(0.1),
         metadata: {
           text: "Sample text chunk",
           documentId: "doc-1",
           pageNumber: 1,
           chunkIndex: 0,
         }
       }
     ];
     ```
   - **Expected Output**:
     ```typescript
     // Mock should be called with correct parameters
     expect(mockUpsert).toHaveBeenCalledWith({
       namespace: "test-assistant-abc123",
       vectors: expect.arrayContaining([
         expect.objectContaining({
           id: "doc-1-chunk-0",
           values: expect.any(Array),
         })
       ])
     });
     ```
   - **Mock Configuration**:
     ```typescript
     const mockUpsert = vi.fn().mockResolvedValue({ upsertedCount: 1 });
     vi.mock('@pinecone-database/pinecone', () => ({
       Pinecone: vi.fn(() => ({
         index: vi.fn(() => ({
           namespace: vi.fn(() => ({
             upsert: mockUpsert
           }))
         }))
       }))
     }));
     ```

2. **TC-AC1-002: Upsert with Empty Vectors Array**
   - **Description**: Verify appropriate error when upserting empty array
   - **Input Data**: `namespace = "test-ns", vectors = []`
   - **Expected Output**: Throws `PineconeValidationError` with message "Vectors array cannot be empty"
   - **Mock Configuration**: Mock should not be called

3. **TC-AC1-003: Upsert with Missing Required Metadata Fields**
   - **Description**: Verify validation catches missing metadata
   - **Input Data**:
     ```typescript
     const vectors: VectorRecord[] = [{
       id: "doc-1-chunk-0",
       values: Array(1536).fill(0.1),
       metadata: {
         text: "Sample text"
         // Missing documentId and chunkIndex
       }
     }];
     ```
   - **Expected Output**: Throws `PineconeValidationError` with message "Metadata must include documentId and chunkIndex"
   - **Mock Configuration**: Mock should not be called

4. **TC-AC1-004: Upsert with Invalid Vector Dimensions**
   - **Description**: Verify validation catches dimension mismatch
   - **Input Data**: `values = Array(512).fill(0.1)` (wrong dimension for text-embedding-ada-002)
   - **Expected Output**: Throws `PineconeValidationError` with message "Vector dimension mismatch"
   - **Mock Configuration**: Mock should throw dimension error

5. **TC-AC1-005: Upsert with Namespace Isolation Verification**
   - **Description**: Verify vectors are isolated to specified namespace
   - **Input Data**: Two different namespaces with same document ID
   - **Expected Output**: Mock called twice with different namespace parameters
   - **Mock Configuration**: Track namespace parameter in each call

### AC2: Query Vectors within Namespace

**Test Cases:**

1. **TC-AC2-001: Successful Query with Top K Results**
   - **Description**: Query returns top K most similar vectors from namespace
   - **Input Data**:
     ```typescript
     const namespace = "test-assistant-abc123";
     const queryEmbedding = Array(1536).fill(0.1);
     const topK = 5;
     ```
   - **Expected Output**:
     ```typescript
     {
       results: [
         { id: "doc-1-chunk-0", score: 0.95, metadata: {...} },
         { id: "doc-1-chunk-1", score: 0.92, metadata: {...} },
         { id: "doc-2-chunk-0", score: 0.88, metadata: {...} }
       ]
     }
     ```
   - **Mock Configuration**:
     ```typescript
     const mockQuery = vi.fn().mockResolvedValue({
       matches: [
         { id: "doc-1-chunk-0", score: 0.95, metadata: {...} },
         { id: "doc-1-chunk-1", score: 0.92, metadata: {...} },
         { id: "doc-2-chunk-0", score: 0.88, metadata: {...} }
       ]
     });
     ```

2. **TC-AC2-002: Query with Default Top K (10)**
   - **Description**: Verify default topK is 10 when not specified
   - **Input Data**: `namespace, queryEmbedding` (no topK parameter)
   - **Expected Output**: Mock called with `topK: 10`
   - **Mock Configuration**: Verify default parameter

3. **TC-AC2-003: Query with Invalid Namespace**
   - **Description**: Verify error handling for invalid namespace format
   - **Input Data**: `namespace = "Invalid_Namespace!@#"`
   - **Expected Output**: Throws `PineconeValidationError` with message "Invalid namespace format"
   - **Mock Configuration**: Mock should not be called

4. **TC-AC2-004: Query with Empty Namespace**
   - **Description**: Verify error when namespace is empty
   - **Input Data**: `namespace = ""`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: Mock should not be called

5. **TC-AC2-005: Query with No Results**
   - **Description**: Verify handling when no similar vectors found
   - **Input Data**: Valid query parameters
   - **Expected Output**: `{ results: [] }`
   - **Mock Configuration**: Mock returns empty matches array

6. **TC-AC2-006: Query with Invalid Vector Dimensions**
   - **Description**: Verify error when query embedding has wrong dimensions
   - **Input Data**: `queryEmbedding = Array(512).fill(0.1)`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: Mock should not be called

### AC3: Delete Namespace

**Test Cases:**

1. **TC-AC3-001: Successful Namespace Deletion**
   - **Description**: Verify complete namespace deletion
   - **Input Data**: `namespace = "test-assistant-abc123"`
   - **Expected Output**: Namespace deleted successfully
   - **Mock Configuration**:
     ```typescript
     const mockDeleteAll = vi.fn().mockResolvedValue({});
     ```

2. **TC-AC3-002: Delete Non-Existent Namespace**
   - **Description**: Verify graceful handling of non-existent namespace
   - **Input Data**: `namespace = "nonexistent-namespace"`
   - **Expected Output**: Operation succeeds without error (idempotent)
   - **Mock Configuration**: Mock succeeds even if namespace doesn't exist

3. **TC-AC3-003: Delete with Invalid Namespace Format**
   - **Description**: Verify validation before deletion
   - **Input Data**: `namespace = "INVALID-NS"`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: Mock should not be called

4. **TC-AC3-004: Delete Namespace Isolation**
   - **Description**: Verify deletion only affects target namespace
   - **Input Data**: Delete "namespace-1" while "namespace-2" exists
   - **Expected Output**: Only "namespace-1" delete called
   - **Mock Configuration**: Track which namespace delete was called

5. **TC-AC3-005: Delete with Pinecone API Error**
   - **Description**: Verify error handling for API failures
   - **Input Data**: Valid namespace
   - **Expected Output**: Throws `PineconeAPIError` with sanitized message
   - **Mock Configuration**: Mock throws API error

### AC4: Upsert with Deduplication

**Test Cases:**

1. **TC-AC4-001: Upsert with Duplicate IDs Updates Existing**
   - **Description**: Verify upsert logic updates rather than creates duplicates
   - **Input Data**:
     ```typescript
     // First upsert
     const vector1 = {
       id: "doc-1-chunk-0",
       values: Array(1536).fill(0.1),
       metadata: { text: "Original text" }
     };
     // Second upsert with same ID
     const vector2 = {
       id: "doc-1-chunk-0",
       values: Array(1536).fill(0.2),
       metadata: { text: "Updated text" }
     };
     ```
   - **Expected Output**: Mock called twice, second call updates first
   - **Mock Configuration**: Track upsert calls

2. **TC-AC4-002: Batch Upsert with Mixed Duplicate IDs**
   - **Description**: Verify deduplication within single batch
   - **Input Data**: Array with duplicate IDs
   - **Expected Output**: Only unique IDs sent to Pinecone
   - **Mock Configuration**: Verify unique IDs in mock call

3. **TC-AC4-003: Upsert Preserves Latest Metadata**
   - **Description**: Verify latest metadata is used for duplicate IDs
   - **Input Data**: Same ID with different metadata
   - **Expected Output**: Latest metadata preserved
   - **Mock Configuration**: Verify metadata in mock call

### AC5: Namespace Validation

**Test Cases:**

1. **TC-AC5-001: Valid Namespace Formats**
   - **Description**: Verify acceptance of valid namespace formats
   - **Input Data**:
     ```typescript
     ["test-assistant-123", "assistant-abc", "ns-12345", "test-ns-001"]
     ```
   - **Expected Output**: All pass validation
   - **Mock Configuration**: N/A (pure validation logic)

2. **TC-AC5-002: Invalid Namespace with Special Characters**
   - **Description**: Reject namespaces with invalid characters
   - **Input Data**:
     ```typescript
     ["Test_Assistant", "ns@123", "assistant!123", "ns#abc"]
     ```
   - **Expected Output**: All throw `PineconeValidationError`
   - **Mock Configuration**: N/A

3. **TC-AC5-003: Invalid Namespace Length (Too Short)**
   - **Description**: Reject namespaces shorter than 3 characters
   - **Input Data**: `["ab", "x", ""]`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: N/A

4. **TC-AC5-004: Invalid Namespace Length (Too Long)**
   - **Description**: Reject namespaces longer than 63 characters
   - **Input Data**: `"a".repeat(64)`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: N/A

5. **TC-AC5-005: Invalid Namespace Start/End Characters**
   - **Description**: Reject namespaces starting/ending with hyphen
   - **Input Data**: `["-invalid", "invalid-", "-invalid-"]`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: N/A

6. **TC-AC5-006: Invalid Consecutive Hyphens**
   - **Description**: Reject namespaces with consecutive hyphens
   - **Input Data**: `["test--assistant", "ns---123"]`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: N/A

7. **TC-AC5-007: Uppercase Characters Rejected**
   - **Description**: Verify lowercase-only requirement
   - **Input Data**: `["Test-Namespace", "TEST-NS"]`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: N/A

### AC6: Batch Upsert Optimization

**Test Cases:**

1. **TC-AC6-001: Upsert Exactly 100 Vectors (No Batching)**
   - **Description**: Verify single batch for 100 vectors
   - **Input Data**: Array of 100 vectors
   - **Expected Output**: Mock called exactly once
   - **Mock Configuration**: Track number of calls

2. **TC-AC6-002: Upsert 101 Vectors (Two Batches)**
   - **Description**: Verify batching for 101 vectors
   - **Input Data**: Array of 101 vectors
   - **Expected Output**: Mock called exactly twice (100 + 1)
   - **Mock Configuration**: Track batch sizes

3. **TC-AC6-003: Upsert 250 Vectors (Three Batches)**
   - **Description**: Verify correct batching for 250 vectors
   - **Input Data**: Array of 250 vectors
   - **Expected Output**: Mock called 3 times (100 + 100 + 50)
   - **Mock Configuration**: Verify batch sizes: [100, 100, 50]

4. **TC-AC6-004: Parallel Batch Processing**
   - **Description**: Verify batches are processed in parallel (max 5 concurrent)
   - **Input Data**: Array of 500 vectors
   - **Expected Output**: 5 batches processed in parallel
   - **Mock Configuration**: Track concurrent execution

5. **TC-AC6-005: Batch Processing with Partial Failure**
   - **Description**: Verify handling when one batch fails
   - **Input Data**: Array of 200 vectors
   - **Expected Output**: Error includes failed batch information
   - **Mock Configuration**: Mock succeeds for first batch, fails for second

6. **TC-AC6-006: Empty Batch Handling**
   - **Description**: Verify no API call for empty arrays
   - **Input Data**: `vectors = []`
   - **Expected Output**: Error before API call
   - **Mock Configuration**: Mock should not be called

### AC7: Index Statistics

**Test Cases:**

1. **TC-AC7-001: Get Stats for Existing Namespace**
   - **Description**: Retrieve statistics for namespace with vectors
   - **Input Data**: `namespace = "test-assistant-abc123"`
   - **Expected Output**:
     ```typescript
     {
       vectorCount: 150,
       dimension: 1536
     }
     ```
   - **Mock Configuration**:
     ```typescript
     const mockDescribeIndexStats = vi.fn().mockResolvedValue({
       namespaces: {
         "test-assistant-abc123": {
           vectorCount: 150
         }
       },
       dimension: 1536,
       indexFullness: 0.05
     });
     ```

2. **TC-AC7-002: Get Stats for Empty Namespace**
   - **Description**: Verify stats for namespace with no vectors
   - **Input Data**: `namespace = "empty-namespace"`
   - **Expected Output**:
     ```typescript
     {
       vectorCount: 0,
       dimension: 1536
     }
     ```
   - **Mock Configuration**: Mock returns 0 vectors

3. **TC-AC7-003: Get Stats for Non-Existent Namespace**
   - **Description**: Verify handling when namespace doesn't exist
   - **Input Data**: `namespace = "nonexistent-namespace"`
   - **Expected Output**:
     ```typescript
     {
       vectorCount: 0,
       dimension: 1536
     }
     ```
   - **Mock Configuration**: Mock returns no namespace entry

4. **TC-AC7-004: Get Stats with Invalid Namespace**
   - **Description**: Verify validation before stats retrieval
   - **Input Data**: `namespace = "Invalid_NS"`
   - **Expected Output**: Throws `PineconeValidationError`
   - **Mock Configuration**: Mock should not be called

---

## Edge Cases and Error Scenarios

### Validation Edge Cases

1. **Edge-001: Zero Vector Values**
   - **Test**: Upsert vector with all zero values
   - **Expected**: Succeeds (valid vector)

2. **Edge-002: Negative Vector Values**
   - **Test**: Upsert vector with negative values
   - **Expected**: Succeeds (valid vector)

3. **Edge-003: Very Small Float Values**
   - **Test**: Upsert vector with values < 1e-10
   - **Expected**: Succeeds (valid vector)

4. **Edge-004: NaN Vector Values**
   - **Test**: Upsert vector with NaN values
   - **Expected**: Throws `PineconeValidationError`

5. **Edge-005: Infinity Vector Values**
   - **Test**: Upsert vector with Infinity/-Infinity
   - **Expected**: Throws `PineconeValidationError`

### Error Handling Scenarios

1. **Error-001: Network Timeout**
   - **Scenario**: API call exceeds 30s timeout
   - **Expected**: Throws `PineconeTimeoutError` with retry suggestion

2. **Error-002: Rate Limiting (429)**
   - **Scenario**: Pinecone API returns 429
   - **Expected**: Retry with exponential backoff (max 3 retries)

3. **Error-003: Server Error (500)**
   - **Scenario**: Pinecone API returns 500
   - **Expected**: Retry with exponential backoff (max 3 retries)

4. **Error-004: Authentication Error (401)**
   - **Scenario**: Invalid API key
   - **Expected**: Throws `PineconeAuthError` (no retry)

5. **Error-005: Quota Exceeded (402)**
   - **Scenario**: Pinecone quota/billing issue
   - **Expected**: Throws `PineconeQuotaError` with upgrade message

6. **Error-006: Index Not Found (404)**
   - **Scenario**: Index doesn't exist
   - **Expected**: Throws `PineconeConfigError` with env check message

7. **Error-007: Concurrent Request Limit**
   - **Scenario**: More than 5 concurrent requests
   - **Expected**: Queue additional requests

8. **Error-008: Memory Exhaustion**
   - **Scenario**: Very large batch (>10,000 vectors)
   - **Expected**: Batch processing prevents memory issues

### Multi-Tenant Isolation Tests

1. **MT-001: Namespace Isolation Verification**
   - **Test**: Upsert to namespace-1, query namespace-2
   - **Expected**: namespace-2 query returns empty results

2. **MT-002: Concurrent Namespace Operations**
   - **Test**: Simultaneous upsert to 5 different namespaces
   - **Expected**: All operations succeed independently

3. **MT-003: Delete One Namespace Leaves Others Intact**
   - **Test**: Delete namespace-1, verify namespace-2 unaffected
   - **Expected**: namespace-2 statistics unchanged

---

## Performance Test Requirements

### Benchmark Criteria

| Operation | Metric | Target | Max Acceptable |
|-----------|--------|--------|----------------|
| Upsert 100 vectors | Latency | <2s | <5s |
| Upsert 1000 vectors (batched) | Latency | <10s | <20s |
| Query with topK=10 | Latency | <500ms | <1s |
| Delete namespace | Latency | <3s | <10s |
| Get namespace stats | Latency | <1s | <3s |
| Concurrent operations (5 parallel) | Total time | <15s | <30s |

### Performance Test Cases

1. **Perf-001: Batch Upsert Throughput**
   - **Description**: Measure throughput for various batch sizes
   - **Test Data**: 100, 500, 1000, 5000 vectors
   - **Metrics**: Vectors per second, total time, memory usage

2. **Perf-002: Query Performance with Large Index**
   - **Description**: Query performance with 10k+ vectors in namespace
   - **Test Data**: Namespace with 10,000 vectors
   - **Metrics**: Query latency, result accuracy

3. **Perf-003: Concurrent Request Handling**
   - **Description**: Test parallel request processing
   - **Test Data**: 10 simultaneous upsert operations
   - **Metrics**: Total time, request queueing behavior

4. **Perf-004: Memory Usage During Batch Operations**
   - **Description**: Monitor memory consumption during large batches
   - **Test Data**: 5000 vector batch
   - **Metrics**: Peak memory usage, garbage collection frequency

5. **Perf-005: Retry Overhead Measurement**
   - **Description**: Measure impact of retry logic on failed requests
   - **Test Data**: Simulated API failures
   - **Metrics**: Retry delay, total request time

---

## Test Data Structure and Mocking Strategy

### Mock Fixtures

**File: `src/services/__tests__/fixtures/mockVectorData.ts`**

```typescript
import type { VectorRecord } from '@/types/pinecone';

/**
 * Generate mock vector with specified dimension
 */
export function generateMockVector(dimension: number = 1536): number[] {
  return Array.from({ length: dimension }, () => Math.random() * 2 - 1);
}

/**
 * Generate mock vector record
 */
export function generateMockVectorRecord(
  documentId: string,
  chunkIndex: number,
  overrides?: Partial<VectorRecord>
): VectorRecord {
  return {
    id: `${documentId}-chunk-${chunkIndex}`,
    values: generateMockVector(),
    metadata: {
      text: `Sample text chunk ${chunkIndex} from document ${documentId}`,
      documentId,
      pageNumber: Math.floor(chunkIndex / 5) + 1,
      chunkIndex,
      ...overrides?.metadata,
    },
    ...overrides,
  };
}

/**
 * Generate batch of mock vectors
 */
export function generateMockVectorBatch(
  documentId: string,
  count: number
): VectorRecord[] {
  return Array.from({ length: count }, (_, i) =>
    generateMockVectorRecord(documentId, i)
  );
}

/**
 * Mock query results
 */
export function generateMockQueryResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}-chunk-0`,
    score: 0.95 - i * 0.05,
    metadata: {
      text: `Result text ${i}`,
      documentId: `doc-${i}`,
      chunkIndex: 0,
    },
  }));
}

/**
 * Mock index statistics
 */
export function generateMockIndexStats(namespace: string, vectorCount: number) {
  return {
    namespaces: {
      [namespace]: {
        vectorCount,
      },
    },
    dimension: 1536,
    indexFullness: vectorCount / 100000,
    totalVectorCount: vectorCount,
  };
}
```

**File: `src/services/__tests__/fixtures/testNamespaces.ts`**

```typescript
/**
 * Valid test namespaces following the pattern: ^[a-z0-9-]+$
 */
export const VALID_NAMESPACES = [
  'test-assistant-abc123',
  'assistant-001',
  'ns-development',
  'test-integration-001',
  'perf-test-namespace',
] as const;

/**
 * Invalid test namespaces for validation testing
 */
export const INVALID_NAMESPACES = {
  uppercase: 'Test-Assistant',
  special_chars: 'test_assistant@123',
  too_short: 'ab',
  too_long: 'a'.repeat(64),
  starts_with_hyphen: '-invalid',
  ends_with_hyphen: 'invalid-',
  consecutive_hyphens: 'test--assistant',
  empty: '',
  spaces: 'test assistant',
} as const;

/**
 * Generate unique test namespace
 */
export function generateTestNamespace(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
```

### Mock Pinecone Client Configuration

**File: `src/services/__tests__/mocks/pineconeClient.ts`**

```typescript
import { vi } from 'vitest';
import type { Pinecone, Index } from '@pinecone-database/pinecone';

/**
 * Create mock Pinecone client with configurable behaviors
 */
export function createMockPineconeClient(options: {
  shouldFailAuth?: boolean;
  shouldTimeout?: boolean;
  shouldRateLimit?: boolean;
} = {}) {
  const mockUpsert = vi.fn().mockImplementation(async (vectors) => {
    if (options.shouldTimeout) {
      throw new Error('Request timeout');
    }
    if (options.shouldRateLimit) {
      const error = new Error('Rate limit exceeded') as any;
      error.statusCode = 429;
      throw error;
    }
    return { upsertedCount: vectors.length };
  });

  const mockQuery = vi.fn().mockResolvedValue({
    matches: [],
    namespace: '',
  });

  const mockDeleteAll = vi.fn().mockResolvedValue({});

  const mockDescribeIndexStats = vi.fn().mockResolvedValue({
    namespaces: {},
    dimension: 1536,
    indexFullness: 0,
    totalVectorCount: 0,
  });

  const mockNamespace = vi.fn().mockReturnValue({
    upsert: mockUpsert,
    query: mockQuery,
    deleteAll: mockDeleteAll,
  });

  const mockIndex = {
    namespace: mockNamespace,
    describeIndexStats: mockDescribeIndexStats,
  } as unknown as Index;

  const mockPinecone = {
    index: vi.fn().mockReturnValue(mockIndex),
  } as unknown as Pinecone;

  return {
    client: mockPinecone,
    mocks: {
      upsert: mockUpsert,
      query: mockQuery,
      deleteAll: mockDeleteAll,
      describeIndexStats: mockDescribeIndexStats,
      namespace: mockNamespace,
    },
  };
}

/**
 * Reset all mocks
 */
export function resetPineconeMocks(mocks: any) {
  Object.values(mocks).forEach((mock: any) => {
    if (typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });
}
```

### Environment Setup for Tests

**File: `vitest.setup.ts` (additions)**

```typescript
// Add Pinecone test environment variables
process.env.PINECONE_API_KEY = 'test-pinecone-api-key';
process.env.PINECONE_INDEX = 'test-index';
process.env.PINECONE_ENVIRONMENT = 'test-environment';

// Skip integration tests by default
process.env.SKIP_PINECONE_INTEGRATION_TESTS = 'true';
```

---

## File-by-File Test Implementation Details

### 1. Unit Tests: `src/services/__tests__/pineconeService.test.ts`

**Purpose**: Test business logic, validation, and error handling with mocked Pinecone client

**Structure**:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  deleteVectorsByIds,
  getNamespaceStats,
  validateNamespace,
} from '../pineconeService';
import {
  PineconeValidationError,
  PineconeAPIError,
  PineconeTimeoutError,
  PineconeQuotaError,
} from '@/types/pinecone';
import { createMockPineconeClient, resetPineconeMocks } from './mocks/pineconeClient';
import {
  generateMockVectorRecord,
  generateMockVectorBatch,
  generateMockQueryResults,
} from './fixtures/mockVectorData';
import { VALID_NAMESPACES, INVALID_NAMESPACES } from './fixtures/testNamespaces';

// Mock Pinecone SDK
vi.mock('@pinecone-database/pinecone');

describe('pineconeService - Unit Tests', () => {
  let mockClient: ReturnType<typeof createMockPineconeClient>;

  beforeEach(() => {
    mockClient = createMockPineconeClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateNamespace', () => {
    // TC-AC5-001 through TC-AC5-007
    it('should accept valid namespace formats', () => {
      VALID_NAMESPACES.forEach(ns => {
        expect(() => validateNamespace(ns)).not.toThrow();
      });
    });

    it('should reject invalid namespace formats', () => {
      Object.entries(INVALID_NAMESPACES).forEach(([key, ns]) => {
        expect(() => validateNamespace(ns)).toThrow(PineconeValidationError);
      });
    });

    // Additional validation tests...
  });

  describe('upsertVectors', () => {
    // TC-AC1-001 through TC-AC1-005
    it('should upsert vectors successfully', async () => {
      const namespace = VALID_NAMESPACES[0];
      const vectors = generateMockVectorBatch('doc-1', 10);

      await upsertVectors(namespace, vectors);

      expect(mockClient.mocks.upsert).toHaveBeenCalledWith({
        vectors: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^doc-1-chunk-\d+$/),
            values: expect.any(Array),
          })
        ])
      });
    });

    it('should throw error for empty vectors array', async () => {
      await expect(upsertVectors('test-ns', []))
        .rejects.toThrow(PineconeValidationError);
    });

    // TC-AC4-001: Deduplication tests
    it('should handle duplicate vector IDs correctly', async () => {
      const namespace = VALID_NAMESPACES[0];
      const vector1 = generateMockVectorRecord('doc-1', 0, {
        metadata: { text: 'Original' }
      });
      const vector2 = { ...vector1, metadata: { text: 'Updated' } };

      await upsertVectors(namespace, [vector1, vector2]);

      // Verify only one vector with latest metadata
      const call = mockClient.mocks.upsert.mock.calls[0][0];
      const uniqueIds = new Set(call.vectors.map(v => v.id));
      expect(uniqueIds.size).toBe(1);
      expect(call.vectors[0].metadata.text).toBe('Updated');
    });

    // TC-AC6-001 through TC-AC6-006: Batch processing tests
    it('should batch vectors in groups of 100', async () => {
      const vectors = generateMockVectorBatch('doc-1', 250);

      await upsertVectors('test-ns', vectors);

      expect(mockClient.mocks.upsert).toHaveBeenCalledTimes(3);
      expect(mockClient.mocks.upsert.mock.calls[0][0].vectors).toHaveLength(100);
      expect(mockClient.mocks.upsert.mock.calls[1][0].vectors).toHaveLength(100);
      expect(mockClient.mocks.upsert.mock.calls[2][0].vectors).toHaveLength(50);
    });

    // Error handling tests
    it('should retry on 429 rate limiting', async () => {
      vi.useFakeTimers();

      mockClient.mocks.upsert
        .mockRejectedValueOnce({ statusCode: 429 })
        .mockResolvedValueOnce({ upsertedCount: 10 });

      const vectors = generateMockVectorBatch('doc-1', 10);
      const promise = upsertVectors('test-ns', vectors);

      await vi.runAllTimersAsync();
      await expect(promise).resolves.not.toThrow();

      expect(mockClient.mocks.upsert).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('queryVectors', () => {
    // TC-AC2-001 through TC-AC2-006
    it('should query vectors successfully', async () => {
      const mockResults = generateMockQueryResults(5);
      mockClient.mocks.query.mockResolvedValue({ matches: mockResults });

      const results = await queryVectors('test-ns', Array(1536).fill(0.1), 5);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('metadata');
    });

    it('should use default topK of 10', async () => {
      await queryVectors('test-ns', Array(1536).fill(0.1));

      expect(mockClient.mocks.query).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 10 })
      );
    });

    it('should validate namespace before querying', async () => {
      await expect(queryVectors('INVALID', Array(1536).fill(0.1)))
        .rejects.toThrow(PineconeValidationError);
    });
  });

  describe('deleteNamespace', () => {
    // TC-AC3-001 through TC-AC3-005
    it('should delete namespace successfully', async () => {
      await deleteNamespace('test-ns');

      expect(mockClient.mocks.deleteAll).toHaveBeenCalled();
    });

    it('should be idempotent for non-existent namespace', async () => {
      await expect(deleteNamespace('nonexistent'))
        .resolves.not.toThrow();
    });
  });

  describe('getNamespaceStats', () => {
    // TC-AC7-001 through TC-AC7-004
    it('should return stats for existing namespace', async () => {
      mockClient.mocks.describeIndexStats.mockResolvedValue({
        namespaces: { 'test-ns': { vectorCount: 150 } },
        dimension: 1536,
      });

      const stats = await getNamespaceStats('test-ns');

      expect(stats).toEqual({
        vectorCount: 150,
        dimension: 1536,
      });
    });

    it('should return zero for empty namespace', async () => {
      mockClient.mocks.describeIndexStats.mockResolvedValue({
        namespaces: { 'test-ns': { vectorCount: 0 } },
        dimension: 1536,
      });

      const stats = await getNamespaceStats('test-ns');

      expect(stats.vectorCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    // Edge-001 through Edge-005
    it('should accept zero vector values', async () => {
      const vector = generateMockVectorRecord('doc-1', 0, {
        values: Array(1536).fill(0),
      });

      await expect(upsertVectors('test-ns', [vector]))
        .resolves.not.toThrow();
    });

    it('should reject NaN vector values', async () => {
      const vector = generateMockVectorRecord('doc-1', 0, {
        values: Array(1536).fill(NaN),
      });

      await expect(upsertVectors('test-ns', [vector]))
        .rejects.toThrow(PineconeValidationError);
    });

    it('should reject Infinity vector values', async () => {
      const vector = generateMockVectorRecord('doc-1', 0, {
        values: Array(1536).fill(Infinity),
      });

      await expect(upsertVectors('test-ns', [vector]))
        .rejects.toThrow(PineconeValidationError);
    });
  });

  describe('Error Handling', () => {
    // Error-001 through Error-008
    it('should handle network timeout', async () => {
      const timeoutClient = createMockPineconeClient({ shouldTimeout: true });

      await expect(upsertVectors('test-ns', [generateMockVectorRecord('doc-1', 0)]))
        .rejects.toThrow(PineconeTimeoutError);
    });

    it('should not retry on 401 authentication error', async () => {
      mockClient.mocks.upsert.mockRejectedValue({ statusCode: 401 });

      await expect(upsertVectors('test-ns', [generateMockVectorRecord('doc-1', 0)]))
        .rejects.toThrow();

      expect(mockClient.mocks.upsert).toHaveBeenCalledTimes(1);
    });

    it('should throw quota error on 402', async () => {
      mockClient.mocks.upsert.mockRejectedValue({ statusCode: 402 });

      await expect(upsertVectors('test-ns', [generateMockVectorRecord('doc-1', 0)]))
        .rejects.toThrow(PineconeQuotaError);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    // MT-001 through MT-003
    it('should isolate vectors by namespace', async () => {
      const ns1Vectors = generateMockVectorBatch('doc-1', 10);
      const ns2Vectors = generateMockVectorBatch('doc-2', 10);

      await upsertVectors('namespace-1', ns1Vectors);
      await upsertVectors('namespace-2', ns2Vectors);

      const calls = mockClient.mocks.namespace.mock.calls;
      expect(calls[0][0]).toBe('namespace-1');
      expect(calls[1][0]).toBe('namespace-2');
    });
  });
});
```

### 2. Integration Tests: `src/services/__tests__/pineconeService.integration.test.ts`

**Purpose**: Validate real Pinecone API interactions (manual execution only)

**Structure**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  getNamespaceStats,
} from '../pineconeService';
import { generateMockVectorBatch } from './fixtures/mockVectorData';
import { generateTestNamespace } from './fixtures/testNamespaces';

// Skip integration tests if flag is set or no API key
const shouldSkip =
  process.env.SKIP_PINECONE_INTEGRATION_TESTS === 'true' ||
  !process.env.PINECONE_API_KEY ||
  process.env.PINECONE_API_KEY === 'test-pinecone-api-key';

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('Integration: pineconeService with real Pinecone API', () => {
  let testNamespace: string;

  beforeAll(() => {
    testNamespace = generateTestNamespace('integration');
    console.log(`🧪 Using test namespace: ${testNamespace}`);
  });

  afterAll(async () => {
    // Cleanup: Delete test namespace
    try {
      await deleteNamespace(testNamespace);
      console.log(`✅ Cleaned up test namespace: ${testNamespace}`);
    } catch (error) {
      console.error(`⚠️  Failed to cleanup namespace: ${error}`);
    }
  });

  it('should upsert and query vectors end-to-end', async () => {
    // Upsert test vectors
    const vectors = generateMockVectorBatch('integration-doc-1', 50);
    await upsertVectors(testNamespace, vectors);

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Query vectors
    const queryEmbedding = vectors[0].values;
    const results = await queryVectors(testNamespace, queryEmbedding, 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(vectors[0].id);
    expect(results[0].score).toBeGreaterThan(0.9); // High similarity to itself
  }, 30000);

  it('should handle batch upsert of 250 vectors', async () => {
    const vectors = generateMockVectorBatch('integration-doc-2', 250);

    const startTime = Date.now();
    await upsertVectors(testNamespace, vectors);
    const duration = Date.now() - startTime;

    console.log(`⏱️  Upserted 250 vectors in ${duration}ms`);
    expect(duration).toBeLessThan(20000); // Should complete in <20s
  }, 30000);

  it('should retrieve accurate namespace statistics', async () => {
    const stats = await getNamespaceStats(testNamespace);

    expect(stats.vectorCount).toBeGreaterThan(0);
    expect(stats.dimension).toBe(1536);
  }, 10000);

  it('should delete namespace completely', async () => {
    const tempNamespace = generateTestNamespace('temp');
    const vectors = generateMockVectorBatch('temp-doc', 10);

    // Create vectors
    await upsertVectors(tempNamespace, vectors);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Delete namespace
    await deleteNamespace(tempNamespace);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify deletion
    const stats = await getNamespaceStats(tempNamespace);
    expect(stats.vectorCount).toBe(0);
  }, 15000);
});

if (shouldSkip) {
  console.log(`
ℹ️  Pinecone integration tests are skipped.

To run integration tests locally:
1. Set PINECONE_API_KEY environment variable
2. Set PINECONE_INDEX environment variable
3. Run: SKIP_PINECONE_INTEGRATION_TESTS=false npm test -- pineconeService.integration

Note: Integration tests make real API calls and may incur costs.
  `);
}
```

### 3. Performance Tests: `src/services/__tests__/pineconeService.performance.test.ts`

**Purpose**: Benchmark performance and validate latency requirements

**Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import {
  upsertVectors,
  queryVectors,
  deleteNamespace,
  getNamespaceStats,
} from '../pineconeService';
import { generateMockVectorBatch } from './fixtures/mockVectorData';
import { generateTestNamespace } from './fixtures/testNamespaces';

// Performance tests only run when explicitly enabled
const shouldRun = process.env.RUN_PERFORMANCE_TESTS === 'true';

const describeOrSkip = shouldRun ? describe : describe.skip;

describeOrSkip('Performance: pineconeService benchmarks', () => {
  describe('Batch Upsert Performance', () => {
    // Perf-001
    it('should upsert 100 vectors within 5s', async () => {
      const namespace = generateTestNamespace('perf');
      const vectors = generateMockVectorBatch('perf-doc-1', 100);

      const startTime = Date.now();
      await upsertVectors(namespace, vectors);
      const duration = Date.now() - startTime;

      console.log(`⏱️  100 vectors: ${duration}ms`);
      expect(duration).toBeLessThan(5000);

      await deleteNamespace(namespace);
    }, 10000);

    it('should upsert 1000 vectors within 20s', async () => {
      const namespace = generateTestNamespace('perf');
      const vectors = generateMockVectorBatch('perf-doc-2', 1000);

      const startTime = Date.now();
      await upsertVectors(namespace, vectors);
      const duration = Date.now() - startTime;

      const throughput = (1000 / duration) * 1000; // vectors/second
      console.log(`⏱️  1000 vectors: ${duration}ms (${throughput.toFixed(0)} vectors/sec)`);
      expect(duration).toBeLessThan(20000);

      await deleteNamespace(namespace);
    }, 30000);
  });

  describe('Query Performance', () => {
    // Perf-002
    it('should query within 1s', async () => {
      const namespace = generateTestNamespace('perf');
      const vectors = generateMockVectorBatch('perf-doc-3', 100);
      await upsertVectors(namespace, vectors);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const startTime = Date.now();
      await queryVectors(namespace, vectors[0].values, 10);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Query: ${duration}ms`);
      expect(duration).toBeLessThan(1000);

      await deleteNamespace(namespace);
    }, 15000);
  });

  describe('Concurrent Operations', () => {
    // Perf-003
    it('should handle 5 concurrent upserts efficiently', async () => {
      const namespaces = Array.from({ length: 5 }, (_, i) =>
        generateTestNamespace(`concurrent-${i}`)
      );

      const operations = namespaces.map(ns => {
        const vectors = generateMockVectorBatch(`concurrent-doc-${ns}`, 100);
        return upsertVectors(ns, vectors);
      });

      const startTime = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - startTime;

      console.log(`⏱️  5 concurrent upserts: ${duration}ms`);
      expect(duration).toBeLessThan(30000);

      // Cleanup
      await Promise.all(namespaces.map(ns => deleteNamespace(ns)));
    }, 45000);
  });
});

if (!shouldRun) {
  console.log(`
ℹ️  Performance tests are skipped.

To run performance tests:
RUN_PERFORMANCE_TESTS=true npm test -- pineconeService.performance
  `);
}
```

---

## Configuration Changes

### 1. Update `vitest.config.ts`

No changes needed - existing configuration supports the test structure.

### 2. Add Integration Test Config: `vitest.integration.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.integration.test.{ts,tsx}'],
    testTimeout: 60000, // Longer timeout for integration tests
    watch: false,
    globals: true,
    environment: 'node',
  },
});
```

### 3. Update `package.json` Scripts

Add new test scripts:
```json
{
  "scripts": {
    "test:pinecone": "vitest run src/services/__tests__/pineconeService.test.ts",
    "test:pinecone:integration": "SKIP_PINECONE_INTEGRATION_TESTS=false vitest run src/services/__tests__/pineconeService.integration.test.ts",
    "test:pinecone:performance": "RUN_PERFORMANCE_TESTS=true vitest run src/services/__tests__/pineconeService.performance.test.ts",
    "test:pinecone:all": "npm run test:pinecone && npm run test:pinecone:integration && npm run test:pinecone:performance"
  }
}
```

### 4. Update `.env.example`

Add Pinecone environment variables:
```bash
# Pinecone Vector Store Service (INTEL-003)
# API key for Pinecone vector database operations
PINECONE_API_KEY=your_pinecone_api_key
# Pinecone index name (must already exist)
PINECONE_INDEX=your_pinecone_index_name
# Pinecone environment (e.g., us-east-1-aws, us-west-2-aws)
PINECONE_ENVIRONMENT=us-east-1-aws
```

---

## Type Definitions

### Create: `src/types/pinecone.ts`

```typescript
/**
 * Pinecone Service Types (INTEL-003)
 */

// ============================================================================
// Vector Types
// ============================================================================

/**
 * Vector record with metadata
 */
export interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    text: string;
    documentId: string;
    pageNumber?: number;
    chunkIndex: number;
    [key: string]: any;
  };
}

/**
 * Query result from Pinecone
 */
export interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Namespace statistics
 */
export interface NamespaceStats {
  vectorCount: number;
  dimension: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for Pinecone operations
 */
export class PineconeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'PineconeError';
  }
}

/**
 * Validation error
 */
export class PineconeValidationError extends PineconeError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'PineconeValidationError';
  }
}

/**
 * API error
 */
export class PineconeAPIError extends PineconeError {
  constructor(message: string, statusCode: number) {
    super(message, 'API_ERROR', statusCode);
    this.name = 'PineconeAPIError';
  }
}

/**
 * Timeout error
 */
export class PineconeTimeoutError extends PineconeError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT_ERROR', 408);
    this.name = 'PineconeTimeoutError';
  }
}

/**
 * Authentication error
 */
export class PineconeAuthError extends PineconeError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'PineconeAuthError';
  }
}

/**
 * Quota exceeded error
 */
export class PineconeQuotaError extends PineconeError {
  constructor(message: string = 'Quota exceeded') {
    super(message, 'QUOTA_ERROR', 402);
    this.name = 'PineconeQuotaError';
  }
}

/**
 * Configuration error
 */
export class PineconeConfigError extends PineconeError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'PineconeConfigError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Upsert options
 */
export interface UpsertOptions {
  batchSize?: number; // Default: 100
  maxConcurrent?: number; // Default: 5
  timeout?: number; // Default: 30000ms
}

/**
 * Query options
 */
export interface QueryOptions {
  topK?: number; // Default: 10
  includeMetadata?: boolean; // Default: true
  includeValues?: boolean; // Default: false
}
```

---

## Test Execution Strategy

### 1. Development Workflow

**During Development:**
```bash
# Run unit tests in watch mode
npm run test:watch -- pineconeService.test.ts

# Run specific test
npm test -- -t "should upsert vectors successfully"
```

**Before Commit:**
```bash
# Run all unit tests
npm run test:pinecone

# Check coverage
npm run test:coverage -- pineconeService.test.ts
```

### 2. Pre-Integration Testing

**Manual Integration Test (Local):**
```bash
# Set environment variables
export PINECONE_API_KEY=your_real_api_key
export PINECONE_INDEX=your_test_index
export SKIP_PINECONE_INTEGRATION_TESTS=false

# Run integration tests
npm run test:pinecone:integration
```

**Performance Benchmarking:**
```bash
# Run performance tests
npm run test:pinecone:performance
```

### 3. CI/CD Pipeline

**GitHub Actions Workflow** (`.github/workflows/test.yml`):
```yaml
name: Test Pinecone Service

on:
  push:
    paths:
      - 'src/services/pineconeService.ts'
      - 'src/services/__tests__/pineconeService.test.ts'
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci --legacy-peer-deps
      - run: npm run test:pinecone
      - run: npm run test:coverage -- pineconeService.test.ts

  # Integration tests only run manually or on release branches
  integration-tests:
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/release/*'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci --legacy-peer-deps
      - run: npm run test:pinecone:integration
        env:
          PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
          PINECONE_INDEX: ${{ secrets.PINECONE_INDEX }}
          SKIP_PINECONE_INTEGRATION_TESTS: false
```

---

## Critical Notes and Troubleshooting

### Next.js 15 / React 19 Considerations

1. **Async API Compatibility**:
   - Service should work in both Server Components and API routes
   - No use of `cookies()` or `params` in service layer
   - Pure Node.js service - no React-specific APIs

2. **Import Restrictions**:
   - Service can be imported in both server and client contexts
   - Ensure environment variables are server-side only

### Pinecone-Specific Considerations

1. **Index Configuration**:
   - Dimension must match embedding model (1536 for text-embedding-ada-002)
   - Index must be created before running tests
   - Cannot change dimension after index creation

2. **Rate Limiting**:
   - Free tier: 5 requests/second
   - Paid tier: Higher limits
   - Tests should handle 429 gracefully

3. **Eventual Consistency**:
   - Vectors may not be immediately queryable after upsert
   - Integration tests should include wait time (~2s)

4. **Namespace Limitations**:
   - Lowercase alphanumeric and hyphens only
   - Max 63 characters
   - Cannot use reserved keywords

### Mock Strategy Considerations

1. **Deterministic Testing**:
   - Use fixed seed for random vector generation in tests
   - Mock responses should match actual Pinecone API structure

2. **Error Simulation**:
   - Test retry logic with fake timers
   - Simulate all error codes (401, 402, 404, 429, 500, etc.)

3. **Performance Testing**:
   - Performance tests may be flaky in CI
   - Run performance tests manually before releases

### Common Issues and Solutions

**Issue 1: Integration Tests Timeout**
- **Cause**: Pinecone API slow or rate limiting
- **Solution**: Increase test timeout, reduce vector count, add delays

**Issue 2: Dimension Mismatch Errors**
- **Cause**: Index dimension doesn't match vector dimension
- **Solution**: Verify index configuration, use correct embedding model

**Issue 3: Namespace Not Found**
- **Cause**: Namespace doesn't exist or deleted
- **Solution**: Ensure test creates namespace before querying

**Issue 4: Memory Issues in Large Batches**
- **Cause**: Loading too many vectors in memory
- **Solution**: Use streaming or smaller batch sizes

**Issue 5: Mock Not Being Called**
- **Cause**: Mock setup incorrect or module not mocked
- **Solution**: Verify vi.mock() is before imports, check mock return structure

---

## Next Steps and Implementation Priority

### Phase 1: Core Unit Tests (Priority: P0)
1. Implement namespace validation tests (AC5)
2. Implement upsert tests with mocking (AC1, AC4)
3. Implement query tests (AC2)
4. Implement delete tests (AC3)
5. Implement stats tests (AC7)

### Phase 2: Error Handling (Priority: P0)
1. Implement retry logic tests
2. Implement error type tests
3. Implement edge case tests

### Phase 3: Integration Tests (Priority: P1)
1. Create integration test file
2. Implement end-to-end tests
3. Manual testing with real API

### Phase 4: Performance Tests (Priority: P2)
1. Create performance test file
2. Implement benchmark tests
3. Document performance baselines

### Phase 5: CI/CD Integration (Priority: P1)
1. Add GitHub Actions workflow
2. Configure test environments
3. Set up coverage reporting

---

## Acceptance Criteria Validation Checklist

- [ ] **AC1**: Unit tests validate upsert with namespace isolation
- [ ] **AC2**: Unit tests validate query within namespace with topK
- [ ] **AC3**: Unit tests validate namespace deletion without affecting others
- [ ] **AC4**: Unit tests validate deduplication logic for duplicate IDs
- [ ] **AC5**: Unit tests validate all namespace format rules (7 test cases)
- [ ] **AC6**: Unit tests validate batch processing for 100+ vectors
- [ ] **AC7**: Unit tests validate namespace statistics retrieval
- [ ] All error scenarios have test coverage
- [ ] All edge cases have test coverage
- [ ] Integration tests pass with real Pinecone API (manual)
- [ ] Performance benchmarks meet targets
- [ ] Code coverage >80% (lines, functions, statements)
- [ ] Code coverage >75% (branches)

---

## Documentation and Reporting

### Test Documentation

Each test should include:
- Clear description of what is being tested
- Link to acceptance criteria (e.g., `// TC-AC1-001`)
- Expected behavior
- Edge cases considered

### Coverage Reports

Generate coverage reports:
```bash
npm run test:coverage -- pineconeService.test.ts
```

Review coverage report:
- Open `coverage/index.html` in browser
- Verify all functions have >80% coverage
- Identify untested branches

### Test Metrics

Track metrics:
- Total test count
- Tests per acceptance criteria
- Execution time
- Coverage percentage
- Integration test success rate

---

## Conclusion

This comprehensive testing strategy ensures the Pinecone Vector Store Service is production-ready with robust error handling, validation, and performance characteristics. The test suite provides confidence in multi-tenant isolation, batch processing optimization, and integration with the broader IntelliAA platform.

**Estimated Implementation Time:**
- Phase 1 (Core Unit Tests): 4-6 hours
- Phase 2 (Error Handling): 2-3 hours
- Phase 3 (Integration Tests): 2-3 hours
- Phase 4 (Performance Tests): 2-3 hours
- Phase 5 (CI/CD): 1-2 hours

**Total**: 11-17 hours

**Coverage Target**: Achieve >80% coverage with this strategy, focusing on critical paths and error scenarios.