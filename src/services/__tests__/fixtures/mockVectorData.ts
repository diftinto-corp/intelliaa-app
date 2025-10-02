/**
 * Mock Vector Data Fixtures
 * Test data for Pinecone service tests
 */

import { VectorRecord } from '@/services/pineconeService';

/**
 * Generate deterministic embedding values for testing
 */
export function generateMockEmbedding(dimension: number = 1536, seed: number = 0): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dimension; i++) {
    // Generate deterministic values based on seed
    embedding.push(Math.sin(seed + i) * 0.5);
  }
  return embedding;
}

/**
 * Create a single mock vector record
 */
export function createMockVector(
  documentId: string = 'doc1',
  chunkIndex: number = 0,
  text: string = 'Sample text content'
): VectorRecord {
  return {
    id: `${documentId}-chunk-${chunkIndex}`,
    values: generateMockEmbedding(1536, chunkIndex),
    metadata: {
      text,
      documentId,
      chunkIndex,
      totalChunks: 5,
      pageNumber: Math.floor(chunkIndex / 2) + 1,
    },
  };
}

/**
 * Create multiple mock vectors for a document
 */
export function createMockVectors(
  documentId: string = 'doc1',
  count: number = 5
): VectorRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockVector(documentId, i, `Text content for chunk ${i}`)
  );
}

/**
 * Create mock vectors with specific dimensions
 */
export function createMockVectorsWithDimension(
  dimension: number,
  count: number = 1
): VectorRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-vector-${i}`,
    values: generateMockEmbedding(dimension, i),
    metadata: {
      text: `Text content ${i}`,
      documentId: 'test-doc',
      chunkIndex: i,
    },
  }));
}

/**
 * Create large batch of mock vectors for performance testing
 */
export function createLargeBatchVectors(count: number): VectorRecord[] {
  const vectors: VectorRecord[] = [];
  const docsCount = Math.ceil(count / 10);

  for (let docIdx = 0; docIdx < docsCount; docIdx++) {
    const docId = `doc-${docIdx}`;
    const chunksInDoc = Math.min(10, count - docIdx * 10);

    for (let chunkIdx = 0; chunkIdx < chunksInDoc; chunkIdx++) {
      vectors.push(createMockVector(docId, chunkIdx, `Content for ${docId} chunk ${chunkIdx}`));
    }
  }

  return vectors;
}

/**
 * Create vectors with duplicate IDs for deduplication testing
 */
export function createVectorsWithDuplicates(): VectorRecord[] {
  return [
    createMockVector('doc1', 0, 'Original text'),
    createMockVector('doc1', 1, 'Different text'),
    createMockVector('doc1', 0, 'Updated text'), // Duplicate ID
    createMockVector('doc1', 2, 'More text'),
  ];
}

/**
 * Create invalid vectors for error testing
 */
export const invalidVectors = {
  missingId: {
    id: '',
    values: generateMockEmbedding(),
    metadata: {
      text: 'Text',
      documentId: 'doc1',
      chunkIndex: 0,
    },
  } as VectorRecord,

  missingValues: {
    id: 'test-1',
    values: [],
    metadata: {
      text: 'Text',
      documentId: 'doc1',
      chunkIndex: 0,
    },
  } as VectorRecord,

  invalidValues: {
    id: 'test-1',
    values: [1, 2, NaN, 4, Infinity],
    metadata: {
      text: 'Text',
      documentId: 'doc1',
      chunkIndex: 0,
    },
  } as VectorRecord,

  missingMetadata: {
    id: 'test-1',
    values: generateMockEmbedding(),
    metadata: {} as any,
  } as VectorRecord,

  missingText: {
    id: 'test-1',
    values: generateMockEmbedding(),
    metadata: {
      documentId: 'doc1',
      chunkIndex: 0,
    } as any,
  } as VectorRecord,

  missingDocumentId: {
    id: 'test-1',
    values: generateMockEmbedding(),
    metadata: {
      text: 'Text',
      chunkIndex: 0,
    } as any,
  } as VectorRecord,

  missingChunkIndex: {
    id: 'test-1',
    values: generateMockEmbedding(),
    metadata: {
      text: 'Text',
      documentId: 'doc1',
    } as any,
  } as VectorRecord,

  invalidChunkIndex: {
    id: 'test-1',
    values: generateMockEmbedding(),
    metadata: {
      text: 'Text',
      documentId: 'doc1',
      chunkIndex: -1,
    },
  } as VectorRecord,
};
