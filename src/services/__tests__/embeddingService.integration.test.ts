/**
 * Integration Tests for Embedding Service (INTEL-001)
 *
 * These tests make REAL API calls to OpenAI and should:
 * - Only run locally (skipped in CI)
 * - Require OPENAI_API_KEY environment variable
 * - Cost a small amount of money (~$0.025 per full run)
 *
 * Run with: npm run test:integration
 * Skip with: SKIP_INTEGRATION_TESTS=true npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateEmbeddings } from '../embeddingService';
import {
  EmbeddingValidationError,
  EmbeddingParseError,
} from '@/types/embeddings';

// Skip integration tests if flag is set or no API key
const shouldSkip =
  process.env.SKIP_INTEGRATION_TESTS === 'true' ||
  !process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY === 'sk-test-key-for-testing';

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('Integration: embeddingService with real OpenAI API', () => {
  const fixturesDir = join(__dirname, 'fixtures');

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        '⚠️  Skipping integration tests: OPENAI_API_KEY not set'
      );
    }
  });

  it('should generate embeddings for a small PDF', async () => {
    const smallPdfPath = join(fixturesDir, 'small.pdf');

    if (!existsSync(smallPdfPath)) {
      console.warn('⚠️  Small PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(smallPdfPath);
    const result = await generateEmbeddings(pdfBuffer, {
      model: 'text-embedding-ada-002',
      chunkSize: 1500,
      chunkOverlap: 750,
    });

    // Verify results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);

    // Verify embedding structure
    result.results.forEach((embedding) => {
      expect(embedding.text).toBeDefined();
      expect(embedding.text.length).toBeGreaterThan(0);
      expect(embedding.embedding).toBeDefined();
      expect(embedding.embedding.length).toBe(1536); // ada-002 dimension
      expect(embedding.metadata).toBeDefined();
      expect(embedding.metadata.chunkIndex).toBeGreaterThanOrEqual(0);
      expect(embedding.metadata.totalChunks).toBeGreaterThan(0);
    });

    // Verify usage statistics
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.usage.estimatedCost).toBeGreaterThan(0);
    expect(result.usage.processingTime).toBeGreaterThan(0);
    expect(result.usage.chunkCount).toBe(result.results.length);
    expect(result.usage.model).toBe('text-embedding-ada-002');

    console.log(`✅ Generated ${result.results.length} embeddings`);
    console.log(`💰 Cost: $${result.usage.estimatedCost.toFixed(6)}`);
    console.log(`⏱️  Time: ${result.usage.processingTime}ms`);
  }, 30000); // 30 second timeout

  it('should handle medium-sized PDFs efficiently', async () => {
    const mediumPdfPath = join(fixturesDir, 'medium.pdf');

    if (!existsSync(mediumPdfPath)) {
      console.warn('⚠️  Medium PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(mediumPdfPath);
    const startTime = Date.now();

    const result = await generateEmbeddings(pdfBuffer);

    const actualTime = Date.now() - startTime;

    expect(result.results.length).toBeGreaterThan(10);
    expect(result.usage.estimatedCost).toBeLessThan(0.01); // Should be under 1 cent

    // Verify performance (should complete in reasonable time)
    expect(actualTime).toBeLessThan(15000); // 15 seconds max

    console.log(`✅ Processed medium PDF: ${result.results.length} chunks`);
    console.log(`💰 Cost: $${result.usage.estimatedCost.toFixed(6)}`);
    console.log(`⏱️  Time: ${actualTime}ms`);
  }, 30000);

  it('should handle Unicode content correctly', async () => {
    const unicodePdfPath = join(fixturesDir, 'unicode.pdf');

    if (!existsSync(unicodePdfPath)) {
      console.warn('⚠️  Unicode PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(unicodePdfPath);
    const result = await generateEmbeddings(pdfBuffer);

    expect(result.results.length).toBeGreaterThan(0);

    // Verify embeddings are valid numbers
    result.results.forEach((embedding) => {
      expect(embedding.embedding).toBeDefined();
      expect(embedding.embedding.length).toBe(1536);
      embedding.embedding.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });

    console.log('✅ Unicode content handled correctly');
  }, 30000);

  it('should throw error for empty PDF', async () => {
    const emptyPdfPath = join(fixturesDir, 'empty.pdf');

    if (!existsSync(emptyPdfPath)) {
      console.warn('⚠️  Empty PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(emptyPdfPath);

    await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow();
  }, 10000);

  it('should throw error for corrupted PDF', async () => {
    const corruptedPdfPath = join(fixturesDir, 'corrupted.pdf');

    if (!existsSync(corruptedPdfPath)) {
      console.warn('⚠️  Corrupted PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(corruptedPdfPath);

    await expect(generateEmbeddings(pdfBuffer)).rejects.toThrow(
      EmbeddingParseError
    );
  }, 10000);

  it('should use text-embedding-3-small model when specified', async () => {
    const smallPdfPath = join(fixturesDir, 'small.pdf');

    if (!existsSync(smallPdfPath)) {
      console.warn('⚠️  Small PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(smallPdfPath);
    const result = await generateEmbeddings(pdfBuffer, {
      model: 'text-embedding-3-small',
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.usage.model).toBe('text-embedding-3-small');

    // v3-small is cheaper than ada-002
    const expectedMaxCost = (result.usage.totalTokens / 1000) * 0.00002 * 1.5;
    expect(result.usage.estimatedCost).toBeLessThan(expectedMaxCost);

    console.log('✅ Used text-embedding-3-small model');
    console.log(`💰 Cost: $${result.usage.estimatedCost.toFixed(6)}`);
  }, 30000);

  it('should respect custom chunk size', async () => {
    const smallPdfPath = join(fixturesDir, 'small.pdf');

    if (!existsSync(smallPdfPath)) {
      console.warn('⚠️  Small PDF fixture not found, skipping test');
      return;
    }

    const pdfBuffer = readFileSync(smallPdfPath);

    // Test with larger chunks
    const result1 = await generateEmbeddings(pdfBuffer, {
      chunkSize: 3000,
      chunkOverlap: 500,
    });

    // Test with smaller chunks
    const result2 = await generateEmbeddings(pdfBuffer, {
      chunkSize: 500,
      chunkOverlap: 100,
    });

    // Smaller chunks should produce more chunks for same document
    expect(result2.results.length).toBeGreaterThan(result1.results.length);

    console.log(
      `✅ Large chunks: ${result1.results.length}, Small chunks: ${result2.results.length}`
    );
  }, 60000);
});

// Add note about running integration tests
if (shouldSkip) {
  console.log(`
ℹ️  Integration tests are skipped.

To run integration tests locally:
1. Set OPENAI_API_KEY environment variable
2. Generate test fixtures (see fixtures/README.md)
3. Run: npm run test:integration

Note: Integration tests will make real API calls and cost ~$0.025
  `);
}
