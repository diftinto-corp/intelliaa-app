# Vercel AI SDK Embedding Service - Usage Guide

> **INTEL-001**: Self-contained document embedding service using Vercel AI SDK and OpenAI

This guide provides comprehensive documentation for using the embedding service in the IntelliAA platform.

## Quick Start

```typescript
import { generateEmbeddings } from '@/services/embeddingService';

// Read PDF file
const pdfBuffer = await file.arrayBuffer();
const buffer = Buffer.from(pdfBuffer);

// Generate embeddings
const result = await generateEmbeddings(buffer, {
  model: 'text-embedding-ada-002',
  chunkSize: 1500,
  chunkOverlap: 750,
});

// Access results
console.log(`Generated ${result.results.length} embeddings`);
console.log(`Cost: $${result.usage.estimatedCost.toFixed(6)}`);
```

## Configuration Options

```typescript
interface EmbeddingServiceConfig {
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  chunkSize?: number; // default: 1500
  chunkOverlap?: number; // default: 750
  maxRetries?: number; // default: 2
  abortSignal?: AbortSignal;
  metadata?: Record<string, any>;
}
```

## Model Comparison

| Model | Dimensions | Cost (per 1K tokens) | Use Case |
|-------|------------|---------------------|----------|
| `text-embedding-ada-002` | 1536 | $0.0001 | Default, proven |
| `text-embedding-3-small` | 1536 | $0.00002 | 5x cheaper |
| `text-embedding-3-large` | 3072 | $0.00013 | Highest quality |

## Error Handling

```typescript
import {
  EmbeddingValidationError,
  EmbeddingParseError,
  EmbeddingAPIError,
  EmbeddingRateLimitError,
} from '@/types/embeddings';

try {
  const result = await generateEmbeddings(pdfBuffer);
} catch (error) {
  if (error instanceof EmbeddingValidationError) {
    // Invalid file (wrong type, too large)
  } else if (error instanceof EmbeddingParseError) {
    // PDF parsing failed
  } else if (error instanceof EmbeddingRateLimitError) {
    // Rate limit exceeded
  }
}
```

## Integration with Document Actions

The service integrates automatically via feature flags:

```typescript
import { shouldUseVercelEmbeddings } from '@/lib/featureFlags';

const useVercel = await shouldUseVercelEmbeddings(accountId);
// Returns true/false based on feature flag configuration
```

## Feature Flag Control

### Account-Level

```sql
-- Enable for specific account
UPDATE accounts SET use_vercel_embeddings = true
WHERE id = 'account-uuid';
```

### Global Rollout

```sql
-- Gradual rollout (10% of accounts)
UPDATE feature_flags SET enabled_percentage = 10
WHERE feature_name = 'vercel_embeddings';
```

### Whitelist/Blacklist

```sql
-- Always enable for test account
UPDATE feature_flags
SET enabled_accounts = array_append(enabled_accounts, 'test-uuid')
WHERE feature_name = 'vercel_embeddings';
```

## Cost Tracking

```typescript
import { getTotalEmbeddingCost, checkUsageLimit } from '@/lib/actions/intelliaa/embeddings';

// Get monthly cost
const cost = await getTotalEmbeddingCost(accountId);

// Check limits
const status = await checkUsageLimit(accountId, 10.00);
if (status.exceeded) {
  console.warn(`Exceeded limit: ${status.percentage}%`);
}
```

## Performance Benchmarks

| Document Size | Chunks | Time | Cost |
|--------------|--------|------|------|
| Small (5 pages) | 3-5 | 2.5-3.5s | $0.0008 |
| Medium (20 pages) | 15-20 | 6-9s | $0.003 |
| Large (100 pages) | 100-150 | 22-33s | $0.015 |

## Testing

```bash
# Unit tests (fast, free)
npm test

# Coverage report
npm run test:coverage

# Integration tests (costs ~$0.025)
npm run test:integration
```

## Troubleshooting

**"File is not a valid PDF"**
- Ensure file starts with `%PDF` magic number

**"PDF contains no extractable text"**
- PDF has only images, needs OCR

**"Rate limit exceeded (429)"**
- SDK automatically retries with backoff

**Embeddings seem incorrect**
- Check chunk size (min 100 chars)
- Verify PDF text extraction

## Rollback

```sql
-- Emergency rollback (instant)
UPDATE feature_flags SET enabled_percentage = 0
WHERE feature_name = 'vercel_embeddings';
```

## Support

- User Story: `.claude/user_histories/INTEL-001-vercel-ai-sdk-embedding-service.md`
- Session Context: `.claude/sessions/context_session_INTEL-001.md`
- Testing Plan: `.claude/doc/INTEL-001/testing_implementation_plan.md`
