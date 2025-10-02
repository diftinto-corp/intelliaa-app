# Test Fixtures for Embedding Service

This directory contains PDF fixtures for testing the Vercel AI SDK Embedding Service (INTEL-001).

## Fixtures

### 1. `small.pdf`
- **Size:** ~5 pages
- **Purpose:** Test basic functionality with a small document
- **Expected chunks:** ~3-5 chunks
- **Use case:** Quick tests, happy path scenarios

### 2. `medium.pdf`
- **Size:** ~20 pages
- **Purpose:** Test typical document size
- **Expected chunks:** ~15-20 chunks
- **Use case:** Performance testing, cost calculation validation

### 3. `large.pdf`
- **Size:** ~100 pages
- **Purpose:** Test handling of large documents
- **Expected chunks:** ~100-150 chunks
- **Use case:** Stress testing, batch processing validation

### 4. `unicode.pdf`
- **Size:** ~5 pages
- **Content:** Special characters, emojis, non-Latin scripts
- **Purpose:** Test text encoding and Unicode handling
- **Use case:** Internationalization tests

### 5. `empty.pdf`
- **Size:** 0 KB
- **Purpose:** Test empty file validation
- **Expected:** Should throw `EmbeddingValidationError`

### 6. `corrupted.pdf`
- **Size:** ~10 KB
- **Content:** Invalid PDF structure
- **Purpose:** Test error handling for corrupted files
- **Expected:** Should throw `EmbeddingParseError`

### 7. `no-text.pdf`
- **Size:** ~5 pages
- **Content:** Images only, no extractable text
- **Purpose:** Test handling of image-only PDFs
- **Expected:** Should throw `EmbeddingParseError` with message about no extractable text

## Generating Fixtures

Since we can't commit large binary files, test fixtures should be generated locally:

```bash
# Run the fixture generator script
npm run generate-fixtures
```

Or manually create test PDFs using online tools:
- https://www.pdf24.org/en/create-pdf
- https://www.sejda.com/pdf-maker

## Usage in Tests

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, 'fixtures');
const smallPdf = readFileSync(join(fixturesDir, 'small.pdf'));
const result = await generateEmbeddings(smallPdf);
```

## Notes

- Fixtures are `.gitignore`d to keep repository size small
- Tests will skip if fixtures are not present (with a warning)
- Integration tests require fixtures to run
- Unit tests use mocked data and don't need fixtures
